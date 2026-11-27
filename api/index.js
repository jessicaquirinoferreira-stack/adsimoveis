// server/coreHandler.ts
import crypto2 from "node:crypto";
import fs3 from "node:fs";
import path3 from "node:path";

// src/data/defaults.ts
var DEFAULT_TENANT_ID = "ads-imoveis-sp";
var THEME_PRESETS = {
  "moderno-profissional": {
    name: "Moderno Profissional",
    description: "Alabastro editorial, carv\xE3o arquitet\xF4nico e bronze refinado.",
    tokens: {
      canvasBg: "#F8F7F4",
      surfaceBg: "#FFFFFF",
      inkPrimary: "#14171A",
      inkMuted: "#5C636B",
      accentColor: "#8C6D46",
      accentText: "#FFFFFF",
      borderColor: "#E5E1D8",
      displayFont: "'Cormorant Garamond', Georgia, serif",
      bodyFont: "'Plus Jakarta Sans', system-ui, sans-serif",
      borderRadius: "refined",
      cardElevation: "subtle",
      heroGradient: "linear-gradient(180deg, rgba(16,18,22,0.22) 0%, rgba(16,18,22,0.78) 100%)"
    }
  },
  "minimalista-premium": {
    name: "Minimalista Premium",
    description: "Branco galeria puro, contraste absoluto e tra\xE7o geom\xE9trico.",
    tokens: {
      canvasBg: "#FFFFFF",
      surfaceBg: "#F7F7F8",
      inkPrimary: "#0D0E10",
      inkMuted: "#525866",
      accentColor: "#111827",
      accentText: "#FFFFFF",
      borderColor: "#E5E7EB",
      displayFont: "'Playfair Display', Georgia, serif",
      bodyFont: "'Manrope', system-ui, sans-serif",
      borderRadius: "sharp",
      cardElevation: "flat",
      heroGradient: "linear-gradient(180deg, rgba(13,14,16,0.28) 0%, rgba(13,14,16,0.82) 100%)"
    }
  },
  "imobiliario-contemporaneo": {
    name: "Imobili\xE1rio Contempor\xE2neo",
    description: "Cinza mineral suave, cobalto executivo e leitura arquitet\xF4nica.",
    tokens: {
      canvasBg: "#F4F6F8",
      surfaceBg: "#FFFFFF",
      inkPrimary: "#0F172A",
      inkMuted: "#475569",
      accentColor: "#1E3A5F",
      accentText: "#FFFFFF",
      borderColor: "#DCE2E8",
      displayFont: "'Plus Jakarta Sans', system-ui, sans-serif",
      bodyFont: "'Plus Jakarta Sans', system-ui, sans-serif",
      borderRadius: "refined",
      cardElevation: "subtle",
      heroGradient: "linear-gradient(180deg, rgba(15,23,42,0.24) 0%, rgba(15,23,42,0.80) 100%)"
    }
  },
  "confianca-oportunidade": {
    name: "Confian\xE7a & Oportunidade",
    description: "P\xE9rola serena com verde esmeralda profundo e foco em convers\xE3o.",
    tokens: {
      canvasBg: "#F7F8F7",
      surfaceBg: "#FFFFFF",
      inkPrimary: "#111C18",
      inkMuted: "#4C5E57",
      accentColor: "#154237",
      accentText: "#FFFFFF",
      borderColor: "#DCE3DF",
      displayFont: "'Cormorant Garamond', Georgia, serif",
      bodyFont: "'Manrope', system-ui, sans-serif",
      borderRadius: "soft",
      cardElevation: "subtle",
      heroGradient: "linear-gradient(180deg, rgba(17,28,24,0.22) 0%, rgba(17,28,24,0.82) 100%)"
    }
  }
};
var OFFICIAL_LOGO_URL = "https://i.postimg.cc/HkS62TZ4/Logo-ADS-Imoveis-em-Roxo-Metalico.png";
var ASSISTANT_AVATAR_IMAGE = "/src/assets/images/assistant_sofia_portrait_1795782604601.jpg";
var DEFAULT_TENANT_CONFIG = {
  tenantId: DEFAULT_TENANT_ID,
  companyName: "A D S Im\xF3veis e Intermedia\xE7\xF5es de Neg\xF3cios",
  slogan: "Sua Corretora de Im\xF3veis",
  creci: "226079-F",
  city: "S\xE3o Paulo",
  regions: [
    "Ipiranga",
    "Vila Liviero",
    "Jardim S\xE3o Sav\xE9rio",
    "Alto do Ipiranga",
    "Sacom\xE3"
  ],
  whatsapp: "",
  phone: "",
  email: "",
  address: "",
  instagramUrl: "https://www.instagram.com/ads.imoveiseintermediacaodeneg/",
  domain: "",
  heroHeadline: "As melhores oportunidades em vendas e loca\xE7\xF5es em S\xE3o Paulo",
  heroSubheadline: "Curadoria imobili\xE1ria especializada no Ipiranga, Vila Liviero, Jardim S\xE3o Sav\xE9rio e arredores \u2014 apartamentos residenciais, unidades mobiliadas e pontos comerciais com atendimento transparente.",
  aboutTitle: "Intermedia\xE7\xE3o imobili\xE1ria com seguran\xE7a jur\xEDdica e presen\xE7a local em S\xE3o Paulo",
  aboutText: "A D S Im\xF3veis e Intermedia\xE7\xF5es de Neg\xF3cios (CRECI 226079-F) atua com foco absoluto em vendas e loca\xE7\xF5es na capital paulista. Nossa opera\xE7\xE3o une an\xE1lise documental criteriosa, leitura real do mercado de bairros estrat\xE9gicos como Ipiranga, Vila Liviero, Jardim S\xE3o Sav\xE9rio, proximidades do Metr\xF4 Alto do Ipiranga e Terminal Sacom\xE3, e atendimento consultivo em cada etapa da negocia\xE7\xE3o.",
  logoUrl: OFFICIAL_LOGO_URL,
  faviconUrl: OFFICIAL_LOGO_URL,
  themePreset: "moderno-profissional",
  themeTokens: THEME_PRESETS["moderno-profissional"].tokens,
  seoTitle: "A D S Im\xF3veis | Vendas e Loca\xE7\xF5es em S\xE3o Paulo \xB7 CRECI 226079-F",
  seoDescription: "Oportunidades reais de apartamentos residenciais, unidades mobiliadas e im\xF3veis comerciais para venda e loca\xE7\xE3o em S\xE3o Paulo.",
  assistantName: "Sofia",
  assistantRole: "Assistente Virtual",
  assistantAvatarUrl: ASSISTANT_AVATAR_IMAGE,
  updatedAt: (/* @__PURE__ */ new Date()).toISOString()
};
var nowIso = (/* @__PURE__ */ new Date()).toISOString();
var DEFAULT_PROPERTIES = [
  {
    id: "prop-ipiranga-residence",
    tenantId: DEFAULT_TENANT_ID,
    slug: "apartamento-varanda-gourmet-ipiranga",
    title: "Apartamento Residencial com Varanda Gourmet no Ipiranga",
    subtitle: "Living integrado \xE0 varanda envidra\xE7ada e lazer completo pr\xF3ximo ao Metr\xF4 Alto do Ipiranga",
    description: "Apartamento residencial projetado para quem valoriza ilumina\xE7\xE3o natural, planta bem distribu\xEDda e mobilidade na Zona Sul de S\xE3o Paulo. Conta com sala para dois ambientes integrada \xE0 varanda gourmet, cozinha funcional, lazer completo no condom\xEDnio e f\xE1cil acesso ao Metr\xF4 Alto do Ipiranga e principais vias da regi\xE3o.",
    transactionType: "venda",
    propertyType: "apartamento",
    neighborhood: "Ipiranga",
    city: "S\xE3o Paulo",
    regionHighlight: "Pr\xF3ximo ao Metr\xF4 Alto do Ipiranga",
    salePrice: 79e4,
    rentPrice: 0,
    condoFee: 890,
    iptuFee: 210,
    areaSqm: 78,
    bedrooms: 2,
    bathrooms: 2,
    suites: 1,
    parkingSpaces: 1,
    furnished: false,
    fullLeisure: true,
    features: [
      "Varanda gourmet envidra\xE7ada",
      "Lazer completo no condom\xEDnio",
      "Portaria 24 horas",
      "Pr\xF3ximo ao Metr\xF4 Alto do Ipiranga",
      "Planta com su\xEDte"
    ],
    images: [
      "/src/assets/images/apt_ipiranga_living_1795781790107.jpg",
      "/src/assets/images/hero_sp_architecture_1795781789685.jpg"
    ],
    videoUrl: "",
    virtualTourMode: "hotspot_explorer",
    virtualTourData: {
      panoramicSceneTitle: "Living Integrado & Varanda \u2014 Ipiranga",
      panoramicHighlights: [
        "Incid\xEAncia solar plena da manh\xE3 no living",
        "Abertura total entre sala de jantar e varanda gourmet",
        "Vista aberta para a arboriza\xE7\xE3o do Ipiranga"
      ],
      chapters: [
        {
          id: "ch-1",
          title: "Living e Sala de Jantar",
          narration: "Piso em madeira engenheirada com integra\xE7\xE3o direta \xE0 varanda gourmet e excelente ventila\xE7\xE3o cruzada.",
          cameraHint: "Panor\xE2mica horizontal da \xE1rea social",
          imageIndex: 0,
          durationSec: 5
        },
        {
          id: "ch-2",
          title: "Perspectiva Urbana de S\xE3o Paulo",
          narration: "Localiza\xE7\xE3o estrat\xE9gica pr\xF3xima ao Metr\xF4 Alto do Ipiranga, conectando tranquilidade residencial e acesso r\xE1pido.",
          cameraHint: "Aproxima\xE7\xE3o suave para a vista externa",
          imageIndex: 1,
          durationSec: 5
        }
      ],
      hotspots: [
        {
          id: "hs-1",
          x: 52,
          y: 44,
          title: "Varanda Gourmet Integrada",
          description: "Caixilhos amplos que unem a \xE1rea social ao espa\xE7o de conviv\xEAncia externo.",
          roomLabel: "\xC1rea Social",
          imageIndex: 0
        },
        {
          id: "hs-2",
          x: 24,
          y: 62,
          title: "Sala de Jantar Iluminada",
          description: "Espa\xE7o dimensionado para mesa de 6 lugares com ilumina\xE7\xE3o natural constante.",
          roomLabel: "Jantar",
          imageIndex: 0
        }
      ]
    },
    featured: true,
    published: true,
    status: "disponivel",
    ownerId: "system-seed",
    createdAt: nowIso,
    updatedAt: nowIso
  },
  {
    id: "prop-mobiliado-alto-ipiranga",
    tenantId: DEFAULT_TENANT_ID,
    slug: "apartamento-mobiliado-alto-do-ipiranga",
    title: "Apartamento Mobiliado Pronto para Morar \u2014 Alto do Ipiranga",
    subtitle: "Loca\xE7\xE3o facilitada com marcenaria planejada, ilha em m\xE1rmore e vista panor\xE2mica",
    description: "Unidade totalmente mobiliada com acabamento contempor\xE2neo, ideal para loca\xE7\xE3o pr\xE1tica em S\xE3o Paulo. Cozinha equipada integrada ao living, ilumina\xE7\xE3o arquitet\xF4nica embutida, climatiza\xE7\xE3o e localiza\xE7\xE3o privilegiada com acesso r\xE1pido ao Metr\xF4 Alto do Ipiranga e Terminal Sacom\xE3.",
    transactionType: "aluguel",
    propertyType: "apartamento",
    neighborhood: "Alto do Ipiranga",
    city: "S\xE3o Paulo",
    regionHighlight: "A poucos minutos do Metr\xF4 Alto do Ipiranga",
    salePrice: 0,
    rentPrice: 4400,
    condoFee: 720,
    iptuFee: 165,
    areaSqm: 58,
    bedrooms: 2,
    bathrooms: 1,
    suites: 1,
    parkingSpaces: 1,
    furnished: true,
    fullLeisure: true,
    features: [
      "Totalmente mobiliado",
      "Ilha gourmet em m\xE1rmore",
      "Ilumina\xE7\xE3o arquitet\xF4nica",
      "Lazer completo",
      "Pronto para morar"
    ],
    images: [
      "/src/assets/images/apt_furnished_modern_1795781790675.jpg",
      "/src/assets/images/hero_sp_architecture_1795781789685.jpg"
    ],
    videoUrl: "",
    virtualTourMode: "guided_story",
    virtualTourData: {
      panoramicSceneTitle: "Conceito Aberto Mobiliado \u2014 Alto do Ipiranga",
      panoramicHighlights: [
        "Marcenaria sob medida e mobili\xE1rio contempor\xE2neo inclu\xEDdos",
        "Cozinha americana com bancada em pedra natural",
        "Varanda integrada com vista urbana ao entardecer"
      ],
      chapters: [
        {
          id: "ch-m1",
          title: "Sala e Cozinha Integrada",
          narration: "Projeto de interiores pensado para praticidade imediata, com ilumina\xE7\xE3o linear e mobili\xE1rio completo.",
          cameraHint: "Travelling lento da cozinha para o living",
          imageIndex: 0,
          durationSec: 5
        },
        {
          id: "ch-m2",
          title: "Vista Panor\xE2mica Paulista",
          narration: "Andar alto com vista livre e f\xE1cil deslocamento para os principais eixos de S\xE3o Paulo.",
          cameraHint: "Zoom suave na janela panor\xE2mica",
          imageIndex: 1,
          durationSec: 5
        }
      ],
      hotspots: [
        {
          id: "hs-m1",
          x: 68,
          y: 58,
          title: "Ilha em M\xE1rmore",
          description: "Bancada central equipada com cooktop por indu\xE7\xE3o e banquetas estofadas.",
          roomLabel: "Cozinha",
          imageIndex: 0
        },
        {
          id: "hs-m2",
          x: 34,
          y: 52,
          title: "Estar Mobiliado",
          description: "Sof\xE1 em linho natural, tapete texturizado e acesso direto \xE0 varanda.",
          roomLabel: "Living",
          imageIndex: 0
        }
      ]
    },
    featured: true,
    published: true,
    status: "disponivel",
    ownerId: "system-seed",
    createdAt: nowIso,
    updatedAt: nowIso
  },
  {
    id: "prop-comercial-sacoma-liviero",
    tenantId: DEFAULT_TENANT_ID,
    slug: "loja-comercial-vitrine-sacoma-vila-liviero",
    title: "Loja Comercial com Vitrine em P\xE9-Direito Duplo \u2014 Regi\xE3o Sacom\xE3 / Vila Liviero",
    subtitle: "Excelente visibilidade de rua para varejo, showroom, cl\xEDnica ou servi\xE7os",
    description: "Im\xF3vel comercial t\xE9rreo com ampla fachada envidra\xE7ada, p\xE9-direito elevado e planta livre para f\xE1cil adapta\xE7\xE3o de layout. Posicionamento estrat\xE9gico pr\xF3ximo ao Terminal Sacom\xE3 e corredor comercial da Vila Liviero, com alto fluxo de passagem e facilidade de acesso.",
    transactionType: "venda_aluguel",
    propertyType: "comercial",
    neighborhood: "Vila Liviero",
    city: "S\xE3o Paulo",
    regionHighlight: "Pr\xF3ximo ao Terminal Sacom\xE3",
    salePrice: 118e4,
    rentPrice: 6800,
    condoFee: 0,
    iptuFee: 420,
    areaSqm: 115,
    bedrooms: 0,
    bathrooms: 2,
    suites: 0,
    parkingSpaces: 0,
    furnished: false,
    fullLeisure: false,
    features: [
      "Fachada em vidro de alto impacto",
      "P\xE9-direito duplo",
      "Planta livre adapt\xE1vel",
      "Frente para avenida de fluxo",
      "Sem vaga privativa (estacionamento frontal rotativo)"
    ],
    images: [
      "/src/assets/images/commercial_retail_sp_1795781791892.jpg",
      "/src/assets/images/region_sao_paulo_avenue_1795781792260.jpg"
    ],
    videoUrl: "",
    virtualTourMode: "panoramic_360",
    virtualTourData: {
      panoramicSceneTitle: "Fachada Comercial e Sal\xE3o Principal \u2014 Vila Liviero",
      panoramicHighlights: [
        "Vitrine dupla voltada para cal\xE7ada larga de alto fluxo",
        "Acabamento em travertino e concreto aparente",
        "Conex\xE3o r\xE1pida com Terminal Sacom\xE3 e Via Anchieta"
      ],
      chapters: [
        {
          id: "ch-c1",
          title: "Fachada de Rua e Vitrine",
          narration: "Presen\xE7a arquitet\xF4nica marcante com dupla altura em vidro e excelente exposi\xE7\xE3o para sua marca.",
          cameraHint: "Enquadramento frontal amplo da fachada",
          imageIndex: 0,
          durationSec: 5
        }
      ],
      hotspots: [
        {
          id: "hs-c1",
          x: 42,
          y: 48,
          title: "Vitrine P\xE9-Direito Duplo",
          description: "M\xE1xima visibilidade externa e entrada abundante de luz natural.",
          roomLabel: "Fachada",
          imageIndex: 0
        }
      ]
    },
    featured: true,
    published: true,
    status: "disponivel",
    ownerId: "system-seed",
    createdAt: nowIso,
    updatedAt: nowIso
  },
  {
    id: "prop-jardim-sao-saverio-lazer",
    tenantId: DEFAULT_TENANT_ID,
    slug: "apartamento-lazer-completo-jardim-sao-saverio",
    title: "Apartamento com Lazer Completo no Jardim S\xE3o Sav\xE9rio",
    subtitle: "Unidade espa\xE7osa e silenciosa em rua arborizada com acesso r\xE1pido ao Sacom\xE3",
    description: "Apartamento residencial em condom\xEDnio clube no Jardim S\xE3o Sav\xE9rio, unindo tranquilidade de bairro residencial e infraestrutura completa de lazer e seguran\xE7a. Op\xE7\xE3o vers\xE1til para fam\xEDlias que buscam metragem confort\xE1vel, planta inteligente e mobilidade na Zona Sul.",
    transactionType: "aluguel",
    propertyType: "apartamento",
    neighborhood: "Jardim S\xE3o Sav\xE9rio",
    city: "S\xE3o Paulo",
    regionHighlight: "Regi\xE3o Jardim S\xE3o Sav\xE9rio \xB7 Acesso Sacom\xE3",
    salePrice: 0,
    rentPrice: 2950,
    condoFee: 580,
    iptuFee: 110,
    areaSqm: 64,
    bedrooms: 2,
    bathrooms: 1,
    suites: 0,
    parkingSpaces: 0,
    furnished: false,
    fullLeisure: true,
    features: [
      "Condom\xEDnio com lazer completo",
      "Rua residencial arborizada",
      "Sem vaga de garagem (loca\xE7\xE3o otimizada)",
      "Portaria e seguran\xE7a 24h",
      "F\xE1cil acesso ao Terminal Sacom\xE3"
    ],
    images: [
      "/src/assets/images/region_sao_paulo_avenue_1795781792260.jpg",
      "/src/assets/images/apt_ipiranga_living_1795781790107.jpg"
    ],
    videoUrl: "",
    virtualTourMode: "panoramic_360",
    featured: false,
    published: true,
    status: "disponivel",
    ownerId: "system-seed",
    createdAt: nowIso,
    updatedAt: nowIso
  }
];
var DEFAULT_DEVELOPMENTS = [
  {
    id: "dev-ipiranga-boulevard",
    tenantId: DEFAULT_TENANT_ID,
    slug: "residencial-eixo-ipiranga",
    name: "Residencial Eixo Ipiranga",
    neighborhood: "Ipiranga",
    city: "S\xE3o Paulo",
    stage: "pronto",
    summary: "Empreendimento residencial pronto para morar com lazer completo, \xE1reas comuns equipadas e mobilidade estrat\xE9gica pr\xF3ximo ao Metr\xF4 Alto do Ipiranga.",
    coverImage: "/src/assets/images/hero_sp_architecture_1795781789685.jpg",
    amenities: [
      "Piscina adulto e infantil",
      "Sal\xE3o de festas gourmet",
      "Academia equipada",
      "Brinquedoteca",
      "Portaria 24 horas"
    ],
    published: true,
    ownerId: "system-seed",
    createdAt: nowIso,
    updatedAt: nowIso
  }
];
var DEFAULT_LANDING_PAGES = [
  {
    id: "lp-ipiranga-oportunidades",
    tenantId: DEFAULT_TENANT_ID,
    slug: "oportunidades-ipiranga-alto-do-ipiranga",
    title: "Apartamentos no Ipiranga e Alto do Ipiranga",
    headline: "Viva ou invista pr\xF3ximo ao Metr\xF4 Alto do Ipiranga",
    subheadline: "Sele\xE7\xE3o atualizada de apartamentos residenciais, unidades mobiliadas e op\xE7\xF5es com lazer completo para venda e loca\xE7\xE3o.",
    heroImage: "/src/assets/images/apt_ipiranga_living_1795781790107.jpg",
    ctaLabel: "Solicitar sele\xE7\xE3o personalizada",
    targetRegion: "Ipiranga",
    propertyFilterType: "apartamento",
    bodyText: "A regi\xE3o do Ipiranga e Alto do Ipiranga re\xFAne infraestrutura consolidada, mobilidade sobre trilhos, parques e alta liquidez tanto para moradia quanto para loca\xE7\xE3o residencial. Fale com a A D S Im\xF3veis (CRECI 226079-F) para conhecer unidades dispon\xEDveis conforme seu perfil.",
    published: true,
    ownerId: "system-seed",
    createdAt: nowIso,
    updatedAt: nowIso
  },
  {
    id: "lp-comercial-sacoma-liviero",
    tenantId: DEFAULT_TENANT_ID,
    slug: "imoveis-comerciais-sacoma-vila-liviero",
    title: "Lojas e Im\xF3veis Comerciais no Sacom\xE3 e Vila Liviero",
    headline: "Pontos comerciais estrat\xE9gicos na Zona Sul de S\xE3o Paulo",
    subheadline: "Lojas de rua e espa\xE7os corporativos pr\xF3ximos ao Terminal Sacom\xE3 e Vila Liviero para venda ou loca\xE7\xE3o.",
    heroImage: "/src/assets/images/commercial_retail_sp_1795781791892.jpg",
    ctaLabel: "Consultar pontos comerciais",
    targetRegion: "Vila Liviero",
    propertyFilterType: "comercial",
    bodyText: "Com fluxo cont\xEDnuo de consumidores e conex\xE3o r\xE1pida \xE0 Via Anchieta e Terminal Sacom\xE3, a Vila Liviero e o entorno do Sacom\xE3 oferecem excelente custo-benef\xEDcio para implanta\xE7\xE3o de lojas, cl\xEDnicas e escrit\xF3rios.",
    published: true,
    ownerId: "system-seed",
    createdAt: nowIso,
    updatedAt: nowIso
  }
];

