import { useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Expand, Film, X } from 'lucide-react';
import type { Property, TenantConfig } from '../types/realEstate';
import {
  formatBRL,
  formatParkingLabel,
  formatPropertyTypeLabel,
  formatTransactionLabel,
} from '../lib/formatters';
import { SafeImage } from '../components/SafeImage';
import { VirtualTourViewer } from '../components/VirtualTourViewer';
import { LeadForm } from '../components/LeadForm';

interface PropertyDetailPageProps {
  tenant: TenantConfig;
  property: Property | undefined;
  onBack: () => void;
}

export function PropertyDetailPage({
  tenant,
  property,
  onBack,
}: PropertyDetailPageProps) {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!property) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center space-y-4">
        <h1 className="font-display text-3xl font-semibold">Imóvel não encontrado</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Esta unidade pode ter sido vendida, locada ou removida do catálogo público.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 text-sm font-medium rounded-lg bg-[var(--accent-color)] text-[var(--accent-text)]"
        >
          Voltar ao catálogo
        </button>
      </div>
    );
  }

  const images = property.images.length > 0 ? property.images : [''];
  const currentImg = images[activeImageIdx] || images[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink-primary)] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para imóveis
      </button>

      {/* Header + Gallery */}
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">
              {formatTransactionLabel(property.transactionType)} ·{' '}
              {formatPropertyTypeLabel(property.propertyType)} · {property.neighborhood},{' '}
              {property.city}
            </p>
            <h1 className="font-display text-3xl sm:text-5xl font-semibold text-[var(--ink-primary)] text-balance leading-tight">
              {property.title}
            </h1>
            {property.subtitle && (
              <p className="text-base text-[var(--ink-muted)]">{property.subtitle}</p>
            )}
          </div>

          <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-[var(--radius-card)] p-5 min-w-[260px] space-y-2">
            {property.salePrice > 0 && (
              <div>
                <p className="text-xs text-[var(--ink-muted)]">Valor de venda</p>
                <p className="font-mono-tabular text-2xl font-semibold text-[var(--ink-primary)]">
                  {formatBRL(property.salePrice)}
                </p>
              </div>
            )}
            {property.rentPrice > 0 && (
              <div>
                <p className="text-xs text-[var(--ink-muted)]">Locação mensal</p>
                <p className="font-mono-tabular text-2xl font-semibold text-[var(--ink-primary)]">
                  {formatBRL(property.rentPrice)}
                  <span className="text-xs font-normal text-[var(--ink-muted)]">/mês</span>
                </p>
              </div>
            )}
            <div className="pt-2 border-t border-[var(--border-color)] flex items-center justify-between text-xs text-[var(--ink-muted)] tabular-nums">
              <span>Condomínio: {property.condoFee > 0 ? formatBRL(property.condoFee) : 'Isento / N/A'}</span>
              <span>IPTU: {property.iptuFee > 0 ? formatBRL(property.iptuFee) : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Professional Gallery */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-9 relative aspect-[16/10] rounded-[var(--radius-card)] overflow-hidden border border-[var(--border-color)] bg-neutral-100 group">
            <SafeImage
              src={currentImg}
              alt={`${property.title} — imagem ${activeImageIdx + 1}`}
              loading="eager"
              className="w-full h-full object-cover"
            />
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setActiveImageIdx((prev) => (prev - 1 + images.length) % images.length)
                  }
                  aria-label="Foto anterior"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/55 text-white flex items-center justify-center hover:bg-black/75 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveImageIdx((prev) => (prev + 1) % images.length)
                  }
                  aria-label="Próxima foto"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/55 text-white flex items-center justify-center hover:bg-black/75 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-black/60 text-white rounded-md backdrop-blur-sm hover:bg-black/80"
            >
              <Expand className="w-3.5 h-3.5" />
              Ampliar ({activeImageIdx + 1}/{images.length})
            </button>
          </div>

          <div className="lg:col-span-3 grid grid-cols-3 lg:grid-cols-1 gap-3">
            {images.slice(0, 3).map((img, idx) => (
              <button
                key={`${img}-${idx}`}
                type="button"
                onClick={() => setActiveImageIdx(idx)}
                className={`relative aspect-[4/3] lg:aspect-[16/10] rounded-lg overflow-hidden border-2 transition-all ${
                  idx === activeImageIdx
                    ? 'border-[var(--accent-color)]'
                    : 'border-transparent opacity-75 hover:opacity-100'
                }`}
              >
                <SafeImage
                  src={img}
                  alt={`Miniatura ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Key Specs Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-[var(--radius-card)] p-5">
        <div>
          <p className="text-xs text-[var(--ink-muted)]">Área útil</p>
          <p className="font-mono-tabular text-lg font-semibold mt-0.5">
            {property.areaSqm} m²
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--ink-muted)]">Dormitórios</p>
          <p className="font-mono-tabular text-lg font-semibold mt-0.5">
            {property.bedrooms > 0 ? property.bedrooms : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--ink-muted)]">Suítes</p>
          <p className="font-mono-tabular text-lg font-semibold mt-0.5">
            {property.suites}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--ink-muted)]">Banheiros</p>
          <p className="font-mono-tabular text-lg font-semibold mt-0.5">
            {property.bathrooms}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--ink-muted)]">Garagem</p>
          <p className="font-mono-tabular text-lg font-semibold mt-0.5">
            {formatParkingLabel(property.parkingSpaces)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--ink-muted)]">Mobiliado / Lazer</p>
          <p className="text-sm font-semibold mt-1">
            {property.furnished ? 'Mobiliado' : 'Sem mobília'} ·{' '}
            {property.fullLeisure ? 'Lazer completo' : 'Padrão'}
          </p>
        </div>
      </div>

      {/* Main Description & Lead Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-3">
            <h2 className="font-display text-3xl font-semibold">Sobre o imóvel</h2>
            <p className="text-sm sm:text-base text-[var(--ink-muted)] leading-relaxed whitespace-pre-line">
              {property.description}
            </p>
          </div>

          {property.features.length > 0 && (
            <div className="space-y-3 pt-6 border-t border-[var(--border-color)]">
              <h3 className="font-display text-2xl font-semibold">
                Características e diferenciais
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-[var(--ink-primary)]">
                {property.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cinematic Video if attached */}
          {property.videoUrl && (
            <div className="space-y-3 pt-6 border-t border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-[var(--accent-color)]" />
                <h3 className="font-display text-2xl font-semibold">
                  Apresentação Audiovisual
                </h3>
              </div>
              <video
                src={property.videoUrl}
                controls
                className="w-full rounded-[var(--radius-card)] border border-[var(--border-color)] bg-black"
              />
            </div>
          )}
        </div>

        <div className="lg:col-span-5">
          <LeadForm
            tenant={tenant}
            propertyId={property.id}
            propertyTitle={property.title}
            defaultInterest={
              property.transactionType === 'aluguel' ? 'aluguel' : 'visita'
            }
            sourcePage={`/imovel/${property.slug}`}
            heading="Agendar visita ou solicitar proposta"
            subheading={`Atendimento direto da ${tenant.companyName} · CRECI ${tenant.creci}.`}
          />
        </div>
      </div>

      {/* 3-Mode Virtual Tour */}
      <VirtualTourViewer property={property} />

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/92 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Fechar galeria"
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={currentImg}
            alt={property.title}
            referrerPolicy="no-referrer"
            className="max-h-[88vh] max-w-[92vw] object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  );
}
