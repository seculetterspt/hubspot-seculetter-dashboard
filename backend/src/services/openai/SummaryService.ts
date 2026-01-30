import OpenAI from 'openai';

interface Activity {
  id: string;
  type: 'call' | 'note' | 'meeting' | 'email';
  subject?: string;
  body?: string;
  timestamp: string;
  associations?: {
    contacts?: { id: string; name: string }[];
    companies?: { id: string; name: string }[];
    deals?: { id: string; name: string }[];
  };
}

interface ActivityWithContext {
  id: string;
  type: 'call' | 'note' | 'meeting' | 'email';
  title?: string;
  body?: string;
  timestamp: string;
  date: string; // YYYY-MM-DD 형식
  companyName?: string;
  contactName?: string;
  dealName?: string;
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

  // 각 활동에 대한 개별 요약 생성 (배치 처리)
  async summarizeIndividualActivities(activities: Activity[]): Promise<Map<string, string>> {
    const summaries = new Map<string, string>();

    if (!activities || activities.length === 0) {
      return summaries;
    }

    // 활동 목록을 프롬프트로 변환
    const activitiesForPrompt = activities.map((a, i) => {
      let content = `[${i + 1}] ID: ${a.id}, 유형: ${this.getTypeLabel(a.type)}`;
      if (a.subject) content += `, 제목: ${a.subject}`;
      if (a.body) content += `\n   내용: ${a.body.substring(0, 300)}`;
      return content;
    }).join('\n\n');

    const prompt = `다음 CRM 활동들에 대해 각각 1-2문장으로 간단히 요약해주세요.
각 활동의 목적과 내용을 명확하게 설명해주세요.

## 활동 목록:
${activitiesForPrompt}

## 응답 형식:
각 활동 ID에 대해 JSON 형식으로 응답해주세요:
{
  "summaries": {
    "활동ID1": "이 활동에 대한 1-2문장 요약",
    "활동ID2": "이 활동에 대한 1-2문장 요약"
  }
}

반드시 유효한 JSON 형식으로 작성하세요. 한국어로 작성해주세요.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '당신은 CRM 활동을 분석하는 전문가입니다. 각 영업 활동의 핵심 내용을 간결하게 요약합니다.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from OpenAI');
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.summaries && typeof parsed.summaries === 'object') {
        for (const [id, summary] of Object.entries(parsed.summaries)) {
          summaries.set(id, summary as string);
        }
      }
    } catch (error) {
      console.error('Error generating individual summaries:', error);
    }

    return summaries;
  }

  // 날짜별 활동 요약 생성 (회사명 + 활동유형 + 날짜 형식)
  async summarizeActivitiesWithContext(activities: ActivityWithContext[]): Promise<Map<string, string>> {
    const summaries = new Map<string, string>();

    if (!activities || activities.length === 0) {
      return summaries;
    }

    // 활동 목록을 프롬프트로 변환
    const activitiesForPrompt = activities.map((a, i) => {
      const lines = [
        `[${i + 1}] ID: ${a.id}`,
        `유형: ${this.getTypeLabel(a.type)}`,
        `날짜: ${a.date}`,
      ];
      if (a.companyName) lines.push(`회사: ${a.companyName}`);
      if (a.contactName) lines.push(`담당자: ${a.contactName}`);
      if (a.dealName) lines.push(`거래: ${a.dealName}`);
      if (a.title) lines.push(`제목: ${a.title}`);
      if (a.body) lines.push(`내용: ${a.body.substring(0, 500)}`);
      return lines.join('\n');
    }).join('\n\n---\n\n');

    const prompt = `당신은 B2B 영업 활동을 분석하는 전문가입니다.
다음 CRM 활동들에 대해 각각 핵심 내용을 2-3문장으로 요약해주세요.

## 요약 작성 가이드:
1. 고객의 문의/요청 사항을 명확히 기술
2. 논의된 주요 내용 요약
3. 후속 조치가 필요한 사항 포함
4. 비즈니스 맥락에서 중요한 정보 강조

## 활동 목록:
${activitiesForPrompt}

## 응답 형식:
각 활동 ID에 대해 JSON 형식으로 응답해주세요:
{
  "summaries": {
    "활동ID1": "고객 요청사항과 논의 내용, 후속 조치 사항을 포함한 2-3문장 요약",
    "활동ID2": "고객 요청사항과 논의 내용, 후속 조치 사항을 포함한 2-3문장 요약"
  }
}

반드시 유효한 JSON 형식으로 작성하세요. 한국어로 자연스럽게 작성해주세요.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '당신은 B2B 영업 활동을 분석하는 전문가입니다. 각 활동의 비즈니스 맥락을 이해하고 핵심 내용을 명확하게 요약합니다.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 3000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from OpenAI');
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.summaries && typeof parsed.summaries === 'object') {
        for (const [id, summary] of Object.entries(parsed.summaries)) {
          summaries.set(id, summary as string);
        }
      }
    } catch (error) {
      console.error('Error generating contextual summaries:', error);
    }

    return summaries;
  }

  private getTypeLabel(type: string): string {
    switch (type) {
      case 'call': return '전화';
      case 'note': return '메모';
      case 'meeting': return '미팅';
      case 'email': return '이메일';
      default: return type;
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
