import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  Development,
  LandingPage,
  Lead,
  LeadStatus,
  Property,
  TenantConfig,
} from '../types/realEstate';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function toIsoDate(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof val === 'string' && val) return val;
  return new Date().toISOString();
}

function clampString(val: unknown, maxLen: number): string {
  return typeof val === 'string' ? val.slice(0, maxLen) : '';
}

function sanitizeSlug(val: unknown, fallback: string, maxLen = 140): string {
  const raw = typeof val === 'string' && val.trim() ? val.trim() : fallback;
  const clean = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, maxLen);
  return clean || fallback.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, maxLen) || 'item';
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    return false;
  }
}

void testConnection();

export function subscribeAuthChanges(cb: (email: string | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => {
    cb(user?.email || null);
  });
}

export async function tryFirebaseEmailSignIn(
  email: string,
  password: string
): Promise<{ ok: boolean; code?: string; uid?: string }> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return { ok: true, uid: cred.user.uid };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || 'unknown';
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
      try {
        const created = await createUserWithEmailAndPassword(auth, email, password);
        return { ok: true, uid: created.user.uid };
      } catch (createErr: unknown) {
        return { ok: false, code: (createErr as { code?: string })?.code || code };
      }
    }
    return { ok: false, code };
  }
}

export async function signInWithGoogleFirebase() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutFirebase() {
  return signOut(auth);
}

export async function fetchPublicFirestoreData(tenantId: string): Promise<{
  properties: Property[];
  developments: Development[];
  landingPages: LandingPage[];
  tenant: TenantConfig | null;
}> {
  const result = {
    properties: [] as Property[],
    developments: [] as Development[],
    landingPages: [] as LandingPage[],
    tenant: null as TenantConfig | null,
  };

  try {
    const tenantSnap = await getDoc(doc(db, 'tenants', tenantId));
    if (tenantSnap.exists()) {
      const data = tenantSnap.data();
      result.tenant = {
        ...(data as Omit<TenantConfig, 'updatedAt'>),
        tenantId: tenantSnap.id,
        updatedAt: toIsoDate(data.updatedAt),
      };
    }
  } catch {
    // Public catalog falls back to defaults/API if tenant doc is not seeded in Firestore yet
  }

  try {
    const propQ = query(
      collection(db, 'properties'),
      where('tenantId', '==', tenantId),
      where('published', '==', true)
    );
    const propSnap = await getDocs(propQ);
    result.properties = propSnap.docs.map((d) => {
      const data = d.data();
      return {
        ...(data as Omit<Property, 'id' | 'createdAt' | 'updatedAt'>),
        id: d.id,
        createdAt: toIsoDate(data.createdAt),
        updatedAt: toIsoDate(data.updatedAt),
      };
    });
  } catch {
    // Public catalog may still be served from initial/server state before first Firestore publish
  }

  try {
    const devQ = query(
      collection(db, 'developments'),
      where('tenantId', '==', tenantId),
      where('published', '==', true)
    );
    const devSnap = await getDocs(devQ);
    result.developments = devSnap.docs.map((d) => {
      const data = d.data();
      return {
        ...(data as Omit<Development, 'id' | 'createdAt' | 'updatedAt'>),
        id: d.id,
        createdAt: toIsoDate(data.createdAt),
        updatedAt: toIsoDate(data.updatedAt),
      };
    });
  } catch {
    // Graceful fallback
  }

  try {
    const lpQ = query(
      collection(db, 'landingPages'),
      where('tenantId', '==', tenantId),
      where('published', '==', true)
    );
    const lpSnap = await getDocs(lpQ);
    result.landingPages = lpSnap.docs.map((d) => {
      const data = d.data();
      return {
        ...(data as Omit<LandingPage, 'id' | 'createdAt' | 'updatedAt'>),
        id: d.id,
        createdAt: toIsoDate(data.createdAt),
        updatedAt: toIsoDate(data.updatedAt),
      };
    });
  } catch {
    // Graceful fallback
  }

  return result;
}

