import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { Content } from '@google/genai';
import type {
  SchoolYear,
  Subject,
  TeacherMaterialOption,
  TutorChatRequest,
} from '../src/types/educaia.ts';

const PRIMARY_GEMINI_MODEL = 'gemini-4-hydrogen';
const FALLBACK_GEMINI_MODEL = 'gemini-3.1-flash-lite';
const MAX_HISTORY_MESSAGES = 10;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_CONCURRENT_GEMINI_CALLS = 12;
const MAX_QUEUED_GEMINI_CALLS = 60;
const QUEUE_WAIT_TIMEOUT_MS = 35_000;
const GEMINI_REQUEST_TIMEOUT_MS = 45_000;

let sharedGeminiClient: GoogleGenAI | null = null;
let sharedGeminiKeySnapshot: string | undefined;

let activeGeminiCalls = 0;
interface QueuedTask {
  resolve: () => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}
const pendingGeminiQueue: QueuedTask[] = [];

async function withGeminiConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (activeGeminiCalls >= MAX_CONCURRENT_GEMINI_CALLS) {
    if (pendingGeminiQueue.length >= MAX_QUEUED_GEMINI_CALLS) {
      throw new Error('SERVER_BUSY');
    }

    await new Promise<void>((resolve, reject) => {
      const entry: QueuedTask = {
        resolve: () => {
          clearTimeout(entry.timer);
          resolve();
        },
        reject: (err: Error) => {
          clearTimeout(entry.timer);
          reject(err);
        },
        timer: setTimeout(() => {
          const index = pendingGeminiQueue.indexOf(entry);
          if (index !== -1) {
            pendingGeminiQueue.splice(index, 1);
          }
          reject(new Error('SERVER_BUSY'));
        }, QUEUE_WAIT_TIMEOUT_MS),
      };
      pendingGeminiQueue.push(entry);
    });
  }

  activeGeminiCalls += 1;
  try {
    return await fn();
  } finally {
    activeGeminiCalls = Math.max(0, activeGeminiCalls - 1);
    const next = pendingGeminiQueue.shift();
    if (next) {
      next.resolve();
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function isGeminiConfigured(): boolean {
  const rawKey = process.env.GEMINI_API_KEY?.trim();
  return Boolean(rawKey && rawKey !== 'MY_GEMINI_API_KEY' && rawKey.length > 10);
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('API_NOT_CONFIGURED');
  }

  if (!sharedGeminiClient || sharedGeminiKeySnapshot !== apiKey) {
    sharedGeminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    sharedGeminiKeySnapshot = apiKey;
  }

  return sharedGeminiClient;
}

export function buildTutorSystemInstruction(year: SchoolYear, subject: Subject): string {
  const categoryLabel = subject.category === 'general' ? 'Materia General' : 'Materia Técnica Agropecuaria';

  return `Sos el tutor académico inteligente del módulo EDU-ALUMNO de la plataforma educativa EDUCA.IA, diseñada especialmente para escuelas secundarias técnicas agropecuarias de Argentina.

CONTEXTO ACTUAL DE LA CONSULTA:
- Curso del estudiante: ${year.label} (${year.cycle})
- Perfil pedagógico del curso: ${year.pedagogicalLevel}
- Materia: ${subject.name} (${categoryLabel})
- Enfoque de la materia: ${subject.shortDescription}

IDIOMA Y TONO:
- Respondé siempre en español rioplatense claro, respetuoso, cercano, motivador y educativo (tratando al estudiante de "vos", con calidez docente sin perder rigurosidad).
- Adaptá el vocabulario, la profundidad teórica y los ejemplos estrictamente a ${year.label} de una escuela técnica agropecuaria argentina.

COMPORTAMIENTO PEDAGÓGICO OBLIGATORIO (seguí estos 8 principios):
1. Identificá y tené presente en todo momento el curso (${year.label}) y la materia (${subject.name}).
2. Comprendé qué necesita aprender exactamente el estudiante antes de dar explicaciones largas; si su consulta es muy amplia o ambigua, respondé con una orientación inicial clara y hacé una pregunta corta para enfocar su duda.
3. Explicá con lenguaje apropiado para ${year.label}, dividiendo las ideas complejas en pasos breves y comprensibles.
4. Utilizá ejemplos sencillos y, siempre que corresponda (tanto en materias técnicas como en materias generales como Matemática, Física, Química, Biología, Lengua, Geografía o Historia), conectá la explicación con situaciones reales del ámbito agropecuario argentino (huerta, montes frutales, viñedos, suelos, riego, tambos, cultivos extensivos, agroindustria, gestión de lotes).
5. Proponé ejercicios o desafíos progresivos (de menor a mayor dificultad) para que el estudiante practique en lugar de quedarse solo leyendo teoría.
6. Comprobá siempre la comprensión cerrando tu intervención con una pregunta concreta, un micro-ejercicio o una invitación a que el estudiante explique con sus palabras lo que entendió.
7. Si el estudiante dice que no entiende, se confunde o responde mal un paso, cambiá la estrategia de explicación (usá una analogía distinta, un esquema visual en texto o un caso numérico más simple) en lugar de repetir la misma explicación con otras palabras.
8. Ayudá a razonar paso a paso SIN resolver automáticamente toda la tarea de forma mecánica. Si te piden que hagas un trabajo práctico o ejercicio completo, explicá el método, resolvé un ejemplo análogo o guiá el primer paso para que el estudiante resuelva el resto con tu acompañamiento.

REGLAS ESTRICTAS DE SEGURIDAD Y CUIDADO:
- PRIVACIDAD: Nunca pidas nombre completo, apellido, DNI, teléfono, dirección, escuela exacta, correo electrónico ni ningún dato personal del estudiante. Si el estudiante escribe algún dato personal en el chat, ignorá ese dato, no lo repitas y recordale amablemente que no comparta información personal.
- HONESTIDAD BIBLIOGRÁFICA: No inventes fuentes, libros, autores, artículos, leyes, resoluciones ni citas bibliográficas. Si no contás con una referencia verificada, no la fabriques y explicá directamente el concepto disciplinar.
- SEGURIDAD RURAL Y TÉCNICA: Está prohibido dar instrucciones operativas peligrosas relacionadas con maquinaria agrícola (por ejemplo: intervenir piezas móviles, anular protecciones, operar sin resguardos o realizar reparaciones de riesgo), uso/mezcla/dosificación comercial de agroquímicos o fitosanitarios, trabajos en altura, electricidad rural, espacios confinados (silos) o manejo riesgoso de animales grandes. Ante esos temas, explicá únicamente fundamentos teóricos/conceptuales seguros.
- SUPERVISIÓN DOCENTE Y PROFESIONAL: Aclará explícitamente cuando una práctica de campo, laboratorio, taller, calibración real, uso de equipamiento o decisión productiva/sanitaria real requiera la presencia y supervisión de un docente, instructor de taller o profesional matriculado (ingeniero agrónomo, médico veterinario, bromatólogo).

FORMATO DE RESPUESTA:
- Usá párrafos cortos, subtítulos simples o listas claras cuando ayuden a estudiar mejor.
- Evitá respuestas excesivamente largas que abrumen en pantalla de celular; priorizá claridad, ritmo didáctico e interacción.`;
}

function mapHistoryToContents(
  history: TutorChatRequest['history'],
  currentMessage: string
): Content[] {
  const sanitizedHistory = history
    .filter(
      (item) =>
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string' &&
        item.content.trim().length > 0
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.content.trim().slice(0, MAX_MESSAGE_LENGTH) }],
    }));

  sanitizedHistory.push({
    role: 'user',
    parts: [{ text: currentMessage.trim().slice(0, MAX_MESSAGE_LENGTH) }],
  });

  return sanitizedHistory;
}

