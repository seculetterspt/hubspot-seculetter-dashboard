import { Client } from '@hubspot/api-client';
import dotenv from 'dotenv';

dotenv.config();

export class HubspotClient {
  private client: Client;

  constructor() {
    const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
    if (!accessToken) {
      console.warn('HUBSPOT_ACCESS_TOKEN not set. Running in demo mode.');
    }
    this.client = new Client({ accessToken: accessToken || '' });
  }

  get api(): Client {
    return this.client;
  }

  async getContacts(limit = 100, after?: string) {
    try {
      const response = await this.client.crm.contacts.basicApi.getPage(
        limit,
        after,
        ['firstname', 'lastname', 'email', 'company', 'hs_lead_status', 'lifecyclestage', 'hs_analytics_source', 'jobtitle', 'createdate', 'lastmodifieddate', 'hubspot_owner_id']
      );
      return response;
    } catch (error) {
      console.error('Error fetching contacts:', error);
      throw error;
    }
  }

  async getCompanies(limit = 100, after?: string) {
    try {
      const response = await this.client.crm.companies.basicApi.getPage(
        limit,
        after,
        ['name', 'domain', 'industry', 'numberofemployees', 'annualrevenue', 'createdate', 'lastmodifieddate', 'hubspot_owner_id']
      );
      return response;
    } catch (error) {
      console.error('Error fetching companies:', error);
      throw error;
    }
  }

  async getDeals(limit = 100, after?: string) {
    try {
      const response = await this.client.crm.deals.basicApi.getPage(
        limit,
        after,
        ['dealname', 'amount', 'dealstage', 'pipeline', 'closedate', 'createdate', 'hs_lastmodifieddate', 'hubspot_owner_id', 'hs_deal_stage_probability', 'notes_last_updated']
      );
      return response;
    } catch (error) {
      console.error('Error fetching deals:', error);
      throw error;
    }
  }

  async getTickets(limit = 100, after?: string) {
    try {
      const response = await this.client.crm.tickets.basicApi.getPage(
        limit,
        after,
        ['subject', 'content', 'hs_ticket_priority', 'hs_pipeline_stage', 'createdate', 'hs_lastmodifieddate', 'hubspot_owner_id', 'closed_date']
      );
      return response;
    } catch (error) {
      console.error('Error fetching tickets:', error);
      throw error;
    }
  }

  async getMeetings(limit = 100, after?: string) {
    try {
      const response = await this.client.crm.objects.basicApi.getPage(
        'meetings',
        limit,
        after,
        ['hs_meeting_title', 'hs_meeting_body', 'hs_meeting_start_time', 'hs_meeting_end_time', 'hs_meeting_outcome', 'hs_meeting_location', 'hubspot_owner_id', 'hs_timestamp', 'hs_internal_meeting_notes']
      );
      return response;
    } catch (error) {
      console.error('Error fetching meetings:', error);
      throw error;
    }
  }

  async getCalls(limit = 100, after?: string) {
    try {
      const response = await this.client.crm.objects.basicApi.getPage(
        'calls',
        limit,
        after,
        ['hs_call_title', 'hs_call_body', 'hs_call_duration', 'hs_call_status', 'hs_call_direction', 'hs_call_disposition', 'hs_timestamp', 'hubspot_owner_id']
      );
      return response;
    } catch (error) {
      console.error('Error fetching calls:', error);
      throw error;
    }
  }

  async getNotes(limit = 100, after?: string) {
    try {
      const response = await this.client.crm.objects.basicApi.getPage(
        'notes',
        limit,
        after,
        ['hs_note_body', 'hs_timestamp', 'hubspot_owner_id']
      );
      return response;
    } catch (error) {
      console.error('Error fetching notes:', error);
      throw error;
    }
  }

