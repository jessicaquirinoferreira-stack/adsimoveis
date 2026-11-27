import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import type { TenantConfig } from '../types/realEstate';
import { buildWhatsAppLink } from '../lib/formatters';
import { BrandLogo } from './BrandLogo';

interface SiteHeaderProps {
  tenant: TenantConfig;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function SiteHeader({ tenant, currentPath, onNavigate }: SiteHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: 'Início', path: '/' },
    { label: 'Imóveis', path: '/imoveis' },
    { label: 'Empreendimentos', path: '/empreendimentos' },
    { label: 'Sobre', path: '/sobre' },
    { label: 'Contato', path: '/#contato' },
  ];

  const whatsappUrl = buildWhatsAppLink(
    tenant.whatsapp,
    `Olá, gostaria de informações sobre imóveis com a ${tenant.companyName}.`
  );

  const handleLink = (path: string) => {
    setMobileOpen(false);
    if (path === '/#contato') {
      if (currentPath !== '/') {
        onNavigate('/');
        window.setTimeout(() => {
          document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' });
        }, 120);
      } else {
        document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }
    onNavigate(path);
  };

  return (
    <header className="sticky top-0 z-40 bg-[var(--surface-bg)]/95 backdrop-blur-md border-b border-[var(--border-color)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] sm:h-20 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Logo + Wordmark */}
        <button
          type="button"
          onClick={() => handleLink('/')}
          className="flex items-center gap-3 text-left whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--accent-color)]"
        >
          <BrandLogo
            src={tenant.logoUrl}
            alt={tenant.companyName}
            className="h-14 sm:h-[68px] w-auto shrink-0"
          />
          <span className="font-display text-lg sm:text-xl font-semibold tracking-tight text-[var(--ink-primary)] whitespace-nowrap shrink-0">
            A D S Imóveis
          </span>
        </button>

        {/* Zone 2: 5 concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[var(--ink-muted)]">
          {navItems.map((item) => {
            const active =
              item.path === '/'
                ? currentPath === '/'
                : item.path !== '/#contato' && currentPath.startsWith(item.path);
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleLink(item.path)}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-[var(--ink-primary)] pb-0.5 border-b ${
                  active
                    ? 'text-[var(--ink-primary)] border-[var(--accent-color)]'
                    : 'border-transparent'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary CTA */}
        <div className="flex items-center gap-3 shrink-0">
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center px-4 py-2 text-xs font-medium rounded-[var(--radius-btn)] bg-[var(--accent-color)] text-[var(--accent-text)] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              Atendimento WhatsApp
            </a>
          ) : (
            <button
              type="button"
              onClick={() => handleLink('/#contato')}
              className="hidden sm:inline-flex items-center px-4 py-2 text-xs font-medium rounded-[var(--radius-btn)] bg-[var(--accent-color)] text-[var(--accent-text)] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              Agendar Atendimento
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Abrir menu"
            className="md:hidden p-2 rounded-md text-[var(--ink-primary)] hover:bg-[var(--canvas-bg)]"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--border-color)] bg-[var(--surface-bg)] px-4 py-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => handleLink(item.path)}
              className="block w-full text-left py-2.5 text-sm font-medium text-[var(--ink-primary)] border-b border-[var(--border-color)] last:border-b-0"
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              onNavigate('/admin');
            }}
            className="block w-full text-left py-2.5 text-xs font-medium text-[var(--ink-muted)]"
          >
            Painel Administrativo
          </button>
        </div>
      )}
    </header>
  );
}
