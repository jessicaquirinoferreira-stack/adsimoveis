import crypto from 'node:crypto';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { DEFAULT_TENANT_CONFIG, DEFAULT_TENANT_ID } from '../src/data/defaults';
import firebaseConfig from '../firebase-applet-config.json';
import { getStore, saveStore } from './store';
import type {
  Development,
  LandingPage,
  Lead,
  Property,
  TenantConfig,
} from '../src/types/realEstate';

const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : crypto
        .createHash('sha256')
        .update(
          [
            firebaseConfig.projectId,
            firebaseConfig.firestoreDatabaseId,
            firebaseConfig.appId,
            process.env.ADMIN_EMAIL || 'admin@x.com',
          ].join(':')
        )
        .digest('hex');

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

function isValidId(id: unknown): id is string {
  return typeof id === 'string' && VALID_ID_REGEX.test(id);
}

function sanitizeUrl(url: unknown): string {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('/src/assets/') ||
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('data:video/')
  ) {
    return trimmed;
  }
  return '';
}

function getUploadDir(): string | null {
  const dir = path.resolve(process.cwd(), '.uploads');
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const check = path.join(dir, '.write-check');
    fs.writeFileSync(check, 'ok', 'utf-8');
    fs.unlinkSync(check);
    return dir;
  } catch {
    const tmpDir = '/tmp/ads-imoveis-uploads';
    try {
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      return tmpDir;
    } catch {
      return null;
    }
  }
}

interface SessionPayload {
  email: string;
  role: 'admin';
  tenantId: string;
  exp: number;
}

function signSessionToken(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf-8')
    ) as SessionPayload;
    if (!parsed.email || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function verifyAdminPassword(password: string): boolean {
  const envPass = process.env.ADMIN_PASSWORD?.trim();
  if (envPass) {
    const a = Buffer.from(password, 'utf-8');
    const b = Buffer.from(envPass, 'utf-8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  const store = getStore();
  const creds = store.adminPasswordHash;
  if (!creds) return false;
  const derived = crypto.scryptSync(password, creds.salt, 64);
  const stored = Buffer.from(creds.hashHex, 'hex');
  return derived.length === stored.length && crypto.timingSafeEqual(derived, stored);
}

function requireAdminSession(
  req: IncomingMessage,
  res: ServerResponse
): SessionPayload | null {
  const rawHeader = req.headers.authorization;
  const authHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendJson(res, 401, { error: 'Sessão administrativa não autenticada.' });
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const payload = verifySessionToken(token);
  if (!payload) {
    sendJson(res, 401, { error: 'Sessão administrativa expirada ou inválida.' });
    return null;
  }
  return payload;
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function sendText(res: ServerResponse, statusCode: number, text: string): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(text);
}

async function readJsonBody(
  req: IncomingMessage & { body?: unknown }
): Promise<Record<string, unknown>> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      return req.body as Record<string, unknown>;
    }
    if (typeof req.body === 'string') {
      return req.body ? (JSON.parse(req.body) as Record<string, unknown>) : {};
    }
    if (Buffer.isBuffer(req.body)) {
      const str = req.body.toString('utf-8');
      return str ? (JSON.parse(str) as Record<string, unknown>) : {};
    }
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    const maxBytes = 15 * 1024 * 1024;
    req.on('data', (chunk: Buffer | string) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;
      if (totalBytes > maxBytes) {
        reject(new Error('Corpo da requisição excede o limite permitido.'));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      const raw = Buffer.concat(chunks).toString('utf-8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        reject(new Error('JSON inválido na requisição.'));
      }
    });
    req.on('error', (err) => reject(err));
  });
}

async function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no ambiente do servidor.');
  }
  const { GoogleGenAI, Type } = await import('@google/genai');
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return { ai, Type };
}

function extractGeminiErrorMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : fallback;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; code?: number } };
    if (parsed?.error?.message) {
      if (parsed.error.code === 503) {
        return 'O serviço de inteligência artificial está temporariamente sobrecarregado. Tente novamente em instantes.';
      }
      return parsed.error.message;
    }
  } catch {
    // not JSON
  }
  return raw || fallback;
}

function isTransientGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED')
  );
}

