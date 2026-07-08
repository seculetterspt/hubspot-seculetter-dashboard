import { Request, Response, NextFunction } from 'express';
import axios from 'axios'; // 이미 dependencies에 존재

// Supabase JWT(Bearer) 검증 미들웨어 — 지원셸(seculetter-support) auth.py 패턴과 동일.
// /reports/* 정적 페이지(브라우저 네비, Authorization 헤더 불가)는 이 미들웨어 대상이 아니다.
// req.user 타입은 middleware/auth.ts 의 canonical 전역 선언을 재사용한다(여기서 재선언하지 않음).

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

type Role = 'enduser' | 'partner' | 'staff' | 'admin';

async function verifyBearer(req: Request): Promise<NonNullable<Request['user']>> {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) throw new Error('no-bearer');
  const token = h.slice(7);

  // 1) Supabase Auth로 JWT 원격 검증
  const authRes = await axios.get(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    timeout: 5000,
  });
  const authUser = authRes.data as { id: string; email?: string };
  if (!authUser?.id) throw new Error('no-user');

  // 2) service-role로 profiles.role 조회 (RLS 우회)
  const profRes = await axios.get(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${authUser.id}&select=id,email,role`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      timeout: 5000,
    }
  );
  const profile = (profRes.data as Array<{ id: string; email: string; role: string }>)?.[0];
  if (!profile) throw new Error('no-profile'); // fail-closed

  const email = authUser.email || profile.email;
  return {
    id: authUser.id,
    userId: authUser.id, // 하위호환 (기존 코드가 req.user.userId 참조)
    email,
    name: email, // 대시보드는 표시용 name — email로 대체
    role: (profile.role || 'enduser') as Role,
  };
}

// async 미들웨어: throw가 아니라 응답으로 종결 (Express 4는 async throw 자동처리 안 함)
export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.user = await verifyBearer(req);
    next();
  } catch (e) {
    console.error('[Auth] fail:', e instanceof Error ? e.message : e);
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
};

export const requireStaffOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (req.user.role !== 'staff' && req.user.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden', message: 'Staff or admin required' });
    return;
  }
  next();
};