// server/store.ts
import fs from "node:fs";
import path from "node:path";
var DEFAULT_SCRYPT_SALT = "ads_imoveis_sp_226079";
var DEFAULT_SCRYPT_HASH = "3ad89ce1240b6ffdf2baac729f256423a96106f7d8d7506c044f218462f5cc642242c8086b2697d002f364c751c98fbefb9d0908199e3da8661f508050a58619";
function createInitialState() {
  return {
    tenants: {
      [DEFAULT_TENANT_ID]: DEFAULT_TENANT_CONFIG
    },
    properties: DEFAULT_PROPERTIES,
    developments: DEFAULT_DEVELOPMENTS,
    landingPages: DEFAULT_LANDING_PAGES,
    leads: [],
    adminPasswordHash: {
      salt: DEFAULT_SCRYPT_SALT,
      hashHex: DEFAULT_SCRYPT_HASH
    }
  };
}
function resolveStoreFilePath() {
  const localDir = path.resolve(process.cwd(), ".data");
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const testPath = path.join(localDir, ".write-check");
    fs.writeFileSync(testPath, "ok", "utf-8");
    fs.unlinkSync(testPath);
    return path.join(localDir, "store.json");
  } catch {
    try {
      const tmpDir = "/tmp/ads-imoveis-data";
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      return path.join(tmpDir, "store.json");
    } catch {
      return null;
    }
  }
}
var memoryStore = null;
var storeFilePath = void 0;
function getStore() {
  if (memoryStore) return memoryStore;
  if (storeFilePath === void 0) {
    storeFilePath = resolveStoreFilePath();
  }
  try {
    if (storeFilePath && fs.existsSync(storeFilePath)) {
      const raw = fs.readFileSync(storeFilePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (!parsed.tenants || !parsed.tenants[DEFAULT_TENANT_ID]) {
        parsed.tenants = {
          ...parsed.tenants || {},
          [DEFAULT_TENANT_ID]: DEFAULT_TENANT_CONFIG
        };
      } else {
        const storedTenant = parsed.tenants[DEFAULT_TENANT_ID];
        parsed.tenants[DEFAULT_TENANT_ID] = {
          ...DEFAULT_TENANT_CONFIG,
          ...storedTenant,
          logoUrl: storedTenant.logoUrl || DEFAULT_TENANT_CONFIG.logoUrl,
          faviconUrl: storedTenant.faviconUrl || DEFAULT_TENANT_CONFIG.faviconUrl
        };
      }
      if (!parsed.adminPasswordHash) {
        parsed.adminPasswordHash = {
          salt: DEFAULT_SCRYPT_SALT,
          hashHex: DEFAULT_SCRYPT_HASH
        };
      }
      memoryStore = parsed;
      return memoryStore;
    }
  } catch {
  }
  memoryStore = createInitialState();
  saveStore(memoryStore);
  return memoryStore;
}
function saveStore(next) {
  memoryStore = next;
  if (storeFilePath === void 0) {
    storeFilePath = resolveStoreFilePath();
  }
  if (!storeFilePath) return;
  try {
    fs.writeFileSync(storeFilePath, JSON.stringify(next, null, 2), "utf-8");
  } catch {
  }
}

// server/shared.ts
import crypto from "node:crypto";
import fs2 from "node:fs";
import path2 from "node:path";

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "gen-lang-client-0246841778",
  appId: "1:632743494309:web:8123dc490f2fca5057c34c",
  apiKey: "AIzaSyAWkfCvmzy1ANRknzXa88T-jrxDMJgholU",
  authDomain: "gen-lang-client-0246841778.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-b2baf16f-632f-4e72-8bc5-ea8507631126",
  storageBucket: "gen-lang-client-0246841778.firebasestorage.app",
  messagingSenderId: "632743494309",
  measurementId: "",
  oAuthClientId: "632743494309-km7l6ue5njggru02ippq40dgugv8d1kn.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// server/shared.ts
var SESSION_SECRET = process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16 ? process.env.SESSION_SECRET.trim() : crypto.createHash("sha256").update(
  [
    firebase_applet_config_default.projectId,
    firebase_applet_config_default.firestoreDatabaseId,
    firebase_applet_config_default.appId,
    process.env.ADMIN_EMAIL || "admin@x.com"
  ].join(":")
).digest("hex");
var VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
function isValidId(id) {
  return typeof id === "string" && VALID_ID_REGEX.test(id);
}
function sanitizeUrl(url) {
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/src/assets/") || trimmed.startsWith("/uploads/") || trimmed.startsWith("https://") || trimmed.startsWith("http://") || trimmed.startsWith("data:image/") || trimmed.startsWith("data:video/")) {
    return trimmed;
  }
  return "";
}
function getUploadDir() {
  const dir = path2.resolve(process.cwd(), ".uploads");
  try {
    if (!fs2.existsSync(dir)) {
      fs2.mkdirSync(dir, { recursive: true });
    }
    const check = path2.join(dir, ".write-check");
    fs2.writeFileSync(check, "ok", "utf-8");
    fs2.unlinkSync(check);
    return dir;
  } catch {
    const tmpDir = "/tmp/ads-imoveis-uploads";
    try {
      if (!fs2.existsSync(tmpDir)) {
        fs2.mkdirSync(tmpDir, { recursive: true });
      }
      return tmpDir;
    } catch {
      return null;
    }
  }
}
function signSessionToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}
function verifySessionToken(token) {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf-8")
    );
    if (!parsed.email || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
function verifyAdminPassword(password) {
  const envPass = process.env.ADMIN_PASSWORD?.trim();
  if (envPass) {
    const a = Buffer.from(password, "utf-8");
    const b = Buffer.from(envPass, "utf-8");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  const store = getStore();
  const creds = store.adminPasswordHash;
  if (!creds) return false;
  const derived = crypto.scryptSync(password, creds.salt, 64);
  const stored = Buffer.from(creds.hashHex, "hex");
  return derived.length === stored.length && crypto.timingSafeEqual(derived, stored);
}
function requireAdminSession(req, res) {
  const rawHeader = req.headers.authorization;
  const authHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    sendJson(res, 401, { error: "Sess\xE3o administrativa n\xE3o autenticada." });
    return null;
  }
  const token = authHeader.slice("Bearer ".length).trim();
  const payload = verifySessionToken(token);
  if (!payload) {
    sendJson(res, 401, { error: "Sess\xE3o administrativa expirada ou inv\xE1lida." });
    return null;
  }
  return payload;
}
function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}
function sendText(res, statusCode, text) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(text);
}
async function readJsonBody(req) {
  if (req.body !== void 0 && req.body !== null) {
    if (typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
      return req.body;
    }
    if (typeof req.body === "string") {
      return req.body ? JSON.parse(req.body) : {};
    }
    if (Buffer.isBuffer(req.body)) {
      const str = req.body.toString("utf-8");
      return str ? JSON.parse(str) : {};
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    const maxBytes = 15 * 1024 * 1024;
    req.on("data", (chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;
      if (totalBytes > maxBytes) {
        reject(new Error("Corpo da requisi\xE7\xE3o excede o limite permitido."));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      const raw = Buffer.concat(chunks).toString("utf-8").trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("JSON inv\xE1lido na requisi\xE7\xE3o."));
      }
    });
    req.on("error", (err) => reject(err));
  });
}
function getMimeType(filename) {
  const ext = path2.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mp4") return "video/mp4";
  return "image/jpeg";
}
function resolveRequestRoute(req) {
  const rawUrl = req.url || "/";
  const parsedUrl = new URL(rawUrl, "http://localhost");
  const routeOverride = parsedUrl.searchParams.get("__route");
  const pathname = routeOverride && (routeOverride.startsWith("/api/") || routeOverride.startsWith("/uploads/")) ? routeOverride.split("?")[0] : parsedUrl.pathname;
  const method = (req.method || "GET").toUpperCase();
  return { parsedUrl, pathname, method };
}

