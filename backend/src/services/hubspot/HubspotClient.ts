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
        ['hs_meeting_title', 'hs_meeting_start_time', 'hs_meeting_end_time', 'hs_meeting_outcome', 'hubspot_owner_id']
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
        ['hs_call_title', 'hs_call_duration', 'hs_call_status', 'hs_timestamp', 'hubspot_owner_id']
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
