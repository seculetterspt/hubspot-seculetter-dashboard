import { useEffect, useState } from 'react'
import { Loader2, Mic, RotateCcw, X } from 'lucide-react'
import { api } from '../../services/api'

interface Props {
  audioBlob: Blob
  onTranscribed: (transcript: string) => void
  onEmpty: () => void
  onRetry: () => void
  onCancel: () => void
}

export default function TranscriptionStep({ audioBlob, onTranscribed, onEmpty, onRetry, onCancel }: Props) {
  const [status, setStatus] = useState<'processing' | 'empty' | 'error'>('processing')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const transcribe = async () => {
      try {
        // Blob → base64
        const reader = new FileReader()
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(audioBlob)
        })

        const res = await api.post('/meetings/transcribe', {
          audio: base64,
          mimeType: audioBlob.type,
        })

        if (res.data.isEmpty) {
          setStatus('empty')
        } else {
          onTranscribed(res.data.transcript)
        }
      } catch (err: any) {
        setStatus('error')
        setErrorMsg(err.response?.data?.error || '음성 변환에 실패했습니다')
      }
    }
    transcribe()
  }, [audioBlob, onTranscribed])

  if (status === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={48} className="animate-spin text-primary-600 mb-6" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">음성을 텍스트로 변환 중...</h2>
        <p className="text-gray-500 text-sm">잠시만 기다려주세요</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <X size={32} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">변환 실패</h2>
        <p className="text-gray-500 text-center mb-8">{errorMsg}</p>
        <div className="space-y-3 w-full max-w-xs">
          <button
            onClick={onRetry}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary-600 text-white rounded-2xl font-medium"
          >
            <Mic size={20} /> 다시 녹음하기
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3.5 text-gray-500 rounded-2xl font-medium hover:bg-gray-100"
          >
            취소
          </button>
        </div>
      </div>
    )
  }

  // 빈 트랜스크립트
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-6">
        <Mic size={32} className="text-amber-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">기록할 내용이 없습니다</h2>
      <p className="text-gray-500 text-center mb-8">
        음성이 감지되지 않았거나
        <br />
        내용이 너무 짧습니다
      </p>
      <div className="space-y-3 w-full max-w-xs">
        <button
          onClick={onRetry}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary-600 text-white rounded-2xl font-medium"
        >
          <RotateCcw size={20} /> 다시 녹음하기
        </button>
        <button
          onClick={onEmpty}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border-2 border-gray-200 text-gray-700 rounded-2xl font-medium"
        >
          다음 미팅 기록하기
        </button>
        <button
          onClick={onCancel}
          className="w-full py-3.5 text-gray-500 rounded-2xl font-medium hover:bg-gray-100"
        >
          취소
        </button>
      </div>
    </div>
  )
}
