import {
  AlertTriangle,
  ArrowUp,
  BookOpen,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SCHOOL_YEARS, SUBJECTS, findSchoolYear, findSubject } from '../data/curriculum.ts';
import type {
  ChatMessage,
  SchoolYearId,
  SubjectCategory,
  TutorApiError,
  TutorApiStatus,
  TutorChatResponse,
} from '../types/educaia.ts';
import { FormattedMessage } from './FormattedMessage.tsx';

export function EduAlumnoView() {
  const [selectedYearId, setSelectedYearId] = useState<SchoolYearId>('1.º');
  const [activeCategory, setActiveCategory] = useState<SubjectCategory>('tecnica');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('agricultura');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);

  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [mobileConfigOpen, setMobileConfigOpen] = useState(false);

  // Al cambiar de curso o materia con una charla ya iniciada, registramos qué contexto usaba la charla
  const [chatContext, setChatContext] = useState<{ yearId: SchoolYearId; subjectId: string }>({
    yearId: '1.º',
    subjectId: 'agricultura',
  });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
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

  const contextChangedDuringChat =
    messages.length > 0 &&
    (chatContext.yearId !== selectedYearId || chatContext.subjectId !== selectedSubjectId);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSelectCategory = (category: SubjectCategory) => {
    setActiveCategory(category);
    const firstInCategory = SUBJECTS.find((s) => s.category === category);
    if (firstInCategory && selectedSubject.category !== category) {
      setSelectedSubjectId(firstInCategory.id);
      if (messages.length === 0) {
        setChatContext({ yearId: selectedYearId, subjectId: firstInCategory.id });
      }
    }
  };

  const handleSelectYear = (yearId: SchoolYearId) => {
    setSelectedYearId(yearId);
    if (messages.length === 0) {
      setChatContext({ yearId, subjectId: selectedSubjectId });
    }
  };

  const handleSelectSubject = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setMobileConfigOpen(false);
    if (messages.length === 0) {
      setChatContext({ yearId: selectedYearId, subjectId });
    }
  };

  const handleNewConsultation = () => {
    setMessages([]);
    setErrorMessage(null);
    setLastFailedPrompt(null);
    setChatContext({ yearId: selectedYearId, subjectId: selectedSubjectId });
    textareaRef.current?.focus();
  };

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isSending || inFlightRef.current) return;

    if (apiConfigured === false) {
      setErrorMessage(
        'El tutor requiere que el servicio de inteligencia artificial esté configurado en el servidor.'
      );
      return;
    }

    inFlightRef.current = true;
    setErrorMessage(null);
    setLastFailedPrompt(null);

    const activeYearId = messages.length === 0 ? selectedYearId : chatContext.yearId;
    const activeSubjectId = messages.length === 0 ? selectedSubjectId : chatContext.subjectId;

    if (messages.length === 0) {
      setChatContext({ yearId: selectedYearId, subjectId: selectedSubjectId });
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    };

    const historyPayload = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsSending(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 50_000);

    try {
      let clientId = window.sessionStorage.getItem('educaia_client_id');
      if (!clientId) {
        clientId = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `dev-${Date.now()}`;
        window.sessionStorage.setItem('educaia_client_id', clientId);
      }

      const response = await fetch('/api/tutor/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': clientId,
        },
        signal: controller.signal,
        body: JSON.stringify({
          year: activeYearId,
          subjectId: activeSubjectId,
          message: trimmed,
          history: historyPayload,
        }),
      });

      const payload = (await response.json()) as TutorChatResponse | TutorApiError;

      if (!response.ok) {
        const apiError = payload as TutorApiError;
        if (apiError.code === 'API_NOT_CONFIGURED') {
          setApiConfigured(false);
        }
        throw new Error(
          apiError.error || 'Ocurrió un problema al consultar con el tutor académico.'
        );
      }

      const successData = payload as TutorChatResponse;
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: successData.reply,
        createdAt: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      const messageText = isAbort
        ? 'La consulta demoró demasiado porque hay alta demanda. Esperá unos segundos y volvé a intentarlo.'
        : error instanceof Error
          ? error.message
          : 'No pudimos conectar con el tutor. Revisá tu conexión e intentá nuevamente.';
      setErrorMessage(messageText);
      setLastFailedPrompt(trimmed);
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      setInputText(trimmed);
    } finally {
      window.clearTimeout(timeoutId);
      abortControllerRef.current = null;
      inFlightRef.current = false;
      setIsSending(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void sendMessage(inputText);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(inputText);
    }
  };

  const chatYearObj = findSchoolYear(chatContext.yearId) ?? selectedYear;
  const chatSubjectObj = findSubject(chatContext.subjectId) ?? selectedSubject;

  return (
    <main className="bg-slate-50 min-h-[calc(100vh-4rem)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Encabezado del módulo EDU-ALUMNO */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <p className="text-xs font-medium text-sky-700">
              EDUCA.IA · EDU-ALUMNO · Tutor académico
            </p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0A192F] tracking-tight">
              Tutoría inteligente por año y materia
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleNewConsultation}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#0A192F] bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
            >
              <RotateCcw className="w-4 h-4 text-sky-700" />
              <span>Nueva consulta</span>
            </button>
          </div>
        </div>

        {/* Aviso si no hay API configurada en el servidor */}
        {apiConfigured === false && (
          <div
            role="alert"
            className="mt-6 rounded-xl bg-amber-50 border border-amber-300 p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
          >
            <div className="flex items-start gap-3.5">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-display text-base font-bold text-amber-950">
                  Configuración pendiente del servicio de inteligencia artificial
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-amber-900">
                  El servidor todavía no tiene configurada la variable de entorno{' '}
                  <code className="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">
                    GEMINI_API_KEY
                  </code>
                  . Para garantizar respuestas reales y pedagógicas, EDU-ALUMNO no simula
                  respuestas automáticas sin conexión. Configurá la clave en el entorno del
                  servidor (por ejemplo en <strong>Settings &gt; Secrets</strong>) y volvé a
                  comprobar.
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

        {/* Aviso si falló la comprobación de conexión al servidor */}
        {statusError && (
          <div
            role="alert"
            className="mt-6 rounded-xl bg-red-50 border border-red-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
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

        {/* Selector compacto móvil */}
        <div className="lg:hidden mt-5">
          <button
            type="button"
            onClick={() => setMobileConfigOpen((prev) => !prev)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-left cursor-pointer"
          >
            <div>
              <p className="text-xs text-slate-500">Contexto seleccionado</p>
              <p className="text-sm font-semibold text-[#0A192F]">
                {selectedYear.label} · {selectedSubject.name}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 whitespace-nowrap">
              <span>{mobileConfigOpen ? 'Ocultar' : 'Cambiar'}</span>
              {mobileConfigOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </span>
          </button>
        </div>

        {/* Layout principal: panel de selección + chat */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Panel de selección de Año y Materia */}
          <aside
            className={`lg:col-span-4 space-y-5 ${
              mobileConfigOpen ? 'block' : 'hidden lg:block'
            }`}
          >
            {/* Selector de año escolar */}
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-[#0A192F]">
                  1. Año escolar
                </h2>
                <span className="text-xs text-slate-500 tabular-nums">{selectedYear.cycle}</span>
              </div>

              <div
                role="group"
                aria-label="Seleccionar año escolar"
                className="mt-3.5 grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-3 gap-2"
              >
                {SCHOOL_YEARS.map((year) => {
                  const active = year.id === selectedYearId;
                  return (
                    <button
                      key={year.id}
                      type="button"
                      onClick={() => handleSelectYear(year.id)}
                      aria-pressed={active}
                      className={`min-h-[42px] px-3 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${
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

              <p className="mt-3 text-xs leading-relaxed text-slate-600">
                {selectedYear.label} · {selectedYear.cycle}
              </p>
            </section>

            {/* Selector de materia general o técnica */}
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="font-display text-base font-bold text-[#0A192F]">
                2. Elegí tu materia
              </h2>

              {/* Segmentado General / Técnica */}
              <div
                role="tablist"
                aria-label="Tipo de materia"
                className="mt-3.5 grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg"
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

              {/* Lista de materias */}
              <div className="mt-3.5 space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
                {filteredSubjects.map((subject) => {
                  const active = subject.id === selectedSubjectId;
                  return (
                    <button
                      key={subject.id}
                      type="button"
                      onClick={() => handleSelectSubject(subject.id)}
                      aria-pressed={active}
                      className={`w-full text-left px-3.5 py-2.5 rounded-lg border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${
                        active
                          ? 'bg-sky-50 border-sky-400 text-[#0A192F]'
                          : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200 text-slate-700'
                      }`}
                    >
                      <p className="text-sm font-semibold">{subject.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        {subject.shortDescription}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Nota de privacidad y seguridad */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3 text-xs leading-relaxed text-slate-600">
              <ShieldCheck className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
              <p>
                No escribas nombres completos, teléfonos ni direcciones. Esta conversación no se
                almacena en servidores y las prácticas de campo o taller requieren supervisión
                docente.
              </p>
            </div>
          </aside>

          {/* Área de conversación del tutor */}
          <section className="lg:col-span-8 bg-white border border-slate-200 rounded-xl flex flex-col min-h-[540px] lg:h-[680px]">
            {/* Barra de contexto del chat */}
            <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-[#0A192F] text-white rounded-t-xl">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-sky-500/20 text-sky-300 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-sky-300 truncate">
                    {chatYearObj.label} ·{' '}
                    {chatSubjectObj.category === 'tecnica'
                      ? 'Materia Técnica'
                      : 'Materia General'}
                  </p>
                  <h2 className="font-display text-base sm:text-lg font-bold truncate">
                    {chatSubjectObj.name}
                  </h2>
                </div>
              </div>

              <p className="text-xs text-slate-300">
                Sesión temporal · Sin guardado
              </p>
            </div>

            {/* Aviso si el estudiante cambió de curso/materia durante un hilo activo */}
            {contextChangedDuringChat && (
              <div className="px-5 py-3 bg-sky-50 border-b border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-[#0A192F]">
                <p>
                  Seleccionaste <strong>{selectedYear.label} · {selectedSubject.name}</strong>. Tu
                  conversación actual sigue en {chatYearObj.label} · {chatSubjectObj.name}.
                </p>
                <button
                  type="button"
                  onClick={handleNewConsultation}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0A192F] hover:bg-[#132C4E] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Iniciar nueva consulta aquí
                </button>
              </div>
            )}

            {/* Historial de mensajes */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5 bg-slate-50/60">
              {messages.length === 0 ? (
                <div className="max-w-2xl mx-auto py-4 sm:py-8">
                  <div className="bg-white border border-slate-200 rounded-xl p-6">
                    <p className="text-xs font-medium text-sky-700">
                      {selectedYear.label} · {selectedSubject.name}
                    </p>
                    <h3 className="mt-1.5 font-display text-xl font-bold text-[#0A192F]">
                      ¿Qué tema querés trabajar hoy?
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      Contame qué estás estudiando o en qué punto te trabaste. Te voy a ayudar a
                      entenderlo paso a paso con ejemplos sencillos y situaciones agropecuarias, sin
                      resolver automáticamente toda tu tarea.
                    </p>

                    <div className="mt-6 pt-5 border-t border-slate-100">
                      <p className="text-xs font-semibold text-slate-500">
                        Ideas para empezar en {selectedSubject.name}:
                      </p>
                      <div className="mt-3 grid grid-cols-1 gap-2.5">
                        {selectedSubject.starterQuestions.map((question) => (
                          <button
                            key={question}
                            type="button"
                            disabled={apiConfigured === false || isSending}
                            onClick={() => {
                              if (apiConfigured === false) return;
                              void sendMessage(question);
                            }}
                            className="text-left px-4 py-3 text-sm text-[#0A192F] bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {question}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-2 mb-1 px-1 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">
                          {isUser ? 'Estudiante' : 'Tutor EDU-ALUMNO'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{msg.createdAt}</span>
                      </div>

                      <div
                        className={`max-w-[90%] sm:max-w-[82%] rounded-xl px-4 py-3.5 ${
                          isUser
                            ? 'bg-[#0A192F] text-white'
                            : 'bg-white text-slate-800 border border-slate-200'
                        }`}
                      >
                        <FormattedMessage content={msg.content} isUser={isUser} />
                      </div>
                    </div>
                  );
                })
              )}

              {isSending && (
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-2 mb-1 px-1 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">Tutor EDU-ALUMNO</span>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm text-slate-600 flex items-center gap-2.5">
                    <span
                      className="w-4 h-4 border-2 border-sky-600 border-t-transparent rounded-full animate-spin shrink-0"
                      aria-hidden="true"
                    />
                    <span>Preparando tu explicación paso a paso...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Banner de error de consulta */}
            {errorMessage && (
              <div
                role="alert"
                className="mx-4 sm:mx-6 mt-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-red-900"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
                {lastFailedPrompt && apiConfigured !== false && (
                  <button
                    type="button"
                    onClick={() => void sendMessage(lastFailedPrompt)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-900 bg-white hover:bg-red-100 border border-red-200 rounded-md cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reintentar envío</span>
                  </button>
                )}
              </div>
            )}

            {/* Formulario de envío */}
            <form
              onSubmit={handleSubmit}
              className="p-4 sm:p-5 border-t border-slate-200 bg-white rounded-b-xl"
            >
              <label htmlFor="tutor-question-input" className="sr-only">
                Escribí tu pregunta para el tutor
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                <textarea
                  ref={textareaRef}
                  id="tutor-question-input"
                  rows={2}
                  maxLength={2000}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isSending || apiConfigured === false}
                  placeholder={
                    apiConfigured === false
                      ? 'Configurá GEMINI_API_KEY en el servidor para habilitar el chat...'
                      : `Escribí tu pregunta de ${chatSubjectObj.name} (${chatYearObj.label})...`
                  }
                  className="flex-1 resize-none rounded-lg border border-slate-300 bg-slate-50 focus:bg-white px-3.5 py-2.5 text-sm sm:text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 disabled:opacity-60"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending || apiConfigured === false}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 disabled:text-slate-500 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                >
                  <span>Enviar</span>
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                <span>Enter para enviar · Shift + Enter para nueva línea</span>
                <span className="tabular-nums">{inputText.length}/2000</span>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
