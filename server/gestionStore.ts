import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { GestionData, GestionItem, GestionSectionId } from '../src/types/educaia.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'educaia-gestion.json');

export const VALID_GESTION_SECTIONS: GestionSectionId[] = [
  'calendario-escolar',
  'comunicados',
  'reglamentos',
  'materias',
  'preguntas-frecuentes',
];

function createEmptyGestionData(): GestionData {
  return {
    'calendario-escolar': [],
    comunicados: [],
    reglamentos: [],
    materias: [],
    'preguntas-frecuentes': [],
  };
}

let inMemoryCache: GestionData | null = null;

export function isValidGestionSection(value: string): value is GestionSectionId {
  return VALID_GESTION_SECTIONS.includes(value as GestionSectionId);
}

export function readGestionData(): GestionData {
  if (inMemoryCache) {
    return inMemoryCache;
  }

  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<GestionData>;
      const normalized = createEmptyGestionData();
      for (const section of VALID_GESTION_SECTIONS) {
        if (Array.isArray(parsed[section])) {
          normalized[section] = parsed[section] as GestionItem[];
        }
      }
      inMemoryCache = normalized;
      return normalized;
    }
  } catch (error) {
    console.warn('[EDU-GESTIÓN] No se pudo leer el archivo local, iniciando vacío:', error);
  }

  const empty = createEmptyGestionData();
  inMemoryCache = empty;
  return empty;
}

function persistGestionData(data: GestionData): void {
  inMemoryCache = data;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.warn('[EDU-GESTIÓN] No se pudo escribir en disco, mantenido en memoria:', error);
  }
}

export interface GestionItemInput {
  title: string;
  body: string;
  dateLabel?: string;
  categoryTag?: string;
  authorizedBy?: string;
}

export function createGestionItem(section: GestionSectionId, input: GestionItemInput): GestionItem {
  const data = readGestionData();
  const newItem: GestionItem = {
    id: `gest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    section,
    title: input.title,
    body: input.body,
    dateLabel: input.dateLabel || undefined,
    categoryTag: input.categoryTag || undefined,
    authorizedBy: input.authorizedBy || undefined,
    updatedAt: new Date().toISOString(),
  };

  const nextData: GestionData = {
    ...data,
    [section]: [newItem, ...data[section]],
  };

  persistGestionData(nextData);
  return newItem;
}

export function updateGestionItem(
  section: GestionSectionId,
  id: string,
  input: GestionItemInput
): GestionItem | null {
  const data = readGestionData();
  const existingIndex = data[section].findIndex((item) => item.id === id);
  if (existingIndex === -1) {
    return null;
  }

  const updatedItem: GestionItem = {
    ...data[section][existingIndex],
    title: input.title,
    body: input.body,
    dateLabel: input.dateLabel || undefined,
    categoryTag: input.categoryTag || undefined,
    authorizedBy: input.authorizedBy || undefined,
    updatedAt: new Date().toISOString(),
  };

  const nextSectionItems = [...data[section]];
  nextSectionItems[existingIndex] = updatedItem;

  const nextData: GestionData = {
    ...data,
    [section]: nextSectionItems,
  };

  persistGestionData(nextData);
  return updatedItem;
}

export function deleteGestionItem(section: GestionSectionId, id: string): boolean {
  const data = readGestionData();
  const nextItems = data[section].filter((item) => item.id !== id);
  if (nextItems.length === data[section].length) {
    return false;
  }

  const nextData: GestionData = {
    ...data,
    [section]: nextItems,
  };

  persistGestionData(nextData);
  return true;
}
