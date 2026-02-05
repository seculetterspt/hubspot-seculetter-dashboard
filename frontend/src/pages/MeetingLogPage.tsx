import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../services/api'
import { Loader2 } from 'lucide-react'
import MeetingSelectStep from '../components/meeting/MeetingSelectStep'
import MeetingDetailStep from '../components/meeting/MeetingDetailStep'
import VoiceRecordStep from '../components/meeting/VoiceRecordStep'
import TranscriptionStep from '../components/meeting/TranscriptionStep'
import StructuredReviewStep from '../components/meeting/StructuredReviewStep'
import HubspotLinkStep from '../components/meeting/HubspotLinkStep'
import FinalReviewStep from '../components/meeting/FinalReviewStep'

export interface MeetingFlowData {
  owner: { id: string; name: string; email: string } | null
  selectedMeeting: {
    id: string
    title: string
    startTime: string
    endTime?: string
    location?: string
    body?: string
  } | null
  meetingAssociations: {
    companies: { id: string; name: string }[]
    contacts: { id: string; name: string }[]
    deals: { id: string; name: string }[]
  }
  audioBlob: Blob | null
  audioDuration: number
  transcript: string
  structuredContent: any | null
  clarificationQuestions: any[]
  finalAssociations: {
    companies: { id: string; name: string }[]
    contacts: { id: string; name: string }[]
    deals: { id: string; name: string }[]
  }
}

const INITIAL_DATA: MeetingFlowData = {
  owner: null,
  selectedMeeting: null,
  meetingAssociations: { companies: [], contacts: [], deals: [] },
  audioBlob: null,
  audioDuration: 0,
  transcript: '',
  structuredContent: null,
  clarificationQuestions: [],
  finalAssociations: { companies: [], contacts: [], deals: [] },
}

type Step =
  | 'loading'
  | 'meeting-select'
  | 'meeting-detail'
  | 'record'
  | 'transcribe'
  | 'structure'
  | 'hubspot-link'
  | 'final-review'

export default function MeetingLogPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [step, setStep] = useState<Step>('loading')
  const [data, setData] = useState<MeetingFlowData>(INITIAL_DATA)
  const [error, setError] = useState<string | null>(null)

  const updateData = (updates: Partial<MeetingFlowData>) => {
    setData(prev => ({ ...prev, ...updates }))
  }

  // Auto-lookup HubSpot owner by logged-in user's email
  useEffect(() => {
    const fetchOwner = async () => {
      if (!user?.email) return

      try {
        const res = await api.get('/meetings/owners')
        const owners = res.data.owners || []
        const matchedOwner = owners.find(
          (o: { email: string }) => o.email.toLowerCase() === user.email.toLowerCase()
        )

        if (matchedOwner) {
          updateData({ owner: matchedOwner })
          setStep('meeting-select')
        } else {
          // User email not found in HubSpot owners - show error
          setError(`등록된 HubSpot 사용자가 아닙니다: ${user.email}`)
        }
      } catch (err) {
        console.error('Failed to fetch owners:', err)
        setError('HubSpot 사용자 정보를 불러오지 못했습니다')
      }
    }

    fetchOwner()
  }, [user?.email])

  // Loading state while fetching owner
  if (step === 'loading') {
    if (error) {
      return (
        <div className="max-w-lg mx-auto flex flex-col items-center justify-center min-h-[50vh] px-4">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <p className="text-red-700 font-medium mb-4">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200"
            >
              타임라인으로 돌아가기
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 size={32} className="animate-spin text-primary-600 mb-3" />
        <p className="text-gray-500">사용자 정보 확인 중...</p>
      </div>
    )
  }

  switch (step) {
    case 'meeting-select':
      return (
        <MeetingSelectStep
          ownerId={data.owner?.id || ''}
          onSelect={(meeting, associations) => {
            updateData({ selectedMeeting: meeting, meetingAssociations: associations })
            setStep('meeting-detail')
          }}
          onSkip={() => {
            updateData({
              selectedMeeting: null,
              meetingAssociations: { companies: [], contacts: [], deals: [] },
            })
            setStep('record')
          }}
          onBack={() => navigate('/')}
        />
      )

    case 'meeting-detail':
      return (
        <MeetingDetailStep
          meeting={data.selectedMeeting!}
          associations={data.meetingAssociations}
          onConfirm={(updatedAssociations) => {
            updateData({ meetingAssociations: updatedAssociations })
            setStep('record')
          }}
          onBack={() => setStep('meeting-select')}
        />
      )

    case 'record':
      return (
        <VoiceRecordStep
          meetingTitle={data.selectedMeeting?.title}
          onRecorded={(audioBlob, duration) => {
            updateData({ audioBlob, audioDuration: duration })
            setStep('transcribe')
          }}
          onBack={() =>
            data.selectedMeeting ? setStep('meeting-detail') : setStep('meeting-select')
          }
        />
      )

    case 'transcribe':
      return (
        <TranscriptionStep
          audioBlob={data.audioBlob!}
          onTranscribed={(transcript) => {
            updateData({ transcript })
            setStep('structure')
          }}
          onEmpty={() => setStep('meeting-select')}
          onRetry={() => setStep('record')}
          onCancel={() => {
            setData(INITIAL_DATA)
            navigate('/')
          }}
        />
      )

    case 'structure':
      return (
        <StructuredReviewStep
          transcript={data.transcript}
          meetingContext={{
            companyName: data.meetingAssociations.companies[0]?.name,
            dealName: data.meetingAssociations.deals[0]?.name,
            contactName: data.meetingAssociations.contacts[0]?.name,
          }}
          onStructured={(structuredContent, clarificationQuestions) => {
            updateData({ structuredContent, clarificationQuestions })
            setStep('hubspot-link')
          }}
          onBack={() => setStep('record')}
        />
      )

    case 'hubspot-link':
      return (
        <HubspotLinkStep
          structuredContent={data.structuredContent!}
          existingAssociations={data.meetingAssociations}
          onConfirm={(finalAssociations) => {
            updateData({ finalAssociations })
            setStep('final-review')
          }}
          onBack={() => setStep('structure')}
        />
      )

    case 'final-review':
      return (
        <FinalReviewStep
          data={data}
          onBack={() => setStep('hubspot-link')}
        />
      )

    default:
      return null
  }
}
