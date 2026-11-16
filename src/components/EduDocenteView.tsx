import {
  AlertTriangle,
  BookOpen,
  Check,
  ClipboardCopy,
  FileText,
  Printer,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SCHOOL_YEARS,
  SUBJECTS,
  TEACHER_MATERIAL_OPTIONS,
  findSchoolYear,
  findSubject,
  findTeacherMaterialOption,
} from '../data/curriculum.ts';
import type {
  SchoolYearId,
  SubjectCategory,
  TeacherMaterialResponse,
  TeacherMaterialType,
  TutorApiError,
  TutorApiStatus,
} from '../types/educaia.ts';
import { FormattedMessage } from './FormattedMessage.tsx';

const TOPIC_EXAMPLES_BY_CATEGORY: Record<SubjectCategory, string[]> = {
  tecnica: [
    'Diseño y cálculo básico de riego por goteo en cultivos hortícolas',
    'Evaluación de estructura, porosidad y conservación del suelo',
    'Buenas prácticas de higiene y rendimiento en elaboración agroindustrial',
  ],
  general: [
    'Porcentajes, proporciones y rendimiento en lotes de siembra',
    'Redacción de informes técnicos de observación en entornos formativos',
    'Medición de pH y soluciones aplicadas al análisis de agua y suelo',
  ],
};

