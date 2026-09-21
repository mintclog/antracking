import type { DetectorSettings, DisplaySettings, TrackerSettings } from '../types/tracking'

interface DetectorControlsProps {
  detector: DetectorSettings
  tracker: TrackerSettings
  display: DisplaySettings
  onDetectorChange: (patch: Partial<DetectorSettings>) => void
  onTrackerChange: (patch: Partial<TrackerSettings>) => void
  onDisplayChange: (patch: Partial<DisplaySettings>) => void
}

interface RangeFieldProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}

function RangeField({ label, value, min, max, step = 1, unit = '', onChange }: RangeFieldProps) {
  return (
    <label className="range-field">
      <span><span>{label}</span><output>{value}{unit}</output></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}

export function DetectorControls({
  detector,
  tracker,
  display,
  onDetectorChange,
  onTrackerChange,
  onDisplayChange,
}: DetectorControlsProps) {
  return (
    <section className="panel-section">
      <div className="section-heading"><div><span className="eyebrow">DETECTION</span><h2>검출 설정</h2></div></div>
      <RangeField label="밝기 Threshold" value={detector.threshold} min={0} max={255} onChange={(threshold) => onDetectorChange({ threshold })} />
      <div className="two-column-fields compact">
        <label>최소 면적 (px²)<input type="number" min="1" value={detector.minArea} onChange={(event) => onDetectorChange({ minArea: Number(event.target.value) })} /></label>
        <label>최대 면적 (px²)<input type="number" min="1" value={detector.maxArea} onChange={(event) => onDetectorChange({ maxArea: Number(event.target.value) })} /></label>
      </div>
      <details>
        <summary>고급 검출 설정</summary>
        <div className="advanced-settings">
          <RangeField label="Hue 최소" value={detector.hueMin} min={0} max={179} onChange={(hueMin) => onDetectorChange({ hueMin })} />
          <RangeField label="Hue 최대" value={detector.hueMax} min={0} max={179} onChange={(hueMax) => onDetectorChange({ hueMax })} />
          <RangeField label="채도 최소" value={detector.saturationMin} min={0} max={255} onChange={(saturationMin) => onDetectorChange({ saturationMin })} />
          <RangeField label="채도 최대" value={detector.saturationMax} min={0} max={255} onChange={(saturationMax) => onDetectorChange({ saturationMax })} />
          <RangeField label="Blur" value={detector.blurSize} min={1} max={15} step={2} onChange={(blurSize) => onDetectorChange({ blurSize })} />
          <RangeField label="Morphology" value={detector.morphologySize} min={1} max={11} step={2} onChange={(morphologySize) => onDetectorChange({ morphologySize })} />
          <RangeField label="최대 종횡비" value={detector.maxAspectRatio} min={1} max={8} step={0.5} onChange={(maxAspectRatio) => onDetectorChange({ maxAspectRatio })} />
          <RangeField label="분석 FPS" value={detector.analysisFps} min={1} max={30} onChange={(analysisFps) => onDetectorChange({ analysisFps })} />
          <RangeField label="분석 너비" value={detector.analysisWidth} min={320} max={960} step={160} unit="px" onChange={(analysisWidth) => onDetectorChange({ analysisWidth })} />
          <RangeField label="ID 최대 이동" value={tracker.maxMatchDistancePx} min={5} max={150} unit="px" onChange={(maxMatchDistancePx) => onTrackerChange({ maxMatchDistancePx })} />
          <RangeField label="ID 유지 프레임" value={tracker.maxMissingFrames} min={0} max={60} onChange={(maxMissingFrames) => onTrackerChange({ maxMissingFrames })} />
          <RangeField label="정지 판정 거리" value={tracker.stationaryDistanceCm} min={0} max={0.5} step={0.01} unit="cm" onChange={(stationaryDistanceCm) => onTrackerChange({ stationaryDistanceCm })} />
        </div>
      </details>
      <div className="toggle-grid">
        <label><input type="checkbox" checked={display.showIds} onChange={(event) => onDisplayChange({ showIds: event.target.checked })} />ID 표시</label>
        <label><input type="checkbox" checked={display.showPositions} onChange={(event) => onDisplayChange({ showPositions: event.target.checked })} />현재 위치</label>
        <label><input type="checkbox" checked={display.showTrails} onChange={(event) => onDisplayChange({ showTrails: event.target.checked })} />이동 경로</label>
        <label><input type="checkbox" checked={display.showRoi} onChange={(event) => onDisplayChange({ showRoi: event.target.checked })} />분석 영역</label>
        <label><input type="checkbox" checked={display.showMask} onChange={(event) => onDisplayChange({ showMask: event.target.checked })} />검출 마스크</label>
      </div>
    </section>
  )
}
