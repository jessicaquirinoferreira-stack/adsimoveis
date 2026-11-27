import { ArrowRight, MapPin } from 'lucide-react';
import type { Development, LandingPage, Property, TenantConfig } from '../types/realEstate';
import { HERO_FALLBACK_IMAGE, REGION_AVENUE_IMAGE } from '../data/defaults';
import { SafeImage } from '../components/SafeImage';
import { BrandLogo } from '../components/BrandLogo';
import { PropertyCard } from '../components/PropertyCard';
import { LeadForm } from '../components/LeadForm';

export function DevelopmentsPage({
  tenant,
  developments,
  onNavigate,
}: {
  tenant: TenantConfig;
  developments: Development[];
  onNavigate: (path: string) => void;
}) {
  const published = developments.filter((d) => d.published);
  const stageLabel: Record<Development['stage'], string> = {
    lancamento: 'Lançamento',
    em_obras: 'Em construção',
    pronto: 'Pronto para morar',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-10">
      <div className="border-b border-[var(--border-color)] pb-6 space-y-2">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">
          {tenant.companyName} · {tenant.city}
        </p>
        <h1 className="font-display text-4xl font-semibold">Empreendimentos</h1>
        <p className="text-sm text-[var(--ink-muted)] max-w-2xl">
          Seleção de empreendimentos residenciais e comerciais acompanhados pela corretora em
          São Paulo.
        </p>
      </div>

      {published.length === 0 ? (
        <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-[var(--radius-card)] p-12 text-center space-y-3">
          <h2 className="font-display text-2xl font-semibold">
            Nenhum empreendimento cadastrado no momento
          </h2>
          <p className="text-sm text-[var(--ink-muted)]">
            Explore nosso catálogo geral de vendas e locações ou fale diretamente com a
            corretora.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/imoveis')}
            className="px-5 py-2.5 text-xs font-medium rounded-lg bg-[var(--accent-color)] text-[var(--accent-text)]"
          >
            Ir para o catálogo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {published.map((dev) => (
            <article
              key={dev.id}
              className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-[var(--radius-card)] overflow-hidden"
            >
              <div className="aspect-[16/9] overflow-hidden bg-neutral-100">
                <SafeImage
                  src={dev.coverImage || HERO_FALLBACK_IMAGE}
                  alt={dev.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <p className="text-xs text-[var(--ink-muted)]">
                    {stageLabel[dev.stage]} · {dev.neighborhood}, {dev.city}
                  </p>
                  <h2 className="font-display text-2xl font-semibold">{dev.name}</h2>
                </div>
                <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
                  {dev.summary}
                </p>
                {dev.amenities.length > 0 && (
                  <p className="text-xs text-[var(--ink-muted)] pt-3 border-t border-[var(--border-color)]">
                    Infraestrutura: {dev.amenities.join(' · ')}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function AboutPage({
  tenant,
  onNavigate,
}: {
  tenant: TenantConfig;
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-14">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
        <div className="lg:col-span-6 space-y-5 flex flex-col justify-center">
          <BrandLogo
            src={tenant.logoUrl}
            alt={tenant.companyName}
            className="h-40 sm:h-48 w-auto self-start"
          />
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">
            {tenant.slogan} · CRECI {tenant.creci}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-balance leading-tight">
            {tenant.aboutTitle}
          </h1>
          <p className="text-sm sm:text-base text-[var(--ink-muted)] leading-relaxed whitespace-pre-line">
            {tenant.aboutText}
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/imoveis')}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-[var(--accent-color)] text-[var(--accent-text)]"
            >
              Ver imóveis disponíveis
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="lg:col-span-6 relative min-h-[340px] rounded-[var(--radius-card)] overflow-hidden border border-[var(--border-color)]">
          <SafeImage
            src={REGION_AVENUE_IMAGE}
            alt="Regiões atendidas em São Paulo"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-[var(--radius-card)] p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <p className="text-xs text-[var(--ink-muted)]">Registro Profissional</p>
          <p className="font-display text-2xl font-semibold mt-1">
            CRECI {tenant.creci}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--ink-muted)]">Atuação Principal</p>
          <p className="font-display text-2xl font-semibold mt-1">
            Vendas e Locações em {tenant.city}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--ink-muted)]">Regiões de Foco</p>
          <p className="text-sm font-medium mt-1 leading-relaxed">
            {tenant.regions.join(' · ')}
          </p>
        </div>
      </div>
    </div>
  );
}

export function DynamicLandingPage({
  tenant,
  landingPage,
  properties,
  onSelectProperty,
}: {
  tenant: TenantConfig;
  landingPage: LandingPage | undefined;
  properties: Property[];
  onSelectProperty: (slug: string) => void;
}) {
  if (!landingPage) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center space-y-3">
        <h1 className="font-display text-3xl font-semibold">Página não encontrada</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Esta página regional pode estar em atualização no painel administrativo.
        </p>
      </div>
    );
  }

  const matchingProps = properties
    .filter((p) => p.published)
    .filter((p) => {
      if (
        landingPage.targetRegion &&
        !p.neighborhood.toLowerCase().includes(landingPage.targetRegion.toLowerCase()) &&
        !p.regionHighlight.toLowerCase().includes(landingPage.targetRegion.toLowerCase())
      ) {
        return false;
      }
      if (
        landingPage.propertyFilterType &&
        p.propertyType !== landingPage.propertyFilterType
      ) {
        return false;
      }
      return true;
    });

  return (
    <div className="space-y-16 pb-20">
      <section className="relative min-h-[55vh] flex items-end bg-neutral-950 text-white overflow-hidden">
        <img
          src={landingPage.heroImage || HERO_FALLBACK_IMAGE}
          alt={landingPage.title}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: tenant.themeTokens.heroGradient }}
        />
        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-16 space-y-4">
          <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-white/85">
            <MapPin className="w-3.5 h-3.5" />
            {landingPage.targetRegion} · {tenant.city} · CRECI {tenant.creci}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold max-w-3xl text-balance">
            {landingPage.headline}
          </h1>
          <p className="text-sm sm:text-base text-white/90 max-w-2xl leading-relaxed">
            {landingPage.subheadline}
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="max-w-3xl space-y-3">
          <h2 className="font-display text-3xl font-semibold">{landingPage.title}</h2>
          <p className="text-sm sm:text-base text-[var(--ink-muted)] leading-relaxed whitespace-pre-line">
            {landingPage.bodyText}
          </p>
        </div>

        {matchingProps.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matchingProps.map((p) => (
              <PropertyCard key={p.id} property={p} onSelect={onSelectProperty} />
            ))}
          </div>
        )}

        <div className="pt-8">
          <LeadForm
            tenant={tenant}
            sourcePage={`/lp/${landingPage.slug}`}
            heading={landingPage.ctaLabel || 'Receber opções nesta região'}
          />
        </div>
      </section>
    </div>
  );
}

export function PrivacyLgpdPage({ tenant }: { tenant: TenantConfig }) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-6">
      <div className="border-b border-[var(--border-color)] pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">
          Conformidade Legal · Lei nº 13.709/2018
        </p>
        <h1 className="font-display text-4xl font-semibold mt-1">
          Política de Privacidade e LGPD
        </h1>
      </div>

      <div className="space-y-4 text-sm text-[var(--ink-muted)] leading-relaxed">
        <p>
          A {tenant.companyName} (CRECI {tenant.creci}) respeita a privacidade dos
          visitantes e clientes interessados em vendas e locações em {tenant.city}.
        </p>
        <p>
          Os dados informados nos formulários de contato, agendamento de visitas ou
          avaliação de imóveis (nome, telefone/WhatsApp, e-mail e mensagem) são coletados
          mediante consentimento expresso e utilizados exclusivamente para retorno de
          atendimento imobiliário.
        </p>
        <p>
          Não comercializamos ou compartilhamos informações pessoais com terceiros alheios à
          intermediação imobiliária solicitada. Para atualização, confirmação ou exclusão de
          dados cadastrados, entre em contato pelos canais oficiais configurados pela
          corretora.
        </p>
      </div>
    </div>
  );
}
