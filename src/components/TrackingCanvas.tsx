import { useEffect, useRef } from 'react'
import type {
  Calibration,
  Detection,
  DetectorFrame,
  DetectorSettings,
  DisplaySettings,
  Point,
  TrackingStatus,
  TrackSnapshot,
} from '../types/tracking'
import { ROI_LABELS } from '../tracking/roi'

interface TrackingCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  detectorWorker: Worker | null
  cameraReady: boolean
  roiPoints: Point[]
  isSelectingRoi: boolean
  detectorSettings: DetectorSettings
  displaySettings: DisplaySettings
  trackingStatus: TrackingStatus
  calibration: Calibration | null
  tracks: TrackSnapshot[]
  onRoiPoint: (point: Point) => void
  onDetections: (detections: Detection[], nowMs: number) => void
  onDetectionCount: (count: number) => void
  onFpsChange: (fps: number) => void
  onProcessingError: (message: string) => void
}

interface DetectorWorkerMessage {
  type: 'ready' | 'result' | 'error'
  requestId?: number
  timestampMs?: number
  detections?: Detection[]
  mask?: DetectorFrame
  message?: string
}

function trackColor(id: number): string {
  return `hsl(${(id * 67) % 360} 82% 60%)`
}

function drawRoiOverlay(context: CanvasRenderingContext2D, points: Point[], selecting: boolean): void {
  if (points.length === 0) return
  context.save()
  context.lineWidth = 2
  context.strokeStyle = '#f4d35e'
  context.fillStyle = '#f4d35e'
  context.setLineDash(selecting ? [8, 6] : [])
  context.beginPath()
  context.moveTo(points[0].x, points[0].y)
  points.slice(1).forEach((point) => context.lineTo(point.x, point.y))
  if (points.length === 4) context.closePath()
  context.stroke()
  context.setLineDash([])

  points.forEach((point, index) => {
    context.beginPath()
    context.arc(point.x, point.y, 8, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#071018'
    context.font = '700 12px Inter, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(ROI_LABELS[index], point.x, point.y + 0.5)
    context.fillStyle = '#f4d35e'
  })
  context.restore()
}

function drawDetections(context: CanvasRenderingContext2D, detections: Detection[]): void {
  context.save()
  context.strokeStyle = '#65d6ff'
  context.fillStyle = '#65d6ff'
  context.lineWidth = 1.5
  detections.forEach((detection) => {
    const box = detection.boundingBox
    context.strokeRect(box.x, box.y, box.width, box.height)
    context.beginPath()
    context.arc(detection.x, detection.y, 3, 0, Math.PI * 2)
    context.fill()
  })
  context.restore()
}

function drawTracks(
  context: CanvasRenderingContext2D,
  tracks: TrackSnapshot[],
  display: DisplaySettings,
): void {
  tracks.forEach((track) => {
    const color = trackColor(track.id)
    if (display.showTrails && track.path.length > 1) {
      context.save()
      context.strokeStyle = color
      context.globalAlpha = 0.75
      context.lineWidth = 2
      context.beginPath()
      context.moveTo(track.path[0].x, track.path[0].y)
      track.path.slice(1).forEach((point) => context.lineTo(point.x, point.y))
      context.stroke()
      context.restore()
    }
    if (display.showPositions) {
      context.save()
      context.fillStyle = color
      context.shadowColor = color
      context.shadowBlur = 8
      context.beginPath()
      context.arc(track.position.x, track.position.y, 5, 0, Math.PI * 2)
      context.fill()
      context.restore()
    }
    if (display.showIds) {
      context.save()
      context.font = '700 13px Inter, sans-serif'
      context.fillStyle = color
      context.strokeStyle = 'rgba(4, 10, 15, 0.9)'
      context.lineWidth = 4
      const label = `Ant ${track.id}`
      context.strokeText(label, track.position.x + 9, track.position.y - 9)
      context.fillText(label, track.position.x + 9, track.position.y - 9)
      context.restore()
    }
  })
}

export function TrackingCanvas({
  videoRef,
  detectorWorker,
  cameraReady,
  roiPoints,
  isSelectingRoi,
  detectorSettings,
  displaySettings,
  trackingStatus,
  calibration,
  tracks,
  onRoiPoint,
  onDetections,
  onDetectionCount,
  onFpsChange,
  onProcessingError,
}: TrackingCanvasProps) {
  const displayCanvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const analysisCanvasRef = useRef<HTMLCanvasElement>(null)
  const binaryMaskCanvasRef = useRef<HTMLCanvasElement>(null)
  const latestDetectionsRef = useRef<Detection[]>([])
  const processingRef = useRef(false)
  const requestIdRef = useRef(0)
  const latestRef = useRef({
    videoRef,
    detectorWorker,
    cameraReady,
    roiPoints,
    isSelectingRoi,
    detectorSettings,
    displaySettings,
    trackingStatus,
    calibration,
    tracks,
    onRoiPoint,
    onDetections,
    onDetectionCount,
    onFpsChange,
    onProcessingError,
  })

  useEffect(() => {
    latestRef.current = {
      videoRef,
      detectorWorker,
      cameraReady,
      roiPoints,
      isSelectingRoi,
      detectorSettings,
      displaySettings,
      trackingStatus,
      calibration,
      tracks,
      onRoiPoint,
      onDetections,
      onDetectionCount,
      onFpsChange,
      onProcessingError,
    }
  }, [
    videoRef,
    detectorWorker,
    cameraReady,
    roiPoints,
    isSelectingRoi,
    detectorSettings,
    displaySettings,
    trackingStatus,
    calibration,
    tracks,
    onRoiPoint,
    onDetections,
    onDetectionCount,
    onFpsChange,
    onProcessingError,
  ])

  useEffect(() => {
    latestDetectionsRef.current = []
    processingRef.current = false
    if (!detectorWorker) return

    const handleMessage = (event: MessageEvent<DetectorWorkerMessage>) => {
      if (event.data.type === 'result' && event.data.requestId === requestIdRef.current) {
        processingRef.current = false
        const detections = event.data.detections ?? []
        latestDetectionsRef.current = detections
        latestRef.current.onDetectionCount(detections.length)
        latestRef.current.onDetections(detections, event.data.timestampMs ?? performance.now())

        const mask = event.data.mask
        const maskCanvas = binaryMaskCanvasRef.current
        if (mask && maskCanvas) {
          maskCanvas.width = mask.width
          maskCanvas.height = mask.height
          const context = maskCanvas.getContext('2d')
          const maskPixels = new Uint8ClampedArray(mask.data.length)
          maskPixels.set(mask.data)
          context?.putImageData(new ImageData(maskPixels, mask.width, mask.height), 0, 0)
        }
      } else if (event.data.type === 'error' && event.data.requestId !== undefined) {
        processingRef.current = false
        latestRef.current.onProcessingError(event.data.message ?? '영상 분석 중 오류가 발생했습니다.')
      }
    }
    detectorWorker.addEventListener('message', handleMessage)
    return () => detectorWorker.removeEventListener('message', handleMessage)
  }, [detectorWorker])

  useEffect(() => {
    let animationFrame = 0
    let lastAnalysisAt = 0
    let lastFpsReportAt = performance.now()
    let renderedFrames = 0

    const render = (now: number) => {
      const current = latestRef.current
      const video = current.videoRef.current
      const detectorWorker = current.detectorWorker
      const displayCanvas = displayCanvasRef.current
      const analysisCanvas = analysisCanvasRef.current
      const stage = stageRef.current

      if (video && displayCanvas && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        if (stage && video.videoWidth > 0 && video.videoHeight > 0) {
          stage.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`
        }
        if (displayCanvas.width !== video.videoWidth || displayCanvas.height !== video.videoHeight) {
          displayCanvas.width = video.videoWidth
          displayCanvas.height = video.videoHeight
        }
        const displayContext = displayCanvas.getContext('2d')
        if (displayContext) {
          displayContext.drawImage(video, 0, 0, displayCanvas.width, displayCanvas.height)
          if (current.displaySettings.showRoi) {
            drawRoiOverlay(displayContext, current.roiPoints, current.isSelectingRoi)
          }
          if (current.trackingStatus !== 'idle') {
            drawTracks(displayContext, current.tracks, current.displaySettings)
          } else if (latestDetectionsRef.current.length > 0) {
            drawDetections(displayContext, latestDetectionsRef.current)
          }
          renderedFrames += 1
        }

        const analysisInterval = 1000 / current.detectorSettings.analysisFps
        const canAnalyze =
          current.cameraReady &&
          detectorWorker &&
          current.calibration &&
          current.roiPoints.length === 4 &&
          analysisCanvas &&
          !processingRef.current &&
          now - lastAnalysisAt >= analysisInterval

        if (!current.cameraReady || !current.calibration || current.roiPoints.length !== 4) {
          latestDetectionsRef.current = []
        }

        if (canAnalyze && detectorWorker) {
          processingRef.current = true
          lastAnalysisAt = now
          try {
            const analysisWidth = Math.min(current.detectorSettings.analysisWidth, video.videoWidth)
            const analysisHeight = Math.round((video.videoHeight / video.videoWidth) * analysisWidth)
            if (analysisCanvas.width !== analysisWidth || analysisCanvas.height !== analysisHeight) {
              analysisCanvas.width = analysisWidth
              analysisCanvas.height = analysisHeight
            }
            const analysisContext = analysisCanvas.getContext('2d', { willReadFrequently: true })
            if (!analysisContext) throw new Error('분석 Canvas를 초기화하지 못했습니다.')
            analysisContext.drawImage(video, 0, 0, analysisWidth, analysisHeight)
            const frame = analysisContext.getImageData(0, 0, analysisWidth, analysisHeight)
            requestIdRef.current += 1
            detectorWorker.postMessage({
              type: 'analyze',
              requestId: requestIdRef.current,
              timestampMs: now,
              frame: {
                width: frame.width,
                height: frame.height,
                data: frame.data,
              },
              roiPoints: current.roiPoints,
              settings: current.detectorSettings,
              sourceWidth: video.videoWidth,
              sourceHeight: video.videoHeight,
              renderMask: current.displaySettings.showMask,
            }, [frame.data.buffer as ArrayBuffer])
          } catch (error) {
            processingRef.current = false
            current.onProcessingError(
              error instanceof Error ? error.message : '영상 분석 중 알 수 없는 오류가 발생했습니다.',
            )
          }
        }
      }

      if (now - lastFpsReportAt >= 1000) {
        const seconds = (now - lastFpsReportAt) / 1000
        latestRef.current.onFpsChange(renderedFrames / seconds)
        renderedFrames = 0
        lastFpsReportAt = now
      }
      animationFrame = requestAnimationFrame(render)
    }

    animationFrame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animationFrame)
  }, [])

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const { isSelectingRoi, roiPoints, onRoiPoint } = latestRef.current
    const canvas = displayCanvasRef.current
    if (!isSelectingRoi || roiPoints.length >= 4 || !canvas) return
    const bounds = canvas.getBoundingClientRect()
    onRoiPoint({
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    })
  }

  return (
    <div className="viewer-stack">
      <div ref={stageRef} className={`video-stage ${isSelectingRoi ? 'selecting' : ''}`}>
        <video ref={videoRef} muted playsInline aria-hidden="true" />
        <canvas ref={displayCanvasRef} onPointerDown={handlePointerDown} aria-label="실시간 개미 추적 화면" />
        {!cameraReady && (
          <div className="viewer-placeholder">
            <div className="placeholder-mark">AT</div>
            <strong>카메라 대기 중</strong>
            <span>오른쪽 패널에서 카메라를 선택하고 시작하세요.</span>
          </div>
        )}
        {isSelectingRoi && <div className="selection-banner">노란 스티커 중심을 순서대로 클릭하세요</div>}
      </div>
      <canvas ref={analysisCanvasRef} className="hidden-canvas" />
      <div className={`mask-preview ${displaySettings.showMask ? '' : 'hidden'}`}>
        <div><span>Binary Mask</span><small>흰색 영역이 개미 후보입니다</small></div>
        <canvas ref={binaryMaskCanvasRef} />
      </div>
    </div>
  )
}
