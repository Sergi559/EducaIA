interface FooterProps {
  onNavigateHome: (sectionId?: string) => void;
  onOpenTutor: () => void;
  onOpenDocente: () => void;
  onOpenOrganiza: () => void;
  onOpenGestion: () => void;
}

export function Footer({
  onNavigateHome,
  onOpenTutor,
  onOpenDocente,
  onOpenOrganiza,
  onOpenGestion,
}: FooterProps) {
  return (
    <footer className="bg-[#0A192F] text-slate-300 border-t border-slate-800 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-8 border-b border-slate-800">
          <div>
            <p className="font-display text-lg font-bold text-white tracking-tight">EDUCA.IA</p>
            <p className="mt-1 text-sm text-sky-300">
              Aprender no termina cuando termina la clase.
            </p>
          </div>

          <nav aria-label="Enlaces del pie de página" className="flex flex-wrap items-center gap-6 text-sm">
            <button
              type="button"
              onClick={() => onNavigateHome()}
              className="hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              Inicio
            </button>
            <button
              type="button"
              onClick={onOpenTutor}
              className="hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              EDU-ALUMNO
            </button>
            <button
              type="button"
              onClick={onOpenDocente}
              className="hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              EDU-DOCENTE
            </button>
            <button
              type="button"
              onClick={onOpenOrganiza}
              className="hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              EDU-ORGANIZA
            </button>
            <button
              type="button"
              onClick={onOpenGestion}
              className="hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              EDU-GESTIÓN
            </button>
            <button
              type="button"
              onClick={() => onNavigateHome('modulos')}
              className="hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              Módulos
            </button>
            <button
              type="button"
              onClick={() => onNavigateHome('seguridad')}
              className="hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              Cuidado y privacidad
            </button>
          </nav>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-400">
          <p>
            Plataforma educativa destinada a escuelas secundarias técnicas agropecuarias de la República Argentina.
          </p>
          <p>
            Cuatro módulos integrados · EDU-ALUMNO, EDU-DOCENTE, EDU-ORGANIZA y EDU-GESTIÓN.
          </p>
        </div>
      </div>
    </footer>
  );
}
