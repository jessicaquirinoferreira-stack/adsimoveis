import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, ArrowUpRight, Calculator, MapPin, Search } from 'lucide-react';
import type {
  LandingPage,
  Property,
  PropertyFilters,
  TenantConfig,
} from '../types/realEstate';
import {
  EDITORIAL_TERRACE_IMAGE,
  HERO_FALLBACK_IMAGE,
  REGION_AVENUE_IMAGE,
} from '../data/defaults';
import { formatBRL } from '../lib/formatters';
import { PropertyCard } from '../components/PropertyCard';
import { LeadForm } from '../components/LeadForm';
import { SafeImage } from '../components/SafeImage';
import { BrandLogo } from '../components/BrandLogo';
import { EditorialMarquee, SpotlightCard } from '../components/ModernEffects';

gsap.registerPlugin(ScrollTrigger);

interface HomePageProps {
  tenant: TenantConfig;
  properties: Property[];
  landingPages: LandingPage[];
  onNavigate: (path: string) => void;
  onQuickSearch: (partial: Partial<PropertyFilters>) => void;
}

export function HomePage({
  tenant,
  properties,
  landingPages,
  onNavigate,
  onQuickSearch,
}: HomePageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [txType, setTxType] = useState<'todos' | 'venda' | 'aluguel'>('todos');
  const [propType, setPropType] = useState<'todos' | 'apartamento' | 'comercial'>('todos');
  const [region, setRegion] = useState('');
  const [furnishedOnly, setFurnishedOnly] = useState(false);

  // Interactive Financial Planner State
  const [simMode, setSimMode] = useState<'compra' | 'locacao'>('compra');
  const [simValue, setSimValue] = useState(680000);
  const [simDownPct, setSimDownPct] = useState(25);
  const [simYears, setSimYears] = useState(30);
  const [simRent, setSimRent] = useState(3800);
  const [simCondo, setSimCondo] = useState(720);
  const [simIptu, setSimIptu] = useState(160);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || !containerRef.current) return;

    const ctx = gsap.context(() => {
      gsap.from('.hero-animate', {
        y: 26,
        opacity: 0,
        duration: 0.9,
        stagger: 0.1,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      });

      gsap.to('.hero-bg-image', {
        yPercent: 12,
        scale: 1.08,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero-section',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });

      gsap.utils.toArray<HTMLElement>('.reveal-section').forEach((section) => {
        gsap.from(section, {
          y: 28,
          opacity: 0,
          duration: 0.75,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
          scrollTrigger: {
            trigger: section,
            start: 'top 86%',
            once: true,
          },
        });
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const featuredProperties = properties
    .filter((p) => p.published)
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .slice(0, 6);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onQuickSearch({
      transactionType: txType,
      propertyType: propType,
      neighborhood: region,
      furnishedOnly,
    });
    onNavigate('/imoveis');
  };

  // Price Simulation Calculation
  const financedAmount = simValue * (1 - simDownPct / 100);
  const monthlyRate = 0.0085; // ~10.7% a.a. reference
  const totalMonths = simYears * 12;
  const estimatedInstallment =
    totalMonths > 0
      ? (financedAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -totalMonths))
      : 0;
  const totalMonthlyRental = simRent + simCondo + simIptu;

  const regionDescriptions: Record<string, string> = {
    Ipiranga:
      'Tradição residencial, parques históricos, comércio consolidado e mobilidade sobre trilhos.',
    'Vila Liviero':
      'Custo-benefício estratégico na Zona Sul com forte vocação residencial e comercial.',
    'Jardim São Savério':
      'Ruas tranquilas e arborizadas com condomínios de lazer completo para famílias.',
    'Alto do Ipiranga':
      'Proximidade imediata à Linha 2-Verde do Metrô com apartamentos modernos e mobiliados.',
    Sacomã:
      'Entroncamento de mobilidade junto ao Terminal Sacomã, ideal para moradia e lojas de rua.',
  };

  return (
    <div ref={containerRef} className="overflow-x-hidden">
      {/* 1. Cinematic Hero Section */}
      <section className="hero-section relative min-h-[82vh] lg:min-h-[88vh] flex flex-col justify-end bg-neutral-950 text-white overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={HERO_FALLBACK_IMAGE}
            alt="Arquitetura residencial em São Paulo — A D S Imóveis"
            referrerPolicy="no-referrer"
            className="hero-bg-image w-full h-full object-cover scale-102"
          />
          <div
            className="absolute inset-0"
            style={{ background: tenant.themeTokens.heroGradient }}
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24 pb-10 space-y-8">
          <div className="max-w-3xl space-y-4">
            <p className="hero-animate text-xs sm:text-sm tracking-[0.18em] uppercase text-white/85 font-medium">
              {tenant.companyName} · {tenant.slogan} · CRECI {tenant.creci}
            </p>
            <h1 className="hero-animate font-display text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.06] tracking-tight text-balance">
              {tenant.heroHeadline}
            </h1>
            <p className="hero-animate text-sm sm:text-base text-white/90 max-w-2xl leading-relaxed">
              {tenant.heroSubheadline}
            </p>
          </div>

          {/* Frosted Glass Quick Property Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="hero-animate bg-[var(--surface-bg)]/95 backdrop-blur-xl text-[var(--ink-primary)] border border-[var(--border-color)] rounded-[var(--radius-card)] p-4 sm:p-5 shadow-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--ink-muted)] block">
                Finalidade
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg">
                {(
                  [
                    { id: 'todos', label: 'Todos' },
                    { id: 'venda', label: 'Venda' },
                    { id: 'aluguel', label: 'Aluguel' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTxType(opt.id)}
                    className={`py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      txType === opt.id
                        ? 'bg-[var(--surface-bg)] text-[var(--ink-primary)] shadow-sm'
                        : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="space-y-1.5 block">
              <span className="text-xs font-medium text-[var(--ink-muted)] block">
                Tipo de imóvel
              </span>
              <select
                value={propType}
                onChange={(e) =>
                  setPropType(e.target.value as 'todos' | 'apartamento' | 'comercial')
                }
                className="w-full h-10 px-3 text-sm bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-[var(--accent-color)]"
              >
                <option value="todos">Apartamentos e Comerciais</option>
                <option value="apartamento">Apartamento Residencial</option>
                <option value="comercial">Loja / Imóvel Comercial</option>
              </select>
            </label>

            <label className="space-y-1.5 block">
              <span className="text-xs font-medium text-[var(--ink-muted)] block">
                Região em São Paulo
              </span>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-[var(--accent-color)]"
              >
                <option value="">Todas as regiões</option>
                {tenant.regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2.5 h-10 px-3 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg cursor-pointer text-xs font-medium text-[var(--ink-primary)]">
              <input
                type="checkbox"
                checked={furnishedOnly}
                onChange={(e) => setFurnishedOnly(e.target.checked)}
                className="accent-[var(--accent-color)]"
              />
              <span>Apenas mobiliados</span>
            </label>

            <button
              type="submit"
              className="h-10 px-5 inline-flex items-center justify-center gap-2 text-sm font-medium rounded-lg bg-[var(--accent-color)] text-[var(--accent-text)] hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <Search className="w-4 h-4" />
              Buscar oportunidades
            </button>
          </form>
        </div>
      </section>

      {/* Architectural Marquee Ribbon */}
      <EditorialMarquee
        items={[
          'A D S Imóveis e Intermediações de Negócios',
          `CRECI ${tenant.creci}`,
          'Vendas e Locações em São Paulo',
          ...tenant.regions,
        ]}
      />

      {/* 2. Featured Properties (Sales & Rentals) */}
      <section className="reveal-section max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--border-color)] pb-6">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">
              Seleção em São Paulo · Vendas e Locações
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--ink-primary)] text-balance">
              Imóveis em destaque na capital paulista
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              onQuickSearch({
                transactionType: 'todos',
                propertyType: 'todos',
                neighborhood: '',
                furnishedOnly: false,
              });
              onNavigate('/imoveis');
            }}
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--ink-primary)] hover:text-[var(--accent-color)] transition-colors whitespace-nowrap shrink-0"
          >
            Explorar catálogo completo
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {featuredProperties.length === 0 ? (
          <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-[var(--radius-card)] p-12 text-center space-y-3">
            <p className="font-display text-2xl font-semibold">
              Nenhum imóvel publicado no momento
            </p>
            <p className="text-sm text-[var(--ink-muted)]">
              Acesse o painel administrativo para cadastrar e publicar unidades em São Paulo.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredProperties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                onSelect={(slug) => onNavigate(`/imovel/${slug}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 3. Asymmetric Architectural Bento Showcase */}
      <section className="reveal-section bg-[var(--surface-bg)] border-y border-[var(--border-color)] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">
              Tipologias Trabalhadas · São Paulo
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--ink-primary)] text-balance">
              Explore o portfólio por perfil de imóvel e estilo de moradia
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:auto-rows-[220px]">
            {/* Marquee Bento Tile (2x2) */}
            <button
              type="button"
              onClick={() => {
                onQuickSearch({ fullLeisureOnly: true });
                onNavigate('/imoveis');
              }}
              className="group relative md:col-span-2 lg:row-span-2 min-h-[300px] rounded-2xl overflow-hidden text-left border border-[var(--border-color)]"
            >
              <SafeImage
                src={EDITORIAL_TERRACE_IMAGE}
                alt="Condomínios com lazer completo em São Paulo"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 text-white flex items-end justify-between gap-4">
                <div className="space-y-1.5">
                  <p className="text-xs uppercase tracking-widest text-white/80">
                    Residencial · Venda e Locação
                  </p>
                  <h3 className="font-display text-3xl font-semibold">
                    Condomínios com lazer completo
                  </h3>
                  <p className="text-xs text-white/85 max-w-md">
                    Unidades em condomínios equipados com áreas sociais, piscina, academia e
                    portaria 24h em São Paulo.
                  </p>
                </div>
                <span className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 group-hover:bg-white group-hover:text-neutral-900 transition-colors">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </div>
            </button>

            {/* Tile 2: Apartamentos Mobiliados */}
            <button
              type="button"
              onClick={() => {
                onQuickSearch({ furnishedOnly: true });
                onNavigate('/imoveis');
              }}
              className="group relative min-h-[200px] rounded-2xl overflow-hidden text-left border border-[var(--border-color)]"
            >
              <SafeImage
                src="/src/assets/images/apt_furnished_modern_1795781790675.jpg"
                alt="Apartamentos mobiliados em São Paulo"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-white flex items-end justify-between">
                <div>
                  <p className="text-[11px] text-white/80">Prontos para morar</p>
                  <p className="font-display text-xl font-semibold">
                    Apartamentos Mobiliados
                  </p>
                </div>
                <ArrowUpRight className="w-4 h-4 shrink-0" />
              </div>
            </button>

            {/* Tile 3: Imóveis Comerciais */}
            <button
              type="button"
              onClick={() => {
                onQuickSearch({ propertyType: 'comercial' });
                onNavigate('/imoveis');
              }}
              className="group relative min-h-[200px] rounded-2xl overflow-hidden text-left border border-[var(--border-color)]"
            >
              <SafeImage
                src="/src/assets/images/commercial_retail_sp_1795781791892.jpg"
                alt="Lojas e imóveis comerciais em São Paulo"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-white flex items-end justify-between">
                <div>
                  <p className="text-[11px] text-white/80">Varejo e corporativo</p>
                  <p className="font-display text-xl font-semibold">
                    Lojas e Comerciais
                  </p>
                </div>
                <ArrowUpRight className="w-4 h-4 shrink-0" />
              </div>
            </button>

            {/* Tile 4: Opções com e sem vaga */}
            <button
              type="button"
              onClick={() => {
                onQuickSearch({ parkingFilter: 'sem_vaga' });
                onNavigate('/imoveis');
              }}
              className="group md:col-span-2 relative min-h-[200px] rounded-2xl overflow-hidden text-left border border-[var(--border-color)]"
            >
              <SafeImage
                src="/src/assets/images/apt_ipiranga_living_1795781790107.jpg"
                alt="Imóveis próximos ao metrô com ou sem vaga"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
              <div className="absolute bottom-4 left-5 right-5 text-white flex items-end justify-between">
                <div>
                  <p className="text-[11px] text-white/80">
                    Mobilidade junto ao Metrô e Terminal Sacomã
                  </p>
                  <p className="font-display text-2xl font-semibold">
                    Unidades com e sem vaga de garagem
                  </p>
                </div>
                <ArrowUpRight className="w-4 h-4 shrink-0" />
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* 4. Regions Served in São Paulo */}
      <section className="reveal-section py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-5 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                Presença Regional · {tenant.city}
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--ink-primary)] text-balance">
                Expertise nos bairros de maior liquidez da Zona Sul e eixo Ipiranga
              </h2>
              <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
                Atuação focada em imóveis próximos a estações de metrô, terminais de
                transporte e corredores comerciais consolidados em São Paulo.
              </p>
            </div>

            <div className="relative aspect-[16/10] lg:flex-1 rounded-[var(--radius-card)] overflow-hidden border border-[var(--border-color)]">
              <SafeImage
                src={REGION_AVENUE_IMAGE}
                alt="Bairros atendidos em São Paulo — Ipiranga e Vila Liviero"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="lg:col-span-7 divide-y divide-[var(--border-color)] border-t border-b border-[var(--border-color)]">
            {tenant.regions.map((reg, index) => {
              const matchingLp = landingPages.find(
                (lp) =>
                  lp.published &&
                  lp.targetRegion.toLowerCase() === reg.toLowerCase()
              );
              return (
                <div
                  key={reg}
                  className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono-tabular text-xs text-[var(--ink-muted)]">
                        0{index + 1}.
                      </span>
                      <h3 className="font-display text-2xl font-semibold text-[var(--ink-primary)]">
                        {reg}
                      </h3>
                    </div>
                    <p className="text-sm text-[var(--ink-muted)] max-w-xl">
                      {regionDescriptions[reg] ||
                        `Oportunidades selecionadas de venda e locação na região de ${reg}, São Paulo.`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (matchingLp) {
                        onNavigate(`/lp/${matchingLp.slug}`);
                      } else {
                        onQuickSearch({ neighborhood: reg });
                        onNavigate('/imoveis');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-primary)] hover:text-[var(--accent-color)] whitespace-nowrap shrink-0"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Ver imóveis na região
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Interactive Budget & Planning Simulator + Differentials */}
      <section className="reveal-section max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">
              A D S Imóveis · CRECI {tenant.creci}
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--ink-primary)] text-balance">
              Intermediação conduzida com rigor técnico e transparência
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                num: '01.',
                title: 'Vendas e Locações em São Paulo',
                body: 'Atendimento dedicado tanto para aquisição patrimonial quanto para locação residencial ou comercial ágil e segura.',
              },
              {
                num: '02.',
                title: 'Portfólio Versátil e Real',
                body: 'Apartamentos padrão, unidades mobiliadas prontas para morar, lazer completo, opções com ou sem vaga e lojas comerciais.',
              },
              {
                num: '03.',
                title: 'Segurança Documental (CRECI 226079-F)',
                body: 'Conferência completa de matrícula, certidões, condomínio e IPTU antes da assinatura de qualquer proposta.',
              },
              {
                num: '04.',
                title: 'Visita Virtual em 3 Modalidades',
                body: 'Explore panorâmica 360°, história guiada e hotspots interativos antes da visita presencial.',
              },
            ].map((item) => (
              <SpotlightCard
                key={item.num}
                className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-[var(--radius-card)] p-5 space-y-2"
              >
                <p className="font-mono-tabular text-xs text-[var(--accent-color)] font-medium">
                  {item.num}
                </p>
                <h3 className="font-display text-xl font-semibold text-[var(--ink-primary)]">
                  {item.title}
                </h3>
                <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                  {item.body}
                </p>
              </SpotlightCard>
            ))}
          </div>
        </div>

        {/* Interactive Financial & Monthly Cost Planner */}
        <div className="lg:col-span-5 bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-[var(--radius-card)] p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[var(--accent-color)]" />
              <h3 className="font-display text-2xl font-semibold">
                Planejador Financeiro
              </h3>
            </div>
            <div className="flex p-1 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setSimMode('compra')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  simMode === 'compra'
                    ? 'bg-[var(--surface-bg)] text-[var(--ink-primary)] shadow-sm'
                    : 'text-[var(--ink-muted)]'
                }`}
              >
                Compra
              </button>
              <button
                type="button"
                onClick={() => setSimMode('locacao')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  simMode === 'locacao'
                    ? 'bg-[var(--surface-bg)] text-[var(--ink-primary)] shadow-sm'
                    : 'text-[var(--ink-muted)]'
                }`}
              >
                Locação
              </button>
            </div>
          </div>

          {simMode === 'compra' ? (
            <div className="space-y-4 text-xs">
              <label className="block space-y-1">
                <div className="flex justify-between">
                  <span className="text-[var(--ink-muted)]">Valor do imóvel</span>
                  <span className="font-mono-tabular font-semibold">
                    {formatBRL(simValue)}
                  </span>
                </div>
                <input
                  type="range"
                  min={250000}
                  max={2500000}
                  step={10000}
                  value={simValue}
                  onChange={(e) => setSimValue(Number(e.target.value))}
                  className="w-full accent-[var(--accent-color)]"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex justify-between">
                  <span className="text-[var(--ink-muted)]">Entrada ({simDownPct}%)</span>
                  <span className="font-mono-tabular font-semibold">
                    {formatBRL((simValue * simDownPct) / 100)}
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={70}
                  step={5}
                  value={simDownPct}
                  onChange={(e) => setSimDownPct(Number(e.target.value))}
                  className="w-full accent-[var(--accent-color)]"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex justify-between">
                  <span className="text-[var(--ink-muted)]">Prazo</span>
                  <span className="font-mono-tabular font-semibold">{simYears} anos</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={35}
                  step={5}
                  value={simYears}
                  onChange={(e) => setSimYears(Number(e.target.value))}
                  className="w-full accent-[var(--accent-color)]"
                />
              </label>

              <div className="pt-4 border-t border-[var(--border-color)] flex items-baseline justify-between">
                <span className="text-[var(--ink-muted)]">Parcela estimada (referência)</span>
                <span className="font-mono-tabular text-2xl font-semibold text-[var(--ink-primary)]">
                  {formatBRL(Math.round(estimatedInstallment))}
                  <span className="text-xs font-normal text-[var(--ink-muted)]">/mês</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <label className="block space-y-1">
                <div className="flex justify-between">
                  <span className="text-[var(--ink-muted)]">Aluguel mensal</span>
                  <span className="font-mono-tabular font-semibold">{formatBRL(simRent)}</span>
                </div>
                <input
                  type="range"
                  min={1500}
                  max={12000}
                  step={100}
                  value={simRent}
                  onChange={(e) => setSimRent(Number(e.target.value))}
                  className="w-full accent-[var(--accent-color)]"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-[var(--ink-muted)] block">Condomínio (R$)</span>
                  <input
                    type="number"
                    min={0}
                    value={simCondo}
                    onChange={(e) => setSimCondo(Number(e.target.value) || 0)}
                    className="w-full h-9 px-2.5 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg tabular-nums"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[var(--ink-muted)] block">IPTU mensal (R$)</span>
                  <input
                    type="number"
                    min={0}
                    value={simIptu}
                    onChange={(e) => setSimIptu(Number(e.target.value) || 0)}
                    className="w-full h-9 px-2.5 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg tabular-nums"
                  />
                </label>
              </div>

              <div className="pt-4 border-t border-[var(--border-color)] flex items-baseline justify-between">
                <span className="text-[var(--ink-muted)]">Pacote mensal estimado</span>
                <span className="font-mono-tabular text-2xl font-semibold text-[var(--ink-primary)]">
                  {formatBRL(totalMonthlyRental)}
                  <span className="text-xs font-normal text-[var(--ink-muted)]">/mês</span>
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              onQuickSearch({
                transactionType: simMode === 'compra' ? 'venda' : 'aluguel',
                maxPrice: simMode === 'compra' ? simValue : simRent + 500,
              });
              onNavigate('/imoveis');
            }}
            className="w-full py-2.5 text-xs font-medium rounded-lg border border-[var(--border-color)] hover:border-[var(--accent-color)] transition-colors"
          >
            Ver imóveis compatíveis com este orçamento
          </button>
        </div>
      </section>

      {/* 6. Contact & Conversion Section */}
      <section
        id="contato"
        className="reveal-section bg-[var(--surface-bg)] border-t border-[var(--border-color)] py-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-5">
            <BrandLogo
              src={tenant.logoUrl}
              alt={tenant.companyName}
              className="h-44 sm:h-52 w-auto"
            />
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">
              Atendimento Direto
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--ink-primary)] text-balance">
              Converse com a {tenant.companyName}
            </h2>
            <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
              Quer comprar, alugar ou anunciar seu imóvel no Ipiranga, Vila Liviero,
              Jardim São Savério ou região? Envie sua solicitação e receba atendimento
              consultivo.
            </p>
            <div className="pt-4 border-t border-[var(--border-color)] space-y-2 text-xs text-[var(--ink-muted)]">
              <p>Registro Profissional: CRECI {tenant.creci}</p>
              <p>Atuação: Vendas e Locações em {tenant.city}</p>
              {tenant.address && <p>Endereço: {tenant.address}</p>}
              {tenant.phone && <p>Telefone: {tenant.phone}</p>}
              {tenant.email && <p>E-mail: {tenant.email}</p>}
            </div>
          </div>

          <div className="lg:col-span-7">
            <LeadForm tenant={tenant} sourcePage="/" />
          </div>
        </div>
      </section>
    </div>
  );
}
