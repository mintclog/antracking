import type { CameraStatus } from '../hooks/useCamera'

interface CameraControlsProps {
  devices: MediaDeviceInfo[]
  selectedDeviceId: string
  status: CameraStatus
  resolution: { width: number; height: number }
  fps: number
  onSelect: (deviceId: string) => void
  onStart: () => void
  onStop: () => void
  onRefresh: () => void
}

export function CameraControls({
  devices,
  selectedDeviceId,
  status,
  resolution,
  fps,
  onSelect,
  onStart,
  onStop,
  onRefresh,
}: CameraControlsProps) {
  return (
    <section className="panel-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">INPUT</span>
          <h2>Camera</h2>
        </div>
        <span className={`status-dot ${status === 'ready' ? 'online' : ''}`} />
      </div>

      <label>
        카메라
        <select value={selectedDeviceId} onChange={(event) => onSelect(event.target.value)}>
          {devices.length === 0 && <option value="">카메라 없음</option>}
          {devices.map((device, index) => (
            <option key={device.deviceId || index} value={device.deviceId}>
              {device.label || `카메라 ${index + 1} (권한 허용 후 이름 표시)`}
            </option>
          ))}
        </select>
      </label>

      <div className="metric-row">
        <div><span>해상도</span><strong>{resolution.width ? `${resolution.width} × ${resolution.height}` : '—'}</strong></div>
        <div><span>표시 FPS</span><strong>{fps ? fps.toFixed(1) : '—'}</strong></div>
      </div>

      <div className="button-row">
        <button className="primary" onClick={onStart} disabled={status === 'starting'}>
          {status === 'starting' ? '연결 중…' : '카메라 시작'}
        </button>
        <button onClick={onStop} disabled={status !== 'ready'}>중지</button>
        <button className="icon-button" onClick={onRefresh} title="목록 새로고침">↻</button>
      </div>
    </section>
  )
}
