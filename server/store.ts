import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_DEVELOPMENTS,
  DEFAULT_LANDING_PAGES,
  DEFAULT_PROPERTIES,
  DEFAULT_TENANT_CONFIG,
  DEFAULT_TENANT_ID,
} from '../src/data/defaults';
import type {
  Development,
  LandingPage,
  Lead,
  Property,
  TenantConfig,
} from '../src/types/realEstate';

export interface StoreState {
  tenants: Record<string, TenantConfig>;
  properties: Property[];
  developments: Development[];
  landingPages: LandingPage[];
  leads: Lead[];
  adminPasswordHash?: {
    salt: string;
    hashHex: string;
  };
}

const DEFAULT_SCRYPT_SALT = 'ads_imoveis_sp_226079';
const DEFAULT_SCRYPT_HASH =
  '3ad89ce1240b6ffdf2baac729f256423a96106f7d8d7506c044f218462f5cc642242c8086b2697d002f364c751c98fbefb9d0908199e3da8661f508050a58619';

function createInitialState(): StoreState {
  return {
    tenants: {
      [DEFAULT_TENANT_ID]: DEFAULT_TENANT_CONFIG,
    },
    properties: DEFAULT_PROPERTIES,
    developments: DEFAULT_DEVELOPMENTS,
    landingPages: DEFAULT_LANDING_PAGES,
    leads: [],
    adminPasswordHash: {
      salt: DEFAULT_SCRYPT_SALT,
      hashHex: DEFAULT_SCRYPT_HASH,
    },
  };
}

function resolveStoreFilePath(): string | null {
  const localDir = path.resolve(process.cwd(), '.data');
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const testPath = path.join(localDir, '.write-check');
    fs.writeFileSync(testPath, 'ok', 'utf-8');
    fs.unlinkSync(testPath);
    return path.join(localDir, 'store.json');
  } catch {
    try {
      const tmpDir = '/tmp/ads-imoveis-data';
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      return path.join(tmpDir, 'store.json');
    } catch {
      return null;
    }
  }
}

let memoryStore: StoreState | null = null;
let storeFilePath: string | null | undefined = undefined;

export function getStore(): StoreState {
  if (memoryStore) return memoryStore;
  if (storeFilePath === undefined) {
    storeFilePath = resolveStoreFilePath();
  }
  try {
    if (storeFilePath && fs.existsSync(storeFilePath)) {
      const raw = fs.readFileSync(storeFilePath, 'utf-8');
      const parsed = JSON.parse(raw) as StoreState;
      if (!parsed.tenants || !parsed.tenants[DEFAULT_TENANT_ID]) {
        parsed.tenants = {
          ...(parsed.tenants || {}),
          [DEFAULT_TENANT_ID]: DEFAULT_TENANT_CONFIG,
        };
      } else {
        const storedTenant = parsed.tenants[DEFAULT_TENANT_ID];
        parsed.tenants[DEFAULT_TENANT_ID] = {
          ...DEFAULT_TENANT_CONFIG,
          ...storedTenant,
          logoUrl: storedTenant.logoUrl || DEFAULT_TENANT_CONFIG.logoUrl,
          faviconUrl: storedTenant.faviconUrl || DEFAULT_TENANT_CONFIG.faviconUrl,
        };
      }
      if (!parsed.adminPasswordHash) {
        parsed.adminPasswordHash = {
          salt: DEFAULT_SCRYPT_SALT,
          hashHex: DEFAULT_SCRYPT_HASH,
        };
      }
      memoryStore = parsed;
      return memoryStore;
    }
  } catch {
    // Fall back to fresh initial state
  }
  memoryStore = createInitialState();
  saveStore(memoryStore);
  return memoryStore;
}

export function saveStore(next: StoreState): void {
  memoryStore = next;
  if (storeFilePath === undefined) {
    storeFilePath = resolveStoreFilePath();
  }
  if (!storeFilePath) return;
  try {
    fs.writeFileSync(storeFilePath, JSON.stringify(next, null, 2), 'utf-8');
  } catch {
    // Ephemeral in-memory fallback already updated
  }
}
