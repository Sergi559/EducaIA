import { AlertTriangle, Lock, LogIn, Mail, UserPlus, X } from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { isFirebaseConfigured, signInWithEmail, registerWithEmail } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Ingresá tu correo electrónico.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      if (mode === 'login') {
        await signInWithEmail(cleanEmail, password);
      } else {
        await registerWithEmail(cleanEmail, password);
      }
      setPassword('');
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No pudimos completar el acceso. Intentá nuevamente.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-[#0A192F] px-6 py-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-sky-300">EDUCA.IA · Acceso con cuenta</p>
            <h2 id="auth-modal-title" className="mt-1 font-display text-xl font-bold text-white">
              {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta escolar'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de acceso"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {!isFirebaseConfigured ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-950 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Conexión Firebase pendiente de variables</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-900">
                  Cargá las variables <code>VITE_FIREBASE_*</code> de tu proyecto EDUCAIA en el
                  entorno para habilitar el inicio de sesión con correo y contraseña y la
                  sincronización con Cloud Firestore.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div
                role="tablist"
                aria-label="Modo de autenticación"
                className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-5"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'login'}
                  onClick={() => {
                    setMode('login');
                    setErrorMessage(null);
                  }}
                  className={`py-2 text-xs font-semibold rounded-md cursor-pointer transition-colors ${
                    mode === 'login'
                      ? 'bg-[#0A192F] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Ya tengo cuenta
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'register'}
                  onClick={() => {
                    setMode('register');
                    setErrorMessage(null);
                  }}
                  className={`py-2 text-xs font-semibold rounded-md cursor-pointer transition-colors ${
                    mode === 'register'
                      ? 'bg-[#0A192F] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Registrarme
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="auth-email" className="block text-xs font-semibold text-[#0A192F]">
                    Correo electrónico
                  </label>
                  <div className="mt-1.5 relative">
                    <Mail
                      className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nombre@escuela.edu.ar"
                      className="w-full min-h-[42px] pl-10 pr-3.5 py-2 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-semibold text-[#0A192F]"
                  >
                    Contraseña
                  </label>
                  <div className="mt-1.5 relative">
                    <Lock
                      className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-password"
                      type="password"
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full min-h-[42px] pl-10 pr-3.5 py-2 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                {errorMessage && (
                  <div
                    role="alert"
                    className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900"
                  >
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0A192F] hover:bg-[#132C4E] disabled:bg-slate-300 rounded-lg transition-colors cursor-pointer"
                >
                  {mode === 'login' ? (
                    <LogIn className="w-4 h-4 text-sky-300" />
                  ) : (
                    <UserPlus className="w-4 h-4 text-sky-300" />
                  )}
                  <span>
                    {submitting
                      ? 'Verificando...'
                      : mode === 'login'
                        ? 'Iniciar sesión'
                        : 'Crear cuenta'}
                  </span>
                </button>

                <p className="text-[11px] leading-relaxed text-slate-500 text-center">
                  El acceso con cuenta permite sincronizar <strong>EDU-ORGANIZA</strong> en la nube
                  y habilitar herramientas autorizadas en <strong>EDU-GESTIÓN</strong>.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
