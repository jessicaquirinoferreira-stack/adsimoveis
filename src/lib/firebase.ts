import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  Development,
  LandingPage,
  Lead,
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
    const propQ = query(
      collection(db, 'properties'),
      where('tenantId', '==', tenantId),
      where('published', '==', true)
    );
    const propSnap = await getDocs(propQ);
    result.properties = propSnap.docs.map((d) => ({
      ...(d.data() as Omit<Property, 'id'>),
      id: d.id,
    }));
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
    result.developments = devSnap.docs.map((d) => ({
      ...(d.data() as Omit<Development, 'id'>),
      id: d.id,
    }));
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
    result.landingPages = lpSnap.docs.map((d) => ({
      ...(d.data() as Omit<LandingPage, 'id'>),
      id: d.id,
    }));
  } catch {
    // Graceful fallback
  }

  return result;
}

export async function syncTenantToFirestore(tenant: TenantConfig): Promise<void> {
  if (!auth.currentUser) return;
  try {
    await setDoc(doc(db, 'tenants', tenant.tenantId), {
      ...tenant,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `tenants/${tenant.tenantId}`);
  }
}

export async function syncPropertyToFirestore(property: Property): Promise<void> {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  try {
    const payload = {
      tenantId: property.tenantId,
      slug: property.slug,
      title: property.title,
      subtitle: property.subtitle,
      description: property.description,
      transactionType: property.transactionType,
      propertyType: property.propertyType,
      neighborhood: property.neighborhood,
      city: property.city,
      regionHighlight: property.regionHighlight,
      salePrice: property.salePrice,
      rentPrice: property.rentPrice,
      condoFee: property.condoFee,
      iptuFee: property.iptuFee,
      areaSqm: property.areaSqm,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      suites: property.suites,
      parkingSpaces: property.parkingSpaces,
      furnished: property.furnished,
      fullLeisure: property.fullLeisure,
      features: property.features,
      images: property.images,
      videoUrl: property.videoUrl,
      virtualTourMode: property.virtualTourMode,
      featured: property.featured,
      published: property.published,
      status: property.status,
      ownerId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'properties', property.id), payload);
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

export async function syncLeadToFirestore(lead: Lead): Promise<void> {
  try {
    await setDoc(doc(db, 'leads', lead.id), {
      tenantId: lead.tenantId,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      message: lead.message,
      interestType: lead.interestType,
      propertyId: lead.propertyId,
      propertyTitle: lead.propertyTitle,
      sourcePage: lead.sourcePage,
      status: 'novo',
      lgpdConsent: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Server store already captures lead even if tenant doc isn't mirrored in Firestore yet
  }
}
