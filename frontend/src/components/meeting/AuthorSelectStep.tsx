import { useEffect, useState } from 'react'
import { User, Loader2 } from 'lucide-react'
import { api } from '../../services/api'

interface Owner {
  id: string
  name: string
  email: string
}

interface Props {
  onSelect: (owner: Owner) => void
}

export default function AuthorSelectStep({ onSelect }: Props) {
  const [owners, setOwners] = useState<Owner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchOwners = async () => {
      try {
        const res = await api.get('/meetings/owners')
        setOwners(res.data.owners || [])
      } catch {
        setError('담당자 목록을 불러올 수 없습니다')
      } finally {
        setLoading(false)
      }
    }
    fetchOwners()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 size={32} className="animate-spin text-primary-600 mb-3" />
        <p className="text-gray-500">담당자 목록 불러오는 중...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-6">
        <p className="text-red-500 text-center">{error}</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8 pt-4">
        <h1 className="text-2xl font-bold text-gray-900">미팅 기록하기</h1>
        <p className="text-gray-500 mt-2">누가 기록하나요?</p>
      </div>

      <div className="space-y-3 px-2">
        {owners.map((owner) => (
          <button
            key={owner.id}
            onClick={() => onSelect(owner)}
            className="w-full flex items-center gap-4 px-5 py-4 bg-white rounded-2xl border-2 border-gray-200 hover:border-primary-400 active:bg-primary-50 transition-all"
          >
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
              <User size={24} className="text-primary-600" />
            </div>
            <div className="text-left">
              <span className="text-lg font-semibold text-gray-900 block">{owner.name}</span>
              <span className="text-sm text-gray-500">{owner.email}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
