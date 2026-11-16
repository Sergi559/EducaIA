import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  BookOpen,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  FolderKanban,
  ListChecks,
  LogIn,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { STUDY_DAYS, SUBJECTS, findSubject } from '../data/curriculum.ts';
import { OperationType, db, handleFirestoreError } from '../lib/firebase.ts';
import type {
  OrganizaSubtask,
  OrganizaTask,
  OrganizaTaskKind,
  StudyDayId,
  WeeklyStudyBlock,
} from '../types/educaia.ts';

const TASKS_STORAGE_KEY = 'educaia_organiza_tasks_v1';
const WEEKLY_STORAGE_KEY = 'educaia_organiza_weekly_v1';

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const TASK_KIND_LABELS: Record<OrganizaTaskKind, string> = {
  tarea: 'Tarea',
  'trabajo-practico': 'Trabajo práctico',
  evaluacion: 'Evaluación',
  'practica-campo': 'Práctica de campo',
};

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysKey(baseDate: Date, offsetDays: number): string {
  const next = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + offsetDays);
  return toDateKey(next);
}

function formatDisplayDate(dateKey: string): string {
  const parts = dateKey.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateKey;
  const [year, month, day] = parts;
  return `${day} ${MONTH_NAMES[month - 1]?.slice(0, 3).toLowerCase() ?? ''} ${year}`;
}

function getRelativeDueLabel(dateKey: string, completed: boolean, todayKey: string): {
  label: string;
  urgent: boolean;
} {
  if (completed) {
    return { label: 'Completada', urgent: false };
  }
  const today = new Date(`${todayKey}T00:00:00`);
  const target = new Date(`${dateKey}T00:00:00`);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const abs = Math.abs(diffDays);
    return {
      label: abs === 1 ? 'Vencida ayer' : `Vencida hace ${abs} días`,
      urgent: true,
    };
  }
  if (diffDays === 0) return { label: 'Entrega hoy', urgent: true };
  if (diffDays === 1) return { label: 'Entrega mañana', urgent: true };
  if (diffDays <= 7) return { label: `En ${diffDays} días`, urgent: false };
  return { label: `En ${diffDays} días`, urgent: false };
}

function getSubjectLabel(subjectId: string): string {
  if (subjectId === 'otra') return 'Otra actividad escolar';
  return findSubject(subjectId)?.name ?? 'Materia';
}

function buildCalendarGrid(year: number, monthIndex: number): Array<{
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
}> {
  const firstDay = new Date(year, monthIndex, 1);
  // Lunes = 0 ... Domingo = 6
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const prevMonthDays = new Date(year, monthIndex, 0).getDate();

  const cells: Array<{ dateKey: string; dayNumber: number; inCurrentMonth: boolean }> = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    const date = new Date(year, monthIndex - 1, dayNum);
    cells.push({
      dateKey: toDateKey(date),
      dayNumber: dayNum,
      inCurrentMonth: false,
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, monthIndex, d);
    cells.push({
      dateKey: toDateKey(date),
      dayNumber: d,
      inCurrentMonth: true,
    });
  }

  const remaining = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const date = new Date(year, monthIndex + 1, d);
    cells.push({
      dateKey: toDateKey(date),
      dayNumber: d,
      inCurrentMonth: false,
    });
  }

  return cells;
}

function loadLocalArray<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function saveLocalArray<T>(key: string, items: T[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Si el navegador bloquea el almacenamiento o está lleno, continuamos en memoria sin romper la interfaz
  }
}

type OrganizaTab = 'calendario' | 'plan-semanal';
type TaskStatusFilter = 'todas' | 'pendientes' | 'completadas';

interface EduOrganizaViewProps {
  onOpenAuth: () => void;
}

function buildFirestoreTaskPayload(task: OrganizaTask, isCreate: boolean): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: task.title.slice(0, 200),
    subjectId: task.subjectId.slice(0, 64),
    dueDate: task.dueDate.slice(0, 10),
    kind: task.kind,
    completed: Boolean(task.completed),
    subtasks: task.subtasks.slice(0, 30).map((st) => ({
      id: String(st.id).slice(0, 64),
      title: String(st.title).slice(0, 200),
      completed: Boolean(st.completed),
    })),
    updatedAt: serverTimestamp(),
  };

  if (task.notes?.trim()) {
    payload.notes = task.notes.trim().slice(0, 1000);
  } else if (!isCreate) {
    payload.notes = deleteField();
  }
  if (isCreate) {
    payload.createdAt = serverTimestamp();
  }
  return payload;
}

function buildFirestoreBlockPayload(block: WeeklyStudyBlock): Record<string, unknown> {
  return {
    day: block.day,
    subjectId: block.subjectId.slice(0, 64),
    timeRange: block.timeRange.slice(0, 40),
    durationMinutes: Math.min(480, Math.max(5, Math.round(block.durationMinutes))),
    focusTopic: block.focusTopic.slice(0, 200),
    completedThisWeek: Boolean(block.completedThisWeek),
    updatedAt: serverTimestamp(),
  };
}

const ORGANIZA_SYNC_SESSION_KEY = 'educaia_organiza_cloud_sync_v1';
const ORGANIZA_SYNC_TTL_MS = 5 * 60 * 1000;

