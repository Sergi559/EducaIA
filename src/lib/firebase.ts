import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore, type Firestore } from 'firebase/firestore';
import appletConfig from '../../firebase-applet-config.json';

function readEnvVar(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

const firebaseConfig: FirebaseOptions = {
  apiKey: readEnvVar(import.meta.env.VITE_FIREBASE_API_KEY) || readEnvVar(appletConfig.apiKey),
  authDomain:
    readEnvVar(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) || readEnvVar(appletConfig.authDomain),
  projectId:
    readEnvVar(import.meta.env.VITE_FIREBASE_PROJECT_ID) || readEnvVar(appletConfig.projectId),
  storageBucket:
    readEnvVar(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) ||
    readEnvVar(appletConfig.storageBucket),
  messagingSenderId:
    readEnvVar(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) ||
    readEnvVar(appletConfig.messagingSenderId),
  appId: readEnvVar(import.meta.env.VITE_FIREBASE_APP_ID) || readEnvVar(appletConfig.appId),
};

const firestoreDatabaseId =
  readEnvVar(import.meta.env.VITE_FIREBASE_DATABASE_ID) ||
  readEnvVar(appletConfig.firestoreDatabaseId);

const REQUIRED_ENV_KEYS = [
  ['VITE_FIREBASE_API_KEY', firebaseConfig.apiKey],
  ['VITE_FIREBASE_AUTH_DOMAIN', firebaseConfig.authDomain],
  ['VITE_FIREBASE_PROJECT_ID', firebaseConfig.projectId],
  ['VITE_FIREBASE_APP_ID', firebaseConfig.appId],
] as const;

export const missingFirebaseEnvVars: string[] = REQUIRED_ENV_KEYS
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const isFirebaseConfigured = missingFirebaseEnvVars.length === 0;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
} else {
  console.warn(
    `[EDUCA.IA Firebase] Faltan variables de entorno para inicializar Firebase: ${missingFirebaseEnvVars.join(', ')}`
  );
}

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
    providerInfo: Array<{
      providerId?: string | null;
      email?: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentUser = auth?.currentUser ?? null;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) ?? [],
    },
  };

  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  if (!db) {
    return false;
  }

  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error(
        '[EDUCA.IA Firebase] No se pudo conectar con Firestore. Verificá la configuración de Firebase y la conexión a internet.'
      );
      return false;
    }
    // Si responde con permiso denegado o documento inexistente, significa que hubo comunicación con el servidor.
    return true;
  }
}

export { app, auth, db };
