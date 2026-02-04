import { useState } from 'react'
import AuthorSelectStep from '../components/meeting/AuthorSelectStep'
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
  | 'author'
  | 'meeting-select'
  | 'meeting-detail'
  | 'record'
  | 'transcribe'
  | 'structure'
  | 'hubspot-link'
  | 'final-review'

export default function MeetingLogPage() {
  const [step, setStep] = useState<Step>('author')
  const [data, setData] = useState<MeetingFlowData>(INITIAL_DATA)

  const updateData = (updates: Partial<MeetingFlowData>) => {
    setData(prev => ({ ...prev, ...updates }))
  }

  switch (step) {
    case 'author':
      return (
        <AuthorSelectStep
          onSelect={(owner) => {
            updateData({ owner })
            setStep('meeting-select')
          }}
        />
      )

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
          onBack={() => setStep('author')}
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
            setStep('author')
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
  }
}
