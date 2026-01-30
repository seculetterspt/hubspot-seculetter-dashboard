import { pool } from '../../config/database.js';
import { hubspotClient } from '../hubspot/HubspotClient.js';

interface SnapshotData {
  contacts: {
    total: number;
    created: number;
    modified: number;
    bySource: Record<string, number>;
    byLifecycleStage: Record<string, number>;
    byDecisionMakerRole: Record<string, number>;
  };
  companies: {
    total: number;
    created: number;
    modified: number;
    byIndustry: Record<string, number>;
    bySize: Record<string, number>;
  };
  deals: {
    totalActive: number;
    pipelineValue: number;
    created: number;
    won: number;
    wonValue: number;
    lost: number;
    lostValue: number;
    byStage: Record<string, { count: number; value: number }>;
    byOwner: Record<string, { count: number; value: number }>;
    stalledCount: number;
  };
  tickets: {
    totalOpen: number;
    created: number;
    resolved: number;
    inProgress: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
  };
  activities: {
    meetings: number;
    calls: number;
    notes: number;
    total: number;
    byOwner: Record<string, { meetings: number; calls: number; notes: number }>;
  };
}

export class DailySnapshotService {
  async generateSnapshot(date: Date = new Date()): Promise<SnapshotData> {
    const snapshot: SnapshotData = {
      contacts: { total: 0, created: 0, modified: 0, bySource: {}, byLifecycleStage: {}, byDecisionMakerRole: {} },
      companies: { total: 0, created: 0, modified: 0, byIndustry: {}, bySize: {} },
      deals: { totalActive: 0, pipelineValue: 0, created: 0, won: 0, wonValue: 0, lost: 0, lostValue: 0, byStage: {}, byOwner: {}, stalledCount: 0 },
      tickets: { totalOpen: 0, created: 0, resolved: 0, inProgress: 0, byStatus: {}, byPriority: {} },
      activities: { meetings: 0, calls: 0, notes: 0, total: 0, byOwner: {} }
    };

    try {
      // Contacts
      const contactsResponse = await hubspotClient.getContacts(100);
      snapshot.contacts.total = contactsResponse.results.length;

      const today = new Date(date);
      today.setHours(0, 0, 0, 0);

      for (const contact of contactsResponse.results) {
        const props = contact.properties;
        const createDate = props.createdate ? new Date(props.createdate) : null;
        const modifiedDate = props.lastmodifieddate ? new Date(props.lastmodifieddate) : null;

        if (createDate && createDate >= today) {
          snapshot.contacts.created++;
        }
        if (modifiedDate && modifiedDate >= today) {
          snapshot.contacts.modified++;
        }

        // Source
        const source = props.hs_analytics_source || 'Unknown';
        snapshot.contacts.bySource[source] = (snapshot.contacts.bySource[source] || 0) + 1;

        // Lifecycle Stage
        const stage = props.lifecyclestage || 'Unknown';
        snapshot.contacts.byLifecycleStage[stage] = (snapshot.contacts.byLifecycleStage[stage] || 0) + 1;

        // Decision Maker Role (based on job title)
        const jobTitle = (props.jobtitle || '').toLowerCase();
        let role = '실무자';
        if (jobTitle.includes('ciso') || jobTitle.includes('cto') || jobTitle.includes('cio') || jobTitle.includes('chief')) {
          role = 'C-Level';
        } else if (jobTitle.includes('director') || jobTitle.includes('head') || jobTitle.includes('vp')) {
          role = 'Director';
        } else if (jobTitle.includes('manager') || jobTitle.includes('팀장')) {
          role = 'Manager';
        }
        snapshot.contacts.byDecisionMakerRole[role] = (snapshot.contacts.byDecisionMakerRole[role] || 0) + 1;
      }

      // Companies
      const companiesResponse = await hubspotClient.getCompanies(100);
      snapshot.companies.total = companiesResponse.results.length;

      for (const company of companiesResponse.results) {
        const props = company.properties;
        const createDate = props.createdate ? new Date(props.createdate) : null;
        const modifiedDate = props.lastmodifieddate ? new Date(props.lastmodifieddate) : null;

        if (createDate && createDate >= today) {
          snapshot.companies.created++;
        }
        if (modifiedDate && modifiedDate >= today) {
          snapshot.companies.modified++;
        }

        // Industry
        const industry = props.industry || 'Unknown';
        snapshot.companies.byIndustry[industry] = (snapshot.companies.byIndustry[industry] || 0) + 1;

        // Size (based on employee count)
        const employees = parseInt(props.numberofemployees || '0');
        let size = '소기업';
        if (employees >= 1000) size = '대기업';
        else if (employees >= 300) size = '중견기업';
        else if (employees >= 50) size = '중소기업';
        else if (employees >= 10) size = '스타트업';
        snapshot.companies.bySize[size] = (snapshot.companies.bySize[size] || 0) + 1;
      }

      // Deals
      const dealsResponse = await hubspotClient.getDeals(100);
      const thirtyDaysAgo = new Date(date);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      for (const deal of dealsResponse.results) {
        const props = deal.properties;
        const amount = parseFloat(props.amount || '0');
        const stage = props.dealstage || 'Unknown';
        const ownerId = props.hubspot_owner_id || 'Unassigned';
        const createDate = props.createdate ? new Date(props.createdate) : null;
        const lastModified = props.hs_lastmodifieddate ? new Date(props.hs_lastmodifieddate) : null;

        // Check if deal is active (not closed)
        const isClosed = stage.includes('closed') || stage.includes('lost') || stage.includes('won');

        if (!isClosed) {
          snapshot.deals.totalActive++;
          snapshot.deals.pipelineValue += amount;

          // Check for stalled deals
          if (lastModified && lastModified < thirtyDaysAgo) {
            snapshot.deals.stalledCount++;
          }
        }

        if (createDate && createDate >= today) {
          snapshot.deals.created++;
        }

        if (stage.includes('won') || stage === 'closedwon') {
          snapshot.deals.won++;
          snapshot.deals.wonValue += amount;
        }

        if (stage.includes('lost') || stage === 'closedlost') {
          snapshot.deals.lost++;
          snapshot.deals.lostValue += amount;
        }

        // By Stage
        if (!snapshot.deals.byStage[stage]) {
          snapshot.deals.byStage[stage] = { count: 0, value: 0 };
        }
        snapshot.deals.byStage[stage].count++;
        snapshot.deals.byStage[stage].value += amount;

        // By Owner
        if (!snapshot.deals.byOwner[ownerId]) {
          snapshot.deals.byOwner[ownerId] = { count: 0, value: 0 };
        }
        snapshot.deals.byOwner[ownerId].count++;
        snapshot.deals.byOwner[ownerId].value += amount;
      }

      // Tickets
      const ticketsResponse = await hubspotClient.getTickets(100);

      for (const ticket of ticketsResponse.results) {
        const props = ticket.properties;
        const status = props.hs_pipeline_stage || 'Unknown';
        const priority = props.hs_ticket_priority || 'MEDIUM';
        const createDate = props.createdate ? new Date(props.createdate) : null;
        const closedDate = props.closed_date ? new Date(props.closed_date) : null;

        // By Status
        snapshot.tickets.byStatus[status] = (snapshot.tickets.byStatus[status] || 0) + 1;

        // By Priority
        snapshot.tickets.byPriority[priority] = (snapshot.tickets.byPriority[priority] || 0) + 1;

        if (!closedDate) {
          snapshot.tickets.totalOpen++;
          if (status.toLowerCase().includes('progress')) {
            snapshot.tickets.inProgress++;
          }
        }

        if (createDate && createDate >= today) {
          snapshot.tickets.created++;
        }

        if (closedDate && closedDate >= today) {
          snapshot.tickets.resolved++;
        }
      }

      // Activities - Meetings
      const meetingsResponse = await hubspotClient.getMeetings(100);
      snapshot.activities.meetings = meetingsResponse.results.length;

      for (const meeting of meetingsResponse.results) {
        const ownerId = meeting.properties.hubspot_owner_id || 'Unassigned';
        if (!snapshot.activities.byOwner[ownerId]) {
          snapshot.activities.byOwner[ownerId] = { meetings: 0, calls: 0, notes: 0 };
        }
        snapshot.activities.byOwner[ownerId].meetings++;
      }

      // Activities - Calls
      const callsResponse = await hubspotClient.getCalls(100);
      snapshot.activities.calls = callsResponse.results.length;

      for (const call of callsResponse.results) {
        const ownerId = call.properties.hubspot_owner_id || 'Unassigned';
        if (!snapshot.activities.byOwner[ownerId]) {
          snapshot.activities.byOwner[ownerId] = { meetings: 0, calls: 0, notes: 0 };
        }
        snapshot.activities.byOwner[ownerId].calls++;
      }

      // Activities - Notes
      const notesResponse = await hubspotClient.getNotes(100);
      snapshot.activities.notes = notesResponse.results.length;

      for (const note of notesResponse.results) {
        const ownerId = note.properties.hubspot_owner_id || 'Unassigned';
        if (!snapshot.activities.byOwner[ownerId]) {
          snapshot.activities.byOwner[ownerId] = { meetings: 0, calls: 0, notes: 0 };
        }
        snapshot.activities.byOwner[ownerId].notes++;
      }

      snapshot.activities.total = snapshot.activities.meetings + snapshot.activities.calls + snapshot.activities.notes;

    } catch (error) {
      console.error('Error generating snapshot:', error);
      // Return demo data if HubSpot API fails
      return this.getDemoSnapshot();
    }

    return snapshot;
  }

