import type { Calibration, Point } from '../types/tracking'
import { distance, dot, normalize } from '../utils/geometry'

const MIN_ROI_EDGE_PX = 20
const MIN_ROI_AREA_PX2 = 400

export function isValidRoiGeometry(points: [Point, Point, Point, Point]): boolean {
  const [a, b, c, d] = points
  const edges = [distance(a, b), distance(b, c), distance(c, d), distance(d, a)]
  const signedDoubleArea =
    a.x * b.y - b.x * a.y +
    b.x * c.y - c.x * b.y +
    c.x * d.y - d.x * c.y +
    d.x * a.y - a.x * d.y
  return edges.every((edge) => edge >= MIN_ROI_EDGE_PX) && Math.abs(signedDoubleArea) / 2 >= MIN_ROI_AREA_PX2
}

export function createCalibration(
  points: [Point, Point, Point, Point],
  widthCm: number,
  heightCm: number,
): Calibration {
  if (!isValidRoiGeometry(points)) {
    throw new Error('분석 영역의 점이 너무 가깝거나 올바른 순서로 배치되지 않았습니다.')
  }
  const [a, b, c, d] = points
  const averageWidthPx = (distance(a, b) + distance(d, c)) / 2
  const averageHeightPx = (distance(a, d) + distance(b, c)) / 2
  const horizontalAxis = normalize({
    x: (b.x - a.x + c.x - d.x) / 2,
    y: (b.y - a.y + c.y - d.y) / 2,
  })
  const verticalAxis = normalize({
    x: (d.x - a.x + c.x - b.x) / 2,
    y: (d.y - a.y + c.y - b.y) / 2,
  })

  return {
    widthCm,
    heightCm,
    averageWidthPx,
    averageHeightPx,
    cmPerPixelX: widthCm / averageWidthPx,
    cmPerPixelY: heightCm / averageHeightPx,
    horizontalAxis,
    verticalAxis,
    origin: a,
  }
}

export function pointToCentimeters(point: Point, calibration: Calibration): Point {
  const relative = {
    x: point.x - calibration.origin.x,
    y: point.y - calibration.origin.y,
  }
  return {
    x: dot(relative, calibration.horizontalAxis) * calibration.cmPerPixelX,
    y: dot(relative, calibration.verticalAxis) * calibration.cmPerPixelY,
  }
}

export function distanceInCentimeters(a: Point, b: Point, calibration: Calibration): number {
  const delta = { x: b.x - a.x, y: b.y - a.y }
  const horizontalCm = dot(delta, calibration.horizontalAxis) * calibration.cmPerPixelX
  const verticalCm = dot(delta, calibration.verticalAxis) * calibration.cmPerPixelY
  return Math.hypot(horizontalCm, verticalCm)
}
