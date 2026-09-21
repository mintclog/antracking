import type { Point } from '../types/tracking'
import { ROI_LABELS } from '../tracking/roi'

interface RoiControlsProps {
  points: Point[]
  isSelecting: boolean
  widthCm: number
  heightCm: number
  onWidthChange: (value: number) => void
  onHeightChange: (value: number) => void
  onStartSelecting: () => void
  onUndo: () => void
  onReset: () => void
}

export function RoiControls({
  points,
  isSelecting,
  widthCm,
  heightCm,
  onWidthChange,
  onHeightChange,
  onStartSelecting,
  onUndo,
  onReset,
}: RoiControlsProps) {
  const nextLabel = ROI_LABELS[points.length]
  return (
    <section className="panel-section">
      <div className="section-heading">
        <div><span className="eyebrow">CALIBRATION</span><h2>분석 영역</h2></div>
        <span className="counter">{points.length}/4</span>
      </div>
      <p className="hint">
        {isSelecting && nextLabel
          ? `${nextLabel} 지점을 클릭하세요 — 좌상 → 우상 → 우하 → 좌하`
          : points.length === 4
            ? '분석 영역 설정 완료'
            : '카메라 화면에서 노란 스티커 중심 4개를 지정하세요.'}
      </p>
      <div className="button-row">
        <button className="primary" onClick={onStartSelecting}>{points.length ? '다시 설정' : '영역 설정'}</button>
        <button onClick={onUndo} disabled={points.length === 0}>마지막 점 취소</button>
        <button onClick={onReset} disabled={points.length === 0}>초기화</button>
      </div>
      <div className="two-column-fields">
        <label>실제 가로 (cm)<input type="number" min="0.1" step="0.1" value={widthCm} onChange={(event) => onWidthChange(Number(event.target.value))} /></label>
        <label>실제 세로 (cm)<input type="number" min="0.1" step="0.1" value={heightCm} onChange={(event) => onHeightChange(Number(event.target.value))} /></label>
      </div>
    </section>
  )
}
