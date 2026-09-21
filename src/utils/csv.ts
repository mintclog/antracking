import type { TrackingRecord } from '../types/tracking'

const CSV_HEADER = 'timestamp,antId,xPixel,yPixel,xCm,yCm,speedCmPerSec,isMoving'

export function recordsToCsv(records: TrackingRecord[]): string {
  const rows = records.map((record) =>
    [
      record.timestamp.toFixed(3),
      record.antId,
      record.xPixel.toFixed(2),
      record.yPixel.toFixed(2),
      record.xCm.toFixed(3),
      record.yCm.toFixed(3),
      record.speedCmPerSec.toFixed(3),
      record.isMoving,
    ].join(','),
  )
  return `\uFEFF${[CSV_HEADER, ...rows].join('\n')}`
}

export function downloadTrackingCsv(records: TrackingRecord[]): void {
  const blob = new Blob([recordsToCsv(records)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  link.href = url
  link.download = `ant-tracking-${date}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
