import type { TrackingStatus } from '../types/tracking'

interface TrackingControlsProps {
  status: TrackingStatus
  canStart: boolean
  recordCount: number
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onEnd: () => void
  onReset: () => void
  onDownload: () => void
}

export function TrackingControls({
  status,
  canStart,
  recordCount,
  onStart,
  onPause,
  onResume,
  onEnd,
  onReset,
  onDownload,
}: TrackingControlsProps) {
  return (
    <section className="panel-section tracking-controls">
      <div className="section-heading"><div><span className="eyebrow">SESSION</span><h2>추적 제어</h2></div><span className={`session-badge ${status}`}>{status}</span></div>
      <div className="button-row wrap">
        {(status === 'idle' || status === 'ended') && <button className="primary" disabled={!canStart} onClick={onStart}>추적 시작</button>}
        {status === 'running' && <button className="primary" onClick={onPause}>일시정지</button>}
        {status === 'paused' && <button className="primary" onClick={onResume}>추적 재개</button>}
        <button disabled={status === 'idle' || status === 'ended'} onClick={onEnd}>추적 종료</button>
        <button disabled={recordCount === 0} onClick={onDownload}>CSV 다운로드</button>
        <button className="danger-ghost" disabled={recordCount === 0 && status === 'idle'} onClick={onReset}>데이터 초기화</button>
      </div>
      <p className="record-count">누적 좌표 <strong>{recordCount.toLocaleString()}</strong>개</p>
    </section>
  )
}
