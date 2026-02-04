import { useState, useRef, useCallback } from 'react'

interface UseVoiceRecorderReturn {
  isRecording: boolean
  duration: number
  startRecording: () => Promise<void>
  stopRecording: () => Promise<{ blob: Blob; duration: number }>
  error: string | null
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const startRecording = useCallback(async () => {
    try {
      setError(null)
      chunksRef.current = []

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      })

      // 지원되는 MIME 타입 선택
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : ''

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.start(1000)
      startTimeRef.current = Date.now()
      setIsRecording(true)
      setDuration(0)

      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('마이크 접근이 거부되었습니다.\n브라우저 설정에서 마이크를 허용해주세요.')
      } else if (err.name === 'NotFoundError') {
        setError('마이크를 찾을 수 없습니다.\n기기에 마이크가 연결되어 있는지 확인해주세요.')
      } else {
        setError('녹음을 시작할 수 없습니다.')
      }
    }
  }, [])

  const stopRecording = useCallback(() => {
    return new Promise<{ blob: Blob; duration: number }>((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve({ blob: new Blob(), duration: 0 })
        return
      }

      mediaRecorderRef.current.onstop = () => {
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000)

        // 모든 트랙 정지
        mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop())

        setIsRecording(false)
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }

        resolve({ blob, duration: finalDuration })
      }

      mediaRecorderRef.current.stop()
    })
  }, [])

  return { isRecording, duration, startRecording, stopRecording, error }
}