// server/coreHandler.ts
async function handleCoreApiRequest(req, res) {
  const { parsedUrl, pathname, method } = resolveRequestRoute(req);
  if (!pathname.startsWith("/api/") && !pathname.startsWith("/uploads/")) {
    return false;
  }
  if (method === "GET" && pathname.startsWith("/uploads/")) {
    const filename = decodeURIComponent(pathname.slice("/uploads/".length));
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      sendText(res, 400, "Invalid filename");
      return true;
    }
    const uploadDir = getUploadDir();
    if (!uploadDir) {
      sendText(res, 404, "Not found");
      return true;
    }
    const resolved = path3.resolve(uploadDir, filename);
    if (!resolved.startsWith(uploadDir + path3.sep) || !fs3.existsSync(resolved)) {
      sendText(res, 404, "Not found");
      return true;
    }
    const buf = fs3.readFileSync(resolved);
    res.statusCode = 200;
    res.setHeader("Content-Type", getMimeType(filename));
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end(buf);
    return true;
  }
  if (method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY)
    });
    return true;
  }
  if (method === "POST" && pathname === "/api/admin/login") {
    const body = await readJsonBody(req);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const expectedEmail = (process.env.ADMIN_EMAIL || "admin@x.com").trim().toLowerCase();
    if (!email || !password) {
      sendJson(res, 400, { error: "Informe e-mail e senha." });
      return true;
    }
    if (email !== expectedEmail || !verifyAdminPassword(password)) {
      sendJson(res, 401, { error: "Credenciais inv\xE1lidas para o painel administrativo." });
      return true;
    }
    const token = signSessionToken({
      email,
      role: "admin",
      tenantId: DEFAULT_TENANT_ID,
      exp: Date.now() + 1e3 * 60 * 60 * 24 * 7
    });
    sendJson(res, 200, {
      token,
      user: {
        email,
        role: "admin",
        tenantId: DEFAULT_TENANT_ID
      }
    });
    return true;
  }
  if (method === "GET" && pathname === "/api/admin/session") {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    sendJson(res, 200, {
      authenticated: true,
      user: session
    });
    return true;
  }
  if (method === "POST" && pathname === "/api/admin/password") {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const body = await readJsonBody(req);
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    if (!verifyAdminPassword(currentPassword)) {
      sendJson(res, 403, { error: "Senha atual incorreta." });
      return true;
    }
    if (newPassword.length < 6 || newPassword.length > 128) {
      sendJson(res, 400, { error: "A nova senha deve ter entre 6 e 128 caracteres." });
      return true;
    }
    const salt = crypto2.randomBytes(16).toString("hex");
    const hashHex = crypto2.scryptSync(newPassword, salt, 64).toString("hex");
    const store = getStore();
    store.adminPasswordHash = { salt, hashHex };
    saveStore(store);
    sendJson(res, 200, { ok: true });
    return true;
  }
  if (method === "GET" && pathname === "/api/store/bootstrap") {
    const qTid = parsedUrl.searchParams.get("tenantId");
    const tenantId = isValidId(qTid) ? qTid : DEFAULT_TENANT_ID;
    const store = getStore();
    const tenant = store.tenants[tenantId] || store.tenants[DEFAULT_TENANT_ID] || DEFAULT_TENANT_CONFIG;
    const activeTenantId = tenant.tenantId;
    sendJson(res, 200, {
      tenant,
      tenants: Object.values(store.tenants),
      properties: store.properties.filter(
        (p) => p.tenantId === activeTenantId && p.published
      ),
      developments: store.developments.filter(
        (d) => d.tenantId === activeTenantId && d.published
      ),
      landingPages: store.landingPages.filter(
        (l) => l.tenantId === activeTenantId && l.published
      )
    });
    return true;
  }
  if (method === "POST" && pathname === "/api/store/leads") {
    const body = await readJsonBody(req);
    const tenantId = isValidId(body.tenantId) ? body.tenantId : DEFAULT_TENANT_ID;
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : "";
    const email = typeof body.email === "string" ? body.email.trim().slice(0, 140) : "";
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 2e3) : "";
    const lgpdConsent = body.lgpdConsent === true;
    if (!lgpdConsent) {
      sendJson(res, 400, {
        error: "\xC9 necess\xE1rio concordar com a pol\xEDtica de privacidade (LGPD)."
      });
      return true;
    }
    if (name.length < 2 || phone.length < 8) {
      sendJson(res, 400, {
        error: "Informe nome completo e telefone/WhatsApp v\xE1lido."
      });
      return true;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const lead = {
      id: `lead_${Date.now()}_${crypto2.randomBytes(3).toString("hex")}`,
      tenantId,
      name,
      email,
      phone,
      message,
      interestType: [
        "venda",
        "aluguel",
        "avaliacao",
        "visita",
        "comercial"
      ].includes(String(body.interestType)) ? body.interestType : "visita",
      propertyId: typeof body.propertyId === "string" ? body.propertyId.slice(0, 128) : "",
      propertyTitle: typeof body.propertyTitle === "string" ? body.propertyTitle.slice(0, 180) : "",
      sourcePage: typeof body.sourcePage === "string" ? body.sourcePage.slice(0, 160) : "/",
      status: "novo",
      lgpdConsent: true,
      createdAt: now,
      updatedAt: now
    };
    const store = getStore();
    store.leads.unshift(lead);
    saveStore(store);
    sendJson(res, 201, { lead });
    return true;
  }
  if (method === "GET" && pathname === "/api/store/admin/all") {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const qTid = parsedUrl.searchParams.get("tenantId");
    const tenantId = isValidId(qTid) ? qTid : DEFAULT_TENANT_ID;
    const store = getStore();
    const tenant = store.tenants[tenantId] || store.tenants[DEFAULT_TENANT_ID];
    sendJson(res, 200, {
      tenant,
      tenants: Object.values(store.tenants),
      properties: store.properties.filter((p) => p.tenantId === tenant.tenantId),
      developments: store.developments.filter(
        (d) => d.tenantId === tenant.tenantId
      ),
      landingPages: store.landingPages.filter(
        (l) => l.tenantId === tenant.tenantId
      ),
      leads: store.leads.filter((l) => l.tenantId === tenant.tenantId)
    });
    return true;
  }
  if (method === "PUT" && pathname === "/api/store/admin/tenant") {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const body = await readJsonBody(req);
    const tenantId = isValidId(body?.tenantId) ? body.tenantId : DEFAULT_TENANT_ID;
    const store = getStore();
    const existing = store.tenants[tenantId] || {
      ...DEFAULT_TENANT_CONFIG,
      tenantId
    };
    const updated = {
      ...existing,
      ...body,
      tenantId,
      logoUrl: body?.logoUrl !== void 0 ? sanitizeUrl(body.logoUrl) : existing.logoUrl,
      faviconUrl: body?.faviconUrl !== void 0 ? sanitizeUrl(body.faviconUrl) : existing.faviconUrl,
      assistantAvatarUrl: body?.assistantAvatarUrl !== void 0 ? sanitizeUrl(body.assistantAvatarUrl) : existing.assistantAvatarUrl,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    store.tenants[tenantId] = updated;
    saveStore(store);
    sendJson(res, 200, { tenant: updated });
    return true;
  }
  if (method === "POST" && pathname === "/api/store/admin/tenants") {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const body = await readJsonBody(req);
    if (!isValidId(body?.tenantId) || !body.companyName) {
      sendJson(res, 400, {
        error: "ID do tenant e nome comercial s\xE3o obrigat\xF3rios."
      });
      return true;
    }
    const store = getStore();
    const created = {
      ...DEFAULT_TENANT_CONFIG,
      ...body,
      tenantId: body.tenantId,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    store.tenants[created.tenantId] = created;
    saveStore(store);
    sendJson(res, 201, { tenant: created });
    return true;
  }
  if (method === "POST" && pathname === "/api/store/admin/properties") {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const body = await readJsonBody(req);
    const tenantId = isValidId(body?.tenantId) ? body.tenantId : DEFAULT_TENANT_ID;
    if (!body?.title || body.title.trim().length < 3) {
      sendJson(res, 400, { error: "T\xEDtulo do im\xF3vel \xE9 obrigat\xF3rio." });
      return true;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const id = isValidId(body.id) ? body.id : `prop_${Date.now()}_${crypto2.randomBytes(2).toString("hex")}`;
    const slugBase = (body.slug || body.title).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
    const property = {
      id,
      tenantId,
      slug: slugBase || id,
      title: body.title.trim().slice(0, 160),
      subtitle: (body.subtitle || "").slice(0, 240),
      description: (body.description || "").slice(0, 6e3),
      transactionType: body.transactionType || "venda",
      propertyType: body.propertyType || "apartamento",
      neighborhood: (body.neighborhood || "Ipiranga").slice(0, 100),
      city: (body.city || "S\xE3o Paulo").slice(0, 80),
      regionHighlight: (body.regionHighlight || "").slice(0, 160),
      salePrice: Number(body.salePrice) || 0,
      rentPrice: Number(body.rentPrice) || 0,
      condoFee: Number(body.condoFee) || 0,
      iptuFee: Number(body.iptuFee) || 0,
      areaSqm: Number(body.areaSqm) || 0,
      bedrooms: Number(body.bedrooms) || 0,
      bathrooms: Number(body.bathrooms) || 0,
      suites: Number(body.suites) || 0,
      parkingSpaces: Number(body.parkingSpaces) || 0,
      furnished: Boolean(body.furnished),
      fullLeisure: Boolean(body.fullLeisure),
      features: Array.isArray(body.features) ? body.features.slice(0, 30) : [],
      images: Array.isArray(body.images) ? body.images.map(sanitizeUrl).filter(Boolean).slice(0, 20) : [],
      videoUrl: sanitizeUrl(body.videoUrl),
      virtualTourMode: body.virtualTourMode || "panoramic_360",
      virtualTourData: body.virtualTourData,
      aiAnalysis: body.aiAnalysis,
      featured: Boolean(body.featured),
      published: body.published !== false,
      status: body.status || "disponivel",
      ownerId: session.email || "admin",
      createdAt: body.createdAt || now,
      updatedAt: now
    };
    const store = getStore();
    const idx = store.properties.findIndex((p) => p.id === property.id);
    if (idx >= 0) {
      store.properties[idx] = {
        ...store.properties[idx],
        ...property,
        createdAt: store.properties[idx].createdAt,
        updatedAt: now
      };
    } else {
      store.properties.unshift(property);
    }
    saveStore(store);
    sendJson(res, 200, { property });
    return true;
  }
  if (method === "DELETE" && pathname.startsWith("/api/store/admin/properties/")) {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const id = decodeURIComponent(
      pathname.slice("/api/store/admin/properties/".length)
    );
    const store = getStore();
    store.properties = store.properties.filter((p) => p.id !== id);
    saveStore(store);
    sendJson(res, 200, { ok: true });
    return true;
  }
  if (method === "POST" && pathname === "/api/store/admin/developments") {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const body = await readJsonBody(req);
    const tenantId = isValidId(body?.tenantId) ? body.tenantId : DEFAULT_TENANT_ID;
    if (!body?.name) {
      sendJson(res, 400, { error: "Nome do empreendimento \xE9 obrigat\xF3rio." });
      return true;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const id = isValidId(body.id) ? body.id : `dev_${Date.now()}`;
    const dev = {
      id,
      tenantId,
      slug: (body.slug || id).replace(/[^a-zA-Z0-9_-]/g, "-"),
      name: body.name.trim().slice(0, 160),
      neighborhood: (body.neighborhood || "Ipiranga").slice(0, 100),
      city: (body.city || "S\xE3o Paulo").slice(0, 80),
      stage: body.stage || "pronto",
      summary: (body.summary || "").slice(0, 2e3),
      coverImage: sanitizeUrl(body.coverImage),
      amenities: Array.isArray(body.amenities) ? body.amenities.slice(0, 25) : [],
      published: body.published !== false,
      ownerId: session.email || "admin",
      createdAt: body.createdAt || now,
      updatedAt: now
    };
    const store = getStore();
    const idx = store.developments.findIndex((d) => d.id === dev.id);
    if (idx >= 0) store.developments[idx] = dev;
    else store.developments.unshift(dev);
    saveStore(store);
    sendJson(res, 200, { development: dev });
    return true;
  }
  if (method === "DELETE" && pathname.startsWith("/api/store/admin/developments/")) {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const id = decodeURIComponent(
      pathname.slice("/api/store/admin/developments/".length)
    );
    const store = getStore();
    store.developments = store.developments.filter((d) => d.id !== id);
    saveStore(store);
    sendJson(res, 200, { ok: true });
    return true;
  }
  if (method === "POST" && pathname === "/api/store/admin/landing-pages") {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const body = await readJsonBody(req);
    const tenantId = isValidId(body?.tenantId) ? body.tenantId : DEFAULT_TENANT_ID;
    if (!body?.title || !body?.headline) {
      sendJson(res, 400, { error: "T\xEDtulo e manchete s\xE3o obrigat\xF3rios." });
      return true;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const id = isValidId(body.id) ? body.id : `lp_${Date.now()}`;
    const lp = {
      id,
      tenantId,
      slug: (body.slug || body.title).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100),
      title: body.title.trim().slice(0, 160),
      headline: body.headline.trim().slice(0, 220),
      subheadline: (body.subheadline || "").slice(0, 400),
      heroImage: sanitizeUrl(body.heroImage),
      ctaLabel: (body.ctaLabel || "Falar com a Corretora").slice(0, 80),
      targetRegion: (body.targetRegion || "S\xE3o Paulo").slice(0, 100),
      propertyFilterType: (body.propertyFilterType || "").slice(0, 60),
      bodyText: (body.bodyText || "").slice(0, 5e3),
      published: body.published !== false,
      ownerId: session.email || "admin",
      createdAt: body.createdAt || now,
      updatedAt: now
    };
    const store = getStore();
    const idx = store.landingPages.findIndex((l) => l.id === lp.id);
    if (idx >= 0) store.landingPages[idx] = lp;
    else store.landingPages.unshift(lp);
    saveStore(store);
    sendJson(res, 200, { landingPage: lp });
    return true;
  }
  if (method === "DELETE" && pathname.startsWith("/api/store/admin/landing-pages/")) {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const id = decodeURIComponent(
      pathname.slice("/api/store/admin/landing-pages/".length)
    );
    const store = getStore();
    store.landingPages = store.landingPages.filter((l) => l.id !== id);
    saveStore(store);
    sendJson(res, 200, { ok: true });
    return true;
  }
  if (method === "PATCH" && pathname.startsWith("/api/store/admin/leads/")) {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const id = decodeURIComponent(
      pathname.slice("/api/store/admin/leads/".length)
    );
    const body = await readJsonBody(req);
    const store = getStore();
    const lead = store.leads.find((l) => l.id === id);
    if (!lead) {
      sendJson(res, 404, { error: "Lead n\xE3o encontrado." });
      return true;
    }
    if ([
      "novo",
      "em_atendimento",
      "agendado",
      "convertido",
      "arquivado"
    ].includes(String(body.status))) {
      lead.status = body.status;
    }
    lead.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    saveStore(store);
    sendJson(res, 200, { lead });
    return true;
  }
  if (method === "DELETE" && pathname.startsWith("/api/store/admin/leads/")) {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    const id = decodeURIComponent(
      pathname.slice("/api/store/admin/leads/".length)
    );
    const store = getStore();
    store.leads = store.leads.filter((l) => l.id !== id);
    saveStore(store);
    sendJson(res, 200, { ok: true });
    return true;
  }
  return false;
}

// server/aiHandler.ts
import fs4 from "node:fs";
import path4 from "node:path";
async function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY n\xE3o configurada no ambiente do servidor.");
  }
  const { GoogleGenAI, Type } = await import("@google/genai");
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
  return { ai, Type };
}
function extractGeminiErrorMessage(err, fallback) {
  const raw = err instanceof Error ? err.message : fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.message) {
      if (parsed.error.code === 503) {
        return "O servi\xE7o de intelig\xEAncia artificial est\xE1 temporariamente sobrecarregado. Tente novamente em instantes.";
      }
      return parsed.error.message;
    }
  } catch {
  }
  return raw || fallback;
}
function isTransientGeminiError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand") || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");
}
async function generateContentResilient(ai, params) {
  const models = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];
  let lastError;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({
          ...params,
          model
        });
      } catch (err) {
        lastError = err;
        if (!isTransientGeminiError(err)) {
          throw err;
        }
        await new Promise((r) => setTimeout(r, 450 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}
async function resolveImageAsInlinePart(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("data:image/")) {
    const match = imageUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (match) {
      return {
        inlineData: {
          mimeType: match[1],
          data: match[2]
        }
      };
    }
  }
  if (imageUrl.startsWith("/src/assets/")) {
    const resolved = path4.resolve(process.cwd(), imageUrl.slice(1));
    const baseDir = path4.resolve(process.cwd(), "src", "assets");
    if (resolved.startsWith(baseDir + path4.sep) && fs4.existsSync(resolved)) {
      const buf = fs4.readFileSync(resolved);
      const ext = path4.extname(resolved).toLowerCase();
      const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
      return {
        inlineData: {
          mimeType,
          data: buf.toString("base64")
        }
      };
    }
  }
  if (imageUrl.startsWith("/uploads/")) {
    const filename = path4.basename(imageUrl);
    const uploadDir = getUploadDir();
    if (uploadDir) {
      const resolved = path4.resolve(uploadDir, filename);
      if (resolved.startsWith(uploadDir + path4.sep) && fs4.existsSync(resolved)) {
        const buf = fs4.readFileSync(resolved);
        const ext = path4.extname(resolved).toLowerCase();
        const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
        return {
          inlineData: {
            mimeType,
            data: buf.toString("base64")
          }
        };
      }
    }
  }
  if (imageUrl.startsWith("https://")) {
    const parsed = new URL(imageUrl);
    if (parsed.hostname.endsWith(".public.blob.vercel-storage.com") || parsed.hostname.endsWith(".vercel-storage.com")) {
      const resp = await fetch(imageUrl);
      if (resp.ok) {
        const arrayBuf = await resp.arrayBuffer();
        const mimeType = resp.headers.get("content-type") || "image/jpeg";
        return {
          inlineData: {
            mimeType,
            data: Buffer.from(arrayBuf).toString("base64")
          }
        };
      }
    }
  }
  return null;
}
async function handleAiApiRequest(req, res) {
  const { pathname, method } = resolveRequestRoute(req);
  if (!pathname.startsWith("/api/")) {
    return false;
  }
  if (method === "POST" && pathname === "/api/blob/upload") {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    try {
      const body = await readJsonBody(req);
      const filenameRaw = typeof body.filename === "string" ? body.filename : "media.jpg";
      const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";
      const match = dataUrl.match(
        /^data:((?:image|video)\/[a-zA-Z0-9+.-]+);base64,(.+)$/
      );
      if (!match) {
        sendJson(res, 400, {
          error: "Formato de m\xEDdia inv\xE1lido. Envie imagem ou v\xEDdeo em base64."
        });
        return true;
      }
      const mimeType = match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, "base64");
      if (buffer.length > 10 * 1024 * 1024) {
        sendJson(res, 400, { error: "Arquivo excede o limite de 10 MB." });
        return true;
      }
      const safeBase = filenameRaw.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60) || "asset";
      const uniqueName = `${Date.now()}_${safeBase}`;
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const { put } = await import("@vercel/blob");
        const blob = await put(`ads-imoveis/${uniqueName}`, buffer, {
          access: "public",
          contentType: mimeType,
          token: process.env.BLOB_READ_WRITE_TOKEN
        });
        sendJson(res, 200, { url: blob.url, provider: "vercel-blob" });
        return true;
      }
      const uploadDir = getUploadDir();
      if (uploadDir) {
        const target = path4.resolve(uploadDir, uniqueName);
        if (target.startsWith(uploadDir + path4.sep)) {
          fs4.writeFileSync(target, buffer);
          sendJson(res, 200, {
            url: `/uploads/${uniqueName}`,
            provider: "local-storage"
          });
          return true;
        }
      }
      sendJson(res, 200, { url: dataUrl, provider: "inline-fallback" });
      return true;
    } catch (err) {
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : "Erro ao enviar m\xEDdia."
      });
      return true;
    }
  }
  if (method === "POST" && pathname === "/api/ai/analyze-photo") {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    try {
      const body = await readJsonBody(req);
      const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : "";
      const propertyContext = typeof body.context === "string" ? body.context : "Im\xF3vel em S\xE3o Paulo";
      const imagePart = await resolveImageAsInlinePart(imageUrl);
      if (!imagePart) {
        sendJson(res, 400, {
          error: "Imagem n\xE3o encontrada ou formato n\xE3o suportado para an\xE1lise."
        });
        return true;
      }
      const { ai, Type } = await getGenAIClient();
      const response = await generateContentResilient(ai, {
        contents: {
          parts: [
            imagePart,
            {
              text: `Voc\xEA \xE9 um diretor de fotografia arquitet\xF4nica e consultor da corretora A D S Im\xF3veis (CRECI 226079-F, S\xE3o Paulo). Analise esta foto do im\xF3vel (${propertyContext}) e retorne diagn\xF3stico t\xE9cnico, recomenda\xE7\xF5es de staging/enquadramento e par\xE2metros ideais de melhoria visual (brightness entre 0.95 e 1.18, contrast entre 1.0 e 1.22, saturate entre 0.95 e 1.2, warmth entre -10 e 15, sharpness entre 0 e 1).`
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              qualityScore: { type: Type.INTEGER },
              roomType: { type: Type.STRING },
              lightingNotes: { type: Type.STRING },
              stagingRecommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              recommendedPreset: { type: Type.STRING },
              enhancementParams: {
                type: Type.OBJECT,
                properties: {
                  brightness: { type: Type.NUMBER },
                  contrast: { type: Type.NUMBER },
                  saturate: { type: Type.NUMBER },
                  warmth: { type: Type.NUMBER },
                  sharpness: { type: Type.NUMBER }
                }
              }
            }
          }
        }
      });
      const parsed = JSON.parse((response.text ?? "{}").trim());
      sendJson(res, 200, parsed);
      return true;
    } catch (err) {
      sendJson(res, 500, {
        error: extractGeminiErrorMessage(
          err,
          "Erro ao analisar foto com Gemini AI."
        )
      });
      return true;
    }
  }
  if (method === "POST" && pathname === "/api/ai/cinematic-director") {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    try {
      const body = await readJsonBody(req);
      const property = body.property;
      if (!property?.title) {
        sendJson(res, 400, { error: "Dados do im\xF3vel s\xE3o obrigat\xF3rios." });
        return true;
      }
      const { ai, Type } = await getGenAIClient();
      const response = await generateContentResilient(ai, {
        contents: `Crie um roteiro cinematogr\xE1fico de apresenta\xE7\xE3o imobili\xE1ria para a A D S Im\xF3veis e Intermedia\xE7\xF5es de Neg\xF3cios (CRECI 226079-F, S\xE3o Paulo).
Im\xF3vel: ${property.title}
Bairro: ${property.neighborhood}, S\xE3o Paulo (${property.regionHighlight || ""})
Tipo: ${property.propertyType} | Transa\xE7\xE3o: ${property.transactionType}
\xC1rea: ${property.areaSqm} m\xB2 | Quartos: ${property.bedrooms} | Vagas: ${property.parkingSpaces} | Mobiliado: ${property.furnished ? "Sim" : "N\xE3o"}
Diferenciais: ${(property.features || []).join(", ")}
Quantidade de fotos dispon\xEDveis: ${(property.images || []).length || 2}
Gere um t\xEDtulo de v\xEDdeo, gancho inicial, clima musical e de 3 a 4 cenas curtas com legenda na tela (m\xE1x 7 palavras), locu\xE7\xE3o comercial realista e dire\xE7\xE3o de movimento de c\xE2mera ('zoom-in', 'pan-left', 'pan-right', 'zoom-out').`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              hook: { type: Type.STRING },
              musicMood: { type: Type.STRING },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sceneNumber: { type: Type.INTEGER },
                    caption: { type: Type.STRING },
                    voiceover: { type: Type.STRING },
                    motion: { type: Type.STRING },
                    durationSec: { type: Type.INTEGER }
                  }
                }
              }
            }
          }
        }
      });
      const parsed = JSON.parse((response.text ?? "{}").trim());
      sendJson(res, 200, parsed);
      return true;
    } catch (err) {
      sendJson(res, 500, {
        error: extractGeminiErrorMessage(
          err,
          "Erro ao gerar roteiro cinematogr\xE1fico."
        )
      });
      return true;
    }
  }
  if (method === "POST" && pathname === "/api/ai/virtual-tour") {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    try {
      const body = await readJsonBody(req);
      const property = body.property;
      if (!property?.title) {
        sendJson(res, 400, { error: "Dados do im\xF3vel s\xE3o obrigat\xF3rios." });
        return true;
      }
      const { ai, Type } = await getGenAIClient();
      const imageParts = [];
      for (const img of (property.images || []).slice(0, 2)) {
        const part = await resolveImageAsInlinePart(img);
        if (part) imageParts.push(part);
      }
      imageParts.push({
        text: `Crie os dados completos de Visita Virtual nas 3 modalidades (Panor\xE2mico 360\xB0, Hist\xF3ria Guiada e Explorador de Hotspots) para o im\xF3vel "${property.title}" em ${property.neighborhood}, S\xE3o Paulo, da A D S Im\xF3veis (CRECI 226079-F).
Posicione de 3 a 4 hotspots com coordenadas percentuais x (15 a 85) e y (20 a 80), roomLabel curto, t\xEDtulo e descri\xE7\xE3o real\xEDstica dos ambientes e localiza\xE7\xE3o em S\xE3o Paulo.`
      });
      const response = await generateContentResilient(ai, {
        contents: { parts: imageParts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              panoramicSceneTitle: { type: Type.STRING },
              panoramicHighlights: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              chapters: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    narration: { type: Type.STRING },
                    cameraHint: { type: Type.STRING },
                    imageIndex: { type: Type.INTEGER },
                    durationSec: { type: Type.INTEGER }
                  }
                }
              },
              hotspots: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    roomLabel: { type: Type.STRING },
                    imageIndex: { type: Type.INTEGER }
                  }
                }
              }
            }
          }
        }
      });
      const parsed = JSON.parse((response.text ?? "{}").trim());
      sendJson(res, 200, parsed);
      return true;
    } catch (err) {
      sendJson(res, 500, {
        error: extractGeminiErrorMessage(err, "Erro ao gerar Visita Virtual.")
      });
      return true;
    }
  }
  if (method === "POST" && pathname === "/api/ai/generate-description") {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    try {
      const body = await readJsonBody(req);
      const property = body.property;
      if (!property?.title) {
        sendJson(res, 400, { error: "Dados do im\xF3vel s\xE3o obrigat\xF3rios." });
        return true;
      }
      const { ai, Type } = await getGenAIClient();
      const response = await generateContentResilient(ai, {
        contents: `Escreva textos comerciais profissionais e sem clich\xEAs exagerados para a A D S Im\xF3veis e Intermedia\xE7\xF5es de Neg\xF3cios (CRECI 226079-F), focada em oportunidades reais de venda e loca\xE7\xE3o em S\xE3o Paulo.
Dados do im\xF3vel:
T\xEDtulo: ${property.title}
Tipo: ${property.propertyType} | Finalidade: ${property.transactionType}
Bairro: ${property.neighborhood} | Refer\xEAncia: ${property.regionHighlight || "S\xE3o Paulo"}
\xC1rea: ${property.areaSqm} m\xB2 | Quartos: ${property.bedrooms} | Su\xEDtes: ${property.suites} | Banheiros: ${property.bathrooms} | Vagas: ${property.parkingSpaces}
Mobiliado: ${property.furnished ? "Sim" : "N\xE3o"} | Lazer Completo: ${property.fullLeisure ? "Sim" : "N\xE3o"}
Diferenciais: ${(property.features || []).join(", ")}

N\xE3o invente telefones, nomes de corretores ou depoimentos. Retorne JSON com subtitle (1 frase), portalDescription (2 a 3 par\xE1grafos refinados), instagramCaption (texto pronto para Instagram com hashtags de S\xE3o Paulo e men\xE7\xE3o ao CRECI 226079-F) e seoKeywords.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subtitle: { type: Type.STRING },
              portalDescription: { type: Type.STRING },
              instagramCaption: { type: Type.STRING },
              seoKeywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            }
          }
        }
      });
      const parsed = JSON.parse((response.text ?? "{}").trim());
      sendJson(res, 200, parsed);
      return true;
    } catch (err) {
      sendJson(res, 500, {
        error: extractGeminiErrorMessage(
          err,
          "Erro ao gerar descri\xE7\xE3o comercial."
        )
      });
      return true;
    }
  }
  if (method === "POST" && pathname === "/api/assistant/chat") {
    const body = await readJsonBody(req);
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : "";
    const tenantId = isValidId(body.tenantId) ? body.tenantId : DEFAULT_TENANT_ID;
    if (!message) {
      sendJson(res, 400, { error: "Digite sua d\xFAvida para continuar." });
      return true;
    }
    const store = getStore();
    const tenant = store.tenants[tenantId] || store.tenants[DEFAULT_TENANT_ID] || DEFAULT_TENANT_CONFIG;
    const assistantName = tenant.assistantName || "Sofia";
    try {
      const { ai } = await getGenAIClient();
      const response = await generateContentResilient(ai, {
        contents: `Pergunta do cliente: "${message}"`,
        config: {
          systemInstruction: `Voc\xEA \xE9 ${assistantName}, assistente virtual da ${tenant.companyName} (${tenant.slogan}, CRECI ${tenant.creci}).
Responda em portugu\xEAs do Brasil de forma objetiva, acolhedora e simples (m\xE1ximo 2 a 3 frases curtas).
Fatos oficiais que voc\xEA conhece:
- Atua\xE7\xE3o: vendas e loca\xE7\xF5es em ${tenant.city}.
- Regi\xF5es principais: ${tenant.regions.join(", ")}.
- Tipos de im\xF3veis: apartamentos residenciais (venda e aluguel), apartamentos mobiliados, lojas e im\xF3veis comerciais, op\xE7\xF5es com ou sem vaga de garagem e condom\xEDnios com lazer completo.
- Nunca invente telefones, endere\xE7os, nomes de corretores ou pre\xE7os espec\xEDficos que n\xE3o foram perguntados.
- Sempre convide o cliente a continuar o atendimento pelas redes sociais oficiais (Instagram ou WhatsApp) usando os bot\xF5es exibidos logo abaixo da sua mensagem.`
        }
      });
      sendJson(res, 200, {
        reply: response.text?.trim() || `Ol\xE1! Aqui \xE9 a ${assistantName}, da ${tenant.companyName}. Posso te ajudar com vendas e loca\xE7\xF5es em S\xE3o Paulo \u2014 clique abaixo para falar conosco no Instagram ou WhatsApp.`
      });
      return true;
    } catch (err) {
      sendJson(res, 503, {
        error: extractGeminiErrorMessage(
          err,
          "Assistente temporariamente indispon\xEDvel."
        )
      });
      return true;
    }
  }
  return false;
}

// server/apiHandler.ts
async function handleApiRequest(req, res) {
  const { pathname } = resolveRequestRoute(req);
  if (!pathname.startsWith("/api/") && !pathname.startsWith("/uploads/")) {
    return false;
  }
  if (await handleCoreApiRequest(req, res)) {
    return true;
  }
  if (await handleAiApiRequest(req, res)) {
    return true;
  }
  sendJson(res, 404, { error: "Endpoint n\xE3o encontrado." });
  return true;
}

// server/vercel-entry.ts
async function handler(req, res) {
  try {
    const handled = await handleApiRequest(req, res);
    if (!handled && !res.headersSent) {
      sendJson(res, 404, { error: "Rota API n\xE3o encontrada." });
    }
  } catch (err) {
    if (!res.headersSent) {
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : "Erro interno no servidor."
      });
    }
  }
}
export {
  handler as default
};
