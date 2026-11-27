import type { LandingPage, TenantConfig } from '../types/realEstate';
import { BrandLogo } from './BrandLogo';

interface SiteFooterProps {
  tenant: TenantConfig;
  landingPages: LandingPage[];
  onNavigate: (path: string) => void;
  onReplayIntro?: () => void;
}

export function SiteFooter({
  tenant,
  landingPages,
  onNavigate,
  onReplayIntro,
}: SiteFooterProps) {
  return (
    <footer className="bg-[var(--surface-bg)] border-t border-[var(--border-color)] text-[var(--ink-primary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="md:col-span-2 space-y-4">
          <BrandLogo
            src={tenant.logoUrl}
            alt={tenant.companyName}
            className="h-40 sm:h-44 w-auto"
          />
          <div className="space-y-2">
            <p className="font-display text-2xl font-semibold">{tenant.companyName}</p>
            <p className="text-xs uppercase tracking-widest text-[var(--ink-muted)]">
              {tenant.slogan} · CRECI {tenant.creci}
            </p>
            <p className="text-sm text-[var(--ink-muted)] max-w-md leading-relaxed">
              Atuação em vendas e locações em {tenant.city} ({tenant.regions.join(', ')} e
              regiões próximas).
            </p>
          </div>
          <div className="pt-2 space-y-1 text-xs text-[var(--ink-muted)]">
            {tenant.address && <p>Endereço: {tenant.address}</p>}
            {tenant.phone && <p>Telefone: {tenant.phone}</p>}
            {tenant.email && <p>E-mail: {tenant.email}</p>}
            {tenant.instagramUrl && (
              <p>
                Instagram:{' '}
                <a
                  href={tenant.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-[var(--ink-primary)]"
                >
                  @ads.imoveiseintermediacaodeneg
                </a>
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            Navegação
          </p>
          <ul className="space-y-2 text-sm text-[var(--ink-muted)]">
            <li>
              <button
                type="button"
                onClick={() => onNavigate('/')}
                className="hover:text-[var(--ink-primary)] transition-colors"
              >
                Página inicial
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate('/imoveis')}
                className="hover:text-[var(--ink-primary)] transition-colors"
              >
                Catálogo de imóveis
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate('/empreendimentos')}
                className="hover:text-[var(--ink-primary)] transition-colors"
              >
                Empreendimentos
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate('/sobre')}
                className="hover:text-[var(--ink-primary)] transition-colors"
              >
                Sobre a corretora
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate('/privacidade')}
                className="hover:text-[var(--ink-primary)] transition-colors"
              >
                Privacidade e LGPD
              </button>
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            Regiões & Guias
          </p>
          <ul className="space-y-2 text-sm text-[var(--ink-muted)]">
            {landingPages
              .filter((lp) => lp.published)
              .slice(0, 4)
              .map((lp) => (
                <li key={lp.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(`/lp/${lp.slug}`)}
                    className="text-left hover:text-[var(--ink-primary)] transition-colors"
                  >
                    {lp.title}
                  </button>
                </li>
              ))}
            <li className="pt-2 flex flex-col items-start gap-2">
              {onReplayIntro && (
                <button
                  type="button"
                  onClick={onReplayIntro}
                  className="text-xs underline hover:text-[var(--ink-primary)] transition-colors"
                >
                  Rever introdução (7s)
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigate('/admin')}
                className="text-xs underline hover:text-[var(--ink-primary)] transition-colors"
              >
                Acesso Administrativo
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--ink-muted)]">
          <span>
            © {new Date().getFullYear()} {tenant.companyName} · CRECI {tenant.creci}
          </span>
          <span>Vendas e Locações em {tenant.city}</span>
        </div>
      </div>
    </footer>
  );
}
