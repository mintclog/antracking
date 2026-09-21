/*
 * OpenCV.js must run as a classic worker because its official distribution
 * uses importScripts(). Keeping image processing here prevents compilation
 * and contour analysis from blocking the React UI thread.
 */
const OPENCV_URL = 'https://docs.opencv.org/4.9.0/opencv.js'

let cvInstance = null

function sendError(message, requestId) {
  self.postMessage({ type: 'error', message, requestId })
}

function setReady(candidate) {
  if (cvInstance || !candidate?.Mat) return
  cvInstance = candidate
  self.postMessage({ type: 'ready' })
}

function initializeOpenCv() {
  try {
    self.Module = {
      onRuntimeInitialized: () => setReady(self.cv),
    }
    self.importScripts(OPENCV_URL)

    if (typeof self.cv?.then === 'function') {
      self.cv
        .then(setReady)
        .catch((reason) => sendError(reason?.message ?? 'OpenCV.js 초기화에 실패했습니다.'))
    } else if (self.cv?.Mat) {
      setReady(self.cv)
    } else if (self.cv) {
      self.cv.onRuntimeInitialized = () => setReady(self.cv)
    }
  } catch (reason) {
    sendError(reason?.message ?? 'OpenCV.js 다운로드에 실패했습니다.')
  }
}

function oddKernelSize(value) {
  const integer = Math.max(1, Math.round(value))
  return integer % 2 === 0 ? integer + 1 : integer
}

function detectAnts(message) {
  const { frame, roiPoints, settings, sourceWidth, sourceHeight, renderMask } = message
  if (roiPoints.length !== 4 || frame.width === 0 || frame.height === 0) {
    return { detections: [] }
  }

  const cv = cvInstance
  const scaleX = frame.width / sourceWidth
  const scaleY = frame.height / sourceHeight
  let rgba
  let rgb
  let hsv
  let blurred
  let binary
  let roiMask
  let roiContour
  let roiContours
  let low
  let high
  let kernel
  let contours
  let hierarchy
  let maskRgba

  try {
    rgba = new cv.Mat(frame.height, frame.width, cv.CV_8UC4)
    rgba.data.set(frame.data)
    rgb = new cv.Mat()
    hsv = new cv.Mat()
    blurred = new cv.Mat()
    binary = new cv.Mat()
    roiMask = cv.Mat.zeros(frame.height, frame.width, cv.CV_8UC1)

    const scaledRoi = roiPoints.flatMap((point) => [
      Math.round(point.x * scaleX),
      Math.round(point.y * scaleY),
    ])
    roiContour = cv.matFromArray(4, 1, cv.CV_32SC2, scaledRoi)
    roiContours = new cv.MatVector()
    roiContours.push_back(roiContour)
    cv.fillPoly(roiMask, roiContours, new cv.Scalar(255))

    cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB)
    const blurSize = oddKernelSize(settings.blurSize)
    cv.GaussianBlur(rgb, blurred, new cv.Size(blurSize, blurSize), 0, 0, cv.BORDER_DEFAULT)
    cv.cvtColor(blurred, hsv, cv.COLOR_RGB2HSV)

    low = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [
      settings.hueMin,
      settings.saturationMin,
      0,
      0,
    ])
    high = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [
      settings.hueMax,
      settings.saturationMax,
      settings.threshold,
      255,
    ])
    cv.inRange(hsv, low, high, binary)
    cv.bitwise_and(binary, roiMask, binary)

    const morphologySize = Math.max(1, Math.round(settings.morphologySize))
    kernel = cv.getStructuringElement(
      cv.MORPH_ELLIPSE,
      new cv.Size(morphologySize, morphologySize),
    )
    cv.morphologyEx(binary, binary, cv.MORPH_OPEN, kernel)
    cv.morphologyEx(binary, binary, cv.MORPH_CLOSE, kernel)

    contours = new cv.MatVector()
    hierarchy = new cv.Mat()
    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    const detections = []
    const areaScale = scaleX * scaleY
    for (let index = 0; index < contours.size(); index += 1) {
      const contour = contours.get(index)
      try {
        const area = cv.contourArea(contour, false) / areaScale
        if (area < settings.minArea || area > settings.maxArea) continue

        const rectangle = cv.boundingRect(contour)
        const width = rectangle.width / scaleX
        const height = rectangle.height / scaleY
        if (width < settings.minWidth || height < settings.minHeight) continue
        if (Math.max(width / height, height / width) > settings.maxAspectRatio) continue

        const moments = cv.moments(contour, false)
        if (moments.m00 === 0) continue
        detections.push({
          x: moments.m10 / moments.m00 / scaleX,
          y: moments.m01 / moments.m00 / scaleY,
          area,
          boundingBox: {
            x: rectangle.x / scaleX,
            y: rectangle.y / scaleY,
            width,
            height,
          },
        })
      } finally {
        contour.delete()
      }
    }

    let mask
    if (renderMask) {
      maskRgba = new cv.Mat()
      cv.cvtColor(binary, maskRgba, cv.COLOR_GRAY2RGBA)
      mask = {
        width: maskRgba.cols,
        height: maskRgba.rows,
        data: new Uint8ClampedArray(maskRgba.data),
      }
    }
    return { detections, mask }
  } finally {
    ;[
      rgba,
      rgb,
      hsv,
      blurred,
      binary,
      roiMask,
      roiContour,
      roiContours,
      low,
      high,
      kernel,
      contours,
      hierarchy,
      maskRgba,
    ].forEach((matrix) => matrix?.delete?.())
  }
}

self.addEventListener('message', (event) => {
  if (event.data.type !== 'analyze') return
  if (!cvInstance) {
    sendError('OpenCV.js가 아직 준비되지 않았습니다.', event.data.requestId)
    return
  }

  try {
    const result = detectAnts(event.data)
    const transfer = result.mask ? [result.mask.data.buffer] : []
    self.postMessage(
      {
        type: 'result',
        requestId: event.data.requestId,
        timestampMs: event.data.timestampMs,
        detections: result.detections,
        mask: result.mask,
      },
      transfer,
    )
  } catch (reason) {
    sendError(
      reason?.message ?? '영상 분석 중 알 수 없는 오류가 발생했습니다.',
      event.data.requestId,
    )
  }
})

initializeOpenCv()
