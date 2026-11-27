import crypto from 'node:crypto';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { DEFAULT_TENANT_CONFIG, DEFAULT_TENANT_ID } from '../src/data/defaults';
import { getStore, saveStore } from './store';
import {
  getMimeType,
  getUploadDir,
  isValidId,
  readJsonBody,
  requireAdminSession,
  resolveRequestRoute,
  sanitizeUrl,
  sendJson,
  sendText,
  signSessionToken,
  verifyAdminPassword,
} from './shared';
import type {
  Development,
  LandingPage,
  Lead,
  Property,
  TenantConfig,
} from '../src/types/realEstate';

export async function handleCoreApiRequest(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<boolean> {
  const { parsedUrl, pathname, method } = resolveRequestRoute(req);

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

  return false;
}
