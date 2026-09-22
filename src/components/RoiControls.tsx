import { ROI_LABELS } from '../tracking/roi'
import type { ArucoStatus, Point, RoiMode } from '../types/tracking'
import { openArucoMarkerSheet } from '../utils/arucoMarkerSheet'

interface RoiControlsProps {
  points: Point[]
  mode: RoiMode
  arucoStatus: ArucoStatus
  markerCount: number
  isSelecting: boolean
  widthCm: number
  heightCm: number
  onModeChange: (mode: RoiMode) => void
  onWidthChange: (value: number) => void
  onHeightChange: (value: number) => void
  onStartSelecting: () => void
  onUndo: () => void
  onReset: () => void
}

const ARUCO_STATUS_LABELS: Record<ArucoStatus, string> = {
  idle: '카메라 대기',
  searching: '마커 검색 중',
  partial: '일부 마커만 감지',
  locked: '자동 영역 완료',
  error: '마커 검출 오류',
}

export function RoiControls({
  points,
  mode,
  arucoStatus,
  markerCount,
  isSelecting,
  widthCm,
  heightCm,
  onModeChange,
  onWidthChange,
  onHeightChange,
  onStartSelecting,
  onUndo,
  onReset,
}: RoiControlsProps) {
  const nextLabel = ROI_LABELS[points.length]

  const openMarkerSheet = () => {
    try {
      openArucoMarkerSheet()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '마커 인쇄 화면을 열지 못했습니다.')
    }
  }

  return (
    <section className="panel-section">
      <div className="section-heading">
        <div><span className="eyebrow">CALIBRATION</span><h2>분석 영역</h2></div>
        <span className="counter">{mode === 'aruco' ? markerCount : points.length}/4</span>
      </div>

      <div className="mode-toggle" role="group" aria-label="영역 설정 방식">
        <button className={mode === 'aruco' ? 'active' : ''} aria-pressed={mode === 'aruco'} onClick={() => onModeChange('aruco')}>ArUco 자동</button>
        <button className={mode === 'manual' ? 'active' : ''} aria-pressed={mode === 'manual'} onClick={() => onModeChange('manual')}>수동 4점</button>
      </div>

      {mode === 'aruco' ? (
        <>
          <p className="hint aruco-guide">
            ID 0·1·2·3을 좌상·우상·우하·좌하에 붙이면 사육장 쪽 안쪽 모서리로 영역을 자동 설정합니다.
          </p>
          <div className="aruco-status-row">
            <span className={arucoStatus === 'locked' ? 'ready' : ''}>{ARUCO_STATUS_LABELS[arucoStatus]}</span>
            <strong>{markerCount}/4 detected</strong>
          </div>
          <p className="hint">
            {arucoStatus === 'partial' && points.length === 4
              ? '마커를 놓쳤지만 마지막 정상 영역을 유지합니다.'
              : arucoStatus === 'locked'
                ? '3회 연속 검출을 확인했습니다. 추적 중에는 이 영역이 잠깁니다.'
                : '네 마커 전체와 흰 여백이 화면 안에 보이도록 카메라를 조정하세요.'}
          </p>
          <div className="button-row">
            <button className="primary" onClick={openMarkerSheet}>마커 인쇄</button>
            <button onClick={onReset}>다시 찾기</button>
          </div>
        </>
      ) : (
        <>
          <p className="hint">
            {isSelecting && nextLabel
              ? `${nextLabel} 지점을 클릭하세요 — 좌상 → 우상 → 우하 → 좌하`
              : points.length === 4
                ? '수동 분석 영역 설정 완료'
                : '카메라 화면에서 사육장 모서리 4개를 직접 지정하세요.'}
          </p>
          <div className="button-row">
            <button className="primary" onClick={onStartSelecting}>{points.length ? '다시 설정' : '영역 설정'}</button>
            <button onClick={onUndo} disabled={points.length === 0}>마지막 점 취소</button>
            <button onClick={onReset} disabled={points.length === 0}>초기화</button>
          </div>
        </>
      )}

      <div className="two-column-fields">
        <label>실제 가로 (cm)<input type="number" min="0.1" step="0.1" value={widthCm} onChange={(event) => onWidthChange(Number(event.target.value))} /></label>
        <label>실제 세로 (cm)<input type="number" min="0.1" step="0.1" value={heightCm} onChange={(event) => onHeightChange(Number(event.target.value))} /></label>
      </div>
    </section>
  )
}