function wasOrganizaRecentlySynced(uid: string): boolean {
  try {
    const raw = window.sessionStorage.getItem(ORGANIZA_SYNC_SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { uid?: string; ts?: number };
    return (
      parsed.uid === uid &&
      typeof parsed.ts === 'number' &&
      Date.now() - parsed.ts < ORGANIZA_SYNC_TTL_MS
    );
  } catch {
    return false;
  }
}

function markOrganizaSynced(uid: string): void {
  try {
    window.sessionStorage.setItem(
      ORGANIZA_SYNC_SESSION_KEY,
      JSON.stringify({ uid, ts: Date.now() })
    );
  } catch {
    // Ignorar límite de sessionStorage
  }
}

export function EduOrganizaView({ onOpenAuth }: EduOrganizaViewProps) {
  const { isFirebaseConfigured, user } = useAuth();
  const cloudSyncEnabled = Boolean(isFirebaseConfigured && db && user);

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);

  const [activeTab, setActiveTab] = useState<OrganizaTab>('calendario');
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<OrganizaTask[]>(() => loadLocalArray<OrganizaTask>(TASKS_STORAGE_KEY));
  const [weeklyBlocks, setWeeklyBlocks] = useState<WeeklyStudyBlock[]>(() =>
    loadLocalArray<WeeklyStudyBlock>(WEEKLY_STORAGE_KEY)
  );

  // Estado del calendario
  const [calendarMonth, setCalendarMonth] = useState<{ year: number; month: number }>({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  // Filtros de lista de tareas
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('todas');
  const [subjectFilter, setSubjectFilter] = useState<string>('todas');

  // Formulario de nueva/edición de tarea
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskSubjectId, setTaskSubjectId] = useState('agricultura');
  const [taskDueDate, setTaskDueDate] = useState(todayKey);
  const [taskKind, setTaskKind] = useState<OrganizaTaskKind>('trabajo-practico');
  const [taskNotes, setTaskNotes] = useState('');
  const [draftSubtasks, setDraftSubtasks] = useState<OrganizaSubtask[]>([]);
  const [draftStepText, setDraftStepText] = useState('');
  const [taskFormError, setTaskFormError] = useState<string | null>(null);

  // Inputs rápidos para añadir subtarea dentro de una tarjeta existente
  const [inlineStepInputs, setInlineStepInputs] = useState<Record<string, string>>({});

  // Formulario de plan semanal
  const [planDay, setPlanDay] = useState<StudyDayId>('lunes');
  const [planSubjectId, setPlanSubjectId] = useState('matematica');
  const [planTimeRange, setPlanTimeRange] = useState('17:30');
  const [planDuration, setPlanDuration] = useState(45);
  const [planFocusTopic, setPlanFocusTopic] = useState('');
  const [planError, setPlanError] = useState<string | null>(null);

  // Confirmación limpia para borrar datos locales
  const [confirmClearLocal, setConfirmClearLocal] = useState(false);

  useEffect(() => {
    saveLocalArray(TASKS_STORAGE_KEY, tasks);
  }, [tasks]);

  useEffect(() => {
    saveLocalArray(WEEKLY_STORAGE_KEY, weeklyBlocks);
  }, [weeklyBlocks]);

  // Carga inicial desde Cloud Firestore cuando hay usuario autenticado (con caché de sesión para cuidar cuota gratuita Spark)
  useEffect(() => {
    if (!cloudSyncEnabled || !db || !user) {
      setCloudLoading(false);
      setCloudError(null);
      return;
    }

    const uid = user.uid;
    if (wasOrganizaRecentlySynced(uid)) {
      setCloudLoading(false);
      setCloudError(null);
      return;
    }

    let active = true;
    const firestore = db;

    const loadCloudOrganiza = async () => {
      setCloudLoading(true);
      setCloudError(null);
      try {
        let remoteTasks: OrganizaTask[] = [];
        let remoteBlocks: WeeklyStudyBlock[] = [];

        try {
          const [tasksSnap, blocksSnap] = await Promise.all([
            getDocs(collection(firestore, 'users', uid, 'organiza_tasks')),
            getDocs(collection(firestore, 'users', uid, 'organiza_weekly')),
          ]);

          remoteTasks = tasksSnap.docs.map((d) => {
            const raw = d.data();
            return {
              id: d.id,
              title: String(raw.title ?? ''),
              subjectId: String(raw.subjectId ?? 'otra'),
              dueDate: String(raw.dueDate ?? todayKey),
              kind: (raw.kind as OrganizaTaskKind) || 'tarea',
              notes: typeof raw.notes === 'string' ? raw.notes : undefined,
              completed: Boolean(raw.completed),
              subtasks: Array.isArray(raw.subtasks) ? (raw.subtasks as OrganizaSubtask[]) : [],
              createdAt:
                typeof raw.createdAt?.toDate === 'function'
                  ? raw.createdAt.toDate().toISOString()
                  : new Date().toISOString(),
            };
          });

          remoteBlocks = blocksSnap.docs.map((d) => {
            const raw = d.data();
            return {
              id: d.id,
              day: (raw.day as StudyDayId) || 'lunes',
              subjectId: String(raw.subjectId ?? 'matematica'),
              timeRange: String(raw.timeRange ?? '18:00'),
              durationMinutes: Number(raw.durationMinutes) || 45,
              focusTopic: String(raw.focusTopic ?? ''),
              completedThisWeek: Boolean(raw.completedThisWeek),
            };
          });
        } catch (fsErr) {
          handleFirestoreError(fsErr, OperationType.LIST, `users/${uid}/organiza_tasks`);
        }

        if (!active) return;

        if (remoteTasks.length > 0 || remoteBlocks.length > 0) {
          setTasks(remoteTasks);
          setWeeklyBlocks(remoteBlocks);
        } else {
          // Si la nube aún está vacía pero hay datos locales previos, los sincronizamos
          const localTasks = loadLocalArray<OrganizaTask>(TASKS_STORAGE_KEY);
          const localBlocks = loadLocalArray<WeeklyStudyBlock>(WEEKLY_STORAGE_KEY);
          if (localTasks.length > 0 || localBlocks.length > 0) {
            const batch = writeBatch(firestore);
            for (const t of localTasks.slice(0, 50)) {
              batch.set(
                doc(firestore, 'users', uid, 'organiza_tasks', t.id),
                buildFirestoreTaskPayload(t, true)
              );
            }
            for (const b of localBlocks.slice(0, 50)) {
              batch.set(
                doc(firestore, 'users', uid, 'organiza_weekly', b.id),
                buildFirestoreBlockPayload(b)
              );
            }
            await batch.commit();
          }
        }
        markOrganizaSynced(uid);
      } catch {
        if (active) {
          setCloudError(
            'No se pudo sincronizar EDU-ORGANIZA con Firestore. Tus cambios siguen resguardados localmente.'
          );
        }
      } finally {
        if (active) {
          setCloudLoading(false);
        }
      }
    };

    void loadCloudOrganiza();
    return () => {
      active = false;
    };
  }, [cloudSyncEnabled, user, todayKey]);

  const syncTaskToCloud = async (task: OrganizaTask, isCreate: boolean) => {
    if (!cloudSyncEnabled || !db || !user) return;
    try {
      await setDoc(
        doc(db, 'users', user.uid, 'organiza_tasks', task.id),
        buildFirestoreTaskPayload(task, isCreate),
        { merge: !isCreate }
      );
      setCloudError(null);
    } catch (fsErr) {
      setCloudError('No se pudo guardar la tarea en la nube. Se conservó localmente.');
      try {
        handleFirestoreError(
          fsErr,
          isCreate ? OperationType.CREATE : OperationType.UPDATE,
          `users/${user.uid}/organiza_tasks/${task.id}`
        );
      } catch {
        // Error estructurado ya registrado en consola
      }
    }
  };

  const deleteTaskFromCloud = async (taskId: string) => {
    if (!cloudSyncEnabled || !db || !user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'organiza_tasks', taskId));
      setCloudError(null);
    } catch (fsErr) {
      setCloudError('No se pudo eliminar la tarea en la nube.');
      try {
        handleFirestoreError(fsErr, OperationType.DELETE, `users/${user.uid}/organiza_tasks/${taskId}`);
      } catch {
        // Registrado en consola
      }
    }
  };

  const syncBlockToCloud = async (block: WeeklyStudyBlock) => {
    if (!cloudSyncEnabled || !db || !user) return;
    try {
      await setDoc(
        doc(db, 'users', user.uid, 'organiza_weekly', block.id),
        buildFirestoreBlockPayload(block),
        { merge: true }
      );
      setCloudError(null);
    } catch (fsErr) {
      setCloudError('No se pudo guardar el bloque semanal en la nube.');
      try {
        handleFirestoreError(
          fsErr,
          OperationType.WRITE,
          `users/${user.uid}/organiza_weekly/${block.id}`
        );
      } catch {
        // Registrado en consola
      }
    }
  };

  const deleteBlockFromCloud = async (blockId: string) => {
    if (!cloudSyncEnabled || !db || !user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'organiza_weekly', blockId));
      setCloudError(null);
    } catch (fsErr) {
      setCloudError('No se pudo eliminar el bloque semanal en la nube.');
      try {
        handleFirestoreError(
          fsErr,
          OperationType.DELETE,
          `users/${user.uid}/organiza_weekly/${blockId}`
        );
      } catch {
        // Registrado en consola
      }
    }
  };

  const generalSubjects = useMemo(() => SUBJECTS.filter((s) => s.category === 'general'), []);
  const technicalSubjects = useMemo(() => SUBJECTS.filter((s) => s.category === 'tecnica'), []);

  const calendarCells = useMemo(
    () => buildCalendarGrid(calendarMonth.year, calendarMonth.month),
    [calendarMonth]
  );

  // Mapa rápido por fecha YYYY-MM-DD -> conteo de pendientes / completadas
  const tasksByDate = useMemo(() => {
    const map = new Map<string, { pending: number; completed: number }>();
    for (const task of tasks) {
      const current = map.get(task.dueDate) ?? { pending: 0, completed: 0 };
      if (task.completed) {
        current.completed += 1;
      } else {
        current.pending += 1;
      }
      map.set(task.dueDate, current);
    }
    return map;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return [...tasks]
      .filter((task) => {
        if (statusFilter === 'pendientes' && task.completed) return false;
        if (statusFilter === 'completadas' && !task.completed) return false;
        if (subjectFilter !== 'todas' && task.subjectId !== subjectFilter) return false;
        if (selectedDateKey && task.dueDate !== selectedDateKey) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [tasks, statusFilter, subjectFilter, selectedDateKey]);

  const stats = useMemo(() => {
    const pending = tasks.filter((t) => !t.completed).length;
    const completed = tasks.filter((t) => t.completed).length;
    const weekEndKey = addDaysKey(today, 7);
    const dueThisWeek = tasks.filter(
      (t) => !t.completed && t.dueDate >= todayKey && t.dueDate <= weekEndKey
    ).length;
    const totalWeeklyMinutes = weeklyBlocks.reduce((acc, b) => acc + b.durationMinutes, 0);
    const completedWeeklyBlocks = weeklyBlocks.filter((b) => b.completedThisWeek).length;
    return {
      pending,
      completed,
      dueThisWeek,
      totalWeeklyMinutes,
      completedWeeklyBlocks,
    };
  }, [tasks, weeklyBlocks, today, todayKey]);

  const openNewTaskForm = (prefilledDate?: string) => {
    setEditingTaskId(null);
    setTaskTitle('');
    setTaskSubjectId('agricultura');
    setTaskDueDate(prefilledDate || selectedDateKey || todayKey);
    setTaskKind('trabajo-practico');
    setTaskNotes('');
    setDraftSubtasks([]);
    setDraftStepText('');
    setTaskFormError(null);
    setFormOpen(true);
    setActiveTab('calendario');
  };

  const openEditTaskForm = (task: OrganizaTask) => {
    setEditingTaskId(task.id);
    setTaskTitle(task.title);
    setTaskSubjectId(task.subjectId);
    setTaskDueDate(task.dueDate);
    setTaskKind(task.kind);
    setTaskNotes(task.notes ?? '');
    setDraftSubtasks(task.subtasks.map((s) => ({ ...s })));
    setDraftStepText('');
    setTaskFormError(null);
    setFormOpen(true);
  };

  const addDraftStep = () => {
    const clean = draftStepText.trim();
    if (!clean) return;
    setDraftSubtasks((prev) => [
      ...prev,
      { id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title: clean, completed: false },
    ]);
    setDraftStepText('');
  };

  const suggestBreakdownSteps = () => {
    const suggested = [
      'Revisar consignas, apuntes y materiales necesarios',
      'Desarrollar la parte principal y verificar cálculos o conceptos',
      'Repasar redacción, prolijidad y preparar la entrega',
    ];
    setDraftSubtasks((prev) => [
      ...prev,
      ...suggested.map((title, idx) => ({
        id: `step-${Date.now()}-${idx}`,
        title,
        completed: false,
      })),
    ]);
  };

  const handleSaveTask = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanTitle = taskTitle.trim();
    if (!cleanTitle) {
      setTaskFormError('Indicá el nombre de la tarea o trabajo antes de guardar.');
      return;
    }
    if (!taskDueDate) {
      setTaskFormError('Seleccioná una fecha de entrega.');
      return;
    }

    const finalSubtasks = [...draftSubtasks];
    if (draftStepText.trim()) {
      finalSubtasks.push({
        id: `step-${Date.now()}`,
        title: draftStepText.trim(),
        completed: false,
      });
    }

    if (editingTaskId) {
      const existingTask = tasks.find((item) => item.id === editingTaskId);
      const updatedTask: OrganizaTask | null = existingTask
        ? {
            ...existingTask,
            title: cleanTitle,
            subjectId: taskSubjectId,
            dueDate: taskDueDate,
            kind: taskKind,
            notes: taskNotes.trim() || undefined,
            subtasks: finalSubtasks,
          }
        : null;

      if (updatedTask) {
        setTasks((prev) => prev.map((item) => (item.id === editingTaskId ? updatedTask : item)));
        void syncTaskToCloud(updatedTask, false);
      }
    } else {
      const newTask: OrganizaTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: cleanTitle,
        subjectId: taskSubjectId,
        dueDate: taskDueDate,
        kind: taskKind,
        notes: taskNotes.trim() || undefined,
        completed: false,
        subtasks: finalSubtasks,
        createdAt: new Date().toISOString(),
      };
      setTasks((prev) => [newTask, ...prev]);
      void syncTaskToCloud(newTask, true);
    }

    setFormOpen(false);
    setEditingTaskId(null);
    setDraftStepText('');
    setTaskFormError(null);
  };

  const toggleTaskCompleted = (taskId: string) => {
    const current = tasks.find((t) => t.id === taskId);
    if (!current) return;
    const updated: OrganizaTask = { ...current, completed: !current.completed };
    setTasks((prev) => prev.map((task) => (task.id === taskId ? updated : task)));
    void syncTaskToCloud(updated, false);
  };

  const deleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    void deleteTaskFromCloud(taskId);
  };

  const toggleSubtaskCompleted = (taskId: string, subtaskId: string) => {
    const current = tasks.find((t) => t.id === taskId);
    if (!current) return;
    const updated: OrganizaTask = {
      ...current,
      subtasks: current.subtasks.map((st) =>
        st.id === subtaskId ? { ...st, completed: !st.completed } : st
      ),
    };
    setTasks((prev) => prev.map((task) => (task.id === taskId ? updated : task)));
    void syncTaskToCloud(updated, false);
  };

  const addInlineSubtask = (taskId: string) => {
    const raw = inlineStepInputs[taskId] ?? '';
    const clean = raw.trim();
    if (!clean) return;
    const current = tasks.find((t) => t.id === taskId);
    if (!current) return;

    const updated: OrganizaTask = {
      ...current,
      subtasks: [
        ...current.subtasks,
        {
          id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: clean,
          completed: false,
        },
      ],
    };
    setTasks((prev) => prev.map((task) => (task.id === taskId ? updated : task)));
    setInlineStepInputs((prev) => ({ ...prev, [taskId]: '' }));
    void syncTaskToCloud(updated, false);
  };

  const removeSubtaskFromTask = (taskId: string, subtaskId: string) => {
    const current = tasks.find((t) => t.id === taskId);
    if (!current) return;
    const updated: OrganizaTask = {
      ...current,
      subtasks: current.subtasks.filter((st) => st.id !== subtaskId),
    };
    setTasks((prev) => prev.map((task) => (task.id === taskId ? updated : task)));
    void syncTaskToCloud(updated, false);
  };

  const handleAddWeeklyBlock = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanFocus = planFocusTopic.trim();
    if (!cleanFocus) {
      setPlanError('Escribí qué actividad o tema vas a estudiar en este bloque.');
      return;
    }

    const newBlock: WeeklyStudyBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      day: planDay,
      subjectId: planSubjectId,
      timeRange: planTimeRange.trim() || '18:00',
      durationMinutes: Number(planDuration) || 45,
      focusTopic: cleanFocus,
      completedThisWeek: false,
    };

    setWeeklyBlocks((prev) => [...prev, newBlock]);
    setPlanFocusTopic('');
    setPlanError(null);
    void syncBlockToCloud(newBlock);
  };

  const toggleWeeklyBlockDone = (blockId: string) => {
    const current = weeklyBlocks.find((b) => b.id === blockId);
    if (!current) return;
    const updated: WeeklyStudyBlock = {
      ...current,
      completedThisWeek: !current.completedThisWeek,
    };
    setWeeklyBlocks((prev) => prev.map((block) => (block.id === blockId ? updated : block)));
    void syncBlockToCloud(updated);
  };

  const deleteWeeklyBlock = (blockId: string) => {
    setWeeklyBlocks((prev) => prev.filter((block) => block.id !== blockId));
    void deleteBlockFromCloud(blockId);
  };

  const resetWeeklyChecks = () => {
    const updatedBlocks = weeklyBlocks.map((block) => ({ ...block, completedThisWeek: false }));
    setWeeklyBlocks(updatedBlocks);
    for (const block of updatedBlocks) {
      void syncBlockToCloud(block);
    }
  };

  const loadSampleData = () => {
    const sampleTasks: OrganizaTask[] = [
      {
        id: 'sample-task-1',
        title: 'Informe técnico sobre textura y estructura del suelo de la huerta',
        subjectId: 'suelos',
        dueDate: addDaysKey(today, 2),
        kind: 'trabajo-practico',
        notes: 'Recordar incluir croquis de los perfiles observados en la práctica.',
        completed: false,
        subtasks: [
          { id: 's1-a', title: 'Pasar en limpio datos de la prueba del tacto', completed: true },
          { id: 's1-b', title: 'Calcular porcentajes aproximados de arena, limo y arcilla', completed: false },
          { id: 's1-c', title: 'Redactar conclusiones y recomendaciones de cobertura', completed: false },
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'sample-task-2',
        title: 'Cálculo de lámina neta y tiempo de riego en invernadero',
        subjectId: 'riego',
        dueDate: addDaysKey(today, 4),
        kind: 'tarea',
        completed: false,
        subtasks: [
          { id: 's2-a', title: 'Repasar fórmula de caudal por emisor (L/h)', completed: false },
          { id: 's2-b', title: 'Resolver guía de 4 ejercicios prácticos', completed: false },
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'sample-task-3',
        title: 'Evaluación escrita de ecuaciones y proporciones aplicadas',
        subjectId: 'matematica',
        dueDate: addDaysKey(today, 6),
        kind: 'evaluacion',
        completed: false,
        subtasks: [],
        createdAt: new Date().toISOString(),
      },
    ];

    const sampleBlocks: WeeklyStudyBlock[] = [
      {
        id: 'sample-b-1',
        day: 'lunes',
        subjectId: 'suelos',
        timeRange: '17:30',
        durationMinutes: 45,
        focusTopic: 'Pasar apuntes de textura y armar borrador del informe',
        completedThisWeek: true,
      },
      {
        id: 'sample-b-2',
        day: 'miercoles',
        subjectId: 'riego',
        timeRange: '18:00',
        durationMinutes: 60,
        focusTopic: 'Practicar ejercicios de caudal y espaciamiento de goteros',
        completedThisWeek: false,
      },
      {
        id: 'sample-b-3',
        day: 'viernes',
        subjectId: 'matematica',
        timeRange: '17:00',
        durationMinutes: 45,
        focusTopic: 'Repasar porcentajes de germinación y regla de tres',
        completedThisWeek: false,
      },
    ];

    setTasks(sampleTasks);
    setWeeklyBlocks(sampleBlocks);
    for (const t of sampleTasks) void syncTaskToCloud(t, true);
    for (const b of sampleBlocks) void syncBlockToCloud(b);
  };

  const clearAllLocalData = () => {
    const prevTasks = tasks;
    const prevBlocks = weeklyBlocks;
    setTasks([]);
    setWeeklyBlocks([]);
    setSelectedDateKey(null);
    setConfirmClearLocal(false);
    for (const t of prevTasks) void deleteTaskFromCloud(t.id);
    for (const b of prevBlocks) void deleteBlockFromCloud(b.id);
  };

  const prevMonth = () => {
    setCalendarMonth((prev) =>
      prev.month === 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: prev.month - 1 }
    );
  };

  const nextMonth = () => {
    setCalendarMonth((prev) =>
      prev.month === 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: prev.month + 1 }
    );
  };

  const goToCurrentMonth = () => {
    setCalendarMonth({ year: today.getFullYear(), month: today.getMonth() });
    setSelectedDateKey(todayKey);
  };

  const totalWeeklyHoursText = useMemo(() => {
    const hours = Math.floor(stats.totalWeeklyMinutes / 60);
    const mins = stats.totalWeeklyMinutes % 60;
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} h`;
    return `${hours} h ${mins} min`;
  }, [stats.totalWeeklyMinutes]);

  return (
    <main className="bg-slate-50 min-h-[calc(100vh-4rem)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Encabezado de EDU-ORGANIZA */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <p className="text-xs font-medium text-sky-700">
              EDUCA.IA · EDU-ORGANIZA · Organizador escolar
            </p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0A192F] tracking-tight">
              Calendario de entregas, tareas y plan semanal
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => openNewTaskForm()}
              className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 text-sm font-semibold text-white bg-[#0A192F] hover:bg-[#132C4E] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-sky-300" />
              <span>Nueva tarea</span>
            </button>

            {tasks.length === 0 && weeklyBlocks.length === 0 && (
              <button
                type="button"
                onClick={loadSampleData}
                className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 text-sm font-medium text-[#0A192F] bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <BookOpen className="w-4 h-4 text-sky-700" />
                <span>Cargar ejemplo orientativo</span>
              </button>
            )}

            {(tasks.length > 0 || weeklyBlocks.length > 0) && !confirmClearLocal && (
              <button
                type="button"
                onClick={() => setConfirmClearLocal(true)}
                className="inline-flex items-center justify-center gap-1.5 min-h-[42px] px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-red-700 bg-white hover:bg-red-50 border border-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Borrar datos locales</span>
              </button>
            )}
          </div>
        </div>

        {/* Estado de almacenamiento local / nube Firebase */}
        <div className="mt-4 bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-sky-700 shrink-0" />
            {cloudSyncEnabled ? (
              <span>
                {cloudLoading
                  ? 'Sincronizando tu organizador con Cloud Firestore...'
                  : `Sincronizado en Cloud Firestore con ${user?.email ?? 'tu cuenta'}.`}
              </span>
            ) : (
              <span>
                Guardado localmente en este navegador (sin cuentas ni datos personales).
              </span>
            )}
          </div>

          {!cloudSyncEnabled && isFirebaseConfigured && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0A192F] bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg cursor-pointer self-start sm:self-auto whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5 text-sky-700" />
              <span>Iniciar sesión para sincronizar</span>
            </button>
          )}
        </div>

        {cloudError && (
          <div
            role="alert"
            className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-950"
          >
            {cloudError}
          </div>
        )}

        {/* Confirmación en línea para borrar datos del navegador */}
        {confirmClearLocal && (
          <div
            role="alert"
            className="mt-4 rounded-xl bg-amber-50 border border-amber-300 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <p className="text-sm text-amber-950">
              ¿Querés borrar todas las tareas y bloques semanales guardados en este navegador? Esta
              acción deja el organizador en blanco.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setConfirmClearLocal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={clearAllLocalData}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                Sí, borrar todo
              </button>
            </div>
          </div>
        )}

        {/* Resumen numérico y selector de vista */}
        <div className="mt-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3.5">
              <p className="text-xs text-slate-500">Pendientes</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#0A192F] tabular-nums">
                {stats.pending}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3.5">
              <p className="text-xs text-slate-500">Completadas</p>
              <p className="mt-1 font-display text-2xl font-bold text-sky-700 tabular-nums">
                {stats.completed}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3.5">
              <p className="text-xs text-slate-500">Próximos 7 días</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#0A192F] tabular-nums">
                {stats.dueThisWeek}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3.5">
              <p className="text-xs text-slate-500">Plan semanal</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#0A192F] tabular-nums">
                {totalWeeklyHoursText}
              </p>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Secciones de EDU-ORGANIZA"
            className="grid grid-cols-2 gap-1 p-1 bg-slate-200/80 rounded-xl shrink-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'calendario'}
              onClick={() => setActiveTab('calendario')}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'calendario'
                  ? 'bg-white text-[#0A192F] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-4 h-4 text-sky-700" />
              <span>Calendario y tareas</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'plan-semanal'}
              onClick={() => setActiveTab('plan-semanal')}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'plan-semanal'
                  ? 'bg-white text-[#0A192F] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderKanban className="w-4 h-4 text-sky-700" />
              <span>Plan semanal</span>
            </button>
          </div>
        </div>

        {/* Vista 1: Calendario + Lista de tareas */}
        {activeTab === 'calendario' ? (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Columna izquierda: Calendario mensual y formulario */}
            <div className="lg:col-span-5 space-y-6">
              {/* Calendario */}
              <section className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-bold text-[#0A192F]">
                    {MONTH_NAMES[calendarMonth.month]} {calendarMonth.year}
                  </h2>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={prevMonth}
                      aria-label="Mes anterior"
                      className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={goToCurrentMonth}
                      className="px-3 h-9 text-xs font-semibold rounded-lg border border-slate-200 text-[#0A192F] hover:bg-slate-100 cursor-pointer"
                    >
                      Hoy
                    </button>
                    <button
                      type="button"
                      onClick={nextMonth}
                      aria-label="Mes siguiente"
                      className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Cabecera de días */}
                <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
                  {WEEKDAY_SHORT.map((dayName) => (
                    <div key={dayName} className="py-1.5">
                      {dayName}
                    </div>
                  ))}
                </div>

                {/* Días del mes */}
                <div className="mt-1 grid grid-cols-7 gap-1">
                  {calendarCells.map((cell) => {
                    const summary = tasksByDate.get(cell.dateKey);
                    const isToday = cell.dateKey === todayKey;
                    const isSelected = cell.dateKey === selectedDateKey;
                    const totalForDay = (summary?.pending ?? 0) + (summary?.completed ?? 0);

                    return (
                      <button
                        key={cell.dateKey}
                        type="button"
                        onClick={() =>
                          setSelectedDateKey((prev) =>
                            prev === cell.dateKey ? null : cell.dateKey
                          )
                        }
                        aria-label={`${cell.dayNumber} de ${MONTH_NAMES[calendarMonth.month]}${
                          summary?.pending ? `, ${summary.pending} tareas pendientes` : ''
                        }`}
                        aria-pressed={isSelected}
                        className={`min-h-[46px] p-1.5 rounded-lg flex flex-col items-center justify-between text-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${
                          isSelected
                            ? 'bg-[#0A192F] text-white'
                            : isToday
                              ? 'bg-sky-50 text-[#0A192F] border border-sky-400 font-semibold'
                              : cell.inCurrentMonth
                                ? 'bg-white hover:bg-slate-100 text-slate-800 border border-transparent'
                                : 'bg-slate-50/60 text-slate-400 hover:bg-slate-100 border border-transparent'
                        }`}
                      >
                        <span className="tabular-nums leading-none">{cell.dayNumber}</span>

                        {totalForDay > 0 ? (
                          <span
                            className={`text-[10px] font-semibold tabular-nums leading-none ${
                              isSelected
                                ? 'text-sky-300'
                                : (summary?.pending ?? 0) > 0
                                  ? 'text-sky-700'
                                  : 'text-slate-400'
                            }`}
                          >
                            {summary?.pending ? `${summary.pending}p` : `${summary?.completed}c`}
                          </span>
                        ) : (
                          <span className="h-2.5" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>Tocá un día para filtrar entregas (p: pendientes · c: completadas).</span>
                  {selectedDateKey && (
                    <button
                      type="button"
                      onClick={() => openNewTaskForm(selectedDateKey)}
                      className="font-semibold text-sky-700 hover:text-sky-900 cursor-pointer"
                    >
                      + Agregar tarea el {formatDisplayDate(selectedDateKey)}
                    </button>
                  )}
                </div>
              </section>

              {/* Formulario de tarea + división en actividades */}
              {formOpen && (
                <section className="bg-white border border-sky-300 rounded-xl p-5 shadow-xs">
                  <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
                    <h2 className="font-display text-base font-bold text-[#0A192F]">
                      {editingTaskId ? 'Editar tarea' : 'Registrar nueva tarea'}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setFormOpen(false)}
                      aria-label="Cerrar formulario"
                      className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveTask} className="mt-4 space-y-4">
                    <div>
                      <label
                        htmlFor="organiza-task-title"
                        className="block text-xs font-semibold text-[#0A192F]"
                      >
                        Título de la tarea o trabajo
                      </label>
                      <input
                        id="organiza-task-title"
                        type="text"
                        maxLength={140}
                        value={taskTitle}
                        onChange={(e) => setTaskTitle(e.target.value)}
                        placeholder="Ej.: Informe de práctica de poda en frutales"
                        className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 bg-slate-50 focus:bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="organiza-task-subject"
                          className="block text-xs font-semibold text-[#0A192F]"
                        >
                          Materia
                        </label>
                        <select
                          id="organiza-task-subject"
                          value={taskSubjectId}
                          onChange={(e) => setTaskSubjectId(e.target.value)}
                          className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0A192F] focus:outline-none focus:ring-2 focus:ring-sky-500"
                        >
                          <optgroup label="Materias Técnicas Agropecuarias">
                            {technicalSubjects.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Materias Generales">
                            {generalSubjects.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Otras">
                            <option value="otra">Otra actividad escolar</option>
                          </optgroup>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="organiza-task-date"
                          className="block text-xs font-semibold text-[#0A192F]"
                        >
                          Fecha de entrega
                        </label>
                        <input
                          id="organiza-task-date"
                          type="date"
                          value={taskDueDate}
                          onChange={(e) => setTaskDueDate(e.target.value)}
                          className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0A192F] focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold text-[#0A192F]">
                        Tipo de actividad
                      </span>
                      <div className="mt-1.5 grid grid-cols-2 gap-2">
                        {(Object.keys(TASK_KIND_LABELS) as OrganizaTaskKind[]).map((kindKey) => {
                          const active = taskKind === kindKey;
                          return (
                            <button
                              key={kindKey}
                              type="button"
                              onClick={() => setTaskKind(kindKey)}
                              aria-pressed={active}
                              className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                                active
                                  ? 'bg-sky-50 border-sky-400 text-[#0A192F]'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {TASK_KIND_LABELS[kindKey]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* División de trabajo grande en pequeñas actividades */}
                    <div className="pt-2 border-t border-slate-200">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="organiza-step-input"
                          className="text-xs font-semibold text-[#0A192F]"
                        >
                          Dividir en pequeñas actividades (opcional)
                        </label>
                        <button
                          type="button"
                          onClick={suggestBreakdownSteps}
                          className="text-xs font-medium text-sky-700 hover:text-sky-900 cursor-pointer"
                        >
                          + Sugerir 3 pasos base
                        </button>
                      </div>

                      <div className="mt-2 flex gap-2">
                        <input
                          id="organiza-step-input"
                          type="text"
                          maxLength={120}
                          value={draftStepText}
                          onChange={(e) => setDraftStepText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addDraftStep();
                            }
                          }}
                          placeholder="Ej.: Buscar datos de riego del ensayo..."
                          className="flex-1 min-h-[40px] rounded-lg border border-slate-300 bg-slate-50 focus:bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                        <button
                          type="button"
                          onClick={addDraftStep}
                          className="px-3.5 min-h-[40px] text-xs font-semibold text-[#0A192F] bg-sky-100 hover:bg-sky-200 rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          Agregar paso
                        </button>
                      </div>

                      {draftSubtasks.length > 0 && (
                        <ul className="mt-2.5 space-y-1.5">
                          {draftSubtasks.map((step, index) => (
                            <li
                              key={step.id}
                              className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700"
                            >
                              <span>
                                <strong className="text-[#0A192F] tabular-nums">{index + 1}.</strong>{' '}
                                {step.title}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setDraftSubtasks((prev) => prev.filter((s) => s.id !== step.id))
                                }
                                aria-label="Quitar paso"
                                className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="organiza-task-notes"
                        className="block text-xs font-semibold text-[#0A192F]"
                      >
                        Notas o recordatorios (opcional)
                      </label>
                      <textarea
                        id="organiza-task-notes"
                        rows={2}
                        maxLength={300}
                        value={taskNotes}
                        onChange={(e) => setTaskNotes(e.target.value)}
                        placeholder="Ej.: Llevar cuaderno de campo o calculadora"
                        className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 bg-slate-50 focus:bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    {taskFormError && (
                      <p role="alert" className="text-xs font-medium text-red-700">
                        {taskFormError}
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setFormOpen(false)}
                        className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 text-sm font-semibold text-white bg-[#0A192F] hover:bg-[#132C4E] rounded-lg cursor-pointer"
                      >
                        {editingTaskId ? 'Guardar cambios' : 'Guardar tarea'}
                      </button>
                    </div>
                  </form>
                </section>
              )}

              {/* Aviso de privacidad local */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3 text-xs leading-relaxed text-slate-600">
                <ShieldCheck className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
                <p>
                  Tus tareas y planes se guardan únicamente en este navegador. No se crean cuentas de
                  usuario ni se solicitan datos personales.
                </p>
              </div>
            </div>

            {/* Columna derecha: Lista de tareas */}
            <div className="lg:col-span-7 space-y-4">
              {/* Barra de filtros */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div
                  role="group"
                  aria-label="Filtrar tareas por estado"
                  className="inline-flex p-1 bg-slate-100 rounded-lg self-start"
                >
                  {(
                    [
                      { id: 'todas', label: 'Todas' },
                      { id: 'pendientes', label: 'Pendientes' },
                      { id: 'completadas', label: 'Completadas' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStatusFilter(tab.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                        statusFilter === tab.id
                          ? 'bg-white text-[#0A192F] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="organiza-filter-subject" className="sr-only">
                    Filtrar por materia
                  </label>
                  <select
                    id="organiza-filter-subject"
                    value={subjectFilter}
                    onChange={(e) => setSubjectFilter(e.target.value)}
                    className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-[#0A192F] focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="todas">Todas las materias</option>
                    <optgroup label="Técnicas">
                      {technicalSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Generales">
                      {generalSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </optgroup>
                    <option value="otra">Otra actividad escolar</option>
                  </select>
                </div>
              </div>

              {selectedDateKey && (
                <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs sm:text-sm text-[#0A192F]">
                  <span>
                    Mostrando entregas del <strong>{formatDisplayDate(selectedDateKey)}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedDateKey(null)}
                    className="font-semibold text-sky-700 hover:text-sky-900 cursor-pointer whitespace-nowrap"
                  >
                    Ver todas las fechas
                  </button>
                </div>
              )}

              {/* Lista */}
              {filteredTasks.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                  <ListChecks className="w-10 h-10 text-sky-600 mx-auto" />
                  <h3 className="mt-3 font-display text-lg font-bold text-[#0A192F]">
                    {tasks.length === 0
                      ? 'Todavía no registraste tareas'
                      : 'No hay tareas que coincidan con este filtro'}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto">
                    {tasks.length === 0
                      ? 'Agregá tus trabajos prácticos, evaluaciones o prácticas de campo, definí su fecha de entrega y dividí las tareas largas en pasos simples.'
                      : 'Probá cambiar el filtro de estado, materia o fecha seleccionada en el calendario.'}
                  </p>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => openNewTaskForm()}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0A192F] hover:bg-[#132C4E] rounded-lg cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-sky-300" />
                      <span>Registrar tarea</span>
                    </button>
                    {selectedDateKey && (
                      <button
                        type="button"
                        onClick={() => setSelectedDateKey(null)}
                        className="px-4 py-2.5 text-sm font-medium text-[#0A192F] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                      >
                        Quitar filtro de fecha
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTasks.map((task) => {
                    const dueInfo = getRelativeDueLabel(task.dueDate, task.completed, todayKey);
                    const totalSteps = task.subtasks.length;
                    const doneSteps = task.subtasks.filter((s) => s.completed).length;
                    const progressPercent =
                      totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

                    return (
                      <article
                        key={task.id}
                        className={`bg-white border rounded-xl p-4 sm:p-5 transition-colors ${
                          task.completed ? 'border-slate-200 bg-slate-50/70' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <button
                              type="button"
                              onClick={() => toggleTaskCompleted(task.id)}
                              aria-label={
                                task.completed
                                  ? `Marcar "${task.title}" como pendiente`
                                  : `Marcar "${task.title}" como completada`
                              }
                              className={`mt-0.5 w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${
                                task.completed
                                  ? 'bg-sky-600 border-sky-600 text-white'
                                  : 'bg-white border-slate-300 text-transparent hover:border-sky-500'
                              }`}
                            >
                              <Check className="w-5 h-5" />
                            </button>

                            <div className="min-w-0">
                              <h3
                                className={`font-display text-base sm:text-lg font-bold leading-snug ${
                                  task.completed
                                    ? 'line-through text-slate-400'
                                    : 'text-[#0A192F]'
                                }`}
                              >
                                {task.title}
                              </h3>

                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                                <span className="font-semibold text-sky-800">
                                  {getSubjectLabel(task.subjectId)}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{TASK_KIND_LABELS[task.kind]}</span>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                  Entrega: {formatDisplayDate(task.dueDate)}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span
                                  className={`font-semibold ${
                                    task.completed
                                      ? 'text-sky-700'
                                      : dueInfo.urgent
                                        ? 'text-amber-700'
                                        : 'text-slate-600'
                                  }`}
                                >
                                  {dueInfo.label}
                                </span>
                              </div>

                              {task.notes && (
                                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                                  {task.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => openEditTaskForm(task)}
                              aria-label={`Editar ${task.title}`}
                              className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-[#0A192F] hover:bg-slate-100 cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTask(task.id)}
                              aria-label={`Eliminar ${task.title}`}
                              className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Sub-actividades (dividir trabajos grandes) */}
                        <div className="mt-4 pt-3.5 border-t border-slate-100">
                          {totalSteps > 0 && (
                            <div className="mb-3">
                              <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                                <span className="font-medium">
                                  Actividades del trabajo ({doneSteps} de {totalSteps})
                                </span>
                                <span className="font-semibold tabular-nums text-[#0A192F]">
                                  {progressPercent}%
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-sky-600 transition-all duration-200"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>

                              <ul className="mt-2.5 space-y-1.5">
                                {task.subtasks.map((step) => (
                                  <li
                                    key={step.id}
                                    className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 hover:bg-slate-50"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => toggleSubtaskCompleted(task.id, step.id)}
                                      className="flex items-center gap-2.5 text-left flex-1 min-h-[32px] cursor-pointer"
                                    >
                                      <span
                                        className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                                          step.completed
                                            ? 'bg-sky-600 border-sky-600 text-white'
                                            : 'bg-white border-slate-300 text-transparent'
                                        }`}
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </span>
                                      <span
                                        className={`text-xs sm:text-sm ${
                                          step.completed
                                            ? 'line-through text-slate-400'
                                            : 'text-slate-700'
                                        }`}
                                      >
                                        {step.title}
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeSubtaskFromTask(task.id, step.id)}
                                      aria-label={`Quitar paso ${step.title}`}
                                      className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Agregar paso rápido directo en la tarea */}
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              maxLength={120}
                              value={inlineStepInputs[task.id] ?? ''}
                              onChange={(e) =>
                                setInlineStepInputs((prev) => ({
                                  ...prev,
                                  [task.id]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addInlineSubtask(task.id);
                                }
                              }}
                              placeholder="+ Dividir en una actividad más pequeña..."
                              aria-label={`Agregar actividad pequeña a ${task.title}`}
                              className="flex-1 min-h-[36px] rounded-lg border border-slate-200 bg-slate-50 focus:bg-white px-3 py-1 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                            <button
                              type="button"
                              onClick={() => addInlineSubtask(task.id)}
                              className="min-h-[36px] px-3 py-1 text-xs font-semibold text-[#0A192F] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer whitespace-nowrap"
                            >
                              Agregar paso
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Vista 2: Plan de estudio semanal */
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Formulario para agregar bloque al plan semanal */}
            <form
              onSubmit={handleAddWeeklyBlock}
              className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
            >
              <div>
                <h2 className="font-display text-lg font-bold text-[#0A192F]">
                  Agregar bloque de estudio
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Organizá tus tiempos semanales fuera del horario de clase.
                </p>
              </div>

              <div>
                <label
                  htmlFor="plan-day-select"
                  className="block text-xs font-semibold text-[#0A192F]"
                >
                  Día de la semana
                </label>
                <select
                  id="plan-day-select"
                  value={planDay}
                  onChange={(e) => setPlanDay(e.target.value as StudyDayId)}
                  className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0A192F] focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {STUDY_DAYS.map((day) => (
                    <option key={day.id} value={day.id}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="plan-subject-select"
                  className="block text-xs font-semibold text-[#0A192F]"
                >
                  Materia
                </label>
                <select
                  id="plan-subject-select"
                  value={planSubjectId}
                  onChange={(e) => setPlanSubjectId(e.target.value)}
                  className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0A192F] focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <optgroup label="Materias Técnicas Agropecuarias">
                    {technicalSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Materias Generales">
                    {generalSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                  <option value="otra">Otra actividad escolar</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="plan-time-input"
                    className="block text-xs font-semibold text-[#0A192F]"
                  >
                    Hora de inicio
                  </label>
                  <input
                    id="plan-time-input"
                    type="time"
                    value={planTimeRange}
                    onChange={(e) => setPlanTimeRange(e.target.value)}
                    className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0A192F] focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="plan-duration-select"
                    className="block text-xs font-semibold text-[#0A192F]"
                  >
                    Duración
                  </label>
                  <select
                    id="plan-duration-select"
                    value={planDuration}
                    onChange={(e) => setPlanDuration(Number(e.target.value))}
                    className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0A192F] focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                    <option value={120}>120 min</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="plan-focus-input"
                  className="block text-xs font-semibold text-[#0A192F]"
                >
                  Qué vas a estudiar o practicar
                </label>
                <input
                  id="plan-focus-input"
                  type="text"
                  maxLength={140}
                  value={planFocusTopic}
                  onChange={(e) => setPlanFocusTopic(e.target.value)}
                  placeholder="Ej.: Repasar ejercicios de lámina de riego"
                  className="mt-1.5 w-full min-h-[42px] rounded-lg border border-slate-300 bg-slate-50 focus:bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {planError && (
                <p role="alert" className="text-xs font-medium text-red-700">
                  {planError}
                </p>
              )}

              <button
                type="submit"
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0A192F] hover:bg-[#132C4E] rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 text-sky-300" />
                <span>Agregar al plan semanal</span>
              </button>
            </form>

            {/* Grilla semanal */}
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base sm:text-lg font-bold text-[#0A192F]">
                    Tu semana de estudio
                  </h2>
                  <p className="text-xs text-slate-600 tabular-nums">
                    {stats.completedWeeklyBlocks} de {weeklyBlocks.length} sesiones cumplidas ·{' '}
                    {totalWeeklyHoursText} totales
                  </p>
                </div>

                {weeklyBlocks.length > 0 && (
                  <button
                    type="button"
                    onClick={resetWeeklyChecks}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0A192F] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-sky-700" />
                    <span>Reiniciar semana</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {STUDY_DAYS.map((day) => {
                  const dayBlocks = weeklyBlocks
                    .filter((b) => b.day === day.id)
                    .sort((a, b) => a.timeRange.localeCompare(b.timeRange));
                  const dayMinutes = dayBlocks.reduce((acc, b) => acc + b.durationMinutes, 0);

                  return (
                    <section
                      key={day.id}
                      className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                          <h3 className="font-display text-sm font-bold text-[#0A192F]">
                            {day.label}
                          </h3>
                          <span className="text-xs text-slate-500 tabular-nums">
                            {dayMinutes > 0 ? `${dayMinutes} min` : 'Sin bloques'}
                          </span>
                        </div>

                        {dayBlocks.length === 0 ? (
                          <p className="py-4 text-xs text-slate-400">
                            Día libre o sin sesiones asignadas.
                          </p>
                        ) : (
                          <ul className="mt-3 space-y-2.5">
                            {dayBlocks.map((block) => (
                              <li
                                key={block.id}
                                className={`rounded-lg border p-3 transition-colors ${
                                  block.completedThisWeek
                                    ? 'bg-sky-50/60 border-sky-200'
                                    : 'bg-slate-50 border-slate-200'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleWeeklyBlockDone(block.id)}
                                    className="flex items-start gap-2.5 text-left flex-1 cursor-pointer"
                                  >
                                    <span
                                      className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                                        block.completedThisWeek
                                          ? 'bg-sky-600 border-sky-600 text-white'
                                          : 'bg-white border-slate-300 text-transparent'
                                      }`}
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    </span>
                                    <div>
                                      <p className="text-xs font-semibold text-sky-800 flex items-center gap-1.5 tabular-nums">
                                        <Clock className="w-3 h-3" />
                                        <span>
                                          {block.timeRange} · {block.durationMinutes} min ·{' '}
                                          {getSubjectLabel(block.subjectId)}
                                        </span>
                                      </p>
                                      <p
                                        className={`mt-1 text-xs sm:text-sm ${
                                          block.completedThisWeek
                                            ? 'line-through text-slate-400'
                                            : 'text-[#0A192F]'
                                        }`}
                                      >
                                        {block.focusTopic}
                                      </p>
                                    </div>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => deleteWeeklyBlock(block.id)}
                                    aria-label={`Eliminar bloque de ${getSubjectLabel(block.subjectId)}`}
                                    className="p-1 text-slate-400 hover:text-red-600 cursor-pointer shrink-0"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