export async function fetchAdminFirestoreData(tenantId: string): Promise<{
  tenant: TenantConfig | null;
  properties: Property[];
  developments: Development[];
  landingPages: LandingPage[];
  leads: Lead[];
} | null> {
  if (!auth.currentUser) return null;
  try {
    const tenantSnap = await getDoc(doc(db, 'tenants', tenantId));
    const tenant = tenantSnap.exists()
      ? {
          ...(tenantSnap.data() as Omit<TenantConfig, 'updatedAt'>),
          tenantId: tenantSnap.id,
          updatedAt: toIsoDate(tenantSnap.data().updatedAt),
        }
      : null;

    const [propSnap, devSnap, lpSnap, leadSnap] = await Promise.all([
      getDocs(query(collection(db, 'properties'), where('tenantId', '==', tenantId))),
      getDocs(query(collection(db, 'developments'), where('tenantId', '==', tenantId))),
      getDocs(query(collection(db, 'landingPages'), where('tenantId', '==', tenantId))),
      getDocs(query(collection(db, 'leads'), where('tenantId', '==', tenantId))),
    ]);

    return {
      tenant,
      properties: propSnap.docs.map((d) => {
        const data = d.data();
        return {
          ...(data as Omit<Property, 'id' | 'createdAt' | 'updatedAt'>),
          id: d.id,
          createdAt: toIsoDate(data.createdAt),
          updatedAt: toIsoDate(data.updatedAt),
        };
      }),
      developments: devSnap.docs.map((d) => {
        const data = d.data();
        return {
          ...(data as Omit<Development, 'id' | 'createdAt' | 'updatedAt'>),
          id: d.id,
          createdAt: toIsoDate(data.createdAt),
          updatedAt: toIsoDate(data.updatedAt),
        };
      }),
      landingPages: lpSnap.docs.map((d) => {
        const data = d.data();
        return {
          ...(data as Omit<LandingPage, 'id' | 'createdAt' | 'updatedAt'>),
          id: d.id,
          createdAt: toIsoDate(data.createdAt),
          updatedAt: toIsoDate(data.updatedAt),
        };
      }),
      leads: leadSnap.docs.map((d) => {
        const data = d.data();
        return {
          ...(data as Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>),
          id: d.id,
          createdAt: toIsoDate(data.createdAt),
          updatedAt: toIsoDate(data.updatedAt),
        };
      }),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `tenants/${tenantId}`);
  }
}

