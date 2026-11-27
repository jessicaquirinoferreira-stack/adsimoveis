import { useCallback, useEffect, useState } from 'react';
import type {
  Development,
  LandingPage,
  Property,
  PropertyFilters,
  TenantConfig,
} from './types/realEstate';
import {
  DEFAULT_DEVELOPMENTS,
  DEFAULT_LANDING_PAGES,
  DEFAULT_PROPERTIES,
  DEFAULT_TENANT_CONFIG,
  DEFAULT_TENANT_ID,
} from './data/defaults';
import { apiGetPublicBootstrap } from './lib/storeClient';
import { fetchPublicFirestoreData } from './lib/firebase';
import { SiteHeader } from './components/SiteHeader';
import { SiteFooter } from './components/SiteFooter';
import { ScrollProgressLine } from './components/ModernEffects';
import { SocialFloatingDock } from './components/SocialFloatingDock';
import { VirtualAssistantWidget } from './components/VirtualAssistantWidget';
import { CinematicIntro } from './components/CinematicIntro';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { PropertyDetailPage } from './pages/PropertyDetailPage';
import {
  AboutPage,
  DevelopmentsPage,
  DynamicLandingPage,
  PrivacyLgpdPage,
} from './pages/PublicSubPages';
import { AdminPage } from './pages/AdminPage';

const INITIAL_FILTERS: PropertyFilters = {
  query: '',
  transactionType: 'todos',
  propertyType: 'todos',
  neighborhood: '',
  furnishedOnly: false,
  fullLeisureOnly: false,
  parkingFilter: 'todos',
  minBedrooms: 0,
  minArea: 0,
  maxPrice: 0,
  sortBy: 'featured',
};

