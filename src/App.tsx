import { useCallback, useMemo, useState } from 'react'
import { CameraControls } from './components/CameraControls'
import { DetectorControls } from './components/DetectorControls'
import { RoiControls } from './components/RoiControls'
import { TrackingCanvas } from './components/TrackingCanvas'
import { TrackingControls } from './components/TrackingControls'
import { TrackingStats } from './components/TrackingStats'
import { useAntTracking } from './hooks/useAntTracking'
import { useCamera } from './hooks/useCamera'
import { useOpenCv } from './hooks/useOpenCv'
import { createCalibration, isValidRoiGeometry } from './tracking/measurements'
import { isCompleteRoi } from './tracking/roi'
import type {
  DetectorSettings,
  Detection,
  DisplaySettings,
  Point,
  TrackerSettings,
} from './types/tracking'
import { downloadTrackingCsv } from './utils/csv'

const DEFAULT_DETECTOR_SETTINGS: DetectorSettings = {
  threshold: 95,
  hueMin: 0,
  hueMax: 179,
  saturationMin: 0,
  saturationMax: 255,
  minArea: 18,
  maxArea: 1200,
  minWidth: 2,
  minHeight: 2,
  maxAspectRatio: 6,
  blurSize: 3,
  morphologySize: 3,
  analysisWidth: 640,
  analysisFps: 12,
}

const DEFAULT_TRACKER_SETTINGS: TrackerSettings = {
  maxMatchDistancePx: 65,
  maxMissingFrames: 12,
  stationaryDistanceCm: 0.05,
  trailLength: 300,
}

const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  showIds: true,
  showPositions: true,
  showTrails: true,
  showRoi: true,
  showMask: false,
}