function isCapacityOrRateError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('overloaded') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota')
  );
}

function isRetryableNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('504') ||
    msg.includes('econnreset') ||
    msg.includes('fetch failed')
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithModelFallback(params: {
  ai: GoogleGenAI;
  systemInstruction: string;
  contents: Content[];
}): Promise<string> {
  const models: Array<{ name: string; thinkingLevel?: ThinkingLevel }> = [
    { name: PRIMARY_GEMINI_MODEL, thinkingLevel: ThinkingLevel.LOW },
    { name: FALLBACK_GEMINI_MODEL },
  ];

  let lastError: unknown;

  for (let i = 0; i < models.length; i++) {
    const candidate = models[i];
    const hasNextModel = i < models.length - 1;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await withTimeout(
          params.ai.models.generateContent({
            model: candidate.name,
            contents: params.contents,
            config: {
              systemInstruction: params.systemInstruction,
              ...(candidate.thinkingLevel
                ? { thinkingConfig: { thinkingLevel: candidate.thinkingLevel } }
                : {}),
            },
          }),
          GEMINI_REQUEST_TIMEOUT_MS
        );

        const replyText = response.text?.trim();
        if (!replyText) {
          throw new Error('EMPTY_MODEL_RESPONSE');
        }

        return replyText;
      } catch (error) {
        lastError = error;
        if (hasNextModel && isCapacityOrRateError(error)) {
          console.warn(
            `[EDUCA.IA Gemini] ${candidate.name} saturado/limitado; usando ${models[i + 1].name}:`,
            error instanceof Error ? error.message : error
          );
          break;
        }
        if (attempt < 2 && isRetryableNetworkError(error)) {
          await sleep(400 + Math.floor(Math.random() * 350));
          continue;
        }
        throw error;
      }
    }
  }

  throw lastError;
}

