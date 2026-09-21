import { useCallback, useEffect, useState } from 'react'

const LOAD_TIMEOUT_MS = 60_000

type OpenCvStatus = 'loading' | 'ready' | 'error'

interface WorkerStatusMessage {
  type: 'ready' | 'error'
  message?: string
  requestId?: number
}

export function useOpenCv() {
  const [status, setStatus] = useState<OpenCvStatus>('loading')
  const [worker, setWorker] = useState<Worker | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const detectorWorker = new Worker('/opencv-worker.js', {
      type: 'classic',
      name: 'ant-detector',
    })
    let active = true
    queueMicrotask(() => {
      if (active) setWorker(detectorWorker)
    })

    const timeout = window.setTimeout(() => {
      if (!active) return
      detectorWorker.terminate()
      setWorker(null)
      setStatus('error')
      setError('OpenCV.js 초기화 시간이 초과되었습니다. 인터넷 연결을 확인하고 다시 시도하세요.')
    }, LOAD_TIMEOUT_MS)

    const handleMessage = (event: MessageEvent<WorkerStatusMessage>) => {
      if (!active || event.data.requestId !== undefined) return
      if (event.data.type === 'ready') {
        window.clearTimeout(timeout)
        setStatus('ready')
        setError(null)
      } else if (event.data.type === 'error') {
        window.clearTimeout(timeout)
        setStatus('error')
        setError(event.data.message ?? 'OpenCV.js 초기화에 실패했습니다.')
      }
    }
    const handleWorkerError = (event: ErrorEvent) => {
      if (!active) return
      window.clearTimeout(timeout)
      setStatus('error')
      setError(event.message || 'OpenCV worker를 시작하지 못했습니다.')
    }

    detectorWorker.addEventListener('message', handleMessage)
    detectorWorker.addEventListener('error', handleWorkerError)
    return () => {
      active = false
      window.clearTimeout(timeout)
      detectorWorker.removeEventListener('message', handleMessage)
      detectorWorker.removeEventListener('error', handleWorkerError)
      detectorWorker.terminate()
    }
  }, [attempt])

  const retry = useCallback(() => {
    setWorker(null)
    setError(null)
    setStatus('loading')
    setAttempt((current) => current + 1)
  }, [])

  return { worker, status, error, retry, clearError: () => setError(null) }
}
