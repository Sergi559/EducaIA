import { LogIn, LogOut, Menu, UserCheck, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';

export type AppView = 'home' | 'edu-alumno' | 'edu-docente' | 'edu-organiza' | 'edu-gestion';

interface NavbarProps {
  currentView: AppView;
  onNavigateHome: (sectionId?: string) => void;
  onOpenTutor: () => void;
  onOpenDocente: () => void;
  onOpenOrganiza: () => void;
  onOpenGestion: () => void;
  onOpenAuth: () => void;
}

export function Navbar({
  currentView,
  onNavigateHome,
  onOpenTutor,
  onOpenDocente,
  onOpenOrganiza,
  onOpenGestion,
  onOpenAuth,
}: NavbarProps) {
  const { user, signOutUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSectionLink = (sectionId?: string) => {
    setMobileMenuOpen(false);
    onNavigateHome(sectionId);
  };

  const handleOpenTutor = () => {
    setMobileMenuOpen(false);
    onOpenTutor();
  };

  const handleOpenDocente = () => {
    setMobileMenuOpen(false);
    onOpenDocente();
  };

  const handleOpenOrganiza = () => {
    setMobileMenuOpen(false);
    onOpenOrganiza();
  };

  const handleOpenGestion = () => {
    setMobileMenuOpen(false);
    onOpenGestion();
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zona 1: Logotipo textual en una sola línea */}
        <button
          type="button"
          onClick={() => handleSectionLink()}
          className="font-display text-xl font-extrabold tracking-tight text-[#0A192F] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 rounded-md px-1"
        >
          EDUCA.IA
        </button>

        {/* Zona 2: Enlaces de navegación en una sola línea */}
        <nav
          aria-label="Navegación principal"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <button
            type="button"
            onClick={() => handleSectionLink()}
            className={`whitespace-nowrap shrink-0 cursor-pointer transition-colors hover:text-[#0A192F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 rounded-sm py-1 ${
              currentView === 'home'
                ? 'text-[#0A192F] underline underline-offset-8 decoration-sky-500 decoration-2'
                : ''
            }`}
          >
            Inicio
          </button>
          <button
            type="button"
            onClick={handleOpenTutor}
            className={`whitespace-nowrap shrink-0 cursor-pointer transition-colors hover:text-[#0A192F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 rounded-sm py-1 ${
              currentView === 'edu-alumno'
                ? 'text-[#0A192F] underline underline-offset-8 decoration-sky-500 decoration-2'
                : ''
            }`}
          >
            EDU-ALUMNO
          </button>
          <button
            type="button"
            onClick={handleOpenDocente}
            className={`whitespace-nowrap shrink-0 cursor-pointer transition-colors hover:text-[#0A192F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 rounded-sm py-1 ${
              currentView === 'edu-docente'
                ? 'text-[#0A192F] underline underline-offset-8 decoration-sky-500 decoration-2'
                : ''
            }`}
          >
            EDU-DOCENTE
          </button>
          <button
            type="button"
            onClick={handleOpenOrganiza}
            className={`whitespace-nowrap shrink-0 cursor-pointer transition-colors hover:text-[#0A192F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 rounded-sm py-1 ${
              currentView === 'edu-organiza'
                ? 'text-[#0A192F] underline underline-offset-8 decoration-sky-500 decoration-2'
                : ''
            }`}
          >
            EDU-ORGANIZA
          </button>
          <button
            type="button"
            onClick={handleOpenGestion}
            className={`whitespace-nowrap shrink-0 cursor-pointer transition-colors hover:text-[#0A192F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 rounded-sm py-1 ${
              currentView === 'edu-gestion'
                ? 'text-[#0A192F] underline underline-offset-8 decoration-sky-500 decoration-2'
                : ''
            }`}
          >
            EDU-GESTIÓN
          </button>
        </nav>

        {/* Zona 3: Acceso de cuenta y acción principal */}
        <div className="flex items-center gap-2.5 shrink-0">
          {user ? (
            <button
              type="button"
              onClick={() => void signOutUser()}
              title={user.email ?? 'Cuenta activa'}
              className="hidden sm:inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <UserCheck className="w-3.5 h-3.5 text-sky-700" />
              <span>Salir</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="hidden sm:inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0A192F] bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <LogIn className="w-3.5 h-3.5 text-sky-700" />
              <span>Acceder</span>
            </button>
          )}

          {currentView === 'home' ? (
            <button
              type="button"
              onClick={handleOpenTutor}
              className="hidden sm:inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-[#0A192F] hover:bg-[#132C4E] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              Ir al tutor
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSectionLink()}
              className="hidden sm:inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-[#0A192F] bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              Volver al inicio
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Menú móvil desplegable */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
          <button
            type="button"
            onClick={() => handleSectionLink()}
            className="w-full text-left px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            Inicio
          </button>
          <button
            type="button"
            onClick={handleOpenTutor}
            className="w-full text-left px-3 py-2.5 text-sm font-medium text-sky-700 hover:bg-sky-50 rounded-lg cursor-pointer"
          >
            EDU-ALUMNO (Tutor activo)
          </button>
          <button
            type="button"
            onClick={handleOpenDocente}
            className="w-full text-left px-3 py-2.5 text-sm font-medium text-sky-700 hover:bg-sky-50 rounded-lg cursor-pointer"
          >
            EDU-DOCENTE (Asistente activo)
          </button>
          <button
            type="button"
            onClick={handleOpenOrganiza}
            className="w-full text-left px-3 py-2.5 text-sm font-medium text-sky-700 hover:bg-sky-50 rounded-lg cursor-pointer"
          >
            EDU-ORGANIZA (Organizador activo)
          </button>
          <button
            type="button"
            onClick={handleOpenGestion}
            className="w-full text-left px-3 py-2.5 text-sm font-medium text-sky-700 hover:bg-sky-50 rounded-lg cursor-pointer"
          >
            EDU-GESTIÓN (Información institucional)
          </button>
          <button
            type="button"
            onClick={() => handleSectionLink('modulos')}
            className="w-full text-left px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            Módulos
          </button>
          <button
            type="button"
            onClick={() => handleSectionLink('seguridad')}
            className="w-full text-left px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            Seguridad
          </button>
          <div className="pt-2 border-t border-slate-100">
            {user ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void signOutUser();
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-sky-700" />
                <span>Cerrar sesión ({user.email})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth();
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-[#0A192F] hover:bg-sky-50 rounded-lg cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-sky-700" />
                <span>Acceder con correo</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
