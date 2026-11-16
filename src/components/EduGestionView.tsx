import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  FileCheck2,
  HelpCircle,
  Landmark,
  Lock,
  LogIn,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { GESTION_SECTIONS } from '../data/curriculum.ts';
import { OperationType, db, handleFirestoreError } from '../lib/firebase.ts';
import type { GestionData, GestionItem, GestionSectionId } from '../types/educaia.ts';
import { FormattedMessage } from './FormattedMessage.tsx';

const SECTION_ICONS: Record<GestionSectionId, typeof CalendarDays> = {
  'calendario-escolar': CalendarDays,
  comunicados: Megaphone,
  reglamentos: Scale,
  materias: BookOpen,
  'preguntas-frecuentes': HelpCircle,
};

const EMPTY_GESTION_DATA: GestionData = {
  'calendario-escolar': [],
  comunicados: [],
  reglamentos: [],
  materias: [],
  'preguntas-frecuentes': [],
};

type GestionMode = 'consulta' | 'admin';

interface EduGestionViewProps {
  onOpenAuth: () => void;
}

function normalizeTimestampToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return new Date().toISOString();
}

const GESTION_CACHE_KEY = 'educaia_gestion_cache_v1';
const GESTION_CACHE_TTL_MS = 5 * 60 * 1000;

function readGestionCache(source: 'firestore' | 'api'): GestionData | null {
  try {
    const raw = window.sessionStorage.getItem(GESTION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      source?: string;
      ts?: number;
      data?: GestionData;
    };
    if (
      parsed.source === source &&
      typeof parsed.ts === 'number' &&
      Date.now() - parsed.ts < GESTION_CACHE_TTL_MS &&
      parsed.data
    ) {
      return parsed.data;
    }
  } catch {
    // Cache inválido
  }
  return null;
}

function writeGestionCache(source: 'firestore' | 'api', payload: GestionData): void {
  try {
    window.sessionStorage.setItem(
      GESTION_CACHE_KEY,
      JSON.stringify({ source, ts: Date.now(), data: payload })
    );
  } catch {
    // Ignorar límite de sessionStorage
  }
}

