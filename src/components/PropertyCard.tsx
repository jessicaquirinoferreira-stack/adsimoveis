import { ArrowUpRight } from 'lucide-react';
import { motion } from 'motion/react';
import type { Property } from '../types/realEstate';
import {
  formatBRL,
  formatParkingLabel,
  formatPropertyTypeLabel,
  formatTransactionLabel,
} from '../lib/formatters';
import { SafeImage } from './SafeImage';
import { SpotlightCard } from './ModernEffects';

interface PropertyCardProps {
  property: Property;
  onSelect: (slug: string) => void;
}

export function PropertyCard({ property, onSelect }: PropertyCardProps) {
  const primaryPrice =
    property.transactionType === 'aluguel'
      ? formatBRL(property.rentPrice)
      : formatBRL(property.salePrice);

  const secondaryPrice =
    property.transactionType === 'venda_aluguel' && property.rentPrice > 0
      ? `Locação ${formatBRL(property.rentPrice)}/mês`
      : property.transactionType === 'aluguel'
        ? '/mês'
        : null;

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      <SpotlightCard
        onClick={() => onSelect(property.slug)}
        className="group cursor-pointer h-full bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-[var(--radius-card)] overflow-hidden flex flex-col"
      >
        <div
          className="relative aspect-[4/3] overflow-hidden bg-neutral-100"
          style={{ boxShadow: 'var(--card-shadow)' }}
        >
          <SafeImage
            src={property.images[0]}
            alt={property.title}
            fallbackLabel={property.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/35 to-transparent pointer-events-none" />
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between text-white">
            <div>
              <p className="text-xs font-medium tracking-wide text-white/85">
                {formatTransactionLabel(property.transactionType)} · {property.neighborhood}
              </p>
              <p className="font-mono-tabular text-lg font-semibold leading-tight mt-0.5">
                {primaryPrice}
                {secondaryPrice && (
                  <span className="text-xs font-normal text-white/85 ml-1.5">
                    {secondaryPrice}
                  </span>
                )}
              </p>
            </div>
            <span className="w-8 h-8 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center group-hover:bg-white group-hover:text-neutral-900 transition-colors">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
        </div>

        <div className="p-5 flex-1 flex flex-col justify-between gap-4">
          <div>
            <p className="text-xs text-[var(--ink-muted)] mb-1.5">
              {formatPropertyTypeLabel(property.propertyType)}
              {property.furnished ? ' · Mobiliado' : ''}
              {property.fullLeisure ? ' · Lazer completo' : ''}
            </p>
            <h3 className="font-display text-xl font-semibold text-[var(--ink-primary)] leading-snug line-clamp-2">
              {property.title}
            </h3>
            {property.regionHighlight && (
              <p className="text-xs text-[var(--ink-muted)] mt-1.5 line-clamp-1">
                {property.regionHighlight}
              </p>
            )}
          </div>

          <div className="pt-3 border-t border-[var(--border-color)] flex items-center justify-between text-xs text-[var(--ink-muted)] tabular-nums">
            <span>
              {property.areaSqm > 0 ? `${property.areaSqm} m²` : 'Sob consulta'}
              {property.bedrooms > 0 ? ` · ${property.bedrooms} dorms` : ''}
              {` · ${formatParkingLabel(property.parkingSpaces)}`}
            </span>
            {property.condoFee > 0 && (
              <span className="truncate ml-2">Cond. {formatBRL(property.condoFee)}</span>
            )}
          </div>
        </div>
      </SpotlightCard>
    </motion.div>
  );
}