function applyThemeTokens(tenant: TenantConfig) {
  const root = document.documentElement;
  const t = tenant.themeTokens;
  root.style.setProperty('--canvas-bg', t.canvasBg);
  root.style.setProperty('--surface-bg', t.surfaceBg);
  root.style.setProperty('--ink-primary', t.inkPrimary);
  root.style.setProperty('--ink-muted', t.inkMuted);
  root.style.setProperty('--accent-color', t.accentColor);
  root.style.setProperty('--accent-text', t.accentText);
  root.style.setProperty('--border-color', t.borderColor);
  root.style.setProperty('--display-font', t.displayFont);
  root.style.setProperty('--body-font', t.bodyFont);

  const radiusMap = {
    sharp: { card: '0.25rem', btn: '0.25rem' },
    refined: { card: '0.75rem', btn: '0.5rem' },
    soft: { card: '1.25rem', btn: '0.75rem' },
  };
  const r = radiusMap[t.borderRadius || 'refined'];
  root.style.setProperty('--radius-card', r.card);
  root.style.setProperty('--radius-btn', r.btn);

  const shadowMap = {
    flat: 'none',
    subtle: '0 1px 3px rgba(15, 23, 42, 0.05)',
    elevated: '0 12px 28px -12px rgba(15, 23, 42, 0.14)',
  };
  root.style.setProperty('--card-shadow', shadowMap[t.cardElevation || 'subtle']);

  if (tenant.seoTitle) {
    document.title = tenant.seoTitle;
  }
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && tenant.seoDescription) {
    metaDesc.setAttribute('content', tenant.seoDescription);
  }
  if (tenant.faviconUrl) {
    let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = tenant.faviconUrl;
  }
}

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(
    () => window.location.pathname || '/'
  );
  const [activeTenantId, setActiveTenantId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tenant') || DEFAULT_TENANT_ID;
  });

  const [tenant, setTenant] = useState<TenantConfig>(DEFAULT_TENANT_CONFIG);
  const [properties, setProperties] = useState<Property[]>(DEFAULT_PROPERTIES);
  const [developments, setDevelopments] = useState<Development[]>(DEFAULT_DEVELOPMENTS);
  const [landingPages, setLandingPages] = useState<LandingPage[]>(DEFAULT_LANDING_PAGES);
  const [filters, setFilters] = useState<PropertyFilters>(INITIAL_FILTERS);
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    const path = window.location.pathname || '/';
    return !path.startsWith('/admin');
  });

  const refreshPublicData = useCallback(
    async (tid = activeTenantId) => {
      try {
        const [serverData, fsData] = await Promise.all([
          apiGetPublicBootstrap(tid),
          fetchPublicFirestoreData(tid),
        ]);
        const nextTenant = fsData.tenant || serverData.tenant || DEFAULT_TENANT_CONFIG;
        setTenant(nextTenant);
        applyThemeTokens(nextTenant);

        // Merge Firestore published entries over server defaults if present
        if (fsData.properties.length > 0) {
          const map = new Map<string, Property>();
          for (const p of serverData.properties) map.set(p.id, p);
          for (const p of fsData.properties) map.set(p.id, p);
          setProperties(Array.from(map.values()));
        } else {
          setProperties(serverData.properties);
        }

        setDevelopments(
          fsData.developments.length > 0 ? fsData.developments : serverData.developments
        );
        setLandingPages(
          fsData.landingPages.length > 0 ? fsData.landingPages : serverData.landingPages
        );
      } catch {
        applyThemeTokens(DEFAULT_TENANT_CONFIG);
      }
    },
    [activeTenantId]
  );

  useEffect(() => {
    void refreshPublicData(activeTenantId);
  }, [activeTenantId, refreshPublicData]);

  useEffect(() => {
    const handlePop = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const navigate = (path: string) => {
    if (path === currentPath) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  if (currentPath.startsWith('/admin')) {
    return (
      <AdminPage
        activeTenantId={activeTenantId}
        onExitAdmin={() => navigate('/')}
        onDataChanged={refreshPublicData}
        onSwitchTenant={(tid) => setActiveTenantId(tid)}
      />
    );
  }

  const renderPage = () => {
    if (currentPath.startsWith('/imovel/')) {
      const slug = currentPath.replace('/imovel/', '').split('?')[0];
      const prop = properties.find((p) => p.slug === slug || p.id === slug);
      return (
        <PropertyDetailPage
          tenant={tenant}
          property={prop}
          onBack={() => navigate('/imoveis')}
        />
      );
    }

    if (currentPath.startsWith('/lp/')) {
      const slug = currentPath.replace('/lp/', '').split('?')[0];
      const lp = landingPages.find((l) => l.slug === slug || l.id === slug);
      return (
        <DynamicLandingPage
          tenant={tenant}
          landingPage={lp}
          properties={properties}
          onSelectProperty={(propSlug) => navigate(`/imovel/${propSlug}`)}
        />
      );
    }

    if (currentPath.startsWith('/imoveis')) {
      return (
        <CatalogPage
          tenant={tenant}
          properties={properties}
          filters={filters}
          onChangeFilters={setFilters}
          onResetFilters={() => setFilters(INITIAL_FILTERS)}
          onSelectProperty={(slug) => navigate(`/imovel/${slug}`)}
        />
      );
    }

    if (currentPath.startsWith('/empreendimentos')) {
      return (
        <DevelopmentsPage
          tenant={tenant}
          developments={developments}
          onNavigate={navigate}
        />
      );
    }

    if (currentPath.startsWith('/sobre')) {
      return <AboutPage tenant={tenant} onNavigate={navigate} />;
    }

    if (currentPath.startsWith('/privacidade')) {
      return <PrivacyLgpdPage tenant={tenant} />;
    }

    return (
      <HomePage
        tenant={tenant}
        properties={properties}
        landingPages={landingPages}
        onNavigate={navigate}
        onQuickSearch={(partial) =>
          setFilters({ ...INITIAL_FILTERS, ...partial })
        }
      />
    );
  };

  const scrollToContactSection = () => {
    if (currentPath !== '/') {
      navigate('/');
      window.setTimeout(() => {
        document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } else {
      document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--canvas-bg)] text-[var(--ink-primary)]">
      {showIntro && (
        <CinematicIntro
          tenant={tenant}
          onComplete={() => setShowIntro(false)}
        />
      )}
      <ScrollProgressLine />
      <SiteHeader
        tenant={tenant}
        currentPath={currentPath}
        onNavigate={navigate}
      />
      <main className="flex-1">{renderPage()}</main>
      <SiteFooter
        tenant={tenant}
        landingPages={landingPages}
        onNavigate={navigate}
        onReplayIntro={() => setShowIntro(true)}
      />
      <VirtualAssistantWidget
        tenant={tenant}
        onNavigate={navigate}
        onFallbackContact={scrollToContactSection}
      />
      <SocialFloatingDock
        tenant={tenant}
        onFallbackContact={scrollToContactSection}
      />
    </div>
  );
}