export async function syncTenantToFirestore(tenant: TenantConfig): Promise<void> {
  if (!auth.currentUser) return;
  const tenantRef = doc(db, 'tenants', tenant.tenantId);
  try {
    const payload = {
      tenantId: clampString(tenant.tenantId, 64),
      companyName: clampString(tenant.companyName, 140),
      slogan: clampString(tenant.slogan, 160),
      creci: clampString(tenant.creci, 40),
      city: clampString(tenant.city, 80),
      regions: Array.isArray(tenant.regions)
        ? tenant.regions.slice(0, 30).map((r) => String(r))
        : [],
      whatsapp: clampString(tenant.whatsapp, 32),
      phone: clampString(tenant.phone, 32),
      email: clampString(tenant.email, 120),
      address: clampString(tenant.address, 240),
      instagramUrl: clampString(tenant.instagramUrl, 240),
      domain: clampString(tenant.domain, 160),
      heroHeadline: clampString(tenant.heroHeadline, 200),
      heroSubheadline: clampString(tenant.heroSubheadline, 360),
      aboutTitle: clampString(tenant.aboutTitle, 160),
      aboutText: clampString(tenant.aboutText, 4000),
      logoUrl: clampString(tenant.logoUrl, 500),
      faviconUrl: clampString(tenant.faviconUrl, 500),
      themePreset: tenant.themePreset,
      themeTokens: tenant.themeTokens,
      seoTitle: clampString(tenant.seoTitle, 140),
      seoDescription: clampString(tenant.seoDescription, 240),
      assistantName: clampString(tenant.assistantName || 'Sofia', 80),
      assistantRole: clampString(tenant.assistantRole || 'Assistente Virtual', 100),
      assistantAvatarUrl: clampString(tenant.assistantAvatarUrl, 500),
      updatedAt: serverTimestamp(),
    };
    const existing = await getDoc(tenantRef);
    if (existing.exists()) {
      const { tenantId: _omitTenantId, ...updateFields } = payload;
      await updateDoc(tenantRef, updateFields);
    } else {
      await setDoc(tenantRef, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `tenants/${tenant.tenantId}`);
  }
}

export async function syncPropertyToFirestore(property: Property): Promise<void> {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const propRef = doc(db, 'properties', property.id);
  try {
    const existing = await getDoc(propRef);
    const baseFields = {
      slug: sanitizeSlug(property.slug, property.id, 140),
      title: clampString(property.title, 160),
      subtitle: clampString(property.subtitle, 240),
      description: clampString(property.description, 6000),
      transactionType: property.transactionType,
      propertyType: property.propertyType,
      neighborhood: clampString(property.neighborhood, 100),
      city: clampString(property.city, 80),
      regionHighlight: clampString(property.regionHighlight, 160),
      salePrice: Number(property.salePrice) || 0,
      rentPrice: Number(property.rentPrice) || 0,
      condoFee: Number(property.condoFee) || 0,
      iptuFee: Number(property.iptuFee) || 0,
      areaSqm: Number(property.areaSqm) || 0,
      bedrooms: Math.max(0, Math.min(30, Math.round(Number(property.bedrooms) || 0))),
      bathrooms: Math.max(0, Math.min(30, Math.round(Number(property.bathrooms) || 0))),
      suites: Math.max(0, Math.min(20, Math.round(Number(property.suites) || 0))),
      parkingSpaces: Math.max(0, Math.min(50, Math.round(Number(property.parkingSpaces) || 0))),
      furnished: Boolean(property.furnished),
      fullLeisure: Boolean(property.fullLeisure),
      features: Array.isArray(property.features)
        ? property.features.slice(0, 30).map((f) => String(f))
        : [],
      images: Array.isArray(property.images)
        ? property.images.slice(0, 20).map((i) => String(i))
        : [],
      videoUrl: clampString(property.videoUrl, 1000),
      virtualTourMode: property.virtualTourMode || 'panoramic_360',
      ...(property.virtualTourData ? { virtualTourData: property.virtualTourData } : {}),
      ...(property.aiAnalysis ? { aiAnalysis: property.aiAnalysis } : {}),
      featured: Boolean(property.featured),
      published: Boolean(property.published),
      status: property.status || 'disponivel',
      updatedAt: serverTimestamp(),
    };

    if (existing.exists()) {
      await updateDoc(propRef, baseFields);
    } else {
      await setDoc(propRef, {
        ...baseFields,
        tenantId: clampString(property.tenantId, 64),
        ownerId: uid,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `properties/${property.id}`);
  }
}

export async function deletePropertyFromFirestore(propertyId: string): Promise<void> {
  if (!auth.currentUser) return;
  try {
    await deleteDoc(doc(db, 'properties', propertyId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `properties/${propertyId}`);
  }
}

export async function syncDevelopmentToFirestore(dev: Development): Promise<void> {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const devRef = doc(db, 'developments', dev.id);
  try {
    const existing = await getDoc(devRef);
    const baseFields = {
      slug: sanitizeSlug(dev.slug, dev.id, 140),
      name: clampString(dev.name, 160),
      neighborhood: clampString(dev.neighborhood, 100),
      city: clampString(dev.city, 80),
      stage: dev.stage || 'pronto',
      summary: clampString(dev.summary, 2000),
      coverImage: clampString(dev.coverImage, 1000),
      amenities: Array.isArray(dev.amenities)
        ? dev.amenities.slice(0, 25).map((a) => String(a))
        : [],
      published: Boolean(dev.published),
      updatedAt: serverTimestamp(),
    };
    if (existing.exists()) {
      await updateDoc(devRef, baseFields);
    } else {
      await setDoc(devRef, {
        ...baseFields,
        tenantId: clampString(dev.tenantId, 64),
        ownerId: uid,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `developments/${dev.id}`);
  }
}

export async function deleteDevelopmentFromFirestore(devId: string): Promise<void> {
  if (!auth.currentUser) return;
  try {
    await deleteDoc(doc(db, 'developments', devId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `developments/${devId}`);
  }
}

export async function syncLandingPageToFirestore(lp: LandingPage): Promise<void> {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const lpRef = doc(db, 'landingPages', lp.id);
  try {
    const existing = await getDoc(lpRef);
    const baseFields = {
      slug: sanitizeSlug(lp.slug, lp.id, 140),
      title: clampString(lp.title, 160),
      headline: clampString(lp.headline, 220),
      subheadline: clampString(lp.subheadline, 400),
      heroImage: clampString(lp.heroImage, 1000),
      ctaLabel: clampString(lp.ctaLabel, 80),
      targetRegion: clampString(lp.targetRegion, 100),
      propertyFilterType: clampString(lp.propertyFilterType, 60),
      bodyText: clampString(lp.bodyText, 5000),
      published: Boolean(lp.published),
      updatedAt: serverTimestamp(),
    };
    if (existing.exists()) {
      await updateDoc(lpRef, baseFields);
    } else {
      await setDoc(lpRef, {
        ...baseFields,
        tenantId: clampString(lp.tenantId, 64),
        ownerId: uid,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `landingPages/${lp.id}`);
  }
}

export async function deleteLandingPageFromFirestore(lpId: string): Promise<void> {
  if (!auth.currentUser) return;
  try {
    await deleteDoc(doc(db, 'landingPages', lpId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `landingPages/${lpId}`);
  }
}

export async function updateLeadStatusInFirestore(
  leadId: string,
  status: LeadStatus
): Promise<void> {
  if (!auth.currentUser) return;
  try {
    await updateDoc(doc(db, 'leads', leadId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `leads/${leadId}`);
  }
}

export async function deleteLeadFromFirestore(leadId: string): Promise<void> {
  if (!auth.currentUser) return;
  try {
    await deleteDoc(doc(db, 'leads', leadId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `leads/${leadId}`);
  }
}

export async function syncLeadToFirestore(lead: Lead): Promise<void> {
  try {
    await setDoc(doc(db, 'leads', lead.id), {
      tenantId: clampString(lead.tenantId, 64),
      name: clampString(lead.name, 120),
      email: clampString(lead.email, 140),
      phone: clampString(lead.phone, 40),
      message: clampString(lead.message, 2000),
      interestType: lead.interestType,
      propertyId: clampString(lead.propertyId, 128),
      propertyTitle: clampString(lead.propertyTitle, 180),
      sourcePage: clampString(lead.sourcePage, 160),
      status: 'novo',
      lgpdConsent: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Server store already captures lead even if tenant doc isn't mirrored in Firestore yet
  }
}
