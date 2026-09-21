import type {
  Calibration,
  Detection,
  Point,
  TrackerSettings,
  TrackingRecord,
  TrackSnapshot,
} from '../types/tracking'
import { distance } from '../utils/geometry'
import { distanceInCentimeters, pointToCentimeters } from './measurements'

interface InternalTrack {
  id: number
  position: Point
  path: Point[]
  totalDistanceCm: number
  firstSeenSec: number
  lastSeenSec: number
  missingFrames: number
  isMoving: boolean
  archived: boolean
}

interface MatchCandidate {
  trackId: number
  detectionIndex: number
  distancePx: number
}

export class CentroidTracker {
  private activeTracks = new Map<number, InternalTrack>()
  private archivedTracks = new Map<number, InternalTrack>()
  private records: TrackingRecord[] = []
  private nextId = 1

  reset(): void {
    this.activeTracks.clear()
    this.archivedTracks.clear()
    this.records = []
    this.nextId = 1
  }

  update(
    detections: Detection[],
    timestampSec: number,
    calibration: Calibration,
    settings: TrackerSettings,
  ): void {
    const candidates: MatchCandidate[] = []
    this.activeTracks.forEach((track) => {
      detections.forEach((detection, detectionIndex) => {
        const distancePx = distance(track.position, detection)
        if (distancePx <= settings.maxMatchDistancePx) {
          candidates.push({ trackId: track.id, detectionIndex, distancePx })
        }
      })
    })
    candidates.sort((a, b) => a.distancePx - b.distancePx)

    const matchedTrackIds = new Set<number>()
    const matchedDetectionIndexes = new Set<number>()
    candidates.forEach((candidate) => {
      if (
        matchedTrackIds.has(candidate.trackId) ||
        matchedDetectionIndexes.has(candidate.detectionIndex)
      ) {
        return
      }
      const track = this.activeTracks.get(candidate.trackId)
      if (!track) return
      this.updateTrack(track, detections[candidate.detectionIndex], timestampSec, calibration, settings)
      matchedTrackIds.add(candidate.trackId)
      matchedDetectionIndexes.add(candidate.detectionIndex)
    })

    this.activeTracks.forEach((track, id) => {
      if (matchedTrackIds.has(id)) return
      track.missingFrames += 1
      track.isMoving = false
      if (track.missingFrames > settings.maxMissingFrames) {
        track.archived = true
        this.archivedTracks.set(id, track)
        this.activeTracks.delete(id)
      }
    })

    detections.forEach((detection, detectionIndex) => {
      if (!matchedDetectionIndexes.has(detectionIndex)) {
        this.createTrack(detection, timestampSec, calibration)
      }
    })
  }

  private createTrack(
    detection: Detection,
    timestampSec: number,
    calibration: Calibration,
  ): void {
    const id = this.nextId
    this.nextId += 1
    const position = { x: detection.x, y: detection.y }
    this.activeTracks.set(id, {
      id,
      position,
      path: [position],
      totalDistanceCm: 0,
      firstSeenSec: timestampSec,
      lastSeenSec: timestampSec,
      missingFrames: 0,
      isMoving: false,
      archived: false,
    })
    this.addRecord(id, position, timestampSec, 0, false, calibration)
  }

  private updateTrack(
    track: InternalTrack,
    detection: Detection,
    timestampSec: number,
    calibration: Calibration,
    settings: TrackerSettings,
  ): void {
    const position = { x: detection.x, y: detection.y }
    const elapsedSinceLastDetection = Math.max(timestampSec - track.lastSeenSec, 0.001)
    const measuredDistance = distanceInCentimeters(track.position, position, calibration)
    const isMoving = measuredDistance >= settings.stationaryDistanceCm
    const countedDistance = isMoving ? measuredDistance : 0
    const speed = countedDistance / elapsedSinceLastDetection

    track.position = position
    track.path.push(position)
    if (track.path.length > settings.trailLength) track.path.shift()
    track.totalDistanceCm += countedDistance
    track.lastSeenSec = timestampSec
    track.missingFrames = 0
    track.isMoving = isMoving
    this.addRecord(track.id, position, timestampSec, speed, isMoving, calibration)
  }

  private addRecord(
    antId: number,
    point: Point,
    timestamp: number,
    speedCmPerSec: number,
    isMoving: boolean,
    calibration: Calibration,
  ): void {
    const centimeters = pointToCentimeters(point, calibration)
    this.records.push({
      timestamp,
      antId,
      xPixel: point.x,
      yPixel: point.y,
      xCm: centimeters.x,
      yCm: centimeters.y,
      speedCmPerSec,
      isMoving,
    })
  }

  getVisibleTracks(timestampSec: number): TrackSnapshot[] {
    return [...this.activeTracks.values()].map((track) => this.toSnapshot(track, timestampSec))
  }

  getAllTracks(timestampSec: number): TrackSnapshot[] {
    return [...this.activeTracks.values(), ...this.archivedTracks.values()]
      .sort((a, b) => a.id - b.id)
      .map((track) => this.toSnapshot(track, timestampSec))
  }

  getRecords(): readonly TrackingRecord[] {
    return this.records
  }

  private toSnapshot(track: InternalTrack, timestampSec: number): TrackSnapshot {
    const elapsedSec = Math.max((track.archived ? track.lastSeenSec : timestampSec) - track.firstSeenSec, 0)
    return {
      ...track,
      path: [...track.path],
      averageSpeedCmPerSec: elapsedSec > 0 ? track.totalDistanceCm / elapsedSec : 0,
      elapsedSec,
      isDetected: !track.archived && track.missingFrames === 0,
    }
  }
}
