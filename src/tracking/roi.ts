import type { Point } from '../types/tracking'

export const ROI_LABELS = ['A', 'B', 'C', 'D'] as const

export function isCompleteRoi(points: Point[]): points is [Point, Point, Point, Point] {
  return points.length === 4
}

export function drawRoiMask(
  context: CanvasRenderingContext2D,
  points: Point[],
  scaleX: number,
  scaleY: number,
): void {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height)
  if (!isCompleteRoi(points)) return

  context.fillStyle = '#ffffff'
  context.beginPath()
  context.moveTo(points[0].x * scaleX, points[0].y * scaleY)
  points.slice(1).forEach((point) => context.lineTo(point.x * scaleX, point.y * scaleY))
  context.closePath()
  context.fill()
}