export function EduDocenteView() {
  const [selectedYearId, setSelectedYearId] = useState<SchoolYearId>('4.º');
  const [activeCategory, setActiveCategory] = useState<SubjectCategory>('tecnica');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('riego');
  const [materialType, setMaterialType] = useState<TeacherMaterialType>('actividades');
  const [topic, setTopic] = useState('');
  const [objective, setObjective] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');

  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [generatedMeta, setGeneratedMeta] = useState<{
    yearLabel: string;
    subjectName: string;
    materialLabel: string;
    topic: string;
  } | null>(null);

  const [refinementNote, setRefinementNote] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const selectedYear = useMemo(
    () => findSchoolYear(selectedYearId) ?? SCHOOL_YEARS[0],
    [selectedYearId]
  );
  const selectedSubject = useMemo(
    () => findSubject(selectedSubjectId) ?? SUBJECTS[0],
    [selectedSubjectId]
  );
  const filteredSubjects = useMemo(
    () => SUBJECTS.filter((s) => s.category === activeCategory),
    [activeCategory]
  );
  const selectedMaterialOption = useMemo(
    () => findTeacherMaterialOption(materialType) ?? TEACHER_MATERIAL_OPTIONS[0],
    [materialType]
  );

  const checkApiStatus = async () => {
    setStatusError(null);
    try {
      const res = await fetch('/api/tutor/status');
      if (!res.ok) {
        throw new Error('No se pudo verificar el estado del servidor.');
      }
      const data = (await res.json()) as TutorApiStatus;
      setApiConfigured(Boolean(data.configured));
    } catch {
      setStatusError(
        'No se pudo conectar con el servidor de EDUCA.IA. Verificá que el backend esté activo.'
      );
      setApiConfigured(null);
    }
  };

  useEffect(() => {
    void checkApiStatus();
  }, []);

  const handleSelectCategory = (category: SubjectCategory) => {
    setActiveCategory(category);
    const firstInCategory = SUBJECTS.find((s) => s.category === category);
    if (firstInCategory && selectedSubject.category !== category) {
      setSelectedSubjectId(firstInCategory.id);
    }
  };

  const handleReset = () => {
    setTopic('');
    setObjective('');
    setAdditionalContext('');
    setRefinementNote('');
    setGeneratedContent(null);
    setGeneratedMeta(null);
    setErrorMessage(null);
    setCopied(false);
  };

  const requestGeneration = async (options?: { withRefinement?: boolean }) => {
    if (isGenerating || inFlightRef.current) return;

    const trimmedTopic = topic.trim();
    const trimmedObjective = objective.trim();

    if (!trimmedTopic) {
      setErrorMessage('Indicá el tema que querés trabajar antes de generar el material.');
      return;
    }

    if (!trimmedObjective) {
      setErrorMessage('Definí el objetivo de aprendizaje para orientar la propuesta.');
      return;
    }

    if (apiConfigured === false) {
      setErrorMessage(
        'El servicio de inteligencia artificial aún no está configurado en el servidor.'
      );
      return;
    }

    if (options?.withRefinement && !refinementNote.trim()) {
      setErrorMessage('Escribí qué ajuste querés aplicar sobre el material generado.');
      return;
    }

    inFlightRef.current = true;
    setErrorMessage(null);
    setCopied(false);
    setIsGenerating(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 50_000);

    try {
      let clientId = window.sessionStorage.getItem('educaia_client_id');
      if (!clientId) {
        clientId = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `dev-${Date.now()}`;
        window.sessionStorage.setItem('educaia_client_id', clientId);
      }

      const response = await fetch('/api/docente/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': clientId,
        },
        signal: controller.signal,
        body: JSON.stringify({
          year: selectedYearId,
          subjectId: selectedSubjectId,
          materialType,
          topic: trimmedTopic,
          objective: trimmedObjective,
          additionalContext: additionalContext.trim() || undefined,
          refinementNote: options?.withRefinement ? refinementNote.trim() : undefined,
          previousContent: options?.withRefinement ? generatedContent ?? undefined : undefined,
        }),
      });

      const payload = (await response.json()) as TeacherMaterialResponse | TutorApiError;

      if (!response.ok) {
        const apiError = payload as TutorApiError;
        if (apiError.code === 'API_NOT_CONFIGURED') {
          setApiConfigured(false);
        }
        throw new Error(
          apiError.error || 'No se pudo generar el material docente en este momento.'
        );
      }

      const data = payload as TeacherMaterialResponse;
      setGeneratedContent(data.content);
      setGeneratedMeta({
        yearLabel: selectedYear.label,
        subjectName: selectedSubject.name,
        materialLabel: selectedMaterialOption.label,
        topic: trimmedTopic,
      });

      if (options?.withRefinement) {
        setRefinementNote('');
      }
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      setErrorMessage(
        isAbort
          ? 'La generación demoró demasiado porque hay alta demanda. Esperá unos segundos y volvé a intentarlo.'
          : error instanceof Error
            ? error.message
            : 'Error de conexión al generar el material. Intentá nuevamente.'
      );
    } finally {
      window.clearTimeout(timeoutId);
      abortControllerRef.current = null;
      inFlightRef.current = false;
      setIsGenerating(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void requestGeneration();
  };

  const handleRefineSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void requestGeneration({ withRefinement: true });
  };

  const handleCopy = async () => {
    if (!generatedContent) return;
    try {
      await navigator.clipboard.writeText(generatedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setErrorMessage(
        'No se pudo copiar automáticamente al portapapeles. Podés seleccionar el texto manualmente.'
      );
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const applySampleTopic = (sampleTopic: string) => {
    setTopic(sampleTopic);
    if (!objective.trim()) {
      setObjective(
        `Que los estudiantes de ${selectedYear.label} comprendan y apliquen los conceptos clave de "${sampleTopic}" en situaciones del entorno agropecuario.`
      );
    }
  };

  return (
    <main className="bg-slate-50 min-h-[calc(100vh-4rem)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Encabezado del módulo EDU-DOCENTE */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200 print:hidden">
          <div>
            <p className="text-xs font-medium text-sky-700">
              EDUCA.IA · EDU-DOCENTE · Asistente para docentes
            </p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0A192F] tracking-tight">
              Planificación y recursos didácticos agropecuarios
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#0A192F] bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
            >
              <RotateCcw className="w-4 h-4 text-sky-700" />
              <span>Nueva planificación</span>
            </button>
          </div>
        </div>

        {/* Aviso si falta GEMINI_API_KEY en el servidor */}
        {apiConfigured === false && (
          <div
            role="alert"
            className="mt-6 rounded-xl bg-amber-50 border border-amber-300 p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 print:hidden"
          >
            <div className="flex items-start gap-3.5">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-display text-base font-bold text-amber-950">
                  Configuración pendiente del servicio de inteligencia artificial
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-amber-900">
                  El servidor todavía no tiene configurada la variable{' '}
                  <code className="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">
                    GEMINI_API_KEY
                  </code>
                  . EDU-DOCENTE utiliza la conexión segura del backend para generar materiales reales
                  y no simula contenidos sin conexión.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void checkApiStatus()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-amber-950 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Verificar de nuevo</span>
            </button>
          </div>
        )}

        {statusError && (
          <div
            role="alert"
            className="mt-6 rounded-xl bg-red-50 border border-red-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden"
          >
            <div className="flex items-center gap-3 text-sm text-red-900">
              <AlertTriangle className="w-5 h-5 text-red-700 shrink-0" />
              <span>{statusError}</span>
            </div>
            <button
              type="button"
              onClick={() => void checkApiStatus()}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-red-900 bg-white hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reintentar</span>
            </button>
          </div>
        )}

        {/* Layout principal de 2 columnas */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Formulario docente */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5 print:hidden"
          >
            {/* 1. Curso */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="font-display text-sm font-bold text-[#0A192F]">
                  1. Curso
                </label>
                <span className="text-xs text-slate-500">{selectedYear.cycle}</span>
              </div>
              <div
                role="group"
                aria-label="Seleccionar curso"
                className="mt-2.5 grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-3 gap-2"
              >
                {SCHOOL_YEARS.map((year) => {
                  const active = year.id === selectedYearId;
                  return (
                    <button
                      key={year.id}
                      type="button"
                      onClick={() => setSelectedYearId(year.id)}
                      aria-pressed={active}
                      className={`min-h-[40px] px-2.5 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${
                        active
                          ? 'bg-[#0A192F] text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {year.id}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Materia */}
            <div>
              <span className="font-display text-sm font-bold text-[#0A192F] block">
                2. Materia
              </span>
              <div
                role="tablist"
                aria-label="Categoría de materia"
                className="mt-2.5 grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === 'tecnica'}
                  onClick={() => handleSelectCategory('tecnica')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs sm:text-sm font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    activeCategory === 'tecnica'
                      ? 'bg-white text-[#0A192F] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                  <span>Técnicas (11)</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === 'general'}
                  onClick={() => handleSelectCategory('general')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs sm:text-sm font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    activeCategory === 'general'
                      ? 'bg-white text-[#0A192F] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                  <span>Generales (8)</span>
                </button>
              </div>

              <label htmlFor="docente-subject-select" className="sr-only">
                Seleccionar materia
              </label>
              <select
                id="docente-subject-select"
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="mt-2.5 w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-[#0A192F] focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              >
                {filteredSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-slate-500">{selectedSubject.shortDescription}</p>
            </div>

            {/* 3. Tipo de material */}
            <div>
              <span className="font-display text-sm font-bold text-[#0A192F] block">
                3. Tipo de material a generar
              </span>
              <div className="mt-2.5 space-y-2">
                {TEACHER_MATERIAL_OPTIONS.map((option) => {
                  const active = option.id === materialType;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setMaterialType(option.id)}
                      aria-pressed={active}
                      className={`w-full text-left px-3.5 py-2.5 rounded-lg border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${
                        active
                          ? 'bg-sky-50 border-sky-400 text-[#0A192F]'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{option.shortDescription}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Tema */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="docente-topic-input"
                  className="font-display text-sm font-bold text-[#0A192F]"
                >
                  4. Tema
                </label>
                <span className="text-xs text-slate-400 tabular-nums">{topic.length}/300</span>
              </div>
              <input
                id="docente-topic-input"
                type="text"
                maxLength={300}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={`Ej.: ${TOPIC_EXAMPLES_BY_CATEGORY[activeCategory][0]}`}
                className="mt-2 w-full min-h-[42px] rounded-lg border border-slate-300 bg-slate-50 focus:bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TOPIC_EXAMPLES_BY_CATEGORY[activeCategory].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => applySampleTopic(sample)}
                    className="text-left text-xs text-sky-700 hover:text-sky-900 hover:underline cursor-pointer"
                  >
                    + Usar ejemplo: “{sample.slice(0, 42)}…”
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Objetivo de aprendizaje */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="docente-objective-input"
                  className="font-display text-sm font-bold text-[#0A192F]"
                >
                  5. Objetivo de aprendizaje
                </label>
                <span className="text-xs text-slate-400 tabular-nums">
                  {objective.length}/600
                </span>
              </div>
              <textarea
                id="docente-objective-input"
                rows={3}
                maxLength={600}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Ej.: Que los estudiantes identifiquen las variables que determinan la lámina de riego y calculen la frecuencia adecuada para un cultivo hortícola."
                className="mt-2 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 focus:bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>

            {/* 6. Contexto o articulación (opcional) */}
            <div>
              <label
                htmlFor="docente-context-input"
                className="font-display text-sm font-bold text-[#0A192F] block"
              >
                6. Entorno formativo o duración (opcional)
              </label>
              <input
                id="docente-context-input"
                type="text"
                maxLength={400}
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder={
                  materialType === 'proyecto'
                    ? 'Ej.: Articular con Matemática y Biología · Trabajo en huerta escolar durante 3 semanas'
                    : 'Ej.: 2 módulos de 80 min · Trabajo grupal en invernadero o aula'
                }
                className="mt-2 w-full min-h-[42px] rounded-lg border border-slate-300 bg-slate-50 focus:bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs sm:text-sm text-red-900"
              >
                <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isGenerating || apiConfigured === false}
              className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#0A192F] hover:bg-[#132C4E] disabled:bg-slate-300 disabled:text-slate-500 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              <Sparkles className="w-4 h-4 text-sky-300" />
              <span>
                {isGenerating
                  ? 'Generando material...'
                  : `Generar ${selectedMaterialOption.label.toLowerCase()}`}
              </span>
            </button>

            <div className="pt-2 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-500 leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
              <p>
                Los materiales generados son propuestas pedagógicas de apoyo adaptadas a escuelas
                técnicas agropecuarias y requieren revisión docente antes de su implementación.
              </p>
            </div>
          </form>

          {/* Panel de resultado */}
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl flex flex-col min-h-[540px]">
            <div className="px-5 py-4 border-b border-slate-200 bg-[#0A192F] text-white rounded-t-xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-sky-500/20 text-sky-300 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-sky-300 truncate">
                    {generatedMeta
                      ? `${generatedMeta.yearLabel} · ${generatedMeta.subjectName}`
                      : `${selectedYear.label} · ${selectedSubject.name}`}
                  </p>
                  <h2 className="font-display text-base sm:text-lg font-bold truncate">
                    {generatedMeta ? generatedMeta.materialLabel : selectedMaterialOption.label}
                  </h2>
                </div>
              </div>

              {generatedContent && (
                <div className="flex items-center gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-sky-300" />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <>
                        <ClipboardCopy className="w-3.5 h-3.5 text-sky-300" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0A192F] bg-sky-300 hover:bg-sky-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimir</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 p-5 sm:p-7">
              {isGenerating ? (
                <div className="h-full min-h-[360px] flex flex-col items-center justify-center text-center px-4">
                  <span
                    className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  <h3 className="mt-4 font-display text-lg font-bold text-[#0A192F]">
                    Elaborando {selectedMaterialOption.label.toLowerCase()}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600 max-w-md">
                    Adaptando consignas, lenguaje y situaciones agropecuarias para{' '}
                    <strong>{selectedYear.label}</strong> en{' '}
                    <strong>{selectedSubject.name}</strong>.
                  </p>
                </div>
              ) : generatedContent ? (
                <div>
                  {generatedMeta && (
                    <div className="mb-5 pb-4 border-b border-slate-200">
                      <p className="text-xs font-medium text-sky-700">
                        {generatedMeta.yearLabel} · {generatedMeta.subjectName} ·{' '}
                        {generatedMeta.materialLabel}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#0A192F]">
                        Tema: {generatedMeta.topic}
                      </p>
                    </div>
                  )}

                  <div className="text-slate-800">
                    <FormattedMessage content={generatedContent} isUser={false} />
                  </div>
                </div>
              ) : (
                <div className="h-full min-h-[360px] flex flex-col justify-center max-w-xl mx-auto">
                  <p className="text-xs font-medium text-sky-700">
                    {selectedYear.label} · {selectedSubject.name}
                  </p>
                  <h3 className="mt-2 font-display text-xl font-bold text-[#0A192F]">
                    Prepará material docente adaptado a tu escuela técnica
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Completá el formulario con el curso, la materia, el tema y el objetivo de
                    aprendizaje. {selectedMaterialOption.outputHint}
                  </p>

                  <div className="mt-6 pt-5 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600">
                    <div>
                      <p className="font-semibold text-[#0A192F]">5 formatos disponibles</p>
                      <p className="mt-1 leading-relaxed">
                        Actividades, preguntas de evaluación, guías de estudio, rúbricas en tabla y
                        proyectos interdisciplinarios.
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-[#0A192F]">Enfoque técnico agropecuario</p>
                      <p className="mt-1 leading-relaxed">
                        Ejemplos reales de campo, huerta, tambo, agroindustria, riego, suelos y
                        prácticas con supervisión docente.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Ajuste iterativo sobre el material ya generado */}
            {generatedContent && !isGenerating && (
              <form
                onSubmit={handleRefineSubmit}
                className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 rounded-b-xl print:hidden"
              >
                <label
                  htmlFor="docente-refine-input"
                  className="block text-xs font-semibold text-[#0A192F]"
                >
                  ¿Querés ajustar este material? Pedile una modificación puntual
                </label>
                <div className="mt-2 flex flex-col sm:flex-row gap-2.5">
                  <input
                    id="docente-refine-input"
                    type="text"
                    maxLength={500}
                    value={refinementNote}
                    onChange={(e) => setRefinementNote(e.target.value)}
                    placeholder="Ej.: Sumá una consigna más simple de nivel inicial o adaptala para trabajo en grupos..."
                    className="flex-1 min-h-[42px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                  <button
                    type="submit"
                    disabled={!refinementNote.trim() || isGenerating || apiConfigured === false}
                    className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 disabled:text-slate-500 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Aplicar ajuste</span>
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
