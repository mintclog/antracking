import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'

// Run without a new test dependency. Transpile the existing TS modules in memory.
const require = createRequire(import.meta.url)
const cache = new Map()
function loadTs(filename) {
  filename = path.resolve(filename)
  if (cache.has(filename)) return cache.get(filename)
  const module = { exports: {} }
  cache.set(filename, module.exports)
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename })(
    (name) => name.startsWith('.') ? loadTs(path.resolve(path.dirname(filename), `${name}.ts`)) : require(name),
    module, module.exports,
  )
  return module.exports
}

const { CentroidTracker } = loadTs('src/tracking/tracker.ts')
const { createCalibration } = loadTs('src/tracking/measurements.ts')
const { createRoiFromArucoMarkers } = loadTs('src/tracking/aruco.ts')
const markerCenters = [{ x: 10, y: 10 }, { x: 110, y: 10 }, { x: 110, y: 90 }, { x: 10, y: 90 }]
const markers = markerCenters.map((center, id) => ({
  id, center,
  corners: [
    { x: center.x - 5, y: center.y - 5 }, { x: center.x + 5, y: center.y - 5 },
    { x: center.x + 5, y: center.y + 5 }, { x: center.x - 5, y: center.y + 5 },
  ],
}))
const centerRoi = createRoiFromArucoMarkers([markers[2], markers[0], markers[3], markers[1]])
assert.deepEqual(centerRoi, markerCenters, 'ROI must use centers ordered by ID, not inner corners')
assert.notEqual(centerRoi[0], markers[0].center, 'ROI points should not alias marker objects')
assert.equal(createRoiFromArucoMarkers(markers.slice(0, 3)), null)
assert.equal(createRoiFromArucoMarkers(markers.map((marker) => ({ ...marker, center: { x: 0, y: 0 } }))), null)
const centerCalibration = createCalibration(centerRoi, 20, 16)
assert.equal(centerCalibration.averageWidthPx, 100)
assert.equal(centerCalibration.averageHeightPx, 80)
console.log('PASS: ArUco center ROI, ID order, missing/degenerate markers, center-based calibration')
const app = fs.readFileSync('src/App.tsx', 'utf8')
function defaults(name) {
  const literal = app.match(new RegExp(`const ${name}: \\w+ = (\\{[\\s\\S]*?\\n\\})`))?.[1]
  assert.ok(literal, `Missing ${name}`)
  return vm.runInNewContext(`(${literal})`)
}
const settings = defaults('DEFAULT_TRACKER_SETTINGS')
const detectorSettings = defaults('DEFAULT_DETECTOR_SETTINGS')
assert.equal(settings.minimumConfirmationMovementPx, 0)
const roi = [{ x: 10, y: 10 }, { x: 110, y: 10 }, { x: 110, y: 90 }, { x: 10, y: 90 }]
const calibration = createCalibration(roi, 20, 16)
const ant = { x: 45, y: 45, area: 50, boundingBox: { x: 40, y: 40, width: 10, height: 10 }, circularity: 0.7, solidity: 0.8, fillRatio: 0.5 }
const tracker = new CentroidTracker()
for (let frame = 0; frame < 10; frame++) tracker.update([ant], frame / 12, calibration, settings)
assert.equal(tracker.getVisibleTracks(1).length, 1)
assert.equal(tracker.getRecords().length, 6)
assert.ok(tracker.getRecords().every((record) => record.antId === 1 && !record.isMoving && record.speedCmPerSec === 0))
assert.equal(tracker.getVisibleTracks(1)[0].totalDistanceCm, 0)
tracker.update([], 1, calibration, settings)
tracker.update([ant], 1.1, calibration, settings)
assert.equal(tracker.getVisibleTracks(1.1)[0].id, 1)
tracker.update([{ ...ant, x: 46 }], 1.2, calibration, settings)
assert.ok(tracker.getRecords().at(-1).isMoving)
const transient = new CentroidTracker()
transient.update([ant], 0, calibration, settings)
transient.update([], 0.1, calibration, settings)
assert.equal(transient.getRecords().length, 0)
console.log('PASS: stationary confirmation, ID persistence, zero speed/distance, moving ant, transient rejection')

// Optional actual OpenCV runtime, downloaded to tmp (never committed).
if (process.argv[2]) {
  const cvModule = require(path.resolve(process.argv[2]))
  if (!cvModule.Mat) await new Promise((resolve) => cvModule.then(() => resolve()))
  const cv = cvModule
  let handleMessage
  let result
  const self = {
    cv,
    importScripts() {},
    postMessage(message) { result = message },
    addEventListener(_name, handler) { handleMessage = handler },
  }
  vm.runInNewContext(fs.readFileSync('public/opencv-worker.js', 'utf8'), { self, Uint8ClampedArray, console })
  assert.equal(result.type, 'ready', result.message)
  const width = 120, height = 100
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let color = [25, 70, 210, 255] // blue gel
    if (x >= 20 && x < 75 && y >= 20 && y < 50) color = [230, 230, 230, 255] // tunnel
    if (x >= 40 && x < 50 && y >= 35 && y < 40) color = [20, 20, 20, 255] // stationary ant
    if (x < 8) color = [240, 240, 240, 255] // outside ROI
    data.set(color, (y * width + x) * 4)
  }
  for (const mode of ['ants', 'tunnels', 'both']) {
    handleMessage({ data: {
      type: 'analyze', requestId: 1, timestampMs: 0, frame: { width, height, data }, roiPoints: roi,
      sourceWidth: width, sourceHeight: height, renderMask: true,
      settings: { ...detectorSettings, mode, blurSize: 1, morphologySize: 1, maxCircularity: 1, maxFillRatio: 1 },
    } })
    assert.equal(result.type, 'result', result.message)
    assert.equal(result.detections.length, mode === 'tunnels' ? 0 : 1)
    if (mode !== 'ants') {
      assert.equal(result.tunnels.regionCount, 1)
      assert.ok(result.tunnels.areaPixel > 1000)
      assert.ok(result.tunnels.roiFraction > 0 && result.tunnels.roiFraction < 1)
      const mask = result.tunnelMask.data
      assert.equal(mask[(30 * width + 3) * 4 + 3], 0, 'Outside ROI must be transparent')
      assert.equal(mask[(37 * width + 45) * 4 + 3], 0, 'Dark ant must not become a tunnel')
      assert.ok(mask[(25 * width + 25) * 4 + 3] > 0)
    } else assert.equal(result.tunnelMask, undefined)
  }
  console.log('PASS: actual OpenCV worker, all three modes, ROI exclusion, blue gel and ant exclusion, tunnel area')
} else console.log('SKIP: OpenCV runtime check (pass a local opencv.cjs path to enable)')