  async saveSnapshot(date: Date, snapshot: SnapshotData): Promise<void> {
    const client = await pool.connect();
    const dateStr = date.toISOString().split('T')[0];

    try {
      await client.query('BEGIN');

      // Save contacts snapshot
      await client.query(`
        INSERT INTO daily_contacts_snapshot
        (snapshot_date, total_count, created_count, modified_count, by_source, by_lifecycle_stage, by_decision_maker_role)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (snapshot_date) DO UPDATE SET
        total_count = $2, created_count = $3, modified_count = $4, by_source = $5, by_lifecycle_stage = $6, by_decision_maker_role = $7
      `, [dateStr, snapshot.contacts.total, snapshot.contacts.created, snapshot.contacts.modified,
          JSON.stringify(snapshot.contacts.bySource), JSON.stringify(snapshot.contacts.byLifecycleStage),
          JSON.stringify(snapshot.contacts.byDecisionMakerRole)]);

      // Save companies snapshot
      await client.query(`
        INSERT INTO daily_companies_snapshot
        (snapshot_date, total_count, created_count, modified_count, by_industry, by_size)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (snapshot_date) DO UPDATE SET
        total_count = $2, created_count = $3, modified_count = $4, by_industry = $5, by_size = $6
      `, [dateStr, snapshot.companies.total, snapshot.companies.created, snapshot.companies.modified,
          JSON.stringify(snapshot.companies.byIndustry), JSON.stringify(snapshot.companies.bySize)]);

      // Save deals snapshot
      const winRate = snapshot.deals.won + snapshot.deals.lost > 0
        ? (snapshot.deals.won / (snapshot.deals.won + snapshot.deals.lost) * 100).toFixed(2)
        : 0;
      const avgDealValue = snapshot.deals.totalActive > 0
        ? snapshot.deals.pipelineValue / snapshot.deals.totalActive
        : 0;

      await client.query(`
        INSERT INTO daily_deals_snapshot
        (snapshot_date, total_active_count, total_pipeline_value, created_count, won_count, won_value,
         lost_count, lost_value, by_stage, by_owner, win_rate, avg_deal_value, stalled_deals_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (snapshot_date) DO UPDATE SET
        total_active_count = $2, total_pipeline_value = $3, created_count = $4, won_count = $5, won_value = $6,
        lost_count = $7, lost_value = $8, by_stage = $9, by_owner = $10, win_rate = $11, avg_deal_value = $12, stalled_deals_count = $13
      `, [dateStr, snapshot.deals.totalActive, snapshot.deals.pipelineValue, snapshot.deals.created,
          snapshot.deals.won, snapshot.deals.wonValue, snapshot.deals.lost, snapshot.deals.lostValue,
          JSON.stringify(snapshot.deals.byStage), JSON.stringify(snapshot.deals.byOwner), winRate, avgDealValue,
          snapshot.deals.stalledCount]);

      // Save tickets snapshot
      await client.query(`
        INSERT INTO daily_tickets_snapshot
        (snapshot_date, total_open_count, created_count, resolved_count, in_progress_count, by_status, by_priority)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (snapshot_date) DO UPDATE SET
        total_open_count = $2, created_count = $3, resolved_count = $4, in_progress_count = $5, by_status = $6, by_priority = $7
      `, [dateStr, snapshot.tickets.totalOpen, snapshot.tickets.created, snapshot.tickets.resolved,
          snapshot.tickets.inProgress, JSON.stringify(snapshot.tickets.byStatus), JSON.stringify(snapshot.tickets.byPriority)]);

      // Save activities snapshot
      await client.query(`
        INSERT INTO daily_activities_snapshot
        (snapshot_date, meetings_count, calls_count, notes_count, total_activities, by_owner)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (snapshot_date) DO UPDATE SET
        meetings_count = $2, calls_count = $3, notes_count = $4, total_activities = $5, by_owner = $6
      `, [dateStr, snapshot.activities.meetings, snapshot.activities.calls, snapshot.activities.notes,
          snapshot.activities.total, JSON.stringify(snapshot.activities.byOwner)]);

      await client.query('COMMIT');
      console.log(`Snapshot saved for ${dateStr}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error saving snapshot:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  getDemoSnapshot(): SnapshotData {
    return {
      contacts: {
        total: 1247,
        created: 12,
        modified: 45,
        bySource: { 'ORGANIC_SEARCH': 320, 'DIRECT_TRAFFIC': 280, 'REFERRALS': 180, 'EMAIL_MARKETING': 220, 'SOCIAL_MEDIA': 150, 'PAID_SEARCH': 97 },
        byLifecycleStage: { 'subscriber': 420, 'lead': 380, 'marketingqualifiedlead': 220, 'salesqualifiedlead': 150, 'opportunity': 50, 'customer': 27 },
        byDecisionMakerRole: { 'C-Level': 85, 'Director': 142, 'Manager': 320, '실무자': 700 }
      },
      companies: {
        total: 423,
        created: 5,
        modified: 18,
        byIndustry: { '금융': 85, '제조': 72, '공공기관': 65, 'IT서비스': 95, '의료': 42, '유통': 38, '기타': 26 },
        bySize: { '대기업': 45, '중견기업': 78, '중소기업': 185, '스타트업': 115 }
      },
      deals: {
        totalActive: 67,
        pipelineValue: 4850000000,
        created: 3,
        won: 2,
        wonValue: 280000000,
        lost: 1,
        lostValue: 150000000,
        byStage: {
          '리드': { count: 15, value: 750000000 },
          '니즈파악': { count: 12, value: 620000000 },
          '제안': { count: 18, value: 1200000000 },
          'POC/BMT': { count: 10, value: 980000000 },
          '협상': { count: 8, value: 850000000 },
          '계약': { count: 4, value: 450000000 }
        },
        byOwner: {
          '김영업': { count: 18, value: 1450000000 },
          '이매니저': { count: 15, value: 1200000000 },
          '박대리': { count: 12, value: 850000000 },
          '최주임': { count: 10, value: 680000000 },
          '정사원': { count: 12, value: 670000000 }
        },
        stalledCount: 8
      },
      tickets: {
        totalOpen: 23,
        created: 5,
        resolved: 7,
        inProgress: 12,
        byStatus: { 'NEW': 8, 'IN_PROGRESS': 12, 'WAITING': 3, 'CLOSED': 45 },
        byPriority: { 'HIGH': 5, 'MEDIUM': 12, 'LOW': 6 }
      },
      activities: {
        meetings: 8,
        calls: 24,
        notes: 15,
        total: 47,
        byOwner: {
          '김영업': { meetings: 3, calls: 8, notes: 5 },
          '이매니저': { meetings: 2, calls: 6, notes: 4 },
          '박대리': { meetings: 2, calls: 5, notes: 3 },
          '최주임': { meetings: 1, calls: 3, notes: 2 },
          '정사원': { meetings: 0, calls: 2, notes: 1 }
        }
      }
    };
  }

  // Raw 데이터 스냅샷 저장 (비교용)
  async saveRawSnapshot(date: Date): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0];

    // 오늘 raw 데이터 가져오기
    let contacts: any[] = [];
    let companies: any[] = [];
    let deals: any[] = [];
    let tickets: any[] = [];

    try {
      const contactsRes = await hubspotClient.getContacts(100);
      contacts = contactsRes.results.map(c => ({
        id: c.id,
        name: `${c.properties.firstname || ''} ${c.properties.lastname || ''}`.trim() || '(이름 없음)',
        email: c.properties.email || '-',
        company: c.properties.company || '-',
        lifecycleStage: c.properties.lifecyclestage || '-',
        source: c.properties.hs_analytics_source || '-',
        modifiedAt: c.properties.lastmodifieddate,
        createdAt: c.properties.createdate
      }));
    } catch (error) {
      console.error('Error fetching contacts for raw snapshot:', error);
    }

    try {
      const companiesRes = await hubspotClient.getCompanies(100);
      companies = companiesRes.results.map(c => ({
        id: c.id,
        name: c.properties.name || '(이름 없음)',
        domain: c.properties.domain || '-',
        industry: c.properties.industry || '-',
        employees: c.properties.numberofemployees || '-',
        modifiedAt: c.properties.lastmodifieddate,
        createdAt: c.properties.createdate
      }));
    } catch (error) {
      console.error('Error fetching companies for raw snapshot:', error);
    }

    try {
      const dealsRes = await hubspotClient.getDeals(100);
      deals = dealsRes.results.map(d => ({
        id: d.id,
        name: d.properties.dealname || '(이름 없음)',
        amount: d.properties.amount ? Number(d.properties.amount) : 0,
        stage: d.properties.dealstage || '-',
        pipeline: d.properties.pipeline || '-',
        closeDate: d.properties.closedate || '-',
        modifiedAt: d.properties.hs_lastmodifieddate,
        createdAt: d.properties.createdate
      }));
    } catch (error) {
      console.error('Error fetching deals for raw snapshot:', error);
    }

    try {
      const ticketsRes = await hubspotClient.getTickets(100);
      tickets = ticketsRes.results.map(t => ({
        id: t.id,
        subject: t.properties.subject || '(제목 없음)',
        priority: t.properties.hs_ticket_priority || '-',
        status: t.properties.hs_pipeline_stage || '-',
        modifiedAt: t.properties.hs_lastmodifieddate,
        createdAt: t.properties.createdate
      }));
    } catch (error) {
      console.error('Error fetching tickets for raw snapshot:', error);
    }

    // DB에 저장
    try {
      await pool.query(`
        INSERT INTO daily_raw_snapshot (snapshot_date, snapshot_time, contacts, companies, deals, tickets)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (snapshot_date) DO UPDATE SET
        snapshot_time = $2, contacts = $3, companies = $4, deals = $5, tickets = $6
      `, [dateStr, timeStr, JSON.stringify(contacts), JSON.stringify(companies), JSON.stringify(deals), JSON.stringify(tickets)]);
      console.log(`Raw snapshot saved for ${dateStr} at ${timeStr}`);
    } catch (error) {
      console.error('Error saving raw snapshot:', error);
    }
  }

  // 특정 날짜의 raw 스냅샷 조회
  async getRawSnapshot(date: Date): Promise<{ contacts: any[]; companies: any[]; deals: any[]; tickets: any[] } | null> {
    const dateStr = date.toISOString().split('T')[0];
    try {
      const result = await pool.query(
        'SELECT contacts, companies, deals, tickets FROM daily_raw_snapshot WHERE snapshot_date = $1',
        [dateStr]
      );
      if (result.rows.length > 0) {
        return {
          contacts: result.rows[0].contacts || [],
          companies: result.rows[0].companies || [],
          deals: result.rows[0].deals || [],
          tickets: result.rows[0].tickets || []
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching raw snapshot:', error);
      return null;
    }
  }
}

export const dailySnapshotService = new DailySnapshotService();
