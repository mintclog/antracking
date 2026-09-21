import type { Point } from '../types/tracking'

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function normalize(vector: Point): Point {
  const length = Math.hypot(vector.x, vector.y)
  return length > 0 ? { x: vector.x / length, y: vector.y / length } : { x: 0, y: 0 }
}

export function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, '0')).join(':')
}
