import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { put } from '@vercel/blob';
import { DEFAULT_TENANT_CONFIG, DEFAULT_TENANT_ID } from '../src/data/defaults';
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
    : crypto.randomBytes(32).toString('hex');

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
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as SessionPayload;
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

interface AuthedRequest extends Request {
  adminSession?: SessionPayload;
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sessão administrativa não autenticada.' });
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sessão administrativa expirada ou inválida.' });
    return;
  }
  req.adminSession = payload;
  next();
}

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no ambiente do servidor.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
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
  ai: GoogleGenAI,
  params: Omit<Parameters<GoogleGenAI['models']['generateContent']>[0], 'model'>
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
      const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
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
        const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
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

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '15mb' }));

  // Serve local uploaded media safely
  app.get('/uploads/:filename', (req: Request, res: Response) => {
    const filename = req.params.filename;
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      res.status(400).send('Invalid filename');
      return;
    }
    const uploadDir = getUploadDir();
    if (!uploadDir) {
      res.status(404).send('Not found');
      return;
    }
    const resolved = path.resolve(uploadDir, filename);
    if (!resolved.startsWith(uploadDir + path.sep) || !fs.existsSync(resolved)) {
      res.status(404).send('Not found');
      return;
    }
    res.sendFile(resolved);
  });

  // Health endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // =========================================================================
  // Admin Authentication
  // =========================================================================
  app.post('/api/admin/login', (req: Request, res: Response) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const expectedEmail = (process.env.ADMIN_EMAIL || 'admin@x.com').trim().toLowerCase();

    if (!email || !password) {
      res.status(400).json({ error: 'Informe e-mail e senha.' });
      return;
    }
    if (email !== expectedEmail || !verifyAdminPassword(password)) {
      res.status(401).json({ error: 'Credenciais inválidas para o painel administrativo.' });
      return;
    }

    const token = signSessionToken({
      email,
      role: 'admin',
      tenantId: DEFAULT_TENANT_ID,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    });
    res.json({
      token,
      user: {
        email,
        role: 'admin',
        tenantId: DEFAULT_TENANT_ID,
      },
    });
  });

  app.get('/api/admin/session', requireAdmin, (req: AuthedRequest, res: Response) => {
    res.json({
      authenticated: true,
      user: req.adminSession,
    });
  });

  app.post('/api/admin/password', requireAdmin, (req: AuthedRequest, res: Response) => {
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    if (!verifyAdminPassword(currentPassword)) {
      res.status(403).json({ error: 'Senha atual incorreta.' });
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 128) {
      res.status(400).json({ error: 'A nova senha deve ter entre 6 e 128 caracteres.' });
      return;
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hashHex = crypto.scryptSync(newPassword, salt, 64).toString('hex');
    const store = getStore();
    store.adminPasswordHash = { salt, hashHex };
    saveStore(store);
    res.json({ ok: true });
  });

  // =========================================================================
  // Vercel Blob & Media Upload
  // =========================================================================
  app.post('/api/blob/upload', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const filenameRaw = typeof req.body?.filename === 'string' ? req.body.filename : 'media.jpg';
      const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : '';
      const match = dataUrl.match(/^data:((?:image|video)\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (!match) {
        res.status(400).json({ error: 'Formato de mídia inválido. Envie imagem ou vídeo em base64.' });
        return;
      }
      const mimeType = match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.length > 10 * 1024 * 1024) {
        res.status(400).json({ error: 'Arquivo excede o limite de 10 MB.' });
        return;
      }

      const safeBase = filenameRaw.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60) || 'asset';
      const uniqueName = `${Date.now()}_${safeBase}`;

      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const blob = await put(`ads-imoveis/${uniqueName}`, buffer, {
          access: 'public',
          contentType: mimeType,
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        res.json({ url: blob.url, provider: 'vercel-blob' });
        return;
      }

      const uploadDir = getUploadDir();
      if (uploadDir) {
        const target = path.resolve(uploadDir, uniqueName);
        if (target.startsWith(uploadDir + path.sep)) {
          fs.writeFileSync(target, buffer);
          res.json({ url: `/uploads/${uniqueName}`, provider: 'local-storage' });
          return;
        }
      }

      res.json({ url: dataUrl, provider: 'inline-fallback' });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Erro ao enviar mídia.',
      });
    }
  });

  // =========================================================================
  // Store Public Bootstrap & Lead Capture
  // =========================================================================
  app.get('/api/store/bootstrap', (req: Request, res: Response) => {
    const tenantId = isValidId(req.query.tenantId) ? req.query.tenantId : DEFAULT_TENANT_ID;
    const store = getStore();
    const tenant = store.tenants[tenantId] || store.tenants[DEFAULT_TENANT_ID] || DEFAULT_TENANT_CONFIG;
    const activeTenantId = tenant.tenantId;
    res.json({
      tenant,
      tenants: Object.values(store.tenants),
      properties: store.properties.filter((p) => p.tenantId === activeTenantId && p.published),
      developments: store.developments.filter((d) => d.tenantId === activeTenantId && d.published),
      landingPages: store.landingPages.filter((l) => l.tenantId === activeTenantId && l.published),
    });
  });

  app.post('/api/store/leads', (req: Request, res: Response) => {
    const body = req.body || {};
    const tenantId = isValidId(body.tenantId) ? body.tenantId : DEFAULT_TENANT_ID;
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 40) : '';
    const email = typeof body.email === 'string' ? body.email.trim().slice(0, 140) : '';
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : '';
    const lgpdConsent = body.lgpdConsent === true;

    if (!lgpdConsent) {
      res.status(400).json({ error: 'É necessário concordar com a política de privacidade (LGPD).' });
      return;
    }
    if (name.length < 2 || phone.length < 8) {
      res.status(400).json({ error: 'Informe nome completo e telefone/WhatsApp válido.' });
      return;
    }

    const now = new Date().toISOString();
    const lead: Lead = {
      id: `lead_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      tenantId,
      name,
      email,
      phone,
      message,
      interestType: ['venda', 'aluguel', 'avaliacao', 'visita', 'comercial'].includes(body.interestType)
        ? body.interestType
        : 'visita',
      propertyId: typeof body.propertyId === 'string' ? body.propertyId.slice(0, 128) : '',
      propertyTitle: typeof body.propertyTitle === 'string' ? body.propertyTitle.slice(0, 180) : '',
      sourcePage: typeof body.sourcePage === 'string' ? body.sourcePage.slice(0, 160) : '/',
      status: 'novo',
      lgpdConsent: true,
      createdAt: now,
      updatedAt: now,
    };

    const store = getStore();
    store.leads.unshift(lead);
    saveStore(store);
    res.status(201).json({ lead });
  });

  // =========================================================================
  // Store Admin CRUD (Protected by Bearer Session)
  // =========================================================================
  app.get('/api/store/admin/all', requireAdmin, (req: AuthedRequest, res: Response) => {
    const tenantId = isValidId(req.query.tenantId) ? req.query.tenantId : DEFAULT_TENANT_ID;
    const store = getStore();
    const tenant = store.tenants[tenantId] || store.tenants[DEFAULT_TENANT_ID];
    res.json({
      tenant,
      tenants: Object.values(store.tenants),
      properties: store.properties.filter((p) => p.tenantId === tenant.tenantId),
      developments: store.developments.filter((d) => d.tenantId === tenant.tenantId),
      landingPages: store.landingPages.filter((l) => l.tenantId === tenant.tenantId),
      leads: store.leads.filter((l) => l.tenantId === tenant.tenantId),
    });
  });

  app.put('/api/store/admin/tenant', requireAdmin, (req: AuthedRequest, res: Response) => {
    const body = req.body as Partial<TenantConfig>;
    const tenantId = isValidId(body?.tenantId) ? body.tenantId : DEFAULT_TENANT_ID;
    const store = getStore();
    const existing = store.tenants[tenantId] || { ...DEFAULT_TENANT_CONFIG, tenantId };
    const updated: TenantConfig = {
      ...existing,
      ...body,
      tenantId,
      logoUrl: body?.logoUrl !== undefined ? sanitizeUrl(body.logoUrl) : existing.logoUrl,
      faviconUrl: body?.faviconUrl !== undefined ? sanitizeUrl(body.faviconUrl) : existing.faviconUrl,
      assistantAvatarUrl:
        body?.assistantAvatarUrl !== undefined
          ? sanitizeUrl(body.assistantAvatarUrl)
          : existing.assistantAvatarUrl,
      updatedAt: new Date().toISOString(),
    };
    store.tenants[tenantId] = updated;
    saveStore(store);
    res.json({ tenant: updated });
  });

  app.post('/api/store/admin/tenants', requireAdmin, (req: AuthedRequest, res: Response) => {
    const body = req.body as Partial<TenantConfig>;
    if (!isValidId(body?.tenantId) || !body.companyName) {
      res.status(400).json({ error: 'ID do tenant e nome comercial são obrigatórios.' });
      return;
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
    res.status(201).json({ tenant: created });
  });

  app.post('/api/store/admin/properties', requireAdmin, (req: AuthedRequest, res: Response) => {
    const body = req.body as Partial<Property>;
    const tenantId = isValidId(body?.tenantId) ? body.tenantId : DEFAULT_TENANT_ID;
    if (!body?.title || body.title.trim().length < 3) {
      res.status(400).json({ error: 'Título do imóvel é obrigatório.' });
      return;
    }
    const now = new Date().toISOString();
    const id = isValidId(body.id) ? body.id : `prop_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
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
      images: Array.isArray(body.images) ? body.images.map(sanitizeUrl).filter(Boolean).slice(0, 20) : [],
      videoUrl: sanitizeUrl(body.videoUrl),
      virtualTourMode: body.virtualTourMode || 'panoramic_360',
      virtualTourData: body.virtualTourData,
      aiAnalysis: body.aiAnalysis,
      featured: Boolean(body.featured),
      published: body.published !== false,
      status: body.status || 'disponivel',
      ownerId: req.adminSession?.email || 'admin',
      createdAt: body.createdAt || now,
      updatedAt: now,
    };

    const store = getStore();
    const idx = store.properties.findIndex((p) => p.id === property.id);
    if (idx >= 0) {
      store.properties[idx] = { ...store.properties[idx], ...property, createdAt: store.properties[idx].createdAt, updatedAt: now };
    } else {
      store.properties.unshift(property);
    }
    saveStore(store);
    res.json({ property });
  });

  app.delete('/api/store/admin/properties/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
    const id = req.params.id;
    const store = getStore();
    store.properties = store.properties.filter((p) => p.id !== id);
    saveStore(store);
    res.json({ ok: true });
  });

  app.post('/api/store/admin/developments', requireAdmin, (req: AuthedRequest, res: Response) => {
    const body = req.body as Partial<Development>;
    const tenantId = isValidId(body?.tenantId) ? body.tenantId : DEFAULT_TENANT_ID;
    if (!body?.name) {
      res.status(400).json({ error: 'Nome do empreendimento é obrigatório.' });
      return;
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
      ownerId: req.adminSession?.email || 'admin',
      createdAt: body.createdAt || now,
      updatedAt: now,
    };
    const store = getStore();
    const idx = store.developments.findIndex((d) => d.id === dev.id);
    if (idx >= 0) store.developments[idx] = dev;
    else store.developments.unshift(dev);
    saveStore(store);
    res.json({ development: dev });
  });

  app.delete('/api/store/admin/developments/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
    const store = getStore();
    store.developments = store.developments.filter((d) => d.id !== req.params.id);
    saveStore(store);
    res.json({ ok: true });
  });

  app.post('/api/store/admin/landing-pages', requireAdmin, (req: AuthedRequest, res: Response) => {
    const body = req.body as Partial<LandingPage>;
    const tenantId = isValidId(body?.tenantId) ? body.tenantId : DEFAULT_TENANT_ID;
    if (!body?.title || !body?.headline) {
      res.status(400).json({ error: 'Título e manchete são obrigatórios.' });
      return;
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
      ownerId: req.adminSession?.email || 'admin',
      createdAt: body.createdAt || now,
      updatedAt: now,
    };
    const store = getStore();
    const idx = store.landingPages.findIndex((l) => l.id === lp.id);
    if (idx >= 0) store.landingPages[idx] = lp;
    else store.landingPages.unshift(lp);
    saveStore(store);
    res.json({ landingPage: lp });
  });

  app.delete('/api/store/admin/landing-pages/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
    const store = getStore();
    store.landingPages = store.landingPages.filter((l) => l.id !== req.params.id);
    saveStore(store);
    res.json({ ok: true });
  });

  app.patch('/api/store/admin/leads/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
    const store = getStore();
    const lead = store.leads.find((l) => l.id === req.params.id);
    if (!lead) {
      res.status(404).json({ error: 'Lead não encontrado.' });
      return;
    }
    if (['novo', 'em_atendimento', 'agendado', 'convertido', 'arquivado'].includes(req.body?.status)) {
      lead.status = req.body.status;
    }
    lead.updatedAt = new Date().toISOString();
    saveStore(store);
    res.json({ lead });
  });

  app.delete('/api/store/admin/leads/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
    const store = getStore();
    store.leads = store.leads.filter((l) => l.id !== req.params.id);
    saveStore(store);
    res.json({ ok: true });
  });

  // =========================================================================
  // Gemini 4 Hydrogen AI Studio Routes (Server-Side)
  // =========================================================================
  app.post('/api/ai/analyze-photo', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl : '';
      const propertyContext = typeof req.body?.context === 'string' ? req.body.context : 'Imóvel em São Paulo';
      const imagePart = await resolveImageAsInlinePart(imageUrl);
      if (!imagePart) {
        res.status(400).json({ error: 'Imagem não encontrada ou formato não suportado para análise.' });
        return;
      }
      const ai = getGenAIClient();
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
      res.json(parsed);
    } catch (err) {
      res.status(500).json({
        error: extractGeminiErrorMessage(err, 'Erro ao analisar foto com Gemini AI.'),
      });
    }
  });

  app.post('/api/ai/cinematic-director', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const property = req.body?.property as Partial<Property> | undefined;
      if (!property?.title) {
        res.status(400).json({ error: 'Dados do imóvel são obrigatórios.' });
        return;
      }
      const ai = getGenAIClient();
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
      res.json(parsed);
    } catch (err) {
      res.status(500).json({
        error: extractGeminiErrorMessage(err, 'Erro ao gerar roteiro cinematográfico.'),
      });
    }
  });

  app.post('/api/ai/virtual-tour', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const property = req.body?.property as Partial<Property> | undefined;
      if (!property?.title) {
        res.status(400).json({ error: 'Dados do imóvel são obrigatórios.' });
        return;
      }
      const ai = getGenAIClient();
      const imageParts: Array<{ inlineData: { data: string; mimeType: string } } | { text: string }> = [];
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
      res.json(parsed);
    } catch (err) {
      res.status(500).json({
        error: extractGeminiErrorMessage(err, 'Erro ao gerar Visita Virtual.'),
      });
    }
  });

  app.post('/api/ai/generate-description', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const property = req.body?.property as Partial<Property> | undefined;
      if (!property?.title) {
        res.status(400).json({ error: 'Dados do imóvel são obrigatórios.' });
        return;
      }
      const ai = getGenAIClient();
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
      res.json(parsed);
    } catch (err) {
      res.status(500).json({
        error: extractGeminiErrorMessage(err, 'Erro ao gerar descrição comercial.'),
      });
    }
  });

  // =========================================================================
  // Public Virtual Assistant Concierge Route
  // =========================================================================
  app.post('/api/assistant/chat', async (req: Request, res: Response) => {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 500) : '';
    const tenantId = isValidId(req.body?.tenantId) ? req.body.tenantId : DEFAULT_TENANT_ID;
    if (!message) {
      res.status(400).json({ error: 'Digite sua dúvida para continuar.' });
      return;
    }

    const store = getStore();
    const tenant = store.tenants[tenantId] || store.tenants[DEFAULT_TENANT_ID] || DEFAULT_TENANT_CONFIG;
    const assistantName = tenant.assistantName || 'Sofia';

    try {
      const ai = getGenAIClient();
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
      res.json({
        reply:
          response.text?.trim() ||
          `Olá! Aqui é a ${assistantName}, da ${tenant.companyName}. Posso te ajudar com vendas e locações em São Paulo — clique abaixo para falar conosco no Instagram ou WhatsApp.`,
      });
    } catch (err) {
      res.status(503).json({
        error: extractGeminiErrorMessage(err, 'Assistente temporariamente indisponível.'),
      });
    }
  });

  return app;
}
