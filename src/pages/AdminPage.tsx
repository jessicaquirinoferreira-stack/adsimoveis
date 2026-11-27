import { useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Download,
  ExternalLink,
  FilePlus2,
  Globe,
  LayoutDashboard,
  Lock,
  LogOut,
  Palette,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import type {
  Development,
  LandingPage,
  Lead,
  LeadStatus,
  Property,
  PropertyStatus,
  PropertyType,
  TenantConfig,
  ThemePresetId,
  TransactionType,
} from '../types/realEstate';
import { DEFAULT_TENANT_CONFIG, OFFICIAL_LOGO_URL, THEME_PRESETS } from '../data/defaults';
import {
  apiAdminCreateTenant,
  apiAdminDeleteDevelopment,
  apiAdminDeleteLandingPage,
  apiAdminDeleteLead,
  apiAdminDeleteProperty,
  apiAdminFetchAll,
  apiAdminLogin,
  apiAdminSaveDevelopment,
  apiAdminSaveLandingPage,
  apiAdminSaveProperty,
  apiAdminUpdateLeadStatus,
  apiAdminUpdateTenant,
  apiChangePassword,
  apiUploadMedia,
  getAdminToken,
  setAdminToken,
} from '../lib/storeClient';
import {
  FIREBASE_PROJECT_ID,
  FIRESTORE_DATABASE_ID,
  auth,
  deletePropertyFromFirestore,
  signInWithGoogleFirebase,
  signOutFirebase,
  syncPropertyToFirestore,
  syncTenantToFirestore,
  tryFirebaseEmailSignIn,
} from '../lib/firebase';
import { fileToDataUrl, formatBRL, formatParkingLabel } from '../lib/formatters';
import { AIStudioModule } from '../components/admin/AIStudioModule';
import { BrandLogo } from '../components/BrandLogo';

interface AdminPageProps {
  activeTenantId: string;
  onExitAdmin: () => void;
  onDataChanged: (tenantId?: string) => Promise<void>;
  onSwitchTenant: (tenantId: string) => void;
}

type AdminSection =
  | 'dashboard'
  | 'properties'
  | 'ai'
  | 'developments'
  | 'landing-pages'
  | 'leads'
  | 'config'
  | 'security';

export function AdminPage({
  activeTenantId,
  onExitAdmin,
  onDataChanged,
  onSwitchTenant,
}: AdminPageProps) {
  const [authenticated, setAuthenticated] = useState(Boolean(getAdminToken()));
  const [loginEmail, setLoginEmail] = useState('admin@x.com');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  const [firebaseUserEmail, setFirebaseUserEmail] = useState<string | null>(
    auth.currentUser?.email || null
  );
  const [firebaseNotice, setFirebaseNotice] = useState('');

  const [section, setSection] = useState<AdminSection>('dashboard');
  const [tenant, setTenant] = useState<TenantConfig>(DEFAULT_TENANT_CONFIG);
  const [tenants, setTenants] = useState<TenantConfig[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [toast, setToast] = useState('');
  const [errorToast, setErrorToast] = useState('');

  // Property Editor State
  const [editingProperty, setEditingProperty] = useState<Partial<Property> | null>(null);
  const [featureInput, setFeatureInput] = useState('');

  // Development Editor State
  const [editingDev, setEditingDev] = useState<Partial<Development> | null>(null);

  // Landing Page Editor State
  const [editingLp, setEditingLp] = useState<Partial<LandingPage> | null>(null);

  // New Tenant Modal State
  const [newTenantId, setNewTenantId] = useState('');
  const [newTenantName, setNewTenantName] = useState('');

  // Password Change State
  const [currPass, setCurrPass] = useState('');
  const [newPass, setNewPass] = useState('');

  const notify = (msg: string) => {
    setToast(msg);
    setErrorToast('');
    window.setTimeout(() => setToast(''), 4000);
  };

  const notifyError = (msg: string) => {
    setErrorToast(msg);
    setToast('');
  };

  const loadAdminWorkspace = async (tid = activeTenantId) => {
    const data = await apiAdminFetchAll(tid);
    setTenant(data.tenant);
    setTenants(data.tenants);
    setProperties(data.properties);
    setDevelopments(data.developments);
    setLandingPages(data.landingPages);
    setLeads(data.leads);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginBusy(true);
    setLoginError('');
    try {
      await apiAdminLogin(loginEmail.trim(), loginPassword);
      // Also attempt Firebase Email/Password auth silently if enabled on console
      const fb = await tryFirebaseEmailSignIn(loginEmail.trim(), loginPassword);
      if (fb.ok) {
        setFirebaseUserEmail(auth.currentUser?.email || loginEmail.trim());
        setFirebaseNotice('Sincronização direta com Firebase ativa.');
      } else if (fb.code === 'auth/operation-not-allowed') {
        setFirebaseNotice(
          'Autenticação local do painel ativa. Para gravar diretamente no Firestore sem login Google, ative "E-mail/senha" no Firebase Authentication ou clique em Conectar Google na aba Segurança.'
        );
      }
      await loadAdminWorkspace(activeTenantId);
      setAuthenticated(true);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Falha no login administrativo.');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleGoogleSyncConnect = async () => {
    try {
      const cred = await signInWithGoogleFirebase();
      setFirebaseUserEmail(cred.user.email || 'Conectado');
      await syncTenantToFirestore(tenant);
      for (const p of properties) {
        await syncPropertyToFirestore(p);
      }
      notify('Conta Google conectada e dados sincronizados com o Firestore.');
    } catch (err) {
      notifyError(
        err instanceof Error
          ? err.message
          : 'Não foi possível conectar via Google Firebase.'
      );
    }
  };

  const handleLogout = async () => {
    setAdminToken(null);
    setAuthenticated(false);
    await signOutFirebase().catch(() => {});
    onExitAdmin();
  };

  const handleSaveProperty = async (prop: Partial<Property>) => {
    try {
      const { property: saved } = await apiAdminSaveProperty({
        ...prop,
        tenantId: tenant.tenantId,
      });
      await syncPropertyToFirestore(saved).catch(() => {});
      await loadAdminWorkspace(tenant.tenantId);
      await onDataChanged(tenant.tenantId);
      setEditingProperty(null);
      notify(`Imóvel "${saved.title}" salvo e atualizado.`);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Erro ao salvar imóvel.');
    }
  };

  const handleTogglePublish = async (prop: Property) => {
    await handleSaveProperty({ ...prop, published: !prop.published });
  };

  const handleDeleteProperty = async (id: string) => {
    try {
      await apiAdminDeleteProperty(id);
      await deletePropertyFromFirestore(id).catch(() => {});
      await loadAdminWorkspace(tenant.tenantId);
      await onDataChanged(tenant.tenantId);
      notify('Imóvel removido do catálogo.');
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Erro ao excluir imóvel.');
    }
  };

  const handleUploadFiles = async (
    files: FileList | null,
    onUrls: (urls: string[]) => void
  ) => {
    if (!files || files.length === 0) return;
    try {
      const uploadedUrls: string[] = [];
      for (const file of Array.from(files)) {
        const dataUrl = await fileToDataUrl(file);
        const res = await apiUploadMedia(file.name, dataUrl);
        uploadedUrls.push(res.url);
      }
      onUrls(uploadedUrls);
      notify(`${uploadedUrls.length} arquivo(s) enviado(s) com sucesso.`);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Erro no upload de mídia.');
    }
  };

  const handleSaveTenant = async (next: TenantConfig) => {
    try {
      const { tenant: updated } = await apiAdminUpdateTenant(next);
      setTenant(updated);
      await syncTenantToFirestore(updated).catch(() => {});
      await loadAdminWorkspace(updated.tenantId);
      await onDataChanged(updated.tenantId);
      notify('Configurações da corretora e tema visual salvos.');
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Erro ao salvar configurações.');
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleanId = newTenantId
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-');
      const { tenant: created } = await apiAdminCreateTenant({
        tenantId: cleanId,
        companyName: newTenantName.trim(),
      });
      setNewTenantId('');
      setNewTenantName('');
      onSwitchTenant(created.tenantId);
      await loadAdminWorkspace(created.tenantId);
      await onDataChanged(created.tenantId);
      notify(`Novo tenant "${created.companyName}" criado e ativado.`);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Erro ao criar tenant.');
    }
  };

  const exportLeadsCsv = () => {
    const header = ['Nome', 'Telefone', 'E-mail', 'Finalidade', 'Imóvel', 'Status', 'Data'];
    const rows = leads.map((l) => [
      `"${l.name.replace(/"/g, '""')}"`,
      `"${l.phone}"`,
      `"${l.email}"`,
      l.interestType,
      `"${l.propertyTitle.replace(/"/g, '""')}"`,
      l.status,
      l.createdAt,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${tenant.tenantId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // =========================================================================
  // LOGIN VIEW
  // =========================================================================
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--canvas-bg)]">
        <div className="max-w-md w-full bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-8 space-y-6">
          <div className="space-y-2">
            <button
              type="button"
              onClick={onExitAdmin}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar ao site público
            </button>
            <div className="pt-2">
              <BrandLogo
                src={tenant.logoUrl}
                alt={tenant.companyName}
                className="h-36 w-auto mx-auto"
              />
            </div>
            <p className="text-xs uppercase tracking-widest text-[var(--ink-muted)] pt-1">
              A D S Imóveis · CRECI 226079-F
            </p>
            <h1 className="font-display text-3xl font-semibold">
              Painel Administrativo
            </h1>
            <p className="text-xs text-[var(--ink-muted)]">
              Gerencie imóveis, vendas, locações, temas visuais, landing pages, leads e
              Estúdio de IA.
            </p>
          </div>

          {loginError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium">E-mail administrativo</span>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium">Senha</span>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Digite a senha do painel"
                className="w-full h-10 px-3 text-sm bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
              />
            </label>

            <button
              type="submit"
              disabled={loginBusy}
              className="w-full h-10 text-sm font-medium rounded-lg bg-[var(--accent-color)] text-[var(--accent-text)] hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {loginBusy ? 'Autenticando...' : 'Entrar no painel'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // =========================================================================
  // AUTHENTICATED ADMIN CONSOLE
  // =========================================================================
  const publishedCount = properties.filter((p) => p.published).length;
  const salesCount = properties.filter(
    (p) => p.transactionType === 'venda' || p.transactionType === 'venda_aluguel'
  ).length;
  const rentCount = properties.filter(
    (p) => p.transactionType === 'aluguel' || p.transactionType === 'venda_aluguel'
  ).length;

  const navButtons: { id: AdminSection; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'properties', label: 'Imóveis', icon: Building2 },
    { id: 'ai', label: 'Estúdio de IA', icon: Sparkles },
    { id: 'developments', label: 'Empreendimentos', icon: FilePlus2 },
    { id: 'landing-pages', label: 'Landing Pages', icon: Globe },
    { id: 'leads', label: 'Leads & Contatos', icon: Users },
    { id: 'config', label: 'Corretora & Temas', icon: Palette },
    { id: 'security', label: 'Firebase & Segurança', icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[var(--canvas-bg)] text-[var(--ink-primary)]">
      {/* Sidebar */}
      <aside className="lg:w-64 shrink-0 bg-[var(--surface-bg)] border-b lg:border-b-0 lg:border-r border-[var(--border-color)] p-4 flex flex-col justify-between gap-6">
        <div className="space-y-6">
          <div className="px-2 pt-2 space-y-2">
            <BrandLogo
              src={tenant.logoUrl}
              alt={tenant.companyName}
              className="h-20 w-auto"
            />
            <p className="font-display text-lg font-semibold leading-tight">A D S Imóveis</p>
            <p className="text-xs text-[var(--ink-muted)] truncate">
              Tenant: {tenant.tenantId}
            </p>
          </div>

          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
            {navButtons.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`inline-flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    section === item.id
                      ? 'bg-[var(--accent-color)] text-[var(--accent-text)]'
                      : 'text-[var(--ink-muted)] hover:bg-[var(--canvas-bg)] hover:text-[var(--ink-primary)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex lg:flex-col gap-2 pt-4 border-t border-[var(--border-color)]">
          <button
            type="button"
            onClick={onExitAdmin}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium border border-[var(--border-color)] rounded-lg hover:bg-[var(--canvas-bg)]"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Ver site público
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-8 space-y-6 overflow-x-hidden">
        {toast && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toast}</span>
          </div>
        )}
        {errorToast && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900">
            {errorToast}
          </div>
        )}

        {/* 1. DASHBOARD */}
        {section === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-4">
              <div>
                <p className="text-xs text-[var(--ink-muted)]">
                  Painel Administrativo · CRECI {tenant.creci}
                </p>
                <h1 className="font-display text-3xl font-semibold">{tenant.companyName}</h1>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSection('properties');
                  setEditingProperty({
                    tenantId: tenant.tenantId,
                    transactionType: 'venda',
                    propertyType: 'apartamento',
                    neighborhood: tenant.regions[0] || 'Ipiranga',
                    city: tenant.city,
                    areaSqm: 65,
                    bedrooms: 2,
                    bathrooms: 1,
                    suites: 0,
                    parkingSpaces: 1,
                    furnished: false,
                    fullLeisure: false,
                    features: [],
                    images: [],
                    published: true,
                    featured: true,
                    status: 'disponivel',
                  });
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-color)] text-[var(--accent-text)]"
              >
                <Plus className="w-4 h-4" />
                Cadastrar novo imóvel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-5">
                <p className="text-xs text-[var(--ink-muted)]">Imóveis publicados</p>
                <p className="font-mono-tabular text-3xl font-semibold mt-1">
                  {publishedCount} / {properties.length}
                </p>
              </div>
              <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-5">
                <p className="text-xs text-[var(--ink-muted)]">Carteira Venda / Locação</p>
                <p className="font-mono-tabular text-3xl font-semibold mt-1">
                  {salesCount} · {rentCount}
                </p>
              </div>
              <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-5">
                <p className="text-xs text-[var(--ink-muted)]">Leads recebidos</p>
                <p className="font-mono-tabular text-3xl font-semibold mt-1">
                  {leads.length}
                </p>
              </div>
              <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-5">
                <p className="text-xs text-[var(--ink-muted)]">Landing Pages ativas</p>
                <p className="font-mono-tabular text-3xl font-semibold mt-1">
                  {landingPages.filter((l) => l.published).length}
                </p>
              </div>
            </div>

            {firebaseNotice && (
              <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold">Status Firebase ({FIREBASE_PROJECT_ID})</p>
                  <p className="text-xs text-[var(--ink-muted)]">{firebaseNotice}</p>
                </div>
                {!firebaseUserEmail && (
                  <button
                    type="button"
                    onClick={handleGoogleSyncConnect}
                    className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border-color)] hover:bg-[var(--canvas-bg)] shrink-0"
                  >
                    Conectar Google Firebase Sync
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. PROPERTIES CRUD */}
        {section === 'properties' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h1 className="font-display text-3xl font-semibold">
                Gerenciar Imóveis ({properties.length})
              </h1>
              <button
                type="button"
                onClick={() =>
                  setEditingProperty({
                    tenantId: tenant.tenantId,
                    transactionType: 'venda',
                    propertyType: 'apartamento',
                    neighborhood: tenant.regions[0] || 'Ipiranga',
                    city: tenant.city,
                    areaSqm: 60,
                    bedrooms: 2,
                    bathrooms: 1,
                    suites: 0,
                    parkingSpaces: 1,
                    furnished: false,
                    fullLeisure: false,
                    features: [],
                    images: [],
                    published: true,
                    featured: false,
                    status: 'disponivel',
                  })
                }
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-color)] text-[var(--accent-text)]"
              >
                <Plus className="w-4 h-4" />
                Novo Imóvel
              </button>
            </div>

            {/* Editor Modal/Card */}
            {editingProperty && (
              <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                  <h2 className="font-display text-2xl font-semibold">
                    {editingProperty.id ? 'Editar Imóvel' : 'Cadastrar Imóvel'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setEditingProperty(null)}
                    className="text-xs text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="md:col-span-2 space-y-1 text-xs">
                    <span className="font-medium">Título do anúncio *</span>
                    <input
                      type="text"
                      value={editingProperty.title || ''}
                      onChange={(e) =>
                        setEditingProperty({ ...editingProperty, title: e.target.value })
                      }
                      className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="font-medium">Finalidade</span>
                    <select
                      value={editingProperty.transactionType || 'venda'}
                      onChange={(e) =>
                        setEditingProperty({
                          ...editingProperty,
                          transactionType: e.target.value as TransactionType,
                        })
                      }
                      className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                    >
                      <option value="venda">Venda</option>
                      <option value="aluguel">Locação</option>
                      <option value="venda_aluguel">Venda e Locação</option>
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="font-medium">Tipo</span>
                    <select
                      value={editingProperty.propertyType || 'apartamento'}
                      onChange={(e) =>
                        setEditingProperty({
                          ...editingProperty,
                          propertyType: e.target.value as PropertyType,
                        })
                      }
                      className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                    >
                      <option value="apartamento">Apartamento</option>
                      <option value="comercial">Loja / Imóvel Comercial</option>
                      <option value="casa">Casa</option>
                      <option value="studio">Studio</option>
                      <option value="terreno">Terreno</option>
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="font-medium">Bairro (São Paulo)</span>
                    <input
                      type="text"
                      value={editingProperty.neighborhood || ''}
                      onChange={(e) =>
                        setEditingProperty({
                          ...editingProperty,
                          neighborhood: e.target.value,
                        })
                      }
                      placeholder="Ex.: Ipiranga, Vila Liviero..."
                      className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                    />
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="font-medium">Ponto de referência</span>
                    <input
                      type="text"
                      value={editingProperty.regionHighlight || ''}
                      onChange={(e) =>
                        setEditingProperty({
                          ...editingProperty,
                          regionHighlight: e.target.value,
                        })
                      }
                      placeholder="Ex.: Próximo ao Metrô Alto do Ipiranga"
                      className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                    />
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="font-medium">Valor Venda (R$)</span>
                    <input
                      type="number"
                      min={0}
                      value={editingProperty.salePrice || 0}
                      onChange={(e) =>
                        setEditingProperty({
                          ...editingProperty,
                          salePrice: Number(e.target.value),
                        })
                      }
                      className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg tabular-nums"
                    />
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="font-medium">Valor Locação (R$/mês)</span>
                    <input
                      type="number"
                      min={0}
                      value={editingProperty.rentPrice || 0}
                      onChange={(e) =>
                        setEditingProperty({
                          ...editingProperty,
                          rentPrice: Number(e.target.value),
                        })
                      }
                      className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg tabular-nums"
                    />
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="font-medium">Condomínio (R$)</span>
                    <input
                      type="number"
                      min={0}
                      value={editingProperty.condoFee || 0}
                      onChange={(e) =>
                        setEditingProperty({
                          ...editingProperty,
                          condoFee: Number(e.target.value),
                        })
                      }
                      className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg tabular-nums"
                    />
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="font-medium">IPTU mensal (R$)</span>
                    <input
                      type="number"
                      min={0}
                      value={editingProperty.iptuFee || 0}
                      onChange={(e) =>
                        setEditingProperty({
                          ...editingProperty,
                          iptuFee: Number(e.target.value),
                        })
                      }
                      className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg tabular-nums"
                    />
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="font-medium">Área útil (m²)</span>
                    <input
                      type="number"
                      min={0}
                      value={editingProperty.areaSqm || 0}
                      onChange={(e) =>
                        setEditingProperty({
                          ...editingProperty,
                          areaSqm: Number(e.target.value),
                        })
                      }
                      className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg tabular-nums"
                    />
                  </label>

                  <div className="grid grid-cols-4 gap-2">
                    <label className="space-y-1 text-xs">
                      <span>Dorms</span>
                      <input
                        type="number"
                        min={0}
                        value={editingProperty.bedrooms || 0}
                        onChange={(e) =>
                          setEditingProperty({
                            ...editingProperty,
                            bedrooms: Number(e.target.value),
                          })
                        }
                        className="w-full h-9 px-2 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg tabular-nums"
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span>Suítes</span>
                      <input
                        type="number"
                        min={0}
                        value={editingProperty.suites || 0}
                        onChange={(e) =>
                          setEditingProperty({
                            ...editingProperty,
                            suites: Number(e.target.value),
                          })
                        }
                        className="w-full h-9 px-2 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg tabular-nums"
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span>Banh.</span>
                      <input
                        type="number"
                        min={0}
                        value={editingProperty.bathrooms || 0}
                        onChange={(e) =>
                          setEditingProperty({
                            ...editingProperty,
                            bathrooms: Number(e.target.value),
                          })
                        }
                        className="w-full h-9 px-2 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg tabular-nums"
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span>Vagas</span>
                      <input
                        type="number"
                        min={0}
                        value={editingProperty.parkingSpaces || 0}
                        onChange={(e) =>
                          setEditingProperty({
                            ...editingProperty,
                            parkingSpaces: Number(e.target.value),
                          })
                        }
                        className="w-full h-9 px-2 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg tabular-nums"
                      />
                    </label>
                  </div>
                </div>

                <label className="block space-y-1 text-xs">
                  <span className="font-medium">Subtítulo</span>
                  <input
                    type="text"
                    value={editingProperty.subtitle || ''}
                    onChange={(e) =>
                      setEditingProperty({ ...editingProperty, subtitle: e.target.value })
                    }
                    className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                  />
                </label>

                <label className="block space-y-1 text-xs">
                  <span className="font-medium">Descrição completa</span>
                  <textarea
                    rows={4}
                    value={editingProperty.description || ''}
                    onChange={(e) =>
                      setEditingProperty({
                        ...editingProperty,
                        description: e.target.value,
                      })
                    }
                    className="w-full p-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                  />
                </label>

                {/* Features & Upload */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 text-xs">
                    <span className="font-medium block">Diferenciais do imóvel</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={featureInput}
                        onChange={(e) => setFeatureInput(e.target.value)}
                        placeholder="Ex.: Varanda gourmet"
                        className="flex-1 h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!featureInput.trim()) return;
                          setEditingProperty({
                            ...editingProperty,
                            features: [
                              ...(editingProperty.features || []),
                              featureInput.trim(),
                            ],
                          });
                          setFeatureInput('');
                        }}
                        className="px-3 h-9 rounded-lg border border-[var(--border-color)]"
                      >
                        Adicionar
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(editingProperty.features || []).map((f, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() =>
                            setEditingProperty({
                              ...editingProperty,
                              features: (editingProperty.features || []).filter(
                                (_x, i) => i !== idx
                              ),
                            })
                          }
                          className="px-2 py-1 rounded bg-[var(--canvas-bg)] border border-[var(--border-color)] text-[11px]"
                        >
                          {f} ×
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <span className="font-medium block">
                      Fotos (Upload automático Vercel Blob / Storage)
                    </span>
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-color)] cursor-pointer hover:bg-[var(--canvas-bg)]">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Enviar imagens do computador</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) =>
                          handleUploadFiles(e.target.files, (urls) =>
                            setEditingProperty({
                              ...editingProperty,
                              images: [...(editingProperty.images || []), ...urls],
                            })
                          )
                        }
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(editingProperty.images || []).map((img, i) => (
                        <div
                          key={i}
                          className="relative w-16 h-12 rounded overflow-hidden border border-[var(--border-color)]"
                        >
                          <img
                            src={img}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setEditingProperty({
                                ...editingProperty,
                                images: (editingProperty.images || []).filter(
                                  (_x, idx) => idx !== i
                                ),
                              })
                            }
                            className="absolute top-0 right-0 bg-black/70 text-white text-[10px] px-1"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-5 pt-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProperty.furnished)}
                      onChange={(e) =>
                        setEditingProperty({
                          ...editingProperty,
                          furnished: e.target.checked,
                        })
                      }
                    />
                    <span>Mobiliado</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProperty.fullLeisure)}
                      onChange={(e) =>
                        setEditingProperty({
                          ...editingProperty,
                          fullLeisure: e.target.checked,
                        })
                      }
                    />
                    <span>Lazer completo</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProperty.featured)}
                      onChange={(e) =>
                        setEditingProperty({
                          ...editingProperty,
                          featured: e.target.checked,
                        })
                      }
                    />
                    <span>Destaque na Home</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingProperty.published !== false}
                      onChange={(e) =>
                        setEditingProperty({
                          ...editingProperty,
                          published: e.target.checked,
                        })
                      }
                    />
                    <span>Publicado automaticamente no site</span>
                  </label>
                  <select
                    value={editingProperty.status || 'disponivel'}
                    onChange={(e) =>
                      setEditingProperty({
                        ...editingProperty,
                        status: e.target.value as PropertyStatus,
                      })
                    }
                    className="h-8 px-2 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded"
                  >
                    <option value="disponivel">Disponível</option>
                    <option value="reservado">Reservado</option>
                    <option value="vendido">Vendido</option>
                    <option value="alugado">Alugado</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border-color)]">
                  <button
                    type="button"
                    onClick={() => setEditingProperty(null)}
                    className="px-4 py-2 text-xs font-medium border border-[var(--border-color)] rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveProperty(editingProperty)}
                    className="px-5 py-2 text-xs font-medium rounded-lg bg-[var(--accent-color)] text-[var(--accent-text)]"
                  >
                    Salvar e publicar
                  </button>
                </div>
              </div>
            )}

            {/* Properties Table */}
            <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--border-color)] bg-[var(--canvas-bg)] text-[var(--ink-muted)]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Imóvel</th>
                    <th className="py-3 px-4 font-medium">Bairro / Tipo</th>
                    <th className="py-3 px-4 font-medium">Valores</th>
                    <th className="py-3 px-4 font-medium">Detalhes</th>
                    <th className="py-3 px-4 font-medium">Publicação</th>
                    <th className="py-3 px-4 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {properties.map((p) => (
                    <tr key={p.id} className="hover:bg-[var(--canvas-bg)]/60">
                      <td className="py-3 px-4 font-medium max-w-[240px] truncate">
                        {p.title}
                      </td>
                      <td className="py-3 px-4 text-[var(--ink-muted)]">
                        {p.neighborhood} · {p.propertyType}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular">
                        {p.salePrice > 0 ? `V: ${formatBRL(p.salePrice)}` : ''}
                        {p.salePrice > 0 && p.rentPrice > 0 ? ' / ' : ''}
                        {p.rentPrice > 0 ? `L: ${formatBRL(p.rentPrice)}` : ''}
                      </td>
                      <td className="py-3 px-4 text-[var(--ink-muted)] tabular-nums">
                        {p.areaSqm}m² · {formatParkingLabel(p.parkingSpaces)}
                        {p.furnished ? ' · Mobiliado' : ''}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(p)}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium ${
                            p.published
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-neutral-200 text-neutral-700'
                          }`}
                        >
                          {p.published ? 'Publicado' : 'Rascunho'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setEditingProperty(p)}
                          className="underline hover:text-[var(--accent-color)]"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProperty(p.id)}
                          aria-label="Excluir imóvel"
                          className="text-red-700 hover:underline"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. AI STUDIO */}
        {section === 'ai' && (
          <AIStudioModule
            properties={properties}
            onSaveProperty={handleSaveProperty}
          />
        )}

        {/* 4. DEVELOPMENTS */}
        {section === 'developments' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="font-display text-3xl font-semibold">Empreendimentos</h1>
              <button
                type="button"
                onClick={() =>
                  setEditingDev({
                    tenantId: tenant.tenantId,
                    neighborhood: 'Ipiranga',
                    city: tenant.city,
                    stage: 'pronto',
                    published: true,
                    amenities: [],
                  })
                }
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-color)] text-[var(--accent-text)]"
              >
                <Plus className="w-4 h-4" />
                Novo Empreendimento
              </button>
            </div>

            {editingDev && (
              <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <label className="space-y-1">
                    <span>Nome *</span>
                    <input
                      type="text"
                      value={editingDev.name || ''}
                      onChange={(e) =>
                        setEditingDev({ ...editingDev, name: e.target.value })
                      }
                      className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                    />
                  </label>
                  <label className="space-y-1">
                    <span>Bairro</span>
                    <input
                      type="text"
                      value={editingDev.neighborhood || ''}
                      onChange={(e) =>
                        setEditingDev({ ...editingDev, neighborhood: e.target.value })
                      }
                      className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                    />
                  </label>
                  <label className="space-y-1">
                    <span>Estágio</span>
                    <select
                      value={editingDev.stage || 'pronto'}
                      onChange={(e) =>
                        setEditingDev({
                          ...editingDev,
                          stage: e.target.value as Development['stage'],
                        })
                      }
                      className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                    >
                      <option value="lancamento">Lançamento</option>
                      <option value="em_obras">Em obras</option>
                      <option value="pronto">Pronto para morar</option>
                    </select>
                  </label>
                </div>
                <textarea
                  rows={3}
                  value={editingDev.summary || ''}
                  onChange={(e) =>
                    setEditingDev({ ...editingDev, summary: e.target.value })
                  }
                  placeholder="Resumo do empreendimento..."
                  className="w-full p-3 text-xs bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                />
                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 px-3 py-2 text-xs border border-[var(--border-color)] rounded-lg cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Capa do empreendimento</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleUploadFiles(e.target.files, (urls) =>
                          setEditingDev({ ...editingDev, coverImage: urls[0] })
                        )
                      }
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingDev(null)}
                      className="px-4 py-2 text-xs border border-[var(--border-color)] rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiAdminSaveDevelopment(editingDev);
                        await loadAdminWorkspace(tenant.tenantId);
                        await onDataChanged(tenant.tenantId);
                        setEditingDev(null);
                        notify('Empreendimento salvo.');
                      }}
                      className="px-4 py-2 text-xs rounded-lg bg-[var(--accent-color)] text-[var(--accent-text)]"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {developments.map((d) => (
                <div
                  key={d.id}
                  className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-5 flex items-start justify-between gap-4"
                >
                  <div>
                    <p className="text-xs text-[var(--ink-muted)]">
                      {d.neighborhood} · {d.stage}
                    </p>
                    <p className="font-display text-xl font-semibold mt-0.5">{d.name}</p>
                    <p className="text-xs text-[var(--ink-muted)] mt-1 line-clamp-2">
                      {d.summary}
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingDev(d)}
                      className="underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiAdminDeleteDevelopment(d.id);
                        await loadAdminWorkspace(tenant.tenantId);
                        await onDataChanged(tenant.tenantId);
                      }}
                      className="text-red-700 underline"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. LANDING PAGES */}
        {section === 'landing-pages' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="font-display text-3xl font-semibold">Landing Pages</h1>
              <button
                type="button"
                onClick={() =>
                  setEditingLp({
                    tenantId: tenant.tenantId,
                    targetRegion: 'Ipiranga',
                    propertyFilterType: 'apartamento',
                    ctaLabel: 'Solicitar opções',
                    published: true,
                  })
                }
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-color)] text-[var(--accent-text)]"
              >
                <Plus className="w-4 h-4" />
                Nova Landing Page
              </button>
            </div>

            {editingLp && (
              <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-6 space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="space-y-1">
                    <span>Título *</span>
                    <input
                      type="text"
                      value={editingLp.title || ''}
                      onChange={(e) =>
                        setEditingLp({ ...editingLp, title: e.target.value })
                      }
                      className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                    />
                  </label>
                  <label className="space-y-1">
                    <span>Região alvo</span>
                    <input
                      type="text"
                      value={editingLp.targetRegion || ''}
                      onChange={(e) =>
                        setEditingLp({ ...editingLp, targetRegion: e.target.value })
                      }
                      className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                    />
                  </label>
                  <label className="md:col-span-2 space-y-1">
                    <span>Manchete principal *</span>
                    <input
                      type="text"
                      value={editingLp.headline || ''}
                      onChange={(e) =>
                        setEditingLp({ ...editingLp, headline: e.target.value })
                      }
                      className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                    />
                  </label>
                </div>
                <textarea
                  rows={3}
                  value={editingLp.bodyText || ''}
                  onChange={(e) =>
                    setEditingLp({ ...editingLp, bodyText: e.target.value })
                  }
                  placeholder="Conteúdo editorial da página..."
                  className="w-full p-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingLp(null)}
                    className="px-4 py-2 border border-[var(--border-color)] rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiAdminSaveLandingPage(editingLp);
                      await loadAdminWorkspace(tenant.tenantId);
                      await onDataChanged(tenant.tenantId);
                      setEditingLp(null);
                      notify('Landing page salva e publicada.');
                    }}
                    className="px-4 py-2 rounded-lg bg-[var(--accent-color)] text-[var(--accent-text)]"
                  >
                    Publicar página
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {landingPages.map((lp) => (
                <div
                  key={lp.id}
                  className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-display text-xl font-semibold">{lp.title}</p>
                    <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                      /lp/{lp.slug} · Região: {lp.targetRegion}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setEditingLp(lp)}
                      className="underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiAdminDeleteLandingPage(lp.id);
                        await loadAdminWorkspace(tenant.tenantId);
                        await onDataChanged(tenant.tenantId);
                      }}
                      className="text-red-700 underline"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. LEADS */}
        {section === 'leads' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="font-display text-3xl font-semibold">
                Gestão de Leads ({leads.length})
              </h1>
              <button
                type="button"
                onClick={exportLeadsCsv}
                disabled={leads.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium border border-[var(--border-color)] rounded-lg disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar CSV
              </button>
            </div>

            {leads.length === 0 ? (
              <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-12 text-center text-sm text-[var(--ink-muted)]">
                Nenhum lead recebido ainda. Todos os contatos enviados pelos formulários do
                site aparecem aqui automaticamente.
              </div>
            ) : (
              <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--border-color)] bg-[var(--canvas-bg)] text-[var(--ink-muted)]">
                    <tr>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Contato</th>
                      <th className="py-3 px-4">Interesse / Imóvel</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {leads.map((l) => (
                      <tr key={l.id}>
                        <td className="py-3 px-4 font-medium">{l.name}</td>
                        <td className="py-3 px-4">
                          <div>{l.phone}</div>
                          {l.email && (
                            <div className="text-[var(--ink-muted)]">{l.email}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 max-w-[260px]">
                          <div className="font-medium">
                            {l.propertyTitle || l.interestType}
                          </div>
                          {l.message && (
                            <div className="text-[var(--ink-muted)] truncate">
                              {l.message}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={l.status}
                            onChange={async (e) => {
                              await apiAdminUpdateLeadStatus(
                                l.id,
                                e.target.value as LeadStatus
                              );
                              await loadAdminWorkspace(tenant.tenantId);
                            }}
                            className="h-8 px-2 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded"
                          >
                            <option value="novo">Novo</option>
                            <option value="em_atendimento">Em atendimento</option>
                            <option value="agendado">Visita agendada</option>
                            <option value="convertido">Convertido</option>
                            <option value="arquivado">Arquivado</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              await apiAdminDeleteLead(l.id);
                              await loadAdminWorkspace(tenant.tenantId);
                            }}
                            className="text-red-700 hover:underline inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 7. CONFIG, MULTI-TENANT & THEMES */}
        {section === 'config' && (
          <div className="space-y-8">
            <h1 className="font-display text-3xl font-semibold">
              Identidade, Multi-Tenant e Sistema de Temas
            </h1>

            {/* Multi-tenant switcher + creation */}
            <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-6 space-y-4">
              <h2 className="font-display text-xl font-semibold">
                Arquitetura Multi-Tenant (Isolamento por Corretora)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end text-xs">
                <label className="space-y-1">
                  <span className="font-medium">Tenant ativo em edição</span>
                  <select
                    value={tenant.tenantId}
                    onChange={async (e) => {
                      onSwitchTenant(e.target.value);
                      await loadAdminWorkspace(e.target.value);
                    }}
                    className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                  >
                    {tenants.map((t) => (
                      <option key={t.tenantId} value={t.tenantId}>
                        {t.companyName} ({t.tenantId})
                      </option>
                    ))}
                  </select>
                </label>

                <form onSubmit={handleCreateTenant} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="novo-slug"
                    value={newTenantId}
                    onChange={(e) => setNewTenantId(e.target.value)}
                    className="w-36 h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Nome da nova corretora"
                    value={newTenantName}
                    onChange={(e) => setNewTenantName(e.target.value)}
                    className="flex-1 h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                  />
                  <button
                    type="submit"
                    className="px-4 h-9 rounded-lg border border-[var(--border-color)] font-medium hover:bg-[var(--canvas-bg)]"
                  >
                    Criar Tenant
                  </button>
                </form>
              </div>
            </div>

            {/* Institutional & Contact Fields */}
            <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-6 space-y-5 text-xs">
              <h2 className="font-display text-xl font-semibold">
                Dados Oficiais & Canais de Contato (Configuráveis)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="space-y-1">
                  <span className="font-medium">Nome Comercial</span>
                  <input
                    type="text"
                    value={tenant.companyName}
                    onChange={(e) =>
                      setTenant({ ...tenant, companyName: e.target.value })
                    }
                    className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                  />
                </label>
                <label className="space-y-1">
                  <span className="font-medium">Slogan / Posicionamento</span>
                  <input
                    type="text"
                    value={tenant.slogan}
                    onChange={(e) => setTenant({ ...tenant, slogan: e.target.value })}
                    className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                  />
                </label>
                <label className="space-y-1">
                  <span className="font-medium">CRECI</span>
                  <input
                    type="text"
                    value={tenant.creci}
                    onChange={(e) => setTenant({ ...tenant, creci: e.target.value })}
                    className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                  />
                </label>
                <label className="space-y-1">
                  <span className="font-medium">WhatsApp (somente números com DDD)</span>
                  <input
                    type="text"
                    value={tenant.whatsapp}
                    onChange={(e) => setTenant({ ...tenant, whatsapp: e.target.value })}
                    placeholder="Ex.: 11999999999"
                    className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                  />
                </label>
                <label className="space-y-1">
                  <span className="font-medium">Telefone Comercial</span>
                  <input
                    type="text"
                    value={tenant.phone}
                    onChange={(e) => setTenant({ ...tenant, phone: e.target.value })}
                    className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                  />
                </label>
                <label className="space-y-1">
                  <span className="font-medium">E-mail de Atendimento</span>
                  <input
                    type="email"
                    value={tenant.email}
                    onChange={(e) => setTenant({ ...tenant, email: e.target.value })}
                    className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                  />
                </label>
                <label className="md:col-span-2 space-y-1">
                  <span className="font-medium">Endereço Físico</span>
                  <input
                    type="text"
                    value={tenant.address}
                    onChange={(e) => setTenant({ ...tenant, address: e.target.value })}
                    className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                  />
                </label>
                <label className="space-y-1">
                  <span className="font-medium">Domínio personalizado</span>
                  <input
                    type="text"
                    value={tenant.domain}
                    onChange={(e) => setTenant({ ...tenant, domain: e.target.value })}
                    placeholder="www.adsimoveis.com.br"
                    className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                  />
                </label>
                <label className="md:col-span-3 space-y-1">
                  <span className="font-medium">Regiões de Atuação (separadas por vírgula)</span>
                  <input
                    type="text"
                    value={tenant.regions.join(', ')}
                    onChange={(e) =>
                      setTenant({
                        ...tenant,
                        regions: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                  />
                </label>
                <label className="md:col-span-3 space-y-1">
                  <span className="font-medium">Manchete Principal (Hero)</span>
                  <input
                    type="text"
                    value={tenant.heroHeadline}
                    onChange={(e) =>
                      setTenant({ ...tenant, heroHeadline: e.target.value })
                    }
                    className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                  />
                </label>
                <label className="md:col-span-3 space-y-1">
                  <span className="font-medium">Texto Institucional (Sobre)</span>
                  <textarea
                    rows={3}
                    value={tenant.aboutText}
                    onChange={(e) => setTenant({ ...tenant, aboutText: e.target.value })}
                    className="w-full p-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-[var(--border-color)]">
                <label className="space-y-1">
                  <span className="font-medium">Nome da Assistente Virtual</span>
                  <input
                    type="text"
                    value={tenant.assistantName || 'Sofia'}
                    onChange={(e) =>
                      setTenant({ ...tenant, assistantName: e.target.value })
                    }
                    className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                  />
                </label>
                <label className="space-y-1">
                  <span className="font-medium">Cargo da Assistente</span>
                  <input
                    type="text"
                    value={tenant.assistantRole || 'Assistente Virtual'}
                    onChange={(e) =>
                      setTenant({ ...tenant, assistantRole: e.target.value })
                    }
                    className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                  />
                </label>
                <label className="space-y-1">
                  <span className="font-medium">Instagram Oficial (URL)</span>
                  <input
                    type="url"
                    value={tenant.instagramUrl}
                    onChange={(e) =>
                      setTenant({ ...tenant, instagramUrl: e.target.value })
                    }
                    className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                  />
                </label>
              </div>

              <div className="pt-3 border-t border-[var(--border-color)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                  <BrandLogo
                    src={tenant.logoUrl}
                    alt={tenant.companyName}
                    className="h-28 w-auto shrink-0"
                  />
                  <div className="flex-1 space-y-2">
                    <label className="space-y-1 block">
                      <span className="font-medium">URL da Logo (PNG Transparente)</span>
                      <input
                        type="url"
                        value={tenant.logoUrl}
                        onChange={(e) =>
                          setTenant({ ...tenant, logoUrl: e.target.value })
                        }
                        placeholder={OFFICIAL_LOGO_URL}
                        className="w-full h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setTenant({
                          ...tenant,
                          logoUrl: OFFICIAL_LOGO_URL,
                          faviconUrl: OFFICIAL_LOGO_URL,
                        })
                      }
                      className="text-[11px] underline text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
                    >
                      Restaurar logo oficial roxo metálico
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2 px-3 py-2 border border-[var(--border-color)] rounded-lg cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Enviar Logotipo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleUploadFiles(e.target.files, (urls) =>
                          setTenant({ ...tenant, logoUrl: urls[0] })
                        )
                      }
                    />
                  </label>
                  <label className="inline-flex items-center gap-2 px-3 py-2 border border-[var(--border-color)] rounded-lg cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Enviar Favicon</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleUploadFiles(e.target.files, (urls) =>
                          setTenant({ ...tenant, faviconUrl: urls[0] })
                        )
                      }
                    />
                  </label>
                  <label className="inline-flex items-center gap-2 px-3 py-2 border border-[var(--border-color)] rounded-lg cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Foto da Assistente Virtual</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleUploadFiles(e.target.files, (urls) =>
                          setTenant({ ...tenant, assistantAvatarUrl: urls[0] })
                        )
                      }
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Theme Presets & Color Customizer */}
            <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-6 space-y-5 text-xs">
              <h2 className="font-display text-xl font-semibold">
                Sistema de Temas & Tokens Visuais
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(Object.keys(THEME_PRESETS) as ThemePresetId[]).map((presetKey) => {
                  const preset = THEME_PRESETS[presetKey];
                  const active = tenant.themePreset === presetKey;
                  return (
                    <button
                      key={presetKey}
                      type="button"
                      onClick={() =>
                        setTenant({
                          ...tenant,
                          themePreset: presetKey,
                          themeTokens: { ...preset.tokens },
                        })
                      }
                      className={`text-left p-4 rounded-xl border transition-all space-y-2 ${
                        active
                          ? 'border-[var(--accent-color)] ring-1 ring-[var(--accent-color)]'
                          : 'border-[var(--border-color)]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-4 h-4 rounded-full border border-black/10"
                          style={{ background: preset.tokens.canvasBg }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-black/10"
                          style={{ background: preset.tokens.accentColor }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-black/10"
                          style={{ background: preset.tokens.inkPrimary }}
                        />
                      </div>
                      <p className="font-semibold text-sm">{preset.name}</p>
                      <p className="text-[var(--ink-muted)]">{preset.description}</p>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-[var(--border-color)]">
                <label className="space-y-1">
                  <span>Fundo Canvas</span>
                  <input
                    type="color"
                    value={tenant.themeTokens.canvasBg}
                    onChange={(e) =>
                      setTenant({
                        ...tenant,
                        themeTokens: { ...tenant.themeTokens, canvasBg: e.target.value },
                      })
                    }
                    className="w-full h-9 rounded cursor-pointer"
                  />
                </label>
                <label className="space-y-1">
                  <span>Superfície Cards</span>
                  <input
                    type="color"
                    value={tenant.themeTokens.surfaceBg}
                    onChange={(e) =>
                      setTenant({
                        ...tenant,
                        themeTokens: { ...tenant.themeTokens, surfaceBg: e.target.value },
                      })
                    }
                    className="w-full h-9 rounded cursor-pointer"
                  />
                </label>
                <label className="space-y-1">
                  <span>Cor de Destaque (CTA)</span>
                  <input
                    type="color"
                    value={tenant.themeTokens.accentColor}
                    onChange={(e) =>
                      setTenant({
                        ...tenant,
                        themeTokens: { ...tenant.themeTokens, accentColor: e.target.value },
                      })
                    }
                    className="w-full h-9 rounded cursor-pointer"
                  />
                </label>
                <label className="space-y-1">
                  <span>Arredondamento</span>
                  <select
                    value={tenant.themeTokens.borderRadius}
                    onChange={(e) =>
                      setTenant({
                        ...tenant,
                        themeTokens: {
                          ...tenant.themeTokens,
                          borderRadius: e.target.value as 'sharp' | 'refined' | 'soft',
                        },
                      })
                    }
                    className="w-full h-9 px-2 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                  >
                    <option value="sharp">Reto Editorial</option>
                    <option value="refined">Refinado</option>
                    <option value="soft">Suave</option>
                  </select>
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => handleSaveTenant(tenant)}
                  className="px-6 py-2.5 text-xs font-medium rounded-lg bg-[var(--accent-color)] text-[var(--accent-text)]"
                >
                  Salvar alterações e aplicar tema no site
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 8. SECURITY & FIREBASE */}
        {section === 'security' && (
          <div className="space-y-6 max-w-3xl">
            <h1 className="font-display text-3xl font-semibold">
              Firebase, Segurança & Deploy Vercel
            </h1>

            <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-6 space-y-4 text-xs">
              <h2 className="font-display text-xl font-semibold">
                Projeto Firebase Dedicado (Auto-configurado)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-lg bg-[var(--canvas-bg)] border border-[var(--border-color)]">
                <div>
                  <span className="text-[var(--ink-muted)] block">Project ID</span>
                  <span className="font-mono-tabular font-semibold">{FIREBASE_PROJECT_ID}</span>
                </div>
                <div>
                  <span className="text-[var(--ink-muted)] block">Firestore Database ID</span>
                  <span className="font-mono-tabular font-semibold">{FIRESTORE_DATABASE_ID}</span>
                </div>
              </div>
              <p className="text-[var(--ink-muted)] leading-relaxed">
                Status da sessão Firebase:{' '}
                <strong>
                  {firebaseUserEmail
                    ? `Conectado (${firebaseUserEmail})`
                    : 'Sessão administrativa via servidor ativa'}
                </strong>
                . Para sincronizar diretamente pelo Firebase Authentication com Google ou
                habilitar e-mail/senha no console do projeto, utilize o botão abaixo.
              </p>
              <button
                type="button"
                onClick={handleGoogleSyncConnect}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-color)] text-[var(--accent-text)]"
              >
                Conectar / Sincronizar com Google Firebase
              </button>
            </div>

            <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-6 space-y-4 text-xs">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[var(--accent-color)]" />
                <h2 className="font-display text-xl font-semibold">
                  Alterar Senha Administrativa
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="password"
                  placeholder="Senha atual"
                  value={currPass}
                  onChange={(e) => setCurrPass(e.target.value)}
                  className="h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                />
                <input
                  type="password"
                  placeholder="Nova senha (mín. 6 caracteres)"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  className="h-9 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
                />
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await apiChangePassword(currPass, newPass);
                    setCurrPass('');
                    setNewPass('');
                    notify('Senha administrativa atualizada com sucesso.');
                  } catch (err) {
                    notifyError(
                      err instanceof Error ? err.message : 'Erro ao alterar senha.'
                    );
                  }
                }}
                className="px-4 py-2 rounded-lg border border-[var(--border-color)] font-medium hover:bg-[var(--canvas-bg)]"
              >
                Atualizar senha
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
