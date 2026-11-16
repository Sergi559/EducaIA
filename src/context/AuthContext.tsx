import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  auth,
  db,
  isFirebaseConfigured,
  missingFirebaseEnvVars,
  testFirestoreConnection,
} from '../lib/firebase.ts';

interface AuthContextValue {
  isFirebaseConfigured: boolean;
  missingEnvVars: string[];
  user: User | null;
  isAdmin: boolean;
  authLoading: boolean;
  firestoreConnected: boolean | null;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function translateFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  switch (code) {
    case 'auth/invalid-email':
      return 'El formato del correo electrónico no es válido.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Correo electrónico o contraseña incorrectos.';
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta registrada con ese correo electrónico.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos seguidos. Esperá unos minutos antes de volver a intentar.';
    case 'auth/operation-not-allowed':
      return 'El inicio de sesión con correo y contraseña no está habilitado en el proyecto Firebase.';
    case 'auth/network-request-failed':
      return 'Error de conexión al verificar la cuenta. Revisá tu red e intentá nuevamente.';
    default:
      return error instanceof Error
        ? error.message
        : 'No se pudo completar la autenticación en este momento.';
  }
}

const CONN_SESSION_KEY = 'educaia_fs_conn_ok';
const PROFILE_SESSION_PREFIX = 'educaia_fs_profile_';
const ADMIN_SESSION_PREFIX = 'educaia_fs_admin_';
const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000;

function readSessionFlag(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionFlag(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignoramos errores de almacenamiento en modo privado
  }
}

function removeSessionFlag(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignoramos errores de almacenamiento
  }
}

async function ensureMinimalUserProfile(uid: string): Promise<void> {
  if (!db) return;
  const cacheKey = `${PROFILE_SESSION_PREFIX}${uid}`;
  if (readSessionFlag(cacheKey) === '1') {
    return;
  }
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        role: 'alumno',
        createdAt: serverTimestamp(),
      });
    }
    writeSessionFlag(cacheKey, '1');
  } catch {
    // Si las reglas aún no se aplicaron o el cliente está offline, no bloqueamos el inicio de sesión
  }
}

async function checkAdminStatus(uid: string): Promise<boolean> {
  if (!db) return false;
  const cacheKey = `${ADMIN_SESSION_PREFIX}${uid}`;
  const cachedRaw = readSessionFlag(cacheKey);
  if (cachedRaw) {
    try {
      const parsed = JSON.parse(cachedRaw) as { active?: boolean; ts?: number };
      if (typeof parsed.active === 'boolean' && typeof parsed.ts === 'number') {
        if (Date.now() - parsed.ts < ADMIN_CACHE_TTL_MS) {
          return parsed.active;
        }
      }
    } catch {
      // Cache corrupto: reconsultamos
    }
  }
  try {
    const adminRef = doc(db, 'admins', uid);
    const snap = await getDoc(adminRef);
    const active = snap.exists() && snap.data()?.active === true;
    writeSessionFlag(cacheKey, JSON.stringify({ active, ts: Date.now() }));
    return active;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(Boolean(isFirebaseConfigured && auth));
  const [firestoreConnected, setFirestoreConnected] = useState<boolean | null>(() =>
    readSessionFlag(CONN_SESSION_KEY) === '1' ? true : null
  );

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;
    if (readSessionFlag(CONN_SESSION_KEY) !== '1') {
      void testFirestoreConnection().then((ok) => {
        if (ok) {
          writeSessionFlag(CONN_SESSION_KEY, '1');
        }
        if (mounted) {
          setFirestoreConnected(ok);
        }
      });
    }

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (!mounted) return;
      setUser(nextUser);

      if (!nextUser) {
        setIsAdmin(false);
        setAuthLoading(false);
        return;
      }

      void Promise.all([
        ensureMinimalUserProfile(nextUser.uid),
        checkAdminStatus(nextUser.uid),
      ])
        .then(([, adminFlag]) => {
          if (mounted) {
            setIsAdmin(adminFlag);
          }
        })
        .finally(() => {
          if (mounted) {
            setAuthLoading(false);
          }
        });
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Firebase Authentication todavía no está configurado en las variables de entorno.');
    }
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      throw new Error(translateFirebaseAuthError(error));
    }
  };

  const registerWithEmail = async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Firebase Authentication todavía no está configurado en las variables de entorno.');
    }
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await ensureMinimalUserProfile(credential.user.uid);
    } catch (error) {
      throw new Error(translateFirebaseAuthError(error));
    }
  };

  const signOutUser = async () => {
    if (!auth) return;
    const currentUid = auth.currentUser?.uid;
    if (currentUid) {
      removeSessionFlag(`${PROFILE_SESSION_PREFIX}${currentUid}`);
      removeSessionFlag(`${ADMIN_SESSION_PREFIX}${currentUid}`);
    }
    removeSessionFlag('educaia_organiza_cloud_sync_v1');
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        isFirebaseConfigured,
        missingEnvVars: missingFirebaseEnvVars,
        user,
        isAdmin,
        authLoading,
        firestoreConnected,
        signInWithEmail,
        registerWithEmail,
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  }
  return ctx;
}
