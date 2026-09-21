import { useCallback, useRef, useState } from 'react'
import type {
  Calibration,
  Detection,
  TrackerSettings,
  TrackingRecord,
  TrackingStatus,
  TrackSnapshot,
} from '../types/tracking'
import { CentroidTracker } from '../tracking/tracker'

export function useAntTracking(settings: TrackerSettings) {
  const [tracker] = useState(() => new CentroidTracker())

  const statusRef = useRef<TrackingStatus>('idle')
  const sessionStartedAtRef = useRef(0)
  const pauseStartedAtRef = useRef(0)
  const pausedDurationRef = useRef(0)
  const [status, setStatus] = useState<TrackingStatus>('idle')
  const [visibleTracks, setVisibleTracks] = useState<TrackSnapshot[]>([])
  const [allTracks, setAllTracks] = useState<TrackSnapshot[]>([])
  const [recordCount, setRecordCount] = useState(0)
  const [elapsedSec, setElapsedSec] = useState(0)

  const setTrackingStatus = useCallback((nextStatus: TrackingStatus) => {
    statusRef.current = nextStatus
    setStatus(nextStatus)
  }, [])

  const start = useCallback(() => {
    tracker.reset()
    sessionStartedAtRef.current = performance.now()
    pauseStartedAtRef.current = 0
    pausedDurationRef.current = 0
    setVisibleTracks([])
    setAllTracks([])
    setRecordCount(0)
    setElapsedSec(0)
    setTrackingStatus('running')
  }, [setTrackingStatus, tracker])

  const pause = useCallback(() => {
    if (statusRef.current !== 'running') return
    pauseStartedAtRef.current = performance.now()
    setTrackingStatus('paused')
  }, [setTrackingStatus])

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return
    pausedDurationRef.current += performance.now() - pauseStartedAtRef.current
    pauseStartedAtRef.current = 0
    setTrackingStatus('running')
  }, [setTrackingStatus])

  const end = useCallback(() => {
    if (statusRef.current === 'paused') {
      pausedDurationRef.current += performance.now() - pauseStartedAtRef.current
      pauseStartedAtRef.current = 0
    }
    if (statusRef.current === 'running') {
      const now = performance.now()
      setElapsedSec((now - sessionStartedAtRef.current - pausedDurationRef.current) / 1000)
    }
    if (statusRef.current !== 'idle') setTrackingStatus('ended')
  }, [setTrackingStatus])

  const reset = useCallback(() => {
    tracker.reset()
    sessionStartedAtRef.current = 0
    pauseStartedAtRef.current = 0
    pausedDurationRef.current = 0
    setVisibleTracks([])
    setAllTracks([])
    setRecordCount(0)
    setElapsedSec(0)
    setTrackingStatus('idle')
  }, [setTrackingStatus, tracker])

  const processDetections = useCallback(
    (detections: Detection[], calibration: Calibration, nowMs: number) => {
      if (statusRef.current !== 'running') return
      const timestampSec = Math.max(
        0,
        (nowMs - sessionStartedAtRef.current - pausedDurationRef.current) / 1000,
      )
      tracker.update(detections, timestampSec, calibration, settings)
      setVisibleTracks(tracker.getVisibleTracks(timestampSec))
      setAllTracks(tracker.getAllTracks(timestampSec))
      setRecordCount(tracker.getRecords().length)
      setElapsedSec(timestampSec)
    },
    [settings, tracker],
  )

  const getRecords = useCallback(
    (): readonly TrackingRecord[] => tracker.getRecords(),
    [tracker],
  )

  return {
    status,
    visibleTracks,
    allTracks,
    recordCount,
    elapsedSec,
    start,
    pause,
    resume,
    end,
    reset,
    processDetections,
    getRecords,
  }
}