export async function generateTutorReply(params: {
  year: SchoolYear;
  subject: Subject;
  message: string;
  history: TutorChatRequest['history'];
}): Promise<string> {
  const ai = getGeminiClient();
  const systemInstruction = buildTutorSystemInstruction(params.year, params.subject);
  const contents = mapHistoryToContents(params.history, params.message);

  return withGeminiConcurrencyLimit(() =>
    generateWithModelFallback({
      ai,
      systemInstruction,
      contents,
    })
  );
}

export function buildTeacherSystemInstruction(
  year: SchoolYear,
  subject: Subject,
  materialOption: TeacherMaterialOption
): string {
  const categoryLabel =
    subject.category === 'general' ? 'Materia General' : 'Materia Técnica Agropecuaria';

  return `Sos el asistente pedagógico profesional del módulo EDU-DOCENTE de la plataforma EDUCA.IA, diseñado para docentes de escuelas secundarias técnicas agropecuarias de Argentina.

CONTEXTO CURRICULAR:
- Curso destinatario: ${year.label} (${year.cycle})
- Nivel y perfil del curso: ${year.pedagogicalLevel}
- Materia: ${subject.name} (${categoryLabel})
- Descripción disciplinar: ${subject.shortDescription}
- Tipo de material solicitado: ${materialOption.label} (${materialOption.shortDescription})

ENFOQUE OBLIGATORIO PARA ESCUELA TÉCNICA AGROPECUARIA ARGENTINA:
- Redactá en español argentino profesional, claro, organizado y listo para ser utilizado o adaptado en clase por un docente.
- Todos los ejemplos, consignas, situaciones problemáticas, criterios y contextos deben corresponder a la realidad de una escuela técnica agropecuaria argentina (huerta, invernadero, montes frutales, viñedos, tambo, corrales, cultivos extensivos, suelos, sistemas de riego, laboratorio, sala de agroindustria, taller rural o gestión de emprendimientos).
- Incluso cuando la materia sea general (Matemática, Lengua y Literatura, Historia, Geografía, Física, Química, Biología o Educación Ciudadana), vinculá las propuestas con situaciones o problemáticas del entorno agropecuario sin perder el rigor propio de la disciplina.
- Adaptá la complejidad cognitiva, el vocabulario técnico y la autonomía esperada estrictamente a ${year.label}.

ESTRUCTURA ESPERADA SEGÚN EL TIPO DE MATERIAL:
- Si es "Actividades educativas": incluí Título, Encuadre breve (curso, materia, objetivo), Actividad de apertura/indagación, Desarrollo con consignas progresivas (teóricas y aplicadas al entorno agropecuario), Cierre/puesta en común y pautas de seguridad o materiales necesarios.
- Si son "Preguntas de evaluación": incluí un banco equilibrado de preguntas (comprensión conceptual, análisis de caso productivo, resolución de problemas o interpretación de datos y pregunta reflexiva) junto con los criterios clave o respuestas esperadas orientativas para el docente.
- Si es "Guía de estudio": incluí Objetivos para el estudiante, Conceptos fundamentales explicados con claridad, Vocabulario técnico esencial, Preguntas orientadoras de lectura/observación y una breve instancia de autoevaluación.
- Si es "Rúbrica de evaluación": presentá obligatoriamente una tabla Markdown bien estructurada (columnas: Criterio | Inicial | En proceso | Logrado | Destacado) con descriptores concretos y observables para ${year.label}, más orientaciones breves de aplicación y retroalimentación.
- Si es "Proyecto interdisciplinario": incluí Título del proyecto, Pregunta impulsora o problema productivo local, Materias articuladas (conectando ${subject.name} con otras materias generales y técnicas relevantes), Objetivos por área, Etapas de trabajo (indagación, planificación, ejecución en entorno formativo, socialización), Roles de los estudiantes, Producto final y Criterios de evaluación integral.

SEGURIDAD, RIGOR Y PRIVACIDAD:
- No inventes bibliografía, autores, citas textuales, resoluciones ministeriales ni números de leyes. Si mencionás normativa o referencias externas, hacelo de manera general o sugerí al docente incorporar la bibliografía de su cátedra.
- No incluyas instrucciones operativas peligrosas relacionadas con maquinaria agrícola, agroquímicos o tareas rurales riesgosas. Siempre que haya prácticas en taller, campo, laboratorio o sala de elaboración, incluí un apartado breve de "Cuidados y supervisión docente".
- No pidas datos personales de estudiantes ni nombres reales.`;
}

