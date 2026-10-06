import type { ArucoMarker, Point } from '../types/tracking'
import { distance } from '../utils/geometry'
import { isValidRoiGeometry } from './measurements'

export const ARUCO_MARKER_IDS = [0, 1, 2, 3] as const

function polygonSignedArea(points: [Point, Point, Point, Point]): number {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length]
    return area + point.x * next.y - next.x * point.y
  }, 0) / 2
}

export function createRoiFromArucoMarkers(
  markers: ArucoMarker[],
): [Point, Point, Point, Point] | null {
  const markerById = new Map(markers.map((marker) => [marker.id, marker]))
  const ordered = ARUCO_MARKER_IDS.map((id) => markerById.get(id))
  if (ordered.some((marker) => !marker)) return null

  const completeMarkers = ordered as [ArucoMarker, ArucoMarker, ArucoMarker, ArucoMarker]
  const points = completeMarkers.map((marker) => ({ ...marker.center })) as [
    Point,
    Point,
    Point,
    Point,
  ]

  if (!isValidRoiGeometry(points) || polygonSignedArea(points) <= 0) return null
  return points
}

export function averageRoiShift(previous: Point[], next: Point[]): number {
  if (previous.length !== 4 || next.length !== 4) return Number.POSITIVE_INFINITY
  return previous.reduce((sum, point, index) => sum + distance(point, next[index]), 0) / 4
}

export function smoothRoi(
  previous: [Point, Point, Point, Point],
  next: [Point, Point, Point, Point],
  alpha = 0.25,
): [Point, Point, Point, Point] {
  return previous.map((point, index) => ({
    x: point.x + (next[index].x - point.x) * alpha,
    y: point.y + (next[index].y - point.y) * alpha,
  })) as [Point, Point, Point, Point]
}
