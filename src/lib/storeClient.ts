import type {
  AIPropertyAnalysis,
  Development,
  LandingPage,
  Lead,
  LeadInterestType,
  LeadStatus,
  Property,
  TenantConfig,
  VirtualTourData,
} from '../types/realEstate';

const ADMIN_TOKEN_KEY = 'ads_admin_session_token';

function readStoredToken(): string | null {
  try {
    return typeof window !== 'undefined'
      ? window.sessionStorage.getItem(ADMIN_TOKEN_KEY)
      : null;
  } catch {
    return null;
  }
}

let adminBearerToken: string | null = readStoredToken();

export function setAdminToken(token: string | null) {
  adminBearerToken = token;
  try {
    if (typeof window !== 'undefined') {
      if (token) {
        window.sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
      } else {
        window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      }
    }
  } catch {
    // Ignore storage quota or restricted iframe errors
  }
}

export function getAdminToken(): string | null {
  if (!adminBearerToken) {
    adminBearerToken = readStoredToken();
  }
  return adminBearerToken;
}

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (adminBearerToken) {
    headers['Authorization'] = `Bearer ${adminBearerToken}`;
  }
  return headers;
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Erro HTTP ${res.status}`);
  }
  return data as T;
}

export async function apiAdminLogin(email: string, password: string) {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJson<{
    token: string;
    user: { email: string; role: string; tenantId: string };
  }>(res);
  setAdminToken(data.token);
  return data;
}

export async function apiChangePassword(currentPassword: string, newPassword: string) {
  const res = await fetch('/api/admin/password', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return parseJson<{ ok: boolean }>(res);
}

export async function apiGetPublicBootstrap(tenantId: string) {
  const res = await fetch(`/api/store/bootstrap?tenantId=${encodeURIComponent(tenantId)}`);
  return parseJson<{
    tenant: TenantConfig;
    tenants: TenantConfig[];
    properties: Property[];
    developments: Development[];
    landingPages: LandingPage[];
  }>(res);
}

export async function apiCreateLead(payload: {
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  interestType: LeadInterestType;
  propertyId?: string;
  propertyTitle?: string;
  sourcePage?: string;
  lgpdConsent: boolean;
}) {
  const res = await fetch('/api/store/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson<{ lead: Lead }>(res);
}

export async function apiAdminFetchAll(tenantId: string) {
  const res = await fetch(`/api/store/admin/all?tenantId=${encodeURIComponent(tenantId)}`, {
    headers: authHeaders(),
  });
  return parseJson<{
    tenant: TenantConfig;
    tenants: TenantConfig[];
    properties: Property[];
    developments: Development[];
    landingPages: LandingPage[];
    leads: Lead[];
  }>(res);
}

export async function apiAdminUpdateTenant(tenant: Partial<TenantConfig>) {
  const res = await fetch('/api/store/admin/tenant', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(tenant),
  });
  return parseJson<{ tenant: TenantConfig }>(res);
}

export async function apiAdminCreateTenant(tenant: Partial<TenantConfig>) {
  const res = await fetch('/api/store/admin/tenants', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(tenant),
  });
  return parseJson<{ tenant: TenantConfig }>(res);
}

export async function apiAdminSaveProperty(property: Partial<Property>) {
  const res = await fetch('/api/store/admin/properties', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(property),
  });
  return parseJson<{ property: Property }>(res);
}

export async function apiAdminDeleteProperty(id: string) {
  const res = await fetch(`/api/store/admin/properties/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return parseJson<{ ok: boolean }>(res);
}

export async function apiAdminSaveDevelopment(dev: Partial<Development>) {
  const res = await fetch('/api/store/admin/developments', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(dev),
  });
  return parseJson<{ development: Development }>(res);
}

export async function apiAdminDeleteDevelopment(id: string) {
  const res = await fetch(`/api/store/admin/developments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return parseJson<{ ok: boolean }>(res);
}

export async function apiAdminSaveLandingPage(lp: Partial<LandingPage>) {
  const res = await fetch('/api/store/admin/landing-pages', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(lp),
  });
  return parseJson<{ landingPage: LandingPage }>(res);
}

export async function apiAdminDeleteLandingPage(id: string) {
  const res = await fetch(`/api/store/admin/landing-pages/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return parseJson<{ ok: boolean }>(res);
}

export async function apiAdminUpdateLeadStatus(id: string, status: LeadStatus) {
  const res = await fetch(`/api/store/admin/leads/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  return parseJson<{ lead: Lead }>(res);
}

export async function apiAdminDeleteLead(id: string) {
  const res = await fetch(`/api/store/admin/leads/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return parseJson<{ ok: boolean }>(res);
}

export async function apiUploadMedia(filename: string, dataUrl: string) {
  const res = await fetch('/api/blob/upload', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ filename, dataUrl }),
  });
  return parseJson<{ url: string; provider: string }>(res);
}

export async function apiAnalyzePhoto(imageUrl: string, context: string) {
  const res = await fetch('/api/ai/analyze-photo', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ imageUrl, context }),
  });
  return parseJson<AIPropertyAnalysis>(res);
}

export async function apiCinematicDirector(property: Partial<Property>) {
  const res = await fetch('/api/ai/cinematic-director', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ property }),
  });
  return parseJson<NonNullable<AIPropertyAnalysis['cinematicStoryboard']>>(res);
}

export async function apiGenerateVirtualTour(property: Partial<Property>) {
  const res = await fetch('/api/ai/virtual-tour', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ property }),
  });
  return parseJson<VirtualTourData>(res);
}

export async function apiGenerateDescription(property: Partial<Property>) {
  const res = await fetch('/api/ai/generate-description', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ property }),
  });
  return parseJson<{
    subtitle: string;
    portalDescription: string;
    instagramCaption: string;
    seoKeywords: string[];
  }>(res);
}

export async function apiAssistantChat(tenantId: string, message: string) {
  const res = await fetch('/api/assistant/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, message }),
  });
  return parseJson<{ reply: string }>(res);
}
