import OpenAI from 'openai';

interface Activity {
  id: string;
  type: 'call' | 'note' | 'meeting' | 'email';
  subject?: string;
  body?: string;
  timestamp: string;
  associations?: {
    contacts?: string[];
    companies?: string[];
    deals?: string[];
  };
}

interface ActivitySummary {
  overview: string;
  keyActivities: string[];
  insights: string[];
  recommendations: string[];
}

export class SummaryService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async summarizeActivities(activities: Activity[]): Promise<ActivitySummary> {
    if (!activities || activities.length === 0) {
      return {
        overview: '최근 24시간 내 기록된 활동이 없습니다.',
        keyActivities: [],
        insights: [],
        recommendations: ['영업 활동을 시작하고 CRM에 기록해주세요.'],
      };
    }

    const activityText = this.formatActivitiesForPrompt(activities);

    const prompt = `당신은 B2B 영업팀의 CRM 분석 전문가입니다. 최근 24시간 동안의 영업 활동 데이터를 분석하여 팀이 현재 어떤 일을 하고 있는지, 어떤 목적으로 활동하는지를 명확하게 요약해주세요.

## 활동 데이터:
${activityText}

## 분석 요청:
다음 형식으로 JSON 응답을 작성해주세요:

{
  "overview": "전체 활동에 대한 2-3문장 요약 (현재 팀이 무엇을 하고 있는지, 어떤 방향으로 움직이고 있는지)",
  "keyActivities": ["주요 활동 1", "주요 활동 2", "주요 활동 3"],
  "insights": ["발견한 인사이트 1", "발견한 인사이트 2"],
  "recommendations": ["추천 사항 1", "추천 사항 2"]
}

응답은 반드시 유효한 JSON 형식으로만 작성하세요. 한국어로 작성해주세요.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '당신은 B2B 영업 활동 분석 전문가입니다. 영업팀의 활동을 분석하여 비즈니스 인사이트를 제공합니다. 응답은 항상 유효한 JSON 형식으로만 작성합니다.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from OpenAI');
      }

      // JSON 파싱 시도
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as ActivitySummary;
      return {
        overview: parsed.overview || '요약을 생성할 수 없습니다.',
        keyActivities: parsed.keyActivities || [],
        insights: parsed.insights || [],
        recommendations: parsed.recommendations || [],
      };
    } catch (error) {
      console.error('Error summarizing activities:', error);
      return {
        overview: '활동 요약 생성 중 오류가 발생했습니다.',
        keyActivities: [],
        insights: [],
        recommendations: ['잠시 후 다시 시도해주세요.'],
      };
    }
  }

  private formatActivitiesForPrompt(activities: Activity[]): string {
    const grouped = {
      call: activities.filter(a => a.type === 'call'),
      note: activities.filter(a => a.type === 'note'),
      meeting: activities.filter(a => a.type === 'meeting'),
      email: activities.filter(a => a.type === 'email'),
    };

    let text = '';

    if (grouped.call.length > 0) {
      text += `### 전화 통화 (${grouped.call.length}건)\n`;
      grouped.call.forEach((call, i) => {
        text += `${i + 1}. ${call.timestamp} - ${call.subject || '제목 없음'}\n`;
        if (call.body) {
          text += `   내용: ${call.body.substring(0, 200)}${call.body.length > 200 ? '...' : ''}\n`;
        }
      });
      text += '\n';
    }

    if (grouped.meeting.length > 0) {
      text += `### 미팅 (${grouped.meeting.length}건)\n`;
      grouped.meeting.forEach((meeting, i) => {
        text += `${i + 1}. ${meeting.timestamp} - ${meeting.subject || '제목 없음'}\n`;
        if (meeting.body) {
          text += `   내용: ${meeting.body.substring(0, 200)}${meeting.body.length > 200 ? '...' : ''}\n`;
        }
      });
      text += '\n';
    }

    if (grouped.email.length > 0) {
      text += `### 이메일 (${grouped.email.length}건)\n`;
      grouped.email.forEach((email, i) => {
        text += `${i + 1}. ${email.timestamp} - ${email.subject || '제목 없음'}\n`;
        if (email.body) {
          text += `   내용: ${email.body.substring(0, 200)}${email.body.length > 200 ? '...' : ''}\n`;
        }
      });
      text += '\n';
    }

    if (grouped.note.length > 0) {
      text += `### 메모 (${grouped.note.length}건)\n`;
      grouped.note.forEach((note, i) => {
        text += `${i + 1}. ${note.timestamp}\n`;
        if (note.body) {
          text += `   내용: ${note.body.substring(0, 200)}${note.body.length > 200 ? '...' : ''}\n`;
        }
      });
      text += '\n';
    }

    return text || '활동 데이터가 없습니다.';
  }
}

export const summaryService = new SummaryService();
