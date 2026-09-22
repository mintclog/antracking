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
  lastArea: number
  path: Point[]
  totalDistanceCm: number
  firstSeenSec: number
  lastSeenSec: number
  missingFrames: number
  isMoving: boolean
  archived: boolean
}

interface PendingCandidate {
  id: number
  position: Point
  firstPosition: Point
  lastArea: number
  consecutiveFrames: number
  maximumMovementPx: number
}

interface MatchCandidate {
  trackId: number
  detectionIndex: number
  distancePx: number
}

function areaChangeRatio(previousArea: number, nextArea: number): number {
  const smallerArea = Math.min(previousArea, nextArea)
  return smallerArea > 0 ? Math.max(previousArea, nextArea) / smallerArea : Number.POSITIVE_INFINITY
}

export class CentroidTracker {
  private activeTracks = new Map<number, InternalTrack>()
  private archivedTracks = new Map<number, InternalTrack>()
  private pendingCandidates = new Map<number, PendingCandidate>()
  private records: TrackingRecord[] = []
  private nextId = 1
  private nextCandidateId = 1

  reset(): void {
    this.activeTracks.clear()
    this.archivedTracks.clear()
    this.pendingCandidates.clear()
    this.records = []
    this.nextId = 1
    this.nextCandidateId = 1
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
        const elapsedSec = Math.max(timestampSec - track.lastSeenSec, 0.001)
        const speedCmPerSec =
          distanceInCentimeters(track.position, detection, calibration) / elapsedSec
        const hasStableArea =
          areaChangeRatio(track.lastArea, detection.area) <= settings.maxAreaChangeRatio
        if (distancePx > settings.maxMatchDistancePx || !hasStableArea) return
        if (speedCmPerSec > settings.maxSpeedCmPerSec) return
        candidates.push({ trackId: track.id, detectionIndex, distancePx })
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

    this.updatePendingCandidates(detections, matchedDetectionIndexes, timestampSec, calibration, settings)
  }

  private updatePendingCandidates(
    detections: Detection[],
    matchedDetectionIndexes: Set<number>,
    timestampSec: number,
    calibration: Calibration,
    settings: TrackerSettings,
  ): void {
    const candidates: MatchCandidate[] = []
    this.pendingCandidates.forEach((candidate) => {
      detections.forEach((detection, detectionIndex) => {
        if (matchedDetectionIndexes.has(detectionIndex)) return
        const distancePx = distance(candidate.position, detection)
        const hasStableArea =
          areaChangeRatio(candidate.lastArea, detection.area) <= settings.maxAreaChangeRatio
        if (distancePx <= settings.confirmationMaxDistancePx && hasStableArea) {
          candidates.push({ trackId: candidate.id, detectionIndex, distancePx })
        }
      })
    })
    candidates.sort((a, b) => a.distancePx - b.distancePx)

    const matchedCandidateIds = new Set<number>()
    candidates.forEach((match) => {
      if (
        matchedCandidateIds.has(match.trackId) ||
        matchedDetectionIndexes.has(match.detectionIndex)
      ) {
        return
      }
      const candidate = this.pendingCandidates.get(match.trackId)
      const detection = detections[match.detectionIndex]
      if (!candidate || !detection) return

      candidate.position = { x: detection.x, y: detection.y }
      candidate.lastArea = detection.area
      candidate.consecutiveFrames += 1
      candidate.maximumMovementPx = Math.max(
        candidate.maximumMovementPx,
        distance(candidate.firstPosition, detection),
      )
      matchedCandidateIds.add(candidate.id)
      matchedDetectionIndexes.add(match.detectionIndex)

      const enoughFrames =
        candidate.consecutiveFrames >= settings.minimumConfirmationFrames
      const enoughMovement =
        candidate.maximumMovementPx >= settings.minimumConfirmationMovementPx
      if (enoughFrames && enoughMovement) {
        this.createTrack(detection, timestampSec, calibration)
        this.pendingCandidates.delete(candidate.id)
      }
    })

    this.pendingCandidates.forEach((_candidate, id) => {
      if (!matchedCandidateIds.has(id)) this.pendingCandidates.delete(id)
    })

    detections.forEach((detection, detectionIndex) => {
      if (matchedDetectionIndexes.has(detectionIndex)) return
      if (
        settings.minimumConfirmationFrames <= 1 &&
        settings.minimumConfirmationMovementPx <= 0
      ) {
        this.createTrack(detection, timestampSec, calibration)
        return
      }

      const position = { x: detection.x, y: detection.y }
      this.pendingCandidates.set(this.nextCandidateId, {
        id: this.nextCandidateId,
        position,
        firstPosition: position,
        lastArea: detection.area,
        consecutiveFrames: 1,
        maximumMovementPx: 0,
      })
      this.nextCandidateId += 1
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
      lastArea: detection.area,
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
    track.lastArea = detection.area
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