  // 활동의 연결 정보 조회 (회사, 연락처, 거래)
  async getActivityAssociations(objectType: string, activityId: string) {
    const associations: { companies: any[]; contacts: any[]; deals: any[] } = {
      companies: [],
      contacts: [],
      deals: []
    };

    try {
      // 회사 연결
      const companyAssoc = await this.client.crm.associations.v4.basicApi.getPage(
        objectType,
        activityId,
        'companies',
        undefined,
        10
      );
      if (companyAssoc.results.length > 0) {
        const companyIds = companyAssoc.results.map(r => r.toObjectId);
        for (const companyId of companyIds) {
          try {
            const company = await this.client.crm.companies.basicApi.getById(companyId, ['name']);
            associations.companies.push({ id: companyId, name: company.properties.name || '(회사명 없음)' });
          } catch (e) {
            // 회사 조회 실패 시 무시
          }
        }
      }
    } catch (e) {
      // 연결 조회 실패 시 무시
    }

    try {
      // 연락처 연결
      const contactAssoc = await this.client.crm.associations.v4.basicApi.getPage(
        objectType,
        activityId,
        'contacts',
        undefined,
        10
      );
      if (contactAssoc.results.length > 0) {
        const contactIds = contactAssoc.results.map(r => r.toObjectId);
        for (const contactId of contactIds) {
          try {
            const contact = await this.client.crm.contacts.basicApi.getById(contactId, ['firstname', 'lastname']);
            const name = `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim() || '(이름 없음)';
            associations.contacts.push({ id: contactId, name });
          } catch (e) {
            // 연락처 조회 실패 시 무시
          }
        }
      }
    } catch (e) {
      // 연결 조회 실패 시 무시
    }

    try {
      // 거래 연결
      const dealAssoc = await this.client.crm.associations.v4.basicApi.getPage(
        objectType,
        activityId,
        'deals',
        undefined,
        10
      );
      if (dealAssoc.results.length > 0) {
        const dealIds = dealAssoc.results.map(r => r.toObjectId);
        for (const dealId of dealIds) {
          try {
            const deal = await this.client.crm.deals.basicApi.getById(dealId, ['dealname']);
            associations.deals.push({ id: dealId, name: deal.properties.dealname || '(거래명 없음)' });
          } catch (e: any) {
            console.error(`[Deal Assoc] Failed to get deal ${dealId}: ${e.message}`);
          }
        }
      }
    } catch (e: any) {
      // Rate limit 에러 로깅
      if (e.code === 429) {
        console.warn(`[Deal Assoc] Rate limit for ${objectType}/${activityId}`);
      }
    }

    return associations;
  }

  // 활동에 연결된 노트(댓글) 조회
  async getActivityNotes(objectType: string, activityId: string): Promise<{ id: string; body: string; timestamp: string }[]> {
    const notes: { id: string; body: string; timestamp: string }[] = [];

    try {
      // 활동에 연결된 notes 조회
      const noteAssoc = await this.client.crm.associations.v4.basicApi.getPage(
        objectType,
        activityId,
        'notes',
        undefined,
        50
      );

      console.log(`[Notes] ${objectType}/${activityId}: found ${noteAssoc.results.length} notes`);

      if (noteAssoc.results.length > 0) {
        const noteIds = noteAssoc.results.map(r => r.toObjectId);
        for (const noteId of noteIds) {
          try {
            const note = await this.client.crm.objects.basicApi.getById(
              'notes',
              noteId,
              ['hs_note_body', 'hs_timestamp']
            );
            notes.push({
              id: noteId,
              body: note.properties.hs_note_body || '',
              timestamp: note.properties.hs_timestamp || ''
            });
          } catch (e: any) {
            console.error(`[Notes] Failed to get note ${noteId}: ${e.message}`);
          }
        }
      }
    } catch (e: any) {
      // 연결 조회 실패 로그
      if (e.code !== 404) {
        console.error(`[Notes] ${objectType}/${activityId} association error: ${e.message}`);
      }
    }

    // 시간순 정렬 (최신순)
    notes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return notes;
  }

  async getOwners() {
    try {
      const response = await this.client.crm.owners.ownersApi.getPage();
      return response;
    } catch (error) {
      console.error('Error fetching owners:', error);
      throw error;
    }
  }

  async getDealPipelines() {
    try {
      const response = await this.client.crm.pipelines.pipelinesApi.getAll('deals');
      return response;
    } catch (error) {
      console.error('Error fetching deal pipelines:', error);
      throw error;
    }
  }

  // 딜 속성 변경 이력 조회 (propertiesWithHistory 사용 - 최대 50개 제한)
  async getDealsWithHistory(limit = 50, after?: string) {
    try {
      const response = await this.client.crm.deals.basicApi.getPage(
        Math.min(limit, 50), // HubSpot API 제한: propertiesWithHistory 사용 시 최대 50개
        after,
        ['dealname', 'amount', 'dealstage', 'pipeline', 'closedate', 'createdate', 'hs_lastmodifieddate', 'hubspot_owner_id'],
        ['dealstage', 'amount'] // propertiesWithHistory
      );
      return response;
    } catch (error) {
      console.error('Error fetching deals with history:', error);
      throw error;
    }
  }

  async getTicketPipelines() {
    try {
      const response = await this.client.crm.pipelines.pipelinesApi.getAll('tickets');
      return response;
    } catch (error) {
      console.error('Error fetching ticket pipelines:', error);
      throw error;
    }
  }
}

export const hubspotClient = new HubspotClient();