export function EduGestionView({ onOpenAuth }: EduGestionViewProps) {
  const { isFirebaseConfigured, user, isAdmin, authLoading, signOutUser } = useAuth();
  const useFirestore = Boolean(isFirebaseConfigured && db);
  const cacheSource: 'firestore' | 'api' = useFirestore ? 'firestore' : 'api';

  const [mode, setMode] = useState<GestionMode>('consulta');
  const [activeSection, setActiveSection] = useState<GestionSectionId>('calendario-escolar');
  const [data, setData] = useState<GestionData>(
    () => readGestionCache(cacheSource) ?? EMPTY_GESTION_DATA
  );
  const [loading, setLoading] = useState(() => !readGestionCache(cacheSource));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Estado del formulario de administración
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formDateLabel, setFormDateLabel] = useState('');
  const [formCategoryTag, setFormCategoryTag] = useState('');
  const [formAuthorizedBy, setFormAuthorizedBy] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activeSectionMeta = useMemo(
    () => GESTION_SECTIONS.find((s) => s.id === activeSection) ?? GESTION_SECTIONS[0],
    [activeSection]
  );

  const fetchGestionData = useCallback(
    async (forceRefresh = false) => {
      if (!forceRefresh) {
        const cached = readGestionCache(cacheSource);
        if (cached) {
          setData(cached);
          setLoading(false);
          setLoadError(null);
          return;
        }
      }

      setLoading(true);
      setLoadError(null);
      try {
        if (useFirestore && db) {
          const grouped: GestionData = {
            'calendario-escolar': [],
            comunicados: [],
            reglamentos: [],
            materias: [],
            'preguntas-frecuentes': [],
          };

          try {
            const snapshot = await getDocs(
              query(collection(db, 'gestion_items'), orderBy('updatedAt', 'desc'))
            );
            snapshot.forEach((docSnap) => {
              const raw = docSnap.data();
              const section = raw.section as GestionSectionId;
              if (!(section in grouped)) return;
              grouped[section].push({
                id: docSnap.id,
                section,
                title: String(raw.title ?? ''),
                body: String(raw.body ?? ''),
                dateLabel: typeof raw.dateLabel === 'string' ? raw.dateLabel : undefined,
                categoryTag: typeof raw.categoryTag === 'string' ? raw.categoryTag : undefined,
                authorizedBy: typeof raw.authorizedBy === 'string' ? raw.authorizedBy : undefined,
                updatedAt: normalizeTimestampToIso(raw.updatedAt),
              });
            });
          } catch (fsErr) {
            handleFirestoreError(fsErr, OperationType.LIST, 'gestion_items');
          }

          setData(grouped);
          writeGestionCache('firestore', grouped);
        } else {
          const res = await fetch('/api/gestion');
          if (!res.ok) {
            throw new Error('No se pudo obtener la información institucional.');
          }
          const payload = (await res.json()) as GestionData;
          setData(payload);
          writeGestionCache('api', payload);
        }
      } catch {
        setLoadError(
          useFirestore
            ? 'No pudimos cargar la información institucional desde Cloud Firestore. Verificá las reglas de lectura y tu conexión.'
            : 'No pudimos conectar con el servidor para cargar la información institucional. Intentá nuevamente.'
        );
      } finally {
        setLoading(false);
      }
    },
    [useFirestore, cacheSource]
  );

  useEffect(() => {
    void fetchGestionData(false);
  }, [fetchGestionData]);

  const currentItems = useMemo(() => data[activeSection] ?? [], [data, activeSection]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return currentItems;
    return currentItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.body.toLowerCase().includes(q) ||
        (item.categoryTag ?? '').toLowerCase().includes(q) ||
        (item.dateLabel ?? '').toLowerCase().includes(q)
    );
  }, [currentItems, searchQuery]);

  const totalDocuments = useMemo(
    () => GESTION_SECTIONS.reduce((acc, s) => acc + (data[s.id]?.length ?? 0), 0),
    [data]
  );

  const resetForm = () => {
    setEditingItemId(null);
    setFormTitle('');
    setFormBody('');
    setFormDateLabel('');
    setFormCategoryTag('');
    setFormAuthorizedBy('');
    setFormError(null);
  };

  const handleSelectSection = (sectionId: GestionSectionId) => {
    setActiveSection(sectionId);
    setSearchQuery('');
    setConfirmDeleteId(null);
    setFormSuccess(null);
    resetForm();
  };

  const handleStartEdit = (item: GestionItem) => {
    setMode('admin');
    setActiveSection(item.section);
    setEditingItemId(item.id);
    setFormTitle(item.title);
    setFormBody(item.body);
    setFormDateLabel(item.dateLabel ?? '');
    setFormCategoryTag(item.categoryTag ?? '');
    setFormAuthorizedBy(item.authorizedBy ?? '');
    setFormError(null);
    setFormSuccess(null);
  };

  const handleSubmitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanTitle = formTitle.trim();
    const cleanBody = formBody.trim();

    if (!cleanTitle) {
      setFormError(`Completá el campo "${activeSectionMeta.titleLabel}".`);
      return;
    }

    if (!cleanBody) {
      setFormError(`Completá el campo "${activeSectionMeta.bodyLabel}".`);
      return;
    }

    setSaving(true);
    setFormError(null);
    setFormSuccess(null);

    const cleanDateLabel = formDateLabel.trim().slice(0, 80);
    const cleanCategoryTag = formCategoryTag.trim().slice(0, 80);
    const cleanAuthorizedBy = formAuthorizedBy.trim().slice(0, 120);

    try {
      if (useFirestore && db) {
        if (!user || !isAdmin) {
          throw new Error('Necesitás iniciar sesión con una cuenta de administrador autorizada.');
        }

        const itemId =
          editingItemId ?? `gest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        try {
          if (editingItemId) {
            const updatePayload: Record<string, unknown> = {
              section: activeSection,
              title: cleanTitle.slice(0, 200),
              body: cleanBody.slice(0, 5000),
              dateLabel: cleanDateLabel ? cleanDateLabel : deleteField(),
              categoryTag: cleanCategoryTag ? cleanCategoryTag : deleteField(),
              authorizedBy: cleanAuthorizedBy ? cleanAuthorizedBy : deleteField(),
              updatedAt: serverTimestamp(),
              updatedBy: user.uid,
            };
            await updateDoc(doc(db, 'gestion_items', editingItemId), updatePayload);
          } else {
            const createPayload: Record<string, unknown> = {
              section: activeSection,
              title: cleanTitle.slice(0, 200),
              body: cleanBody.slice(0, 5000),
              updatedAt: serverTimestamp(),
              updatedBy: user.uid,
            };
            if (cleanDateLabel) createPayload.dateLabel = cleanDateLabel;
            if (cleanCategoryTag) createPayload.categoryTag = cleanCategoryTag;
            if (cleanAuthorizedBy) createPayload.authorizedBy = cleanAuthorizedBy;

            await setDoc(doc(db, 'gestion_items', itemId), createPayload);
          }
        } catch (fsErr) {
          handleFirestoreError(
            fsErr,
            editingItemId ? OperationType.UPDATE : OperationType.CREATE,
            `gestion_items/${itemId}`
          );
        }

        const savedItem: GestionItem = {
          id: itemId,
          section: activeSection,
          title: cleanTitle.slice(0, 200),
          body: cleanBody.slice(0, 5000),
          dateLabel: cleanDateLabel || undefined,
          categoryTag: cleanCategoryTag || undefined,
          authorizedBy: cleanAuthorizedBy || undefined,
          updatedAt: new Date().toISOString(),
        };

        setData((prev) => {
          const sectionList = prev[activeSection] ?? [];
          const updatedList = editingItemId
            ? sectionList.map((i) => (i.id === editingItemId ? savedItem : i))
            : [savedItem, ...sectionList];
          const next = {
            ...prev,
            [activeSection]: updatedList,
          };
          writeGestionCache('firestore', next);
          return next;
        });
      } else {
        const payload = {
          title: cleanTitle,
          body: cleanBody,
          dateLabel: cleanDateLabel || undefined,
          categoryTag: cleanCategoryTag || undefined,
          authorizedBy: cleanAuthorizedBy || undefined,
        };

        const endpoint = editingItemId
          ? `/api/gestion/${activeSection}/${editingItemId}`
          : `/api/gestion/${activeSection}`;
        const method = editingItemId ? 'PUT' : 'POST';

        const res = await fetch(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const responseData = (await res.json()) as { item?: GestionItem; error?: string };
        if (!res.ok || !responseData.item) {
          throw new Error(responseData.error || 'No se pudo guardar el registro institucional.');
        }

        const savedItem = responseData.item;
        setData((prev) => {
          const sectionList = prev[activeSection] ?? [];
          const updatedList = editingItemId
            ? sectionList.map((i) => (i.id === editingItemId ? savedItem : i))
            : [savedItem, ...sectionList];
          const next = {
            ...prev,
            [activeSection]: updatedList,
          };
          writeGestionCache('api', next);
          return next;
        });
      }

      setFormSuccess(
        editingItemId
          ? 'Documento institucional actualizado correctamente.'
          : 'Documento institucional publicado en Consulta pública.'
      );
      resetForm();
    } catch (error) {
      setFormError(
        useFirestore
          ? 'No se pudo guardar en Firestore. Verificá que tu cuenta tenga permisos de administración activos.'
          : error instanceof Error
            ? error.message
            : 'Ocurrió un error al guardar la información institucional.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (section: GestionSectionId, id: string) => {
    setFormError(null);
    setFormSuccess(null);
    try {
      if (useFirestore && db) {
        if (!user || !isAdmin) {
          throw new Error('Necesitás permisos de administrador para eliminar documentos.');
        }
        try {
          await deleteDoc(doc(db, 'gestion_items', id));
        } catch (fsErr) {
          handleFirestoreError(fsErr, OperationType.DELETE, `gestion_items/${id}`);
        }
      } else {
        const res = await fetch(`/api/gestion/${section}/${id}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const errPayload = (await res.json()) as { error?: string };
          throw new Error(errPayload.error || 'No se pudo eliminar el documento.');
        }
      }

      setData((prev) => {
        const next = {
          ...prev,
          [section]: prev[section].filter((item) => item.id !== id),
        };
        writeGestionCache(cacheSource, next);
        return next;
      });
      setConfirmDeleteId(null);
      if (editingItemId === id) {
        resetForm();
      }
      setFormSuccess('Documento eliminado de la sección.');
    } catch (error) {
      setFormError(
        useFirestore
          ? 'No se pudo eliminar el documento en Firestore. Verificá los permisos de tu cuenta.'
          : error instanceof Error
            ? error.message
            : 'No se pudo eliminar el documento.'
      );
    }
  };

  return (
    <main className="bg-slate-50 min-h-[calc(100vh-4rem)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Encabezado */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <p className="text-xs font-medium text-sky-700">
              EDUCA.IA · EDU-GESTIÓN · Información institucional
            </p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0A192F] tracking-tight">
              Información pública y autorizada de la escuela
            </h1>
          </div>

          {/* Selector entre Consulta pública y Administración */}
          <div
            role="tablist"
            aria-label="Modo de EDU-GESTIÓN"
            className="grid grid-cols-2 gap-1 p-1 bg-slate-200/80 rounded-xl self-start lg:self-auto shrink-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'consulta'}
              onClick={() => {
                setMode('consulta');
                setFormSuccess(null);
                setFormError(null);
              }}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'consulta'
                  ? 'bg-white text-[#0A192F] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Landmark className="w-4 h-4 text-sky-700" />
              <span>Consulta pública</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={mode === 'admin'}
              onClick={() => {
                setMode('admin');
                setFormSuccess(null);
                setFormError(null);
              }}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'admin'
                  ? 'bg-[#0A192F] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Settings2 className="w-4 h-4 text-sky-400" />
              <span>Administración</span>
            </button>
          </div>
        </div>

        {/* Aviso institucional obligatorio de privacidad y alcance */}
        <div className="mt-5 bg-white border border-slate-200 rounded-xl px-4 py-3.5 flex items-start gap-3 text-xs sm:text-sm text-slate-600">
          <ShieldCheck className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
          <p>
            Espacio destinado exclusivamente a <strong>información pública y autorizada</strong> de
            la institución ({totalDocuments}{' '}
            {totalDocuments === 1 ? 'documento cargado' : 'documentos cargados'}). No incluye ni
            permite cargar datos personales, legajos, calificaciones ni información privada de
            estudiantes.
          </p>
        </div>

        {loadError && (
          <div
            role="alert"
            className="mt-5 rounded-xl bg-red-50 border border-red-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 text-sm text-red-900">
              <AlertTriangle className="w-5 h-5 text-red-700 shrink-0" />
              <span>{loadError}</span>
            </div>
            <button
              type="button"
              onClick={() => void fetchGestionData(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-900 bg-white border border-red-200 rounded-lg hover:bg-red-100 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reintentar</span>
            </button>
          </div>
        )}

        {/* Layout principal: menú de 5 apartados + contenido */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Navegación lateral de las 5 secciones */}
          <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 space-y-1.5">
            <p className="px-2 pb-2 text-xs font-semibold text-slate-500">
              Secciones institucionales
            </p>
            {GESTION_SECTIONS.map((section) => {
              const Icon = SECTION_ICONS[section.id];
              const count = data[section.id]?.length ?? 0;
              const isActive = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => handleSelectSection(section.id)}
                  aria-pressed={isActive}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-lg text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${
                    isActive
                      ? 'bg-[#0A192F] text-white'
                      : 'bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-sky-300' : 'text-sky-700'
                      }`}
                    />
                    <span className="text-sm font-semibold truncate">{section.label}</span>
                  </span>
                  <span
                    className={`text-xs font-medium tabular-nums shrink-0 ${
                      isActive ? 'text-sky-300' : 'text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </aside>

          {/* Contenido principal */}
          <section className="lg:col-span-8 space-y-5">
            {mode === 'consulta' ? (
              <>
                {/* Encabezado de sección + buscador */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="font-display text-xl font-bold text-[#0A192F]">
                        {activeSectionMeta.label}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {activeSectionMeta.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-start shrink-0">
                      <button
                        type="button"
                        onClick={() => void fetchGestionData(true)}
                        disabled={loading}
                        aria-label="Actualizar información institucional"
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 rounded-lg cursor-pointer whitespace-nowrap"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>Actualizar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode('admin')}
                        className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#0A192F] bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5 text-sky-700" />
                        <span>Cargar o editar</span>
                      </button>
                    </div>
                  </div>

                  {currentItems.length > 0 && (
                    <div className="mt-4 relative">
                      <Search
                        className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                        aria-hidden="true"
                      />
                      <label htmlFor="gestion-search" className="sr-only">
                        Buscar en {activeSectionMeta.label}
                      </label>
                      <input
                        id="gestion-search"
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={`Buscar en ${activeSectionMeta.label.toLowerCase()}...`}
                        className="w-full min-h-[42px] pl-10 pr-4 py-2 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  )}
                </div>

                {/* Lista de documentos o estado vacío honesto */}
                {loading ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-600">
                    Cargando información institucional...
                  </div>
                ) : currentItems.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-10 text-center">
                    <FileCheck2 className="w-10 h-10 text-slate-400 mx-auto" />
                    <h3 className="mt-3 font-display text-lg font-bold text-[#0A192F]">
                      Información no disponible
                    </h3>
                    <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                      Todavía no hay documentos ni registros públicos cargados en{' '}
                      <strong>{activeSectionMeta.label}</strong> por la escuela.
                    </p>
                    <button
                      type="button"
                      onClick={() => setMode('admin')}
                      className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0A192F] hover:bg-[#132C4E] rounded-lg cursor-pointer"
                    >
                      <Settings2 className="w-4 h-4 text-sky-300" />
                      <span>Ir a Administración para cargar</span>
                    </button>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                    <p className="text-sm font-medium text-[#0A192F]">
                      No se encontraron resultados para “{searchQuery}”.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="mt-3 text-xs font-semibold text-sky-700 hover:text-sky-900 cursor-pointer"
                    >
                      Limpiar búsqueda
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredItems.map((item) => {
                      const updatedDate = new Date(item.updatedAt).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      });
                      return (
                        <article
                          key={item.id}
                          className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                                {item.dateLabel && (
                                  <>
                                    <span className="font-semibold text-sky-800">
                                      {item.dateLabel}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                  </>
                                )}
                                {item.categoryTag && (
                                  <>
                                    <span className="font-medium text-slate-700">
                                      {item.categoryTag}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                  </>
                                )}
                                <span className="tabular-nums">Actualizado: {updatedDate}</span>
                              </div>

                              <h3 className="mt-1.5 font-display text-lg font-bold text-[#0A192F]">
                                {item.title}
                              </h3>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleStartEdit(item)}
                              aria-label={`Editar ${item.title}`}
                              className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-[#0A192F] hover:bg-slate-100 cursor-pointer shrink-0"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="mt-3 text-slate-700">
                            <FormattedMessage content={item.body} isUser={false} />
                          </div>

                          {item.authorizedBy && (
                            <p className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
                              Publicación autorizada por:{' '}
                              <strong className="text-slate-700">{item.authorizedBy}</strong>
                            </p>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            ) : useFirestore && authLoading ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-600">
                Verificando credenciales institucionales...
              </div>
            ) : useFirestore && !user ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-10 text-center">
                <Lock className="w-10 h-10 text-sky-700 mx-auto" />
                <h2 className="mt-3 font-display text-xl font-bold text-[#0A192F]">
                  Acceso restringido a administración
                </h2>
                <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                  Para cargar, editar o eliminar documentos institucionales en Cloud Firestore
                  iniciá sesión con tu correo y contraseña autorizados.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0A192F] hover:bg-[#132C4E] rounded-lg cursor-pointer"
                  >
                    <LogIn className="w-4 h-4 text-sky-300" />
                    <span>Iniciar sesión</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('consulta')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#0A192F] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    Volver a Consulta pública
                  </button>
                </div>
              </div>
            ) : useFirestore && !isAdmin ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-10 text-center">
                <ShieldCheck className="w-10 h-10 text-amber-600 mx-auto" />
                <h2 className="mt-3 font-display text-xl font-bold text-[#0A192F]">
                  Cuenta sin permisos de administración
                </h2>
                <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                  Iniciaste sesión como <strong>{user?.email}</strong>, pero este usuario no figura
                  como administrador institucional habilitado en Firestore (<code>admins/{'{uid}'}</code>).
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMode('consulta')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0A192F] hover:bg-[#132C4E] rounded-lg cursor-pointer"
                  >
                    Volver a Consulta pública
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void signOutUser().then(() => onOpenAuth());
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#0A192F] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    Cambiar de cuenta
                  </button>
                </div>
              </div>
            ) : (
              /* Modo Administración institucional */
              <>
                <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200">
                    <div>
                      <p className="text-xs font-medium text-sky-700">
                        Administración · {activeSectionMeta.label}
                      </p>
                      <h2 className="mt-0.5 font-display text-xl font-bold text-[#0A192F]">
                        {editingItemId
                          ? 'Editar registro institucional'
                          : 'Cargar nueva información institucional'}
                      </h2>
                    </div>

                    {editingItemId && (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Cancelar edición</span>
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleSubmitForm} className="mt-5 space-y-4">
                    <div>
                      <label
                        htmlFor="gestion-form-title"
                        className="block text-xs font-semibold text-[#0A192F]"
                      >
                        {activeSectionMeta.titleLabel}
                      </label>
                      <input
                        id="gestion-form-title"
                        type="text"
                        maxLength={200}
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder={activeSectionMeta.titlePlaceholder}
                        className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 bg-slate-50 focus:bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {activeSectionMeta.dateFieldLabel && (
                        <div>
                          <label
                            htmlFor="gestion-form-date"
                            className="block text-xs font-semibold text-[#0A192F]"
                          >
                            {activeSectionMeta.dateFieldLabel} (opcional)
                          </label>
                          <input
                            id="gestion-form-date"
                            type="text"
                            maxLength={80}
                            value={formDateLabel}
                            onChange={(e) => setFormDateLabel(e.target.value)}
                            placeholder={activeSectionMeta.dateFieldPlaceholder}
                            className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 bg-slate-50 focus:bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                        </div>
                      )}

                      <div className={!activeSectionMeta.dateFieldLabel ? 'sm:col-span-2' : ''}>
                        <label
                          htmlFor="gestion-form-tag"
                          className="block text-xs font-semibold text-[#0A192F]"
                        >
                          {activeSectionMeta.tagFieldLabel} (opcional)
                        </label>
                        <input
                          id="gestion-form-tag"
                          type="text"
                          maxLength={80}
                          value={formCategoryTag}
                          onChange={(e) => setFormCategoryTag(e.target.value)}
                          placeholder={activeSectionMeta.tagFieldPlaceholder}
                          className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 bg-slate-50 focus:bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="gestion-form-body"
                          className="text-xs font-semibold text-[#0A192F]"
                        >
                          {activeSectionMeta.bodyLabel}
                        </label>
                        <span className="text-xs text-slate-400 tabular-nums">
                          {formBody.length}/5000
                        </span>
                      </div>
                      <textarea
                        id="gestion-form-body"
                        rows={5}
                        maxLength={5000}
                        value={formBody}
                        onChange={(e) => setFormBody(e.target.value)}
                        placeholder={activeSectionMeta.bodyPlaceholder}
                        className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 focus:bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="gestion-form-auth"
                        className="block text-xs font-semibold text-[#0A192F]"
                      >
                        Área o autoridad que autoriza la publicación (opcional)
                      </label>
                      <input
                        id="gestion-form-auth"
                        type="text"
                        maxLength={120}
                        value={formAuthorizedBy}
                        onChange={(e) => setFormAuthorizedBy(e.target.value)}
                        placeholder="Ej.: Equipo Directivo / Secretaría Académica"
                        className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 bg-slate-50 focus:bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    {formError && (
                      <div
                        role="alert"
                        className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs sm:text-sm text-red-900"
                      >
                        {formError}
                      </div>
                    )}

                    {formSuccess && (
                      <div
                        role="status"
                        className="p-3.5 rounded-lg bg-sky-50 border border-sky-200 text-xs sm:text-sm text-[#0A192F]"
                      >
                        {formSuccess}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <p className="text-xs text-slate-500">
                        Solo publicar información institucional oficial, sin datos privados.
                      </p>
                      <button
                        type="submit"
                        disabled={saving}
                        className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0A192F] hover:bg-[#132C4E] disabled:bg-slate-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4 text-sky-300" />
                        <span>
                          {saving
                            ? 'Guardando...'
                            : editingItemId
                              ? 'Guardar cambios'
                              : 'Publicar en esta sección'}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Listado de gestión para editar o eliminar */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
                  <h3 className="font-display text-base font-bold text-[#0A192F]">
                    Registros cargados en {activeSectionMeta.label} ({currentItems.length})
                  </h3>

                  {currentItems.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">
                      Todavía no hay documentos cargados en esta sección.
                    </p>
                  ) : (
                    <ul className="mt-4 divide-y divide-slate-200">
                      {currentItems.map((item) => (
                        <li key={item.id} className="py-3.5 first:pt-0 last:pb-0">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[#0A192F] truncate">
                                {item.title}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {[item.dateLabel, item.categoryTag, item.authorizedBy]
                                  .filter(Boolean)
                                  .join(' · ') || 'Sin etiquetas adicionales'}
                              </p>
                            </div>

                            {confirmDeleteId === item.id ? (
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteItem(item.section, item.id)}
                                  className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
                                >
                                  Confirmar
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(item)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0A192F] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  <span>Editar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(item.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Eliminar</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
