export type SchoolYearId = '1.º' | '2.º' | '3.º' | '4.º' | '5.º' | '6.º';

export type SubjectCategory = 'general' | 'tecnica';

export type ModuleId = 'edu-alumno' | 'edu-docente' | 'edu-organiza' | 'edu-gestion';

export type ModuleStatus = 'active' | 'upcoming';

export interface SchoolYear {
  id: SchoolYearId;
  label: string;
  cycle: 'Ciclo Básico' | 'Ciclo Superior Técnico';
  pedagogicalLevel: string;
}

export interface Subject {
  id: string;
  name: string;
  category: SubjectCategory;
  shortDescription: string;
  starterQuestions: [string, string, string];
}

export interface PlatformModule {
  id: ModuleId;
  name: string;
  subtitle: string;
  description: string;
  status: ModuleStatus;
  ctaLabel: string;
  plannedFeatures: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface TutorApiStatus {
  configured: boolean;
}

export interface TutorChatRequest {
  year: SchoolYearId;
  subjectId: string;
  message: string;
  history: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export interface TutorChatResponse {
  reply: string;
}

export interface TutorApiError {
  error: string;
  code?: 'API_NOT_CONFIGURED' | 'INVALID_REQUEST' | 'UPSTREAM_AUTH' | 'RATE_LIMIT' | 'UPSTREAM_ERROR';
}

export type TeacherMaterialType =
  | 'actividades'
  | 'evaluacion'
  | 'guia-estudio'
  | 'rubrica'
  | 'proyecto';

export interface TeacherMaterialOption {
  id: TeacherMaterialType;
  label: string;
  shortDescription: string;
  outputHint: string;
}

export interface TeacherMaterialRequest {
  year: SchoolYearId;
  subjectId: string;
  materialType: TeacherMaterialType;
  topic: string;
  objective: string;
  additionalContext?: string;
  refinementNote?: string;
  previousContent?: string;
}

export interface TeacherMaterialResponse {
  content: string;
}

export type OrganizaTaskKind = 'tarea' | 'trabajo-practico' | 'evaluacion' | 'practica-campo';

export interface OrganizaSubtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface OrganizaTask {
  id: string;
  title: string;
  subjectId: string;
  dueDate: string; // YYYY-MM-DD
  kind: OrganizaTaskKind;
  notes?: string;
  completed: boolean;
  subtasks: OrganizaSubtask[];
  createdAt: string;
}

export type StudyDayId =
  | 'lunes'
  | 'martes'
  | 'miercoles'
  | 'jueves'
  | 'viernes'
  | 'sabado'
  | 'domingo';

export interface WeeklyStudyBlock {
  id: string;
  day: StudyDayId;
  subjectId: string;
  timeRange: string;
  durationMinutes: number;
  focusTopic: string;
  completedThisWeek: boolean;
}

export type GestionSectionId =
  | 'calendario-escolar'
  | 'comunicados'
  | 'reglamentos'
  | 'materias'
  | 'preguntas-frecuentes';

export interface GestionItem {
  id: string;
  section: GestionSectionId;
  title: string;
  body: string;
  dateLabel?: string; // Para calendario escolar o fecha de comunicado
  categoryTag?: string; // Ej.: Acto, Mesa de examen, Dirección, Año escolar, Normativa
  authorizedBy?: string; // Área o autoridad que autoriza la publicación
  updatedAt: string;
}

export type GestionData = Record<GestionSectionId, GestionItem[]>;