function App() {
  const camera = useCamera()
  const openCv = useOpenCv()
  const [roiPoints, setRoiPoints] = useState<Point[]>([])
  const [isSelectingRoi, setIsSelectingRoi] = useState(false)
  const [widthCm, setWidthCm] = useState(20)
  const [heightCm, setHeightCm] = useState(15)
  const [detectorSettings, setDetectorSettings] = useState(DEFAULT_DETECTOR_SETTINGS)
  const [trackerSettings, setTrackerSettings] = useState(DEFAULT_TRACKER_SETTINGS)
  const [displaySettings, setDisplaySettings] = useState(DEFAULT_DISPLAY_SETTINGS)
  const [fps, setFps] = useState(0)
  const [detectedCount, setDetectedCount] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const tracking = useAntTracking(trackerSettings)
  const processTrackingDetections = tracking.processDetections

  const validSize = Number.isFinite(widthCm) && Number.isFinite(heightCm) && widthCm > 0 && heightCm > 0
  const validRoi = isCompleteRoi(roiPoints) && isValidRoiGeometry(roiPoints)
  const calibration = useMemo(() => {
    if (!isCompleteRoi(roiPoints) || !isValidRoiGeometry(roiPoints) || !validSize) return null
    return createCalibration(roiPoints, widthCm, heightCm)
  }, [heightCm, roiPoints, validSize, widthCm])

  const trackingReady =
    openCv.status === 'ready' && camera.status === 'ready' && Boolean(calibration)

  const currentStep = camera.status !== 'ready' ? 1 : !validRoi ? 2 : !validSize ? 3 : tracking.status === 'idle' ? 4 : 5

  const addRoiPoint = useCallback((point: Point) => {
    if (roiPoints.length >= 4) return
    const next = [...roiPoints, point]
    setRoiPoints(next)
    if (isCompleteRoi(next)) {
      setIsSelectingRoi(false)
      setMessage(
        isValidRoiGeometry(next)
          ? null
          : '분석 영역이 너무 작거나 점 순서가 잘못되었습니다. A → B → C → D 순서로 다시 설정하세요.',
      )
    } else {
      setMessage(null)
    }
  }, [roiPoints])

  const beginRoiSelection = () => {
    if (camera.status !== 'ready') {
      setMessage('먼저 카메라를 시작하세요.')
      return
    }
    if (tracking.status === 'running' || tracking.status === 'paused') tracking.end()
    setRoiPoints([])
    setIsSelectingRoi(true)
    setMessage(null)
  }

  const resetRoi = () => {
    if (tracking.status === 'running' || tracking.status === 'paused') tracking.end()
    setRoiPoints([])
    setIsSelectingRoi(false)
    setDetectedCount(0)
  }

  const startTracking = () => {
    if (!trackingReady) {
      setMessage('카메라, OpenCV, 4점 분석 영역, 실제 크기 설정을 모두 확인하세요.')
      return
    }
    tracking.start()
    setMessage(null)
  }

  const handleCameraSelect = async (deviceId: string) => {
    if (tracking.status === 'running' || tracking.status === 'paused') tracking.end()
    resetRoi()
    const started = await camera.selectCamera(deviceId)
    if (!started) setMessage(null)
  }

  const handleCameraStop = () => {
    if (tracking.status === 'running' || tracking.status === 'paused') tracking.end()
    camera.stopCamera()
    setDetectedCount(0)
    setFps(0)
  }

  const handleDownload = () => {
    const records = [...tracking.getRecords()]
    if (records.length === 0) {
      setMessage('다운로드할 좌표 데이터가 없습니다.')
      return
    }
    downloadTrackingCsv(records)
  }

  const processDetections = useCallback(
    (detections: Detection[], nowMs: number) => {
      if (calibration) processTrackingDetections(detections, calibration, nowMs)
    },
    [calibration, processTrackingDetections],
  )

  const statusMessages = [...new Set([message, camera.error, openCv.error].filter(Boolean))] as string[]

  const dismissErrors = () => {
    setMessage(null)
    camera.clearError()
    openCv.clearError()
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark"><span /></div>
          <div><span className="eyebrow">LOCAL VISION LAB</span><h1>ANT TRACKER</h1></div>
        </div>
        <div className="privacy-note"><span>●</span> 영상은 브라우저 밖으로 전송되지 않습니다</div>
      </header>

      <nav className="steps" aria-label="첫 실행 순서">
        {['카메라 선택', '영역 4점 지정', '실제 크기', '검출값 조정', '추적'].map((label, index) => {
          const step = index + 1
          return <div key={label} className={step === currentStep ? 'active' : step < currentStep ? 'done' : ''}><span>{step < currentStep ? '✓' : step}</span>{label}</div>
        })}
      </nav>

      {statusMessages.length > 0 && (
        <div className="alert" role="alert">
          <strong>확인 필요</strong>
          <span>{statusMessages.join(' · ')}</span>
          {openCv.status === 'error' && (
            <button className="alert-retry" onClick={openCv.retry}>OpenCV 다시 시도</button>
          )}
          <button className="alert-close" aria-label="알림 닫기" onClick={dismissErrors}>×</button>
        </div>
      )}

      <main className="workspace">
        <div className="viewer-column">
          <div className="status-strip">
            <span className={openCv.status === 'ready' ? 'ready' : openCv.status === 'error' ? 'failed' : ''}>OpenCV {openCv.status === 'ready' ? 'ready' : openCv.status === 'error' ? 'failed' : 'loading…'}</span>
            <span className={camera.status === 'ready' ? 'ready' : camera.status === 'error' ? 'failed' : ''}>Camera {camera.status === 'ready' ? 'ready' : camera.status}</span>
            <span className={trackingReady ? 'ready' : ''}>Tracking {trackingReady ? 'ready' : 'waiting'}</span>
            <strong>{detectedCount} candidates</strong>
          </div>
          <TrackingCanvas
            videoRef={camera.videoRef}
            detectorWorker={openCv.status === 'ready' ? openCv.worker : null}
            cameraReady={camera.status === 'ready'}
            roiPoints={roiPoints}
            isSelectingRoi={isSelectingRoi}
            detectorSettings={detectorSettings}
            displaySettings={displaySettings}
            trackingStatus={tracking.status}
            calibration={calibration}
            tracks={tracking.visibleTracks}
            onRoiPoint={addRoiPoint}
            onDetections={processDetections}
            onDetectionCount={setDetectedCount}
            onFpsChange={setFps}
            onProcessingError={setMessage}
          />
          <TrackingControls
            status={tracking.status}
            canStart={trackingReady}
            recordCount={tracking.recordCount}
            onStart={startTracking}
            onPause={tracking.pause}
            onResume={tracking.resume}
            onEnd={tracking.end}
            onReset={tracking.reset}
            onDownload={handleDownload}
          />
        </div>

        <aside className="control-panel">
          <CameraControls
            devices={camera.devices}
            selectedDeviceId={camera.selectedDeviceId}
            status={camera.status}
            resolution={camera.resolution}
            fps={fps}
            onSelect={(deviceId) => void handleCameraSelect(deviceId)}
            onStart={() => void camera.startCamera()}
            onStop={handleCameraStop}
            onRefresh={() => void camera.refreshDevices()}
          />
          <RoiControls
            points={roiPoints}
            isSelecting={isSelectingRoi}
            widthCm={widthCm}
            heightCm={heightCm}
            onWidthChange={setWidthCm}
            onHeightChange={setHeightCm}
            onStartSelecting={beginRoiSelection}
            onUndo={() => { setRoiPoints((points) => points.slice(0, -1)); setIsSelectingRoi(true) }}
            onReset={resetRoi}
          />
          <DetectorControls
            detector={detectorSettings}
            tracker={trackerSettings}
            display={displaySettings}
            onDetectorChange={(patch) => setDetectorSettings((current) => ({ ...current, ...patch }))}
            onTrackerChange={(patch) => setTrackerSettings((current) => ({ ...current, ...patch }))}
            onDisplayChange={(patch) => setDisplaySettings((current) => ({ ...current, ...patch }))}
          />
        </aside>
      </main>

      <TrackingStats tracks={tracking.allTracks} elapsedSec={tracking.elapsedSec} detectedCount={detectedCount} />
      <footer>ANT TRACKER v0.1 · Browser-only centroid tracking</footer>
    </div>
  )
}

export default App
