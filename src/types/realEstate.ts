export type ThemePresetId =
  | 'moderno-profissional'
  | 'minimalista-premium'
  | 'imobiliario-contemporaneo'
  | 'confianca-oportunidade';

export type TransactionType = 'venda' | 'aluguel' | 'venda_aluguel';
export type PropertyType = 'apartamento' | 'comercial' | 'casa' | 'studio' | 'terreno';
export type PropertyStatus = 'disponivel' | 'reservado' | 'vendido' | 'alugado';
export type VirtualTourMode = 'panoramic_360' | 'guided_story' | 'hotspot_explorer';
export type LeadStatus = 'novo' | 'em_atendimento' | 'agendado' | 'convertido' | 'arquivado';
export type LeadInterestType = 'venda' | 'aluguel' | 'avaliacao' | 'visita' | 'comercial';

export interface ThemeTokens {
  canvasBg: string;
  surfaceBg: string;
  inkPrimary: string;
  inkMuted: string;
  accentColor: string;
  accentText: string;
  borderColor: string;
  displayFont: string;
  bodyFont: string;
  borderRadius: 'sharp' | 'refined' | 'soft';
  cardElevation: 'flat' | 'subtle' | 'elevated';
  heroGradient: string;
}

export interface TenantConfig {
  tenantId: string;
  companyName: string;
  slogan: string;
  creci: string;
  city: string;
  regions: string[];
  whatsapp: string;
  phone: string;
  email: string;
  address: string;
  instagramUrl: string;
  domain: string;
  heroHeadline: string;
  heroSubheadline: string;
  aboutTitle: string;
  aboutText: string;
  logoUrl: string;
  faviconUrl: string;
  themePreset: ThemePresetId;
  themeTokens: ThemeTokens;
  seoTitle: string;
  seoDescription: string;
  assistantName?: string;
  assistantRole?: string;
  assistantAvatarUrl?: string;
  updatedAt: string;
}

export interface VirtualTourHotspot {
  id: string;
  x: number;
  y: number;
  title: string;
  description: string;
  roomLabel: string;
  imageIndex: number;
}

export interface VirtualTourChapter {
  id: string;
  title: string;
  narration: string;
  cameraHint: string;
  imageIndex: number;
  durationSec: number;
}

export interface VirtualTourData {
  panoramicSceneTitle: string;
  panoramicHighlights: string[];
  chapters: VirtualTourChapter[];
  hotspots: VirtualTourHotspot[];
}

export interface AIPropertyAnalysis {
  qualityScore?: number;
  roomType?: string;
  lightingNotes?: string;
  stagingRecommendations?: string[];
  recommendedPreset?: string;
  enhancementParams?: {
    brightness: number;
    contrast: number;
    saturate: number;
    warmth: number;
    sharpness: number;
  };
  cinematicStoryboard?: {
    title: string;
    hook: string;
    musicMood: string;
    scenes: {
      sceneNumber: number;
      caption: string;
      voiceover: string;
      motion: 'zoom-in' | 'pan-left' | 'pan-right' | 'zoom-out';
      durationSec: number;
    }[];
  };
}

export interface Property {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  transactionType: TransactionType;
  propertyType: PropertyType;
  neighborhood: string;
  city: string;
  regionHighlight: string;
  salePrice: number;
  rentPrice: number;
  condoFee: number;
  iptuFee: number;
  areaSqm: number;
  bedrooms: number;
  bathrooms: number;
  suites: number;
  parkingSpaces: number;
  furnished: boolean;
  fullLeisure: boolean;
  features: string[];
  images: string[];
  videoUrl: string;
  virtualTourMode: VirtualTourMode;
  virtualTourData?: VirtualTourData;
  aiAnalysis?: AIPropertyAnalysis;
  featured: boolean;
  published: boolean;
  status: PropertyStatus;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Development {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  neighborhood: string;
  city: string;
  stage: 'lancamento' | 'em_obras' | 'pronto';
  summary: string;
  coverImage: string;
  amenities: string[];
  published: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface LandingPage {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  headline: string;
  subheadline: string;
  heroImage: string;
  ctaLabel: string;
  targetRegion: string;
  propertyFilterType: string;
  bodyText: string;
  published: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  interestType: LeadInterestType;
  propertyId: string;
  propertyTitle: string;
  sourcePage: string;
  status: LeadStatus;
  lgpdConsent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyFilters {
  query: string;
  transactionType: 'todos' | 'venda' | 'aluguel';
  propertyType: 'todos' | PropertyType;
  neighborhood: string;
  furnishedOnly: boolean;
  fullLeisureOnly: boolean;
  parkingFilter: 'todos' | 'com_vaga' | 'sem_vaga';
  minBedrooms: number;
  minArea: number;
  maxPrice: number;
  sortBy: 'featured' | 'price_asc' | 'price_desc' | 'area_desc';
}
