import { RotateCcw, Search } from 'lucide-react';
import type { Property, PropertyFilters, PropertyType, TenantConfig } from '../types/realEstate';
import { PropertyCard } from '../components/PropertyCard';

interface CatalogPageProps {
  tenant: TenantConfig;
  properties: Property[];
  filters: PropertyFilters;
  onChangeFilters: (next: PropertyFilters) => void;
  onResetFilters: () => void;
  onSelectProperty: (slug: string) => void;
}

export function CatalogPage({
  tenant,
  properties,
  filters,
  onChangeFilters,
  onResetFilters,
  onSelectProperty,
}: CatalogPageProps) {
  const neighborhoods = Array.from(
    new Set([
      ...tenant.regions,
      ...properties.filter((p) => p.published).map((p) => p.neighborhood),
    ])
  ).filter(Boolean);

  const filtered = properties
    .filter((p) => p.published)
    .filter((p) => {
      if (filters.transactionType === 'venda') {
        if (p.transactionType !== 'venda' && p.transactionType !== 'venda_aluguel') return false;
      }
      if (filters.transactionType === 'aluguel') {
        if (p.transactionType !== 'aluguel' && p.transactionType !== 'venda_aluguel') return false;
      }
      if (filters.propertyType !== 'todos' && p.propertyType !== filters.propertyType) {
        return false;
      }
      if (
        filters.neighborhood &&
        p.neighborhood.toLowerCase() !== filters.neighborhood.toLowerCase()
      ) {
        return false;
      }
      if (filters.furnishedOnly && !p.furnished) return false;
      if (filters.fullLeisureOnly && !p.fullLeisure) return false;
      if (filters.parkingFilter === 'com_vaga' && p.parkingSpaces <= 0) return false;
      if (filters.parkingFilter === 'sem_vaga' && p.parkingSpaces > 0) return false;
      if (filters.minBedrooms > 0 && p.bedrooms < filters.minBedrooms) return false;
      if (filters.minArea > 0 && p.areaSqm < filters.minArea) return false;

      if (filters.maxPrice > 0) {
        const refPrice =
          filters.transactionType === 'aluguel'
            ? p.rentPrice
            : filters.transactionType === 'venda'
              ? p.salePrice
              : p.salePrice || p.rentPrice;
        if (refPrice > 0 && refPrice > filters.maxPrice) return false;
      }

      if (filters.query.trim()) {
        const q = filters.query.trim().toLowerCase();
        const hay = `${p.title} ${p.subtitle} ${p.neighborhood} ${p.regionHighlight} ${p.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const priceA = filters.transactionType === 'aluguel' ? a.rentPrice : a.salePrice || a.rentPrice;
      const priceB = filters.transactionType === 'aluguel' ? b.rentPrice : b.salePrice || b.rentPrice;
      if (filters.sortBy === 'price_asc') return priceA - priceB;
      if (filters.sortBy === 'price_desc') return priceB - priceA;
      if (filters.sortBy === 'area_desc') return b.areaSqm - a.areaSqm;
      return Number(b.featured) - Number(a.featured);
    });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--border-color)] pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">
            {tenant.companyName} · {tenant.city}
          </p>
          <h1 className="font-display text-4xl font-semibold text-[var(--ink-primary)] mt-1">
            Catálogo de Imóveis
          </h1>
        </div>
        <p className="text-sm text-[var(--ink-muted)] tabular-nums">
          {filtered.length}{' '}
          {filtered.length === 1 ? 'imóvel encontrado' : 'imóveis encontrados'}
        </p>
      </div>

      {/* Comprehensive Filter Bar */}
      <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-[var(--radius-card)] p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <label className="md:col-span-2 block space-y-1.5">
            <span className="text-xs font-medium text-[var(--ink-muted)]">
              Busca por palavra-chave ou referência
            </span>
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--ink-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filters.query}
                onChange={(e) => onChangeFilters({ ...filters, query: e.target.value })}
                placeholder="Ex.: Alto do Ipiranga, varanda, loja, mobiliado..."
                className="w-full h-10 pl-9 pr-3 text-sm bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-[var(--accent-color)]"
              />
            </div>
          </label>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[var(--ink-muted)] block">
              Modalidade
            </span>
            <div className="grid grid-cols-3 gap-1 p-1 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg h-10">
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
                  onClick={() =>
                    onChangeFilters({ ...filters, transactionType: opt.id })
                  }
                  className={`text-xs font-medium rounded-md transition-colors ${
                    filters.transactionType === opt.id
                      ? 'bg-[var(--surface-bg)] text-[var(--ink-primary)] shadow-sm'
                      : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--ink-muted)]">
              Tipo de imóvel
            </span>
            <select
              value={filters.propertyType}
              onChange={(e) =>
                onChangeFilters({
                  ...filters,
                  propertyType: e.target.value as 'todos' | PropertyType,
                })
              }
              className="w-full h-10 px-3 text-sm bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
            >
              <option value="todos">Todos os tipos</option>
              <option value="apartamento">Apartamento</option>
              <option value="comercial">Comercial / Loja</option>
              <option value="casa">Casa</option>
              <option value="studio">Studio</option>
              <option value="terreno">Terreno</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-4 border-t border-[var(--border-color)] items-end">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--ink-muted)]">Bairro</span>
            <select
              value={filters.neighborhood}
              onChange={(e) =>
                onChangeFilters({ ...filters, neighborhood: e.target.value })
              }
              className="w-full h-9 px-2.5 text-xs bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
            >
              <option value="">Todos os bairros</option>
              {neighborhoods.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--ink-muted)]">Garagem</span>
            <select
              value={filters.parkingFilter}
              onChange={(e) =>
                onChangeFilters({
                  ...filters,
                  parkingFilter: e.target.value as PropertyFilters['parkingFilter'],
                })
              }
              className="w-full h-9 px-2.5 text-xs bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
            >
              <option value="todos">Com ou sem vaga</option>
              <option value="com_vaga">Com vaga de garagem</option>
              <option value="sem_vaga">Sem vaga</option>
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--ink-muted)]">
              Quartos mínimos
            </span>
            <select
              value={filters.minBedrooms}
              onChange={(e) =>
                onChangeFilters({ ...filters, minBedrooms: Number(e.target.value) })
              }
              className="w-full h-9 px-2.5 text-xs bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
            >
              <option value={0}>Qualquer</option>
              <option value={1}>1+ dormitório</option>
              <option value={2}>2+ dormitórios</option>
              <option value={3}>3+ dormitórios</option>
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--ink-muted)]">
              Área mínima (m²)
            </span>
            <input
              type="number"
              min={0}
              value={filters.minArea || ''}
              onChange={(e) =>
                onChangeFilters({ ...filters, minArea: Number(e.target.value) || 0 })
              }
              placeholder="Ex.: 50"
              className="w-full h-9 px-2.5 text-xs bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg tabular-nums"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--ink-muted)]">
              Valor máximo (R$)
            </span>
            <input
              type="number"
              min={0}
              step={500}
              value={filters.maxPrice || ''}
              onChange={(e) =>
                onChangeFilters({ ...filters, maxPrice: Number(e.target.value) || 0 })
              }
              placeholder="Sem limite"
              className="w-full h-9 px-2.5 text-xs bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg tabular-nums"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--ink-muted)]">Ordenar</span>
            <select
              value={filters.sortBy}
              onChange={(e) =>
                onChangeFilters({
                  ...filters,
                  sortBy: e.target.value as PropertyFilters['sortBy'],
                })
              }
              className="w-full h-9 px-2.5 text-xs bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
            >
              <option value="featured">Destaques</option>
              <option value="price_asc">Menor valor</option>
              <option value="price_desc">Maior valor</option>
              <option value="area_desc">Maior área</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={filters.furnishedOnly}
                onChange={(e) =>
                  onChangeFilters({ ...filters, furnishedOnly: e.target.checked })
                }
                className="accent-[var(--accent-color)]"
              />
              <span>Mobiliado</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={filters.fullLeisureOnly}
                onChange={(e) =>
                  onChangeFilters({ ...filters, fullLeisureOnly: e.target.checked })
                }
                className="accent-[var(--accent-color)]"
              />
              <span>Lazer completo</span>
            </label>
          </div>

          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Limpar filtros
          </button>
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-[var(--radius-card)] p-12 text-center space-y-4">
          <h2 className="font-display text-2xl font-semibold">
            Nenhum imóvel corresponde aos filtros selecionados
          </h2>
          <p className="text-sm text-[var(--ink-muted)]">
            Ajuste os critérios de busca ou remova os filtros ativos para visualizar outras
            oportunidades em São Paulo.
          </p>
          <button
            type="button"
            onClick={onResetFilters}
            className="px-5 py-2.5 text-xs font-medium rounded-lg bg-[var(--accent-color)] text-[var(--accent-text)]"
          >
            Ver todos os imóveis
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onSelect={onSelectProperty}
            />
          ))}
        </div>
      )}
    </div>
  );
}
