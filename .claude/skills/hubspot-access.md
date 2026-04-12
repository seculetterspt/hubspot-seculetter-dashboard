# HubSpot Access Guide

이 프로젝트에서 HubSpot API에 접근하는 방법을 설명합니다.

## 환경 변수 설정

HubSpot API를 사용하려면 다음 환경 변수가 필요합니다:

### 필수 (API 접근용)
```bash
# Private App 토큰 (HubSpot 데이터 조회/수정에 사용)
HUBSPOT_ACCESS_TOKEN=your_hubspot_private_app_token

# HubSpot 계정 ID
HUBSPOT_ACCOUNT_ID=243367573
```

### OAuth 인증용 (사용자 로그인)
```bash
HUBSPOT_CLIENT_ID=your_hubspot_oauth_client_id
HUBSPOT_CLIENT_SECRET=your_hubspot_oauth_client_secret
HUBSPOT_OAUTH_REDIRECT_URI=http://localhost:3001/auth/hubspot/callback
```

## HubSpot Private App 토큰 발급 방법

1. HubSpot 계정 로그인
2. Settings → Integrations → Private Apps 이동
3. "Create a private app" 클릭
4. 앱 이름 입력 및 필요한 Scopes 선택:
   - `crm.objects.contacts.read`
   - `crm.objects.companies.read`
   - `crm.objects.deals.read`
   - `crm.objects.tickets.read`
   - `sales-email-read`
5. 생성 후 Access Token 복사

## HubspotClient 사용법

### 클라이언트 import
```typescript
import { hubspotClient } from './services/hubspot/HubspotClient';
```

### 사용 가능한 메서드

#### CRM 데이터 조회
```typescript
// 연락처 조회
const contacts = await hubspotClient.getContacts(limit, after);

// 회사 조회
const companies = await hubspotClient.getCompanies(limit, after);

// 거래 조회
const deals = await hubspotClient.getDeals(limit, after);

// 티켓 조회
const tickets = await hubspotClient.getTickets(limit, after);

// 미팅 조회
const meetings = await hubspotClient.getMeetings(limit, after);

// 통화 기록 조회
const calls = await hubspotClient.getCalls(limit, after);

// 노트 조회
const notes = await hubspotClient.getNotes(limit, after);

// Owner 목록 조회
const owners = await hubspotClient.getOwners();

// 파이프라인 조회
const dealPipelines = await hubspotClient.getDealPipelines();
const ticketPipelines = await hubspotClient.getTicketPipelines();
```

#### 검색 기능
```typescript
// 회사 검색
const companies = await hubspotClient.searchCompanies('검색어', limit);

// 연락처 검색
const contacts = await hubspotClient.searchContacts('검색어', limit);

// 거래 검색
const deals = await hubspotClient.searchDeals('검색어', limit);
```

#### 미팅 관리
```typescript
// 미팅 생성
const meeting = await hubspotClient.createMeeting({
  hs_meeting_title: '미팅 제목',
  hs_meeting_body: '미팅 내용',
  hs_meeting_start_time: '2024-01-01T10:00:00Z',
  hs_meeting_end_time: '2024-01-01T11:00:00Z',
});

// 미팅 수정
await hubspotClient.updateMeeting(meetingId, {
  hs_meeting_title: '수정된 제목',
});

// 미팅과 다른 객체 연결
await hubspotClient.associateMeetingWith('companies', meetingId, companyId);
await hubspotClient.associateMeetingWith('contacts', meetingId, contactId);
await hubspotClient.associateMeetingWith('deals', meetingId, dealId);
```

#### 연결 정보 조회
```typescript
// 활동의 연결된 회사/연락처/거래 조회
const associations = await hubspotClient.getActivityAssociations('meetings', meetingId);
// returns: { companies: [], contacts: [], deals: [] }

// 활동에 연결된 노트 조회
const notes = await hubspotClient.getActivityNotes('meetings', meetingId);
```

## 직접 HubSpot API 클라이언트 접근

```typescript
// 내부 API 클라이언트 직접 사용
const api = hubspotClient.api;

// 예: 직접 API 호출
const response = await api.crm.contacts.searchApi.doSearch({
  query: 'example',
  limit: 10,
  properties: ['email', 'firstname'],
  filterGroups: [],
  sorts: [],
  after: '0',
});
```

## 파일 위치

- **HubSpot 클라이언트**: `backend/src/services/hubspot/HubspotClient.ts`
- **OAuth 서비스**: `backend/src/services/oauth.ts`
- **환경 변수 예시**: `backend/.env.example`

## 주의사항

1. `HUBSPOT_ACCESS_TOKEN`이 설정되지 않으면 데모 모드로 동작합니다
2. Rate Limit: HubSpot API는 요청 제한이 있으므로 대량 조회 시 주의
3. `propertiesWithHistory` 사용 시 최대 50개 레코드만 조회 가능
4. OAuth 토큰은 사용자 인증용으로만 사용되고 데이터 접근에는 Private App 토큰 사용
