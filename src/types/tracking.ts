export interface Point {
  x: number
  y: number
}

export type RoiMode = 'aruco' | 'manual'

export type ArucoStatus = 'idle' | 'searching' | 'partial' | 'locked' | 'error'

export interface ArucoMarker {
  id: number
  corners: Point[]
  center: Point
}

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface Detection extends Point {
  area: number
  boundingBox: BoundingBox
  circularity: number
  solidity: number
  fillRatio: number
}

export interface DetectorFrame {
  width: number
  height: number
  data: Uint8ClampedArray
}

export interface DetectorSettings {
  threshold: number
  hueMin: number
  hueMax: number
  saturationMin: number
  saturationMax: number
  minArea: number
  maxArea: number
  minWidth: number
  minHeight: number
  maxAspectRatio: number
  minSolidity: number
  maxCircularity: number
  minFillRatio: number
  maxFillRatio: number
  blurSize: number
  morphologySize: number
  analysisWidth: number
  analysisFps: number
}

export interface TrackerSettings {
  minimumConfirmationFrames: number
  confirmationMaxDistancePx: number
  minimumConfirmationMovementPx: number
  maxMatchDistancePx: number
  maxAreaChangeRatio: number
  maxMissingFrames: number
  maxSpeedCmPerSec: number
  stationaryDistanceCm: number
  trailLength: number
}

export interface DisplaySettings {
  showIds: boolean
  showPositions: boolean
  showTrails: boolean
  showRoi: boolean
  showMask: boolean
}

export type TrackingStatus = 'idle' | 'running' | 'paused' | 'ended'

export interface Calibration {
  widthCm: number
  heightCm: number
  averageWidthPx: number
  averageHeightPx: number
  cmPerPixelX: number
  cmPerPixelY: number
  horizontalAxis: Point
  verticalAxis: Point
  origin: Point
}

export interface TrackSnapshot {
  id: number
  position: Point
  path: Point[]
  totalDistanceCm: number
  averageSpeedCmPerSec: number
  firstSeenSec: number
  lastSeenSec: number
  elapsedSec: number
  missingFrames: number
  isDetected: boolean
  isMoving: boolean
  archived: boolean
}

export interface TrackingRecord {
  timestamp: number
  antId: number
  xPixel: number
  yPixel: number
  xCm: number
  yCm: number
  speedCmPerSec: number
  isMoving: boolean
}
