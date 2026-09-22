/* global AR, importScripts */

importScripts('./vendor/js-aruco2/cv.js', './vendor/js-aruco2/aruco.js')

const detector = new AR.Detector({ dictionaryName: 'ARUCO' })
const expectedIds = new Set([0, 1, 2, 3])

function perimeter(corners) {
  return corners.reduce((sum, corner, index) => {
    const next = corners[(index + 1) % corners.length]
    return sum + Math.hypot(next.x - corner.x, next.y - corner.y)
  }, 0)
}

self.onmessage = (event) => {
  if (event.data.type !== 'detect') return
  const { frame, requestId, sourceWidth, sourceHeight } = event.data

  try {
    const scaleX = sourceWidth / frame.width
    const scaleY = sourceHeight / frame.height
    const rawMarkers = detector.detect(frame)
    const largestById = new Map()

    rawMarkers.forEach((marker) => {
      if (!expectedIds.has(marker.id) || marker.corners.length !== 4) return
      const existing = largestById.get(marker.id)
      if (!existing || perimeter(marker.corners) > perimeter(existing.corners)) {
        largestById.set(marker.id, marker)
      }
    })

    const markers = [...largestById.values()].map((marker) => {
      const corners = marker.corners.map((corner) => ({
        x: corner.x * scaleX,
        y: corner.y * scaleY,
      }))
      const center = corners.reduce(
        (point, corner) => ({ x: point.x + corner.x / 4, y: point.y + corner.y / 4 }),
        { x: 0, y: 0 },
      )
      return { id: marker.id, corners, center }
    })

    self.postMessage({ type: 'result', requestId, markers })
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId,
      message: error instanceof Error ? error.message : 'ArUco Marker 분석 중 오류가 발생했습니다.',
    })
  }
}

self.postMessage({ type: 'ready' })
