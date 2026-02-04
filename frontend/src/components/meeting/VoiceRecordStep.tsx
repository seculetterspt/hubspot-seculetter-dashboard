import { ChevronLeft, Mic, Square, AlertCircle } from 'lucide-react'
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder'

interface Props {
  meetingTitle?: string
  onRecorded: (audioBlob: Blob, duration: number) => void
  onBack: () => void
}

export default function VoiceRecordStep({ meetingTitle, onRecorded, onBack }: Props) {
  const { isRecording, duration, startRecording, stopRecording, error } = useVoiceRecorder()

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const handleToggle = async () => {
    if (isRecording) {
      const result = await stopRecording()
      if (result.blob.size > 0) {
        onRecorded(result.blob, result.duration)
      }
    } else {
      await startRecording()
    }
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col min-h-[65vh]">
      <div className="flex items-center gap-3 pt-2">
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ChevronLeft size={24} className="text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">음성 녹음</h1>
      </div>

      {/* 미팅 컨텍스트 */}
      {meetingTitle && (
        <div className="text-center mt-4">
          <p className="text-sm text-gray-500">{meetingTitle}</p>
        </div>
      )}

      {/* 녹음 영역 - 화면 중앙 */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {error ? (
          <div className="text-center px-6">
            <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
            <p className="text-red-600 whitespace-pre-line">{error}</p>
            <button
              onClick={startRecording}
              className="mt-6 px-6 py-3 bg-primary-600 text-white rounded-xl font-medium"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <>
            {/* 녹음 버튼 */}
            <button
              onClick={handleToggle}
              className={`w-28 h-28 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95 ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                  : 'bg-primary-600 hover:bg-primary-700'
              }`}
            >
              {isRecording ? (
                <Square size={36} className="text-white" fill="white" />
              ) : (
                <Mic size={40} className="text-white" />
              )}
            </button>

            {/* 상태 텍스트 */}
            <p className={`mt-6 text-lg font-medium ${isRecording ? 'text-red-600' : 'text-gray-500'}`}>
              {isRecording ? '녹음 중...' : '탭하여 녹음 시작'}
            </p>

            {/* 타이머 */}
            <p className={`mt-2 text-3xl font-mono tabular-nums ${isRecording ? 'text-red-600' : 'text-gray-300'}`}>
              {formatDuration(duration)}
            </p>

            {/* 녹음 중 파형 인디케이터 */}
            {isRecording && (
              <div className="flex items-center gap-1 mt-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-red-400 rounded-full animate-pulse"
                    style={{
                      height: `${12 + Math.random() * 24}px`,
                      animationDelay: `${i * 0.15}s`,
                      animationDuration: `${0.5 + Math.random() * 0.5}s`,
                    }}
                  />
                ))}
              </div>
            )}

            {/* 안내 */}
            {!isRecording && (
              <p className="mt-8 text-sm text-gray-400 text-center px-8">
                미팅 내용을 말씀해주세요.
                <br />
                AI가 자동으로 정리해드립니다.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
