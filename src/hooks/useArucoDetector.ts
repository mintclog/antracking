import { useCallback, useEffect, useState } from 'react'

type ArucoWorkerStatus = 'loading' | 'ready' | 'error'

interface ArucoWorkerMessage {
  type: 'ready' | 'error'
  message?: string
}

export function useArucoDetector() {
  const [worker, setWorker] = useState<Worker | null>(null)
  const [status, setStatus] = useState<ArucoWorkerStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    const nextWorker = new Worker(`${import.meta.env.BASE_URL}aruco-worker.js`)

    const handleMessage = (event: MessageEvent<ArucoWorkerMessage>) => {
      if (event.data.type === 'ready') {
        setWorker(nextWorker)
        setStatus('ready')
      } else if (event.data.type === 'error') {
        setStatus('error')
        setError(event.data.message ?? 'ArUco Marker 검출기를 초기화하지 못했습니다.')
      }
    }
    const handleError = () => {
      setStatus('error')
      setError('ArUco Marker 검출기를 불러오지 못했습니다.')
    }

    nextWorker.addEventListener('message', handleMessage)
    nextWorker.addEventListener('error', handleError)
    return () => {
      nextWorker.removeEventListener('message', handleMessage)
      nextWorker.removeEventListener('error', handleError)
      nextWorker.terminate()
    }
  }, [generation])

  const retry = useCallback(() => {
    setStatus('loading')
    setError(null)
    setWorker(null)
    setGeneration((value) => value + 1)
  }, [])
  const clearError = useCallback(() => setError(null), [])

  return { worker, status, error, retry, clearError }
}