async function generateContentResilient(
  ai: Awaited<ReturnType<typeof getGenAIClient>>['ai'],
  params: Omit<Parameters<typeof ai.models.generateContent>[0], 'model'>
) {
  const models = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
  let lastError: unknown;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({
          ...params,
          model,
        });
      } catch (err) {
        lastError = err;
        if (!isTransientGeminiError(err)) {
          throw err;
        }
        await new Promise((r) => setTimeout(r, 450 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

async function resolveImageAsInlinePart(imageUrl: string): Promise<{
  inlineData: { data: string; mimeType: string };
} | null> {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('data:image/')) {
    const match = imageUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (match) {
      return {
        inlineData: {
          mimeType: match[1],
          data: match[2],
        },
      };
    }
  }
  if (imageUrl.startsWith('/src/assets/')) {
    const resolved = path.resolve(process.cwd(), imageUrl.slice(1));
    const baseDir = path.resolve(process.cwd(), 'src', 'assets');
    if (resolved.startsWith(baseDir + path.sep) && fs.existsSync(resolved)) {
      const buf = fs.readFileSync(resolved);
      const ext = path.extname(resolved).toLowerCase();
      const mimeType =
        ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      return {
        inlineData: {
          mimeType,
          data: buf.toString('base64'),
        },
      };
    }
  }
  if (imageUrl.startsWith('/uploads/')) {
    const filename = path.basename(imageUrl);
    const uploadDir = getUploadDir();
    if (uploadDir) {
      const resolved = path.resolve(uploadDir, filename);
      if (resolved.startsWith(uploadDir + path.sep) && fs.existsSync(resolved)) {
        const buf = fs.readFileSync(resolved);
        const ext = path.extname(resolved).toLowerCase();
        const mimeType =
          ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        return {
          inlineData: {
            mimeType,
            data: buf.toString('base64'),
          },
        };
      }
    }
  }
  if (imageUrl.startsWith('https://')) {
    const parsed = new URL(imageUrl);
    if (
      parsed.hostname.endsWith('.public.blob.vercel-storage.com') ||
      parsed.hostname.endsWith('.vercel-storage.com')
    ) {
      const resp = await fetch(imageUrl);
      if (resp.ok) {
        const arrayBuf = await resp.arrayBuffer();
        const mimeType = resp.headers.get('content-type') || 'image/jpeg';
        return {
          inlineData: {
            mimeType,
            data: Buffer.from(arrayBuf).toString('base64'),
          },
        };
      }
    }
  }
  return null;
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mp4') return 'video/mp4';
  return 'image/jpeg';
}

export async function handleApiRequest(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<boolean> {
  const rawUrl = req.url || '/';
  const parsedUrl = new URL(rawUrl, 'http://localhost');
  const routeOverride = parsedUrl.searchParams.get('__route');
  const pathname =
    routeOverride &&
    (routeOverride.startsWith('/api/') || routeOverride.startsWith('/uploads/'))
      ? routeOverride.split('?')[0]
      : parsedUrl.pathname;
  const method = (req.method || 'GET').toUpperCase();

  if (!pathname.startsWith('/api/') && !pathname.startsWith('/uploads/')) {
    return false;
  }

  // Serve local uploaded media safely
  if (method === 'GET' && pathname.startsWith('/uploads/')) {
    const filename = decodeURIComponent(pathname.slice('/uploads/'.length));
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      sendText(res, 400, 'Invalid filename');
      return true;
    }
    const uploadDir = getUploadDir();
    if (!uploadDir) {
      sendText(res, 404, 'Not found');
      return true;
    }
    const resolved = path.resolve(uploadDir, filename);
    if (!resolved.startsWith(uploadDir + path.sep) || !fs.existsSync(resolved)) {
      sendText(res, 404, 'Not found');
      return true;
    }
    const buf = fs.readFileSync(resolved);
    res.statusCode = 200;
    res.setHeader('Content-Type', getMimeType(filename));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(buf);
    return true;
  }

  // Health endpoint
  if (method === 'GET' && pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
    return true;
  }

  // =========================================================================
  // Admin Authentication
  // =========================================================================
  if (method === 'POST' && pathname === '/api/admin/login') {
    const body = await readJsonBody(req);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const expectedEmail = (process.env.ADMIN_EMAIL || 'admin@x.com').trim().toLowerCase();

    if (!email || !password) {
      sendJson(res, 400, { error: 'Informe e-mail e senha.' });
      return true;
    }
    if (email !== expectedEmail || !verifyAdminPassword(password)) {
      sendJson(res, 401, { error: 'Credenciais inválidas para o painel administrativo.' });
      return true;
    }

    const token = signSessionToken({
      email,
      role: 'admin',
      tenantId: DEFAULT_TENANT_ID,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    });
    sendJson(res, 200, {
      token,
      user: {
        email,
        role: 'admin',
        tenantId: DEFAULT_TENANT_ID,
      },
    });
    return true;
  }

  if (method === 'GET' && pathname === '/api/admin/session') {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    sendJson(res, 200, {
      authenticated: true,
      user: session,
    });
    return true;
  }

  if (method === 'POST' && pathname === '/api/admin/password') {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const body = await readJsonBody(req);
    const currentPassword =
      typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    if (!verifyAdminPassword(currentPassword)) {
      sendJson(res, 403, { error: 'Senha atual incorreta.' });
      return true;
    }
    if (newPassword.length < 6 || newPassword.length > 128) {
      sendJson(res, 400, { error: 'A nova senha deve ter entre 6 e 128 caracteres.' });
      return true;
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hashHex = crypto.scryptSync(newPassword, salt, 64).toString('hex');
    const store = getStore();
    store.adminPasswordHash = { salt, hashHex };
    saveStore(store);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // =========================================================================
  // Vercel Blob & Media Upload
  // =========================================================================
  if (method === 'POST' && pathname === '/api/blob/upload') {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    try {
      const body = await readJsonBody(req);
      const filenameRaw =
        typeof body.filename === 'string' ? body.filename : 'media.jpg';
      const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : '';
      const match = dataUrl.match(
        /^data:((?:image|video)\/[a-zA-Z0-9+.-]+);base64,(.+)$/
      );
      if (!match) {
        sendJson(res, 400, {
          error: 'Formato de mídia inválido. Envie imagem ou vídeo em base64.',
        });
        return true;
      }
      const mimeType = match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.length > 10 * 1024 * 1024) {
        sendJson(res, 400, { error: 'Arquivo excede o limite de 10 MB.' });
        return true;
      }

      const safeBase =
        filenameRaw.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60) || 'asset';
      const uniqueName = `${Date.now()}_${safeBase}`;

      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const { put } = await import('@vercel/blob');
        const blob = await put(`ads-imoveis/${uniqueName}`, buffer, {
          access: 'public',
          contentType: mimeType,
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        sendJson(res, 200, { url: blob.url, provider: 'vercel-blob' });
        return true;
      }

      const uploadDir = getUploadDir();
      if (uploadDir) {
        const target = path.resolve(uploadDir, uniqueName);
        if (target.startsWith(uploadDir + path.sep)) {
          fs.writeFileSync(target, buffer);
          sendJson(res, 200, {
            url: `/uploads/${uniqueName}`,
            provider: 'local-storage',
          });
          return true;
        }
      }

      sendJson(res, 200, { url: dataUrl, provider: 'inline-fallback' });
      return true;
    } catch (err) {
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : 'Erro ao enviar mídia.',
      });
      return true;
    }
  }

  // =========================================================================
  // Store Public Bootstrap & Lead Capture
  // =========================================================================
  if (method === 'GET' && pathname === '/api/store/bootstrap') {
    const qTid = parsedUrl.searchParams.get('tenantId');
    const tenantId = isValidId(qTid) ? qTid : DEFAULT_TENANT_ID;
    const store = getStore();
    const tenant =
      store.tenants[tenantId] ||
      store.tenants[DEFAULT_TENANT_ID] ||
      DEFAULT_TENANT_CONFIG;
    const activeTenantId = tenant.tenantId;
    sendJson(res, 200, {
      tenant,
      tenants: Object.values(store.tenants),
      properties: store.properties.filter(
        (p) => p.tenantId === activeTenantId && p.published
      ),
      developments: store.developments.filter(
        (d) => d.tenantId === activeTenantId && d.published
      ),
      landingPages: store.landingPages.filter(
        (l) => l.tenantId === activeTenantId && l.published
      ),
    });
    return true;
  }

  if (method === 'POST' && pathname === '/api/store/leads') {
    const body = await readJsonBody(req);
    const tenantId = isValidId(body.tenantId) ? body.tenantId : DEFAULT_TENANT_ID;
    const name =
      typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
    const phone =
      typeof body.phone === 'string' ? body.phone.trim().slice(0, 40) : '';
    const email =
      typeof body.email === 'string' ? body.email.trim().slice(0, 140) : '';
    const message =
      typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : '';
    const lgpdConsent = body.lgpdConsent === true;

    if (!lgpdConsent) {
      sendJson(res, 400, {
        error: 'É necessário concordar com a política de privacidade (LGPD).',
      });
      return true;
    }
    if (name.length < 2 || phone.length < 8) {
      sendJson(res, 400, {
        error: 'Informe nome completo e telefone/WhatsApp válido.',
      });
      return true;
    }

    const now = new Date().toISOString();
    const lead: Lead = {
      id: `lead_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      tenantId,
      name,
      email,
      phone,
      message,
      interestType: [
        'venda',
        'aluguel',
        'avaliacao',
        'visita',
        'comercial',
      ].includes(String(body.interestType))
        ? (body.interestType as Lead['interestType'])
        : 'visita',
      propertyId:
        typeof body.propertyId === 'string' ? body.propertyId.slice(0, 128) : '',
      propertyTitle:
        typeof body.propertyTitle === 'string'
          ? body.propertyTitle.slice(0, 180)
          : '',
      sourcePage:
        typeof body.sourcePage === 'string' ? body.sourcePage.slice(0, 160) : '/',
      status: 'novo',
      lgpdConsent: true,
      createdAt: now,
      updatedAt: now,
    };

    const store = getStore();
    store.leads.unshift(lead);
    saveStore(store);
    sendJson(res, 201, { lead });
    return true;
  }

  // =========================================================================
  // Store Admin CRUD (Protected by Bearer Session)
  // =========================================================================
  if (method === 'GET' && pathname === '/api/store/admin/all') {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const qTid = parsedUrl.searchParams.get('tenantId');
    const tenantId = isValidId(qTid) ? qTid : DEFAULT_TENANT_ID;
    const store = getStore();
    const tenant = store.tenants[tenantId] || store.tenants[DEFAULT_TENANT_ID];
    sendJson(res, 200, {
      tenant,
      tenants: Object.values(store.tenants),
      properties: store.properties.filter((p) => p.tenantId === tenant.tenantId),
      developments: store.developments.filter(
        (d) => d.tenantId === tenant.tenantId
      ),
      landingPages: store.landingPages.filter(
        (l) => l.tenantId === tenant.tenantId
      ),
      leads: store.leads.filter((l) => l.tenantId === tenant.tenantId),
    });
    return true;
  }

  if (method === 'PUT' && pathname === '/api/store/admin/tenant') {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const body = (await readJsonBody(req)) as Partial<TenantConfig>;
    const tenantId = isValidId(body?.tenantId)
      ? body.tenantId
      : DEFAULT_TENANT_ID;
    const store = getStore();
    const existing = store.tenants[tenantId] || {
      ...DEFAULT_TENANT_CONFIG,
      tenantId,
    };
    const updated: TenantConfig = {
      ...existing,
      ...body,
      tenantId,
      logoUrl:
        body?.logoUrl !== undefined ? sanitizeUrl(body.logoUrl) : existing.logoUrl,
      faviconUrl:
        body?.faviconUrl !== undefined
          ? sanitizeUrl(body.faviconUrl)
          : existing.faviconUrl,
      assistantAvatarUrl:
        body?.assistantAvatarUrl !== undefined
          ? sanitizeUrl(body.assistantAvatarUrl)
          : existing.assistantAvatarUrl,
      updatedAt: new Date().toISOString(),
    };
    store.tenants[tenantId] = updated;
    saveStore(store);
    sendJson(res, 200, { tenant: updated });
    return true;
  }

  if (method === 'POST' && pathname === '/api/store/admin/tenants') {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const body = (await readJsonBody(req)) as Partial<TenantConfig>;
    if (!isValidId(body?.tenantId) || !body.companyName) {
      sendJson(res, 400, {
        error: 'ID do tenant e nome comercial são obrigatórios.',
      });
      return true;
    }
    const store = getStore();
    const created: TenantConfig = {
      ...DEFAULT_TENANT_CONFIG,
      ...body,
      tenantId: body.tenantId,
      updatedAt: new Date().toISOString(),
    };
    store.tenants[created.tenantId] = created;
    saveStore(store);
    sendJson(res, 201, { tenant: created });
    return true;
  }

  if (method === 'POST' && pathname === '/api/store/admin/properties') {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const body = (await readJsonBody(req)) as Partial<Property>;
    const tenantId = isValidId(body?.tenantId)
      ? body.tenantId
      : DEFAULT_TENANT_ID;
    if (!body?.title || body.title.trim().length < 3) {
      sendJson(res, 400, { error: 'Título do imóvel é obrigatório.' });
      return true;
    }
    const now = new Date().toISOString();
    const id = isValidId(body.id)
      ? body.id
      : `prop_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    const slugBase = (body.slug || body.title)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 90);
    const property: Property = {
      id,
      tenantId,
      slug: slugBase || id,
      title: body.title.trim().slice(0, 160),
      subtitle: (body.subtitle || '').slice(0, 240),
      description: (body.description || '').slice(0, 6000),
      transactionType: body.transactionType || 'venda',
      propertyType: body.propertyType || 'apartamento',
      neighborhood: (body.neighborhood || 'Ipiranga').slice(0, 100),
      city: (body.city || 'São Paulo').slice(0, 80),
      regionHighlight: (body.regionHighlight || '').slice(0, 160),
      salePrice: Number(body.salePrice) || 0,
      rentPrice: Number(body.rentPrice) || 0,
      condoFee: Number(body.condoFee) || 0,
      iptuFee: Number(body.iptuFee) || 0,
      areaSqm: Number(body.areaSqm) || 0,
      bedrooms: Number(body.bedrooms) || 0,
      bathrooms: Number(body.bathrooms) || 0,
      suites: Number(body.suites) || 0,
      parkingSpaces: Number(body.parkingSpaces) || 0,
      furnished: Boolean(body.furnished),
      fullLeisure: Boolean(body.fullLeisure),
      features: Array.isArray(body.features) ? body.features.slice(0, 30) : [],
      images: Array.isArray(body.images)
        ? body.images.map(sanitizeUrl).filter(Boolean).slice(0, 20)
        : [],
      videoUrl: sanitizeUrl(body.videoUrl),
      virtualTourMode: body.virtualTourMode || 'panoramic_360',
      virtualTourData: body.virtualTourData,
      aiAnalysis: body.aiAnalysis,
      featured: Boolean(body.featured),
      published: body.published !== false,
      status: body.status || 'disponivel',
      ownerId: session.email || 'admin',
      createdAt: body.createdAt || now,
      updatedAt: now,
    };

    const store = getStore();
    const idx = store.properties.findIndex((p) => p.id === property.id);
    if (idx >= 0) {
      store.properties[idx] = {
        ...store.properties[idx],
        ...property,
        createdAt: store.properties[idx].createdAt,
        updatedAt: now,
      };
    } else {
      store.properties.unshift(property);
    }
    saveStore(store);
    sendJson(res, 200, { property });
    return true;
  }

  if (
    method === 'DELETE' &&
    pathname.startsWith('/api/store/admin/properties/')
  ) {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const id = decodeURIComponent(
      pathname.slice('/api/store/admin/properties/'.length)
    );
    const store = getStore();
    store.properties = store.properties.filter((p) => p.id !== id);
    saveStore(store);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (method === 'POST' && pathname === '/api/store/admin/developments') {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const body = (await readJsonBody(req)) as Partial<Development>;
    const tenantId = isValidId(body?.tenantId)
      ? body.tenantId
      : DEFAULT_TENANT_ID;
    if (!body?.name) {
      sendJson(res, 400, { error: 'Nome do empreendimento é obrigatório.' });
      return true;
    }
    const now = new Date().toISOString();
    const id = isValidId(body.id) ? body.id : `dev_${Date.now()}`;
    const dev: Development = {
      id,
      tenantId,
      slug: (body.slug || id).replace(/[^a-zA-Z0-9_-]/g, '-'),
      name: body.name.trim().slice(0, 160),
      neighborhood: (body.neighborhood || 'Ipiranga').slice(0, 100),
      city: (body.city || 'São Paulo').slice(0, 80),
      stage: body.stage || 'pronto',
      summary: (body.summary || '').slice(0, 2000),
      coverImage: sanitizeUrl(body.coverImage),
      amenities: Array.isArray(body.amenities) ? body.amenities.slice(0, 25) : [],
      published: body.published !== false,
      ownerId: session.email || 'admin',
      createdAt: body.createdAt || now,
      updatedAt: now,
    };
    const store = getStore();
    const idx = store.developments.findIndex((d) => d.id === dev.id);
    if (idx >= 0) store.developments[idx] = dev;
    else store.developments.unshift(dev);
    saveStore(store);
    sendJson(res, 200, { development: dev });
    return true;
  }

  if (
    method === 'DELETE' &&
    pathname.startsWith('/api/store/admin/developments/')
  ) {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const id = decodeURIComponent(
      pathname.slice('/api/store/admin/developments/'.length)
    );
    const store = getStore();
    store.developments = store.developments.filter((d) => d.id !== id);
    saveStore(store);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (method === 'POST' && pathname === '/api/store/admin/landing-pages') {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const body = (await readJsonBody(req)) as Partial<LandingPage>;
    const tenantId = isValidId(body?.tenantId)
      ? body.tenantId
      : DEFAULT_TENANT_ID;
    if (!body?.title || !body?.headline) {
      sendJson(res, 400, { error: 'Título e manchete são obrigatórios.' });
      return true;
    }
    const now = new Date().toISOString();
    const id = isValidId(body.id) ? body.id : `lp_${Date.now()}`;
    const lp: LandingPage = {
      id,
      tenantId,
      slug: (body.slug || body.title)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 100),
      title: body.title.trim().slice(0, 160),
      headline: body.headline.trim().slice(0, 220),
      subheadline: (body.subheadline || '').slice(0, 400),
      heroImage: sanitizeUrl(body.heroImage),
      ctaLabel: (body.ctaLabel || 'Falar com a Corretora').slice(0, 80),
      targetRegion: (body.targetRegion || 'São Paulo').slice(0, 100),
      propertyFilterType: (body.propertyFilterType || '').slice(0, 60),
      bodyText: (body.bodyText || '').slice(0, 5000),
      published: body.published !== false,
      ownerId: session.email || 'admin',
      createdAt: body.createdAt || now,
      updatedAt: now,
    };
    const store = getStore();
    const idx = store.landingPages.findIndex((l) => l.id === lp.id);
    if (idx >= 0) store.landingPages[idx] = lp;
    else store.landingPages.unshift(lp);
    saveStore(store);
    sendJson(res, 200, { landingPage: lp });
    return true;
  }

  if (
    method === 'DELETE' &&
    pathname.startsWith('/api/store/admin/landing-pages/')
  ) {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const id = decodeURIComponent(
      pathname.slice('/api/store/admin/landing-pages/'.length)
    );
    const store = getStore();
    store.landingPages = store.landingPages.filter((l) => l.id !== id);
    saveStore(store);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (method === 'PATCH' && pathname.startsWith('/api/store/admin/leads/')) {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const id = decodeURIComponent(
      pathname.slice('/api/store/admin/leads/'.length)
    );
    const body = await readJsonBody(req);
    const store = getStore();
    const lead = store.leads.find((l) => l.id === id);
    if (!lead) {
      sendJson(res, 404, { error: 'Lead não encontrado.' });
      return true;
    }
    if (
      [
        'novo',
        'em_atendimento',
        'agendado',
        'convertido',
        'arquivado',
      ].includes(String(body.status))
    ) {
      lead.status = body.status as Lead['status'];
    }
    lead.updatedAt = new Date().toISOString();
    saveStore(store);
    sendJson(res, 200, { lead });
    return true;
  }

  if (method === 'DELETE' && pathname.startsWith('/api/store/admin/leads/')) {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const id = decodeURIComponent(
      pathname.slice('/api/store/admin/leads/'.length)
    );
    const store = getStore();
    store.leads = store.leads.filter((l) => l.id !== id);
    saveStore(store);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // =========================================================================
  // Gemini AI Studio Routes (Dynamic SDK Import — Server-Side)
  // =========================================================================
  if (method === 'POST' && pathname === '/api/ai/analyze-photo') {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    try {
      const body = await readJsonBody(req);
      const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl : '';
      const propertyContext =
        typeof body.context === 'string' ? body.context : 'Imóvel em São Paulo';
      const imagePart = await resolveImageAsInlinePart(imageUrl);
      if (!imagePart) {
        sendJson(res, 400, {
          error: 'Imagem não encontrada ou formato não suportado para análise.',
        });
        return true;
      }
      const { ai, Type } = await getGenAIClient();
      const response = await generateContentResilient(ai, {
        contents: {
          parts: [
            imagePart,
            {
              text: `Você é um diretor de fotografia arquitetônica e consultor da corretora A D S Imóveis (CRECI 226079-F, São Paulo). Analise esta foto do imóvel (${propertyContext}) e retorne diagnóstico técnico, recomendações de staging/enquadramento e parâmetros ideais de melhoria visual (brightness entre 0.95 e 1.18, contrast entre 1.0 e 1.22, saturate entre 0.95 e 1.2, warmth entre -10 e 15, sharpness entre 0 e 1).`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              qualityScore: { type: Type.INTEGER },
              roomType: { type: Type.STRING },
              lightingNotes: { type: Type.STRING },
              stagingRecommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              recommendedPreset: { type: Type.STRING },
              enhancementParams: {
                type: Type.OBJECT,
                properties: {
                  brightness: { type: Type.NUMBER },
                  contrast: { type: Type.NUMBER },
                  saturate: { type: Type.NUMBER },
                  warmth: { type: Type.NUMBER },
                  sharpness: { type: Type.NUMBER },
                },
              },
            },
          },
        },
      });
      const parsed = JSON.parse((response.text ?? '{}').trim());
      sendJson(res, 200, parsed);
      return true;
    } catch (err) {
      sendJson(res, 500, {
        error: extractGeminiErrorMessage(
          err,
          'Erro ao analisar foto com Gemini AI.'
        ),
      });
      return true;
    }
  }

  if (method === 'POST' && pathname === '/api/ai/cinematic-director') {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    try {
      const body = await readJsonBody(req);
      const property = body.property as Partial<Property> | undefined;
      if (!property?.title) {
        sendJson(res, 400, { error: 'Dados do imóvel são obrigatórios.' });
        return true;
      }
      const { ai, Type } = await getGenAIClient();
      const response = await generateContentResilient(ai, {
        contents: `Crie um roteiro cinematográfico de apresentação imobiliária para a A D S Imóveis e Intermediações de Negócios (CRECI 226079-F, São Paulo).
Imóvel: ${property.title}
Bairro: ${property.neighborhood}, São Paulo (${property.regionHighlight || ''})
Tipo: ${property.propertyType} | Transação: ${property.transactionType}
Área: ${property.areaSqm} m² | Quartos: ${property.bedrooms} | Vagas: ${property.parkingSpaces} | Mobiliado: ${property.furnished ? 'Sim' : 'Não'}
Diferenciais: ${(property.features || []).join(', ')}
Quantidade de fotos disponíveis: ${(property.images || []).length || 2}
Gere um título de vídeo, gancho inicial, clima musical e de 3 a 4 cenas curtas com legenda na tela (máx 7 palavras), locução comercial realista e direção de movimento de câmera ('zoom-in', 'pan-left', 'pan-right', 'zoom-out').`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              hook: { type: Type.STRING },
              musicMood: { type: Type.STRING },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sceneNumber: { type: Type.INTEGER },
                    caption: { type: Type.STRING },
                    voiceover: { type: Type.STRING },
                    motion: { type: Type.STRING },
                    durationSec: { type: Type.INTEGER },
                  },
                },
              },
            },
          },
        },
      });
      const parsed = JSON.parse((response.text ?? '{}').trim());
      sendJson(res, 200, parsed);
      return true;
    } catch (err) {
      sendJson(res, 500, {
        error: extractGeminiErrorMessage(
          err,
          'Erro ao gerar roteiro cinematográfico.'
        ),
      });
      return true;
    }
  }

  if (method === 'POST' && pathname === '/api/ai/virtual-tour') {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    try {
      const body = await readJsonBody(req);
      const property = body.property as Partial<Property> | undefined;
      if (!property?.title) {
        sendJson(res, 400, { error: 'Dados do imóvel são obrigatórios.' });
        return true;
      }
      const { ai, Type } = await getGenAIClient();
      const imageParts: Array<
        { inlineData: { data: string; mimeType: string } } | { text: string }
      > = [];
      for (const img of (property.images || []).slice(0, 2)) {
        const part = await resolveImageAsInlinePart(img);
        if (part) imageParts.push(part);
      }
      imageParts.push({
        text: `Crie os dados completos de Visita Virtual nas 3 modalidades (Panorâmico 360°, História Guiada e Explorador de Hotspots) para o imóvel "${property.title}" em ${property.neighborhood}, São Paulo, da A D S Imóveis (CRECI 226079-F).
Posicione de 3 a 4 hotspots com coordenadas percentuais x (15 a 85) e y (20 a 80), roomLabel curto, título e descrição realística dos ambientes e localização em São Paulo.`,
      });

      const response = await generateContentResilient(ai, {
        contents: { parts: imageParts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              panoramicSceneTitle: { type: Type.STRING },
              panoramicHighlights: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              chapters: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    narration: { type: Type.STRING },
                    cameraHint: { type: Type.STRING },
                    imageIndex: { type: Type.INTEGER },
                    durationSec: { type: Type.INTEGER },
                  },
                },
              },
              hotspots: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    roomLabel: { type: Type.STRING },
                    imageIndex: { type: Type.INTEGER },
                  },
                },
              },
            },
          },
        },
      });
      const parsed = JSON.parse((response.text ?? '{}').trim());
      sendJson(res, 200, parsed);
      return true;
    } catch (err) {
      sendJson(res, 500, {
        error: extractGeminiErrorMessage(err, 'Erro ao gerar Visita Virtual.'),
      });
      return true;
    }
  }

  if (method === 'POST' && pathname === '/api/ai/generate-description') {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    try {
      const body = await readJsonBody(req);
      const property = body.property as Partial<Property> | undefined;
      if (!property?.title) {
        sendJson(res, 400, { error: 'Dados do imóvel são obrigatórios.' });
        return true;
      }
      const { ai, Type } = await getGenAIClient();
      const response = await generateContentResilient(ai, {
        contents: `Escreva textos comerciais profissionais e sem clichês exagerados para a A D S Imóveis e Intermediações de Negócios (CRECI 226079-F), focada em oportunidades reais de venda e locação em São Paulo.
Dados do imóvel:
Título: ${property.title}
Tipo: ${property.propertyType} | Finalidade: ${property.transactionType}
Bairro: ${property.neighborhood} | Referência: ${property.regionHighlight || 'São Paulo'}
Área: ${property.areaSqm} m² | Quartos: ${property.bedrooms} | Suítes: ${property.suites} | Banheiros: ${property.bathrooms} | Vagas: ${property.parkingSpaces}
Mobiliado: ${property.furnished ? 'Sim' : 'Não'} | Lazer Completo: ${property.fullLeisure ? 'Sim' : 'Não'}
Diferenciais: ${(property.features || []).join(', ')}

Não invente telefones, nomes de corretores ou depoimentos. Retorne JSON com subtitle (1 frase), portalDescription (2 a 3 parágrafos refinados), instagramCaption (texto pronto para Instagram com hashtags de São Paulo e menção ao CRECI 226079-F) e seoKeywords.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subtitle: { type: Type.STRING },
              portalDescription: { type: Type.STRING },
              instagramCaption: { type: Type.STRING },
              seoKeywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
        },
      });
      const parsed = JSON.parse((response.text ?? '{}').trim());
      sendJson(res, 200, parsed);
      return true;
    } catch (err) {
      sendJson(res, 500, {
        error: extractGeminiErrorMessage(
          err,
          'Erro ao gerar descrição comercial.'
        ),
      });
      return true;
    }
  }

  // =========================================================================
  // Public Virtual Assistant Concierge Route
  // =========================================================================
  if (method === 'POST' && pathname === '/api/assistant/chat') {
    const body = await readJsonBody(req);
    const message =
      typeof body.message === 'string' ? body.message.trim().slice(0, 500) : '';
    const tenantId = isValidId(body.tenantId) ? body.tenantId : DEFAULT_TENANT_ID;
    if (!message) {
      sendJson(res, 400, { error: 'Digite sua dúvida para continuar.' });
      return true;
    }

    const store = getStore();
    const tenant =
      store.tenants[tenantId] ||
      store.tenants[DEFAULT_TENANT_ID] ||
      DEFAULT_TENANT_CONFIG;
    const assistantName = tenant.assistantName || 'Sofia';

    try {
      const { ai } = await getGenAIClient();
      const response = await generateContentResilient(ai, {
        contents: `Pergunta do cliente: "${message}"`,
        config: {
          systemInstruction: `Você é ${assistantName}, assistente virtual da ${tenant.companyName} (${tenant.slogan}, CRECI ${tenant.creci}).
Responda em português do Brasil de forma objetiva, acolhedora e simples (máximo 2 a 3 frases curtas).
Fatos oficiais que você conhece:
- Atuação: vendas e locações em ${tenant.city}.
- Regiões principais: ${tenant.regions.join(', ')}.
- Tipos de imóveis: apartamentos residenciais (venda e aluguel), apartamentos mobiliados, lojas e imóveis comerciais, opções com ou sem vaga de garagem e condomínios com lazer completo.
- Nunca invente telefones, endereços, nomes de corretores ou preços específicos que não foram perguntados.
- Sempre convide o cliente a continuar o atendimento pelas redes sociais oficiais (Instagram ou WhatsApp) usando os botões exibidos logo abaixo da sua mensagem.`,
        },
      });
      sendJson(res, 200, {
        reply:
          response.text?.trim() ||
          `Olá! Aqui é a ${assistantName}, da ${tenant.companyName}. Posso te ajudar com vendas e locações em São Paulo — clique abaixo para falar conosco no Instagram ou WhatsApp.`,
      });
      return true;
    } catch (err) {
      sendJson(res, 503, {
        error: extractGeminiErrorMessage(
          err,
          'Assistente temporariamente indisponível.'
        ),
      });
      return true;
    }
  }

  sendJson(res, 404, { error: 'Endpoint não encontrado.' });
  return true;
}
