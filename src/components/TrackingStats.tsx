import type { TrackSnapshot } from '../types/tracking'
import { formatDuration } from '../utils/geometry'

interface TrackingStatsProps {
  tracks: TrackSnapshot[]
  elapsedSec: number
  detectedCount: number
}

export function TrackingStats({ tracks, elapsedSec, detectedCount }: TrackingStatsProps) {
  return (
    <section className="stats-panel">
      <div className="stats-header">
        <div><span className="eyebrow">LIVE DATA</span><h2>Tracking Data</h2></div>
        <div className="session-summary">
          <span>검출 {detectedCount}</span>
          <strong>{formatDuration(elapsedSec)}</strong>
        </div>
      </div>
      {tracks.length === 0 ? (
        <div className="empty-state">추적을 시작하면 개미별 이동 통계가 여기에 표시됩니다.</div>
      ) : (
        <div className="stats-table-wrap">
          <table>
            <thead><tr><th>개체</th><th>상태</th><th>현재 위치</th><th>이동거리</th><th>평균속도</th><th>추적시간</th></tr></thead>
            <tbody>
              {tracks.map((track) => (
                <tr key={track.id}>
                  <td><span className="ant-id" style={{ '--ant-color': `hsl(${(track.id * 67) % 360} 82% 60%)` } as React.CSSProperties}>Ant {track.id}</span></td>
                  <td><span className={`tracking-state ${track.isDetected ? 'detected' : ''}`}>{track.archived ? 'Lost' : track.isDetected ? 'Tracking' : `Missing ${track.missingFrames}`}</span></td>
                  <td>{track.position.x.toFixed(0)}, {track.position.y.toFixed(0)} px</td>
                  <td>{track.totalDistanceCm.toFixed(2)} cm</td>
                  <td>{track.averageSpeedCmPerSec.toFixed(3)} cm/s</td>
                  <td>{formatDuration(track.elapsedSec)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
