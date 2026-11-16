import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  GraduationCap,
  Landmark,
  ShieldCheck,
  Sprout,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { PLATFORM_MODULES } from '../data/curriculum.ts';
import type { ModuleId } from '../types/educaia.ts';

interface HomeViewProps {
  onOpenTutor: () => void;
  onOpenDocente: () => void;
  onOpenOrganiza: () => void;
  onOpenGestion: () => void;
}

const MODULE_ICONS: Record<ModuleId, typeof GraduationCap> = {
  'edu-alumno': GraduationCap,
  'edu-docente': Users,
  'edu-organiza': CalendarClock,
  'edu-gestion': Landmark,
};

export function HomeView({
  onOpenTutor,
  onOpenDocente,
  onOpenOrganiza,
  onOpenGestion,
}: HomeViewProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <main>
      {/* Hero institucional */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            {/* Columna izquierda: propuesta y acceso */}
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-sm font-medium text-sky-700 tracking-wide">
                Escuelas Técnicas Agropecuarias · Argentina
              </p>

              <h1 className="mt-3 font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight text-[#0A192F] leading-[1.08] text-balance">
                EDUCA.IA
              </h1>

              <p className="mt-4 font-display text-xl sm:text-2xl font-semibold text-sky-700 text-balance">
                “Aprender no termina cuando termina la clase.”
              </p>

              <p className="mt-5 text-base sm:text-[17px] leading-relaxed text-slate-600 max-w-xl">
                Plataforma educativa con inteligencia artificial pensada para acompañar el estudio
                diario en escuelas secundarias técnicas agropecuarias. Explicaciones claras por año
                escolar, ejemplos aplicados al campo argentino y práctica guiada paso a paso.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={onOpenTutor}
                  className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 text-sm sm:text-base font-semibold text-white bg-[#0A192F] hover:bg-[#132C4E] rounded-lg transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                >
                  <span>Abrir EDU-ALUMNO</span>
                  <ArrowRight className="w-4 h-4 text-sky-300" />
                </button>

                <a
                  href="#modulos"
                  className="inline-flex items-center justify-center px-5 py-3.5 text-sm sm:text-base font-semibold text-[#0A192F] bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                >
                  Explorar módulos
                </a>
              </div>
            </div>

            {/* Columna derecha: imagen institucional 16:9 con respaldo */}
            <div className="lg:col-span-6 flex">
              <div className="relative w-full aspect-[16/9] lg:aspect-auto lg:min-h-[380px] rounded-xl overflow-hidden border border-slate-200 bg-[#0A192F]">
                {!imageError ? (
                  <img
                    src="/src/assets/images/hero_agrotech_school_1794845854237.jpg"
                    alt="Estudiantes y docentes en campo experimental e invernadero de una escuela técnica agropecuaria argentina"
                    referrerPolicy="no-referrer"
                    decoding="async"
                    onError={() => setImageError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-[#0A192F] via-[#0F2744] to-sky-900">
                    <Sprout className="w-12 h-12 text-sky-300" />
                    <p className="mt-4 font-display text-xl font-bold text-white">
                      Educación Técnica Agropecuaria
                    </p>
                    <p className="mt-1 text-sm text-sky-200 max-w-sm">
                      Acompañamiento académico de 1.º a 6.º año en materias generales y técnicas.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Franja de estructura curricular */}
          <div className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="font-display text-2xl font-bold text-[#0A192F] tabular-nums">1.º a 6.º</p>
              <p className="mt-1 text-sm text-slate-600">Ciclo Básico y Ciclo Superior Técnico</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-[#0A192F] tabular-nums">8 materias</p>
              <p className="mt-1 text-sm text-slate-600">Formación general secundaria</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-[#0A192F] tabular-nums">11 materias</p>
              <p className="mt-1 text-sm text-slate-600">Especialidades técnicas agropecuarias</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-[#0A192F]">Sin registro</p>
              <p className="mt-1 text-sm text-slate-600">No solicita ni guarda datos personales</p>
            </div>
          </div>
        </div>
      </section>

      {/* Cuatro módulos de EDUCA.IA */}
      <section id="modulos" className="py-16 lg:py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-sky-700">Arquitectura de la plataforma</p>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#0A192F] text-balance">
              Cuatro módulos diseñados para toda la comunidad educativa
            </h2>
            <p className="mt-3 text-base text-slate-600 leading-relaxed">
              Explorá los cuatro espacios integrados de la plataforma: tutoría inteligente para
              estudiantes, asistencia docente, organización escolar e información institucional.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {PLATFORM_MODULES.map((mod) => {
              const Icon = MODULE_ICONS[mod.id];
              const isActive = mod.status === 'active';

              return (
                <article
                  key={mod.id}
                  className={`flex flex-col justify-between rounded-xl p-6 sm:p-8 transition-colors ${
                    isActive
                      ? 'bg-[#0A192F] text-white border border-[#0A192F]'
                      : 'bg-white text-slate-900 border border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <div
                        className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive ? 'bg-sky-500/20 text-sky-300' : 'bg-sky-50 text-sky-700'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <p
                        className={`text-xs font-medium ${
                          isActive ? 'text-sky-300' : 'text-slate-500'
                        }`}
                      >
                        {isActive ? 'Módulo activo' : 'Disponible próximamente'}
                      </p>
                    </div>

                    <h3
                      className={`mt-5 font-display text-xl font-bold tracking-tight ${
                        isActive ? 'text-white' : 'text-[#0A192F]'
                      }`}
                    >
                      {mod.name}
                    </h3>
                    <p
                      className={`mt-1 text-sm font-medium ${
                        isActive ? 'text-sky-300' : 'text-sky-700'
                      }`}
                    >
                      {mod.subtitle}
                    </p>
                    <p
                      className={`mt-3 text-sm sm:text-[15px] leading-relaxed ${
                        isActive ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      {mod.description}
                    </p>
                  </div>

                  <div
                    className={`mt-7 pt-5 border-t flex items-center justify-between gap-4 ${
                      isActive ? 'border-slate-800' : 'border-slate-100'
                    }`}
                  >
                    <span
                      className={`text-xs ${isActive ? 'text-slate-300' : 'text-slate-500'}`}
                    >
                      {mod.id === 'edu-alumno'
                        ? '19 materias · 1.º a 6.º año'
                        : mod.id === 'edu-docente'
                          ? 'Actividades, guías, rúbricas y proyectos'
                          : mod.id === 'edu-organiza'
                            ? 'Calendario, tareas y plan semanal local'
                            : 'Calendario, comunicados y administración'}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        if (mod.id === 'edu-docente') {
                          onOpenDocente();
                        } else if (mod.id === 'edu-organiza') {
                          onOpenOrganiza();
                        } else if (mod.id === 'edu-gestion') {
                          onOpenGestion();
                        } else {
                          onOpenTutor();
                        }
                      }}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#0A192F] bg-sky-300 hover:bg-sky-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                    >
                      <span>{mod.ctaLabel}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Enfoque pedagógico y seguridad */}
      <section id="seguridad" className="py-16 lg:py-20 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700">
                <BookOpen className="w-4 h-4" />
                <span>Cómo enseña EDU-ALUMNO</span>
              </div>
              <h2 className="mt-3 font-display text-2xl font-bold text-[#0A192F] text-balance">
                Acompañamiento para pensar y comprender, no para copiar respuestas
              </h2>
              <ul className="mt-6 space-y-4 text-sm sm:text-[15px] text-slate-600">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                  <span>
                    Adapta el vocabulario y la profundidad al año escolar seleccionado (1.º a 6.º) y
                    al enfoque general o técnico de cada materia.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                  <span>
                    Conecta la teoría con situaciones reales de la producción agropecuaria: huerta,
                    suelos, riego, frutales, vid, tambo, maquinaria y gestión.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                  <span>
                    Propone ejercicios progresivos y verifica la comprensión; si algo no queda claro,
                    cambia la estrategia de explicación.
                  </span>
                </li>
              </ul>
            </div>

            <div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700">
                <ShieldCheck className="w-4 h-4" />
                <span>Cuidado, privacidad y seguridad escolar</span>
              </div>
              <h2 className="mt-3 font-display text-2xl font-bold text-[#0A192F] text-balance">
                Reglas claras para proteger a los estudiantes en el entorno digital y rural
              </h2>
              <ul className="mt-6 space-y-4 text-sm sm:text-[15px] text-slate-600">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#0A192F] shrink-0 mt-0.5" />
                  <span>
                    No solicita nombres completos, teléfonos, domicilios ni datos personales, y no
                    guarda las conversaciones en esta primera versión.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#0A192F] shrink-0 mt-0.5" />
                  <span>
                    Evita inventar bibliografía o citas inexistentes y no brinda instrucciones
                    peligrosas con agroquímicos, maquinaria agrícola o actividades rurales.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#0A192F] shrink-0 mt-0.5" />
                  <span>
                    Señala explícitamente cuándo una práctica de laboratorio, taller o campo
                    requiere supervisión docente o de un profesional matriculado.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