export async function generateTeacherMaterial(params: {
  year: SchoolYear;
  subject: Subject;
  materialOption: TeacherMaterialOption;
  topic: string;
  objective: string;
  additionalContext?: string;
  refinementNote?: string;
  previousContent?: string;
}): Promise<string> {
  const ai = getGeminiClient();
  const systemInstruction = buildTeacherSystemInstruction(
    params.year,
    params.subject,
    params.materialOption
  );

  let userPrompt = `Generá el siguiente material docente:
- Tipo de recurso: ${params.materialOption.label}
- Curso: ${params.year.label} (${params.year.cycle})
- Materia: ${params.subject.name}
- Tema central: ${params.topic}
- Objetivo de aprendizaje: ${params.objective}`;

  if (params.additionalContext?.trim()) {
    userPrompt += `\n- Contexto o duración sugerida: ${params.additionalContext.trim()}`;
  }

  if (params.refinementNote?.trim() && params.previousContent?.trim()) {
    userPrompt += `\n\nEl docente ya cuenta con una primera versión del material y solicita el siguiente ajuste específico:
"${params.refinementNote.trim()}"

Versión anterior como referencia (mantené la estructura y coherencia mejorando según lo pedido):
---
${params.previousContent.trim().slice(0, 6000)}
---`;
  }

  const contents: Content[] = [
    {
      role: 'user',
      parts: [{ text: userPrompt }],
    },
  ];

  return withGeminiConcurrencyLimit(() =>
    generateWithModelFallback({
      ai,
      systemInstruction,
      contents,
    })
  );
}

export function classifyGeminiError(error: unknown): {
  status: number;
  code: 'API_NOT_CONFIGURED' | 'UPSTREAM_AUTH' | 'RATE_LIMIT' | 'UPSTREAM_ERROR';
  message: string;
} {
  if (error instanceof Error && error.message === 'API_NOT_CONFIGURED') {
    return {
      status: 503,
      code: 'API_NOT_CONFIGURED',
      message:
        'El servicio de inteligencia artificial aún no está configurado en el servidor. Solicitá al responsable técnico que configure la variable GEMINI_API_KEY.',
    };
  }

  const rawMessage = error instanceof Error ? error.message : String(error);
  const lower = rawMessage.toLowerCase();

  if (
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('403') ||
    lower.includes('401') ||
    (lower.includes('400') && lower.includes('api key'))
  ) {
    return {
      status: 502,
      code: 'UPSTREAM_AUTH',
      message:
        'No se pudo validar la credencial del servicio de inteligencia artificial. Verificá la configuración de GEMINI_API_KEY en el servidor.',
    };
  }

  if (
    lower.includes('429') ||
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('overloaded') ||
    lower.includes('server_busy') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota')
  ) {
    return {
      status: lower.includes('429') || lower.includes('quota') ? 429 : 503,
      code: 'RATE_LIMIT',
      message:
        'El servicio está recibiendo muchas consultas simultáneas en este momento. Esperá unos segundos y volvé a intentarlo.',
    };
  }

  if (lower.includes('gemini_timeout') || lower.includes('timeout')) {
    return {
      status: 504,
      code: 'UPSTREAM_ERROR',
      message:
        'La consulta demoró más de lo esperado porque hay alta demanda. Intentá nuevamente con una pregunta más breve.',
    };
  }

  return {
    status: 502,
    code: 'UPSTREAM_ERROR',
    message:
      'No pudimos obtener una respuesta del tutor en este momento. Revisá tu conexión e intentá nuevamente.',
  };
}
