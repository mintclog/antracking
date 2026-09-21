import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraStatus = 'idle' | 'starting' | 'ready' | 'error'

function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return '카메라 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용하세요.'
    if (error.name === 'NotFoundError') return '사용 가능한 카메라를 찾을 수 없습니다.'
    if (error.name === 'NotReadableError') return '카메라가 다른 프로그램에서 사용 중이거나 연결이 끊겼습니다.'
    if (error.name === 'OverconstrainedError') {
      const constraint = 'constraint' in error ? String(error.constraint) : ''
      return `선택한 카메라가 요청한 설정을 지원하지 않습니다${constraint ? ` (${constraint})` : ''}.`
    }
  }
  return error instanceof Error ? error.message : '카메라를 시작하지 못했습니다.'
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [resolution, setResolution] = useState({ width: 0, height: 0 })
  const [error, setError] = useState<string | null>(null)

  const refreshDevices = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setError('이 브라우저는 카메라 장치 검색을 지원하지 않습니다.')
      return []
    }
    try {
      const cameras = (await navigator.mediaDevices.enumerateDevices()).filter(
        (device) => device.kind === 'videoinput',
      )
      setDevices(cameras)
      setSelectedDeviceId((current) => {
        const currentStillExists = cameras.some((camera) => camera.deviceId === current)
        return currentStillExists ? current : cameras[0]?.deviceId || ''
      })
      setError(cameras.length === 0 ? '연결된 카메라를 찾을 수 없습니다.' : null)
      return cameras
    } catch (reason) {
      setError(cameraErrorMessage(reason))
      return []
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('idle')
    setResolution({ width: 0, height: 0 })
    setError(null)
  }, [])

  const startCamera = useCallback(
    async (deviceId = selectedDeviceId) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('이 브라우저는 웹캠 사용을 지원하지 않습니다. 최신 Chrome 또는 Edge를 사용하세요.')
        setStatus('error')
        return false
      }
      stopCamera()
      setStatus('starting')
      setError(null)
      try {
        const cameras = await refreshDevices()
        const availableDeviceId = cameras.some((camera) => camera.deviceId === deviceId)
          ? deviceId
          : cameras[0]?.deviceId || ''
        const preferredDevice = availableDeviceId
          ? { deviceId: { ideal: availableDeviceId } }
          : {}
        const attempts: MediaTrackConstraints[] = [
          {
            ...preferredDevice,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          preferredDevice,
          {
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          {},
        ]

        let stream: MediaStream | null = null
        let lastError: unknown = null
        for (const constraints of attempts) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: constraints })
            break
          } catch (reason) {
            lastError = reason
            if (
              reason instanceof DOMException &&
              ['NotAllowedError', 'NotReadableError', 'SecurityError'].includes(reason.name)
            ) {
              throw reason
            }
          }
        }
        if (!stream) throw lastError ?? new Error('사용 가능한 카메라 스트림을 열지 못했습니다.')
        streamRef.current = stream
        const video = videoRef.current
        if (!video) throw new Error('비디오 화면을 초기화하지 못했습니다.')
        video.srcObject = stream
        await video.play()
        setResolution({ width: video.videoWidth, height: video.videoHeight })
        setStatus('ready')

        const activeDeviceId = stream.getVideoTracks()[0]?.getSettings().deviceId
        if (activeDeviceId) setSelectedDeviceId(activeDeviceId)
        await refreshDevices()

        stream.getVideoTracks()[0]?.addEventListener('ended', () => {
          if (streamRef.current === stream) {
            setStatus('error')
            setError('카메라 연결이 종료되었습니다. 연결 상태를 확인한 후 다시 시작하세요.')
          }
        })
        return true
      } catch (reason) {
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        setStatus('error')
        setError(cameraErrorMessage(reason))
        return false
      }
    },
    [refreshDevices, selectedDeviceId, stopCamera],
  )

  const selectCamera = useCallback(
    async (deviceId: string) => {
      setSelectedDeviceId(deviceId)
      if (streamRef.current) return startCamera(deviceId)
      return true
    },
    [startCamera],
  )

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refreshDevices(), 0)
    const handleDeviceChange = () => void refreshDevices()
    navigator.mediaDevices?.addEventListener('devicechange', handleDeviceChange)
    return () => {
      window.clearTimeout(initialRefresh)
      navigator.mediaDevices?.removeEventListener('devicechange', handleDeviceChange)
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [refreshDevices])

  return {
    videoRef,
    devices,
    selectedDeviceId,
    status,
    resolution,
    error,
    startCamera,
    stopCamera,
    selectCamera,
    refreshDevices,
    clearError: () => setError(null),
  }
}
