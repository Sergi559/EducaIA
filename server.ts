import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  findSchoolYear,
  findSubject,
  findTeacherMaterialOption,
} from './src/data/curriculum.ts';
import {
  classifyGeminiError,
  generateTeacherMaterial,
  generateTutorReply,
  isGeminiConfigured,
} from './server/tutor.ts';
import {
  createGestionItem,
  deleteGestionItem,
  isValidGestionSection,
  readGestionData,
  updateGestionItem,
} from './server/gestionStore.ts';
import type { TeacherMaterialRequest, TutorChatRequest } from './src/types/educaia.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;

interface RateBucket {
  timestamps: number[];
}

function createRateLimiter(options: { windowMs: number; maxRequests: number; message: string }) {
  const buckets = new Map<string, RateBucket>();

  const cleanupInterval = setInterval(() => {
    const cutoff = Date.now() - options.windowMs;
    for (const [key, bucket] of buckets.entries()) {
      bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);
      if (bucket.timestamps.length === 0) {
        buckets.delete(key);
      }
    }
  }, options.windowMs);
  cleanupInterval.unref?.();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const rawClientId = req.header('x-client-id')?.trim();
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const rateKey = rawClientId ? `client:${rawClientId.slice(0, 64)}` : `ip:${clientIp}`;
    const now = Date.now();
    const cutoff = now - options.windowMs;

    const bucket = buckets.get(rateKey) ?? { timestamps: [] };
    bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);

    if (bucket.timestamps.length >= options.maxRequests) {
      res.status(429).json({
        code: 'RATE_LIMIT',
        error: options.message,
      });
      return;
    }

    bucket.timestamps.push(now);
    buckets.set(rateKey, bucket);
    next();
  };
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '512kb' }));

  const aiRateLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 30,
    message:
      'Se realizaron demasiadas consultas seguidas desde esta sesión. Esperá unos segundos y volvé a intentarlo.',
  });

  const gestionRateLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 120,
    message:
      'Demasiadas solicitudes consecutivas en EDU-GESTIÓN. Esperá unos segundos y volvé a intentarlo.',
  });

  app.use('/src/assets', (_req, res, next) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    next();
  });

  // Endpoint de estado del servicio de IA (nunca expone claves al navegador)
  app.get('/api/tutor/status', (_req, res) => {
    res.json({
      configured: isGeminiConfigured(),
    });
  });

  // Endpoint principal del tutor académico EDU-ALUMNO (sin persistencia de conversaciones)
  app.post('/api/tutor/chat', aiRateLimiter, async (req, res) => {
    if (!isGeminiConfigured()) {
      res.status(503).json({
        code: 'API_NOT_CONFIGURED',
        error:
          'El servicio de inteligencia artificial aún no está configurado en el servidor. Configurá la variable GEMINI_API_KEY para habilitar las respuestas del tutor.',
      });
      return;
    }

    const body = req.body as Partial<TutorChatRequest> | undefined;
    if (!body || typeof body !== 'object') {
      res.status(400).json({
        code: 'INVALID_REQUEST',
        error: 'La solicitud enviada no tiene un formato válido.',
      });
      return;
    }

    const schoolYear = typeof body.year === 'string' ? findSchoolYear(body.year) : undefined;
    if (!schoolYear) {
      res.status(400).json({
        code: 'INVALID_REQUEST',
        error: 'Seleccioná un año escolar válido entre 1.º y 6.º.',
      });
      return;
    }

    const subject = typeof body.subjectId === 'string' ? findSubject(body.subjectId) : undefined;
    if (!subject) {
      res.status(400).json({
        code: 'INVALID_REQUEST',
        error: 'Seleccioná una materia válida de la lista.',
      });
      return;
    }

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
      res.status(400).json({
        code: 'INVALID_REQUEST',
        error: 'Escribí una pregunta antes de enviar.',
      });
      return;
    }

    if (message.length > 2000) {
      res.status(400).json({
        code: 'INVALID_REQUEST',
        error: 'La pregunta es demasiado extensa (máximo 2000 caracteres). Intentá resumirla en pasos.',
      });
      return;
    }

    const history = Array.isArray(body.history) ? body.history : [];

    try {
      const reply = await generateTutorReply({
        year: schoolYear,
        subject,
        message,
        history,
      });

      res.json({ reply });
    } catch (error) {
      const classified = classifyGeminiError(error);
      console.error('[EDUCA.IA /api/tutor/chat]', error instanceof Error ? error.message : error);
      res.status(classified.status).json({
        code: classified.code,
        error: classified.message,
      });
    }
  });

  // Endpoint del asistente docente EDU-DOCENTE (reutiliza la conexión segura existente)
  app.post('/api/docente/generate', aiRateLimiter, async (req, res) => {
    if (!isGeminiConfigured()) {
      res.status(503).json({
        code: 'API_NOT_CONFIGURED',
        error:
          'El servicio de inteligencia artificial aún no está configurado en el servidor. Configurá la variable GEMINI_API_KEY para habilitar la generación de materiales.',
      });
      return;
    }

    const body = req.body as Partial<TeacherMaterialRequest> | undefined;
    if (!body || typeof body !== 'object') {
      res.status(400).json({
        code: 'INVALID_REQUEST',
        error: 'La solicitud enviada no tiene un formato válido.',
      });
      return;
    }

    const schoolYear = typeof body.year === 'string' ? findSchoolYear(body.year) : undefined;
    if (!schoolYear) {
      res.status(400).json({
        code: 'INVALID_REQUEST',
        error: 'Seleccioná un curso válido entre 1.º y 6.º año.',
      });
      return;
    }

    const subject = typeof body.subjectId === 'string' ? findSubject(body.subjectId) : undefined;
    if (!subject) {
      res.status(400).json({
        code: 'INVALID_REQUEST',
        error: 'Seleccioná una materia válida.',
      });
      return;
    }

    const materialOption =
      typeof body.materialType === 'string'
        ? findTeacherMaterialOption(body.materialType)
        : undefined;
    if (!materialOption) {
      res.status(400).json({
        code: 'INVALID_REQUEST',
        error: 'Seleccioná un tipo de material didáctico válido.',
      });
      return;
    }

    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
    if (!topic) {
      res.status(400).json({
        code: 'INVALID_REQUEST',
        error: 'Indicá el tema que querés trabajar antes de generar el material.',
      });
      return;
    }

    if (topic.length > 300) {
      res.status(400).json({
        code: 'INVALID_REQUEST',
        error: 'El tema es demasiado extenso (máximo 300 caracteres).',
      });
      return;
    }

    const objective = typeof body.objective === 'string' ? body.objective.trim() : '';
    if (!objective) {
      res.status(400).json({
        code: 'INVALID_REQUEST',
        error: 'Definí el objetivo de aprendizaje para orientar el material.',
      });
      return;
    }

    if (objective.length > 600) {
      res.status(400).json({
        code: 'INVALID_REQUEST',
        error: 'El objetivo de aprendizaje supera el máximo permitido (600 caracteres).',
      });
      return;
    }

    const additionalContext =
      typeof body.additionalContext === 'string'
        ? body.additionalContext.trim().slice(0, 400)
        : undefined;
    const refinementNote =
      typeof body.refinementNote === 'string'
        ? body.refinementNote.trim().slice(0, 500)
        : undefined;
    const previousContent =
      typeof body.previousContent === 'string' ? body.previousContent : undefined;

    try {
      const content = await generateTeacherMaterial({
        year: schoolYear,
        subject,
        materialOption,
        topic,
        objective,
        additionalContext,
        refinementNote,
        previousContent,
      });

      res.json({ content });
    } catch (error) {
      const classified = classifyGeminiError(error);
      console.error('[EDUCA.IA /api/docente/generate]', error instanceof Error ? error.message : error);
      res.status(classified.status).json({
        code: classified.code,
        error: classified.message,
      });
    }
  });

  // Endpoints de información institucional pública y administración de EDU-GESTIÓN
  app.use('/api/gestion', gestionRateLimiter);
  app.get('/api/gestion', (_req, res) => {
    res.json(readGestionData());
  });

  app.post('/api/gestion/:section', (req, res) => {
    const section = req.params.section;
    if (!isValidGestionSection(section)) {
      res.status(400).json({ error: 'Sección institucional inválida.' });
      return;
    }

    const body = req.body as Record<string, unknown> | undefined;
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const content = typeof body?.body === 'string' ? body.body.trim() : '';

    if (!title || title.length > 200) {
      res.status(400).json({
        error: 'Indicá un título válido (entre 1 y 200 caracteres).',
      });
      return;
    }

    if (!content || content.length > 5000) {
      res.status(400).json({
        error: 'Indicá el contenido o descripción institucional (máximo 5000 caracteres).',
      });
      return;
    }

    const dateLabel =
      typeof body?.dateLabel === 'string' ? body.dateLabel.trim().slice(0, 80) : undefined;
    const categoryTag =
      typeof body?.categoryTag === 'string' ? body.categoryTag.trim().slice(0, 80) : undefined;
    const authorizedBy =
      typeof body?.authorizedBy === 'string' ? body.authorizedBy.trim().slice(0, 120) : undefined;

    const item = createGestionItem(section, {
      title,
      body: content,
      dateLabel,
      categoryTag,
      authorizedBy,
    });

    res.status(201).json({ item });
  });

  app.put('/api/gestion/:section/:id', (req, res) => {
    const section = req.params.section;
    const id = req.params.id;
    if (!isValidGestionSection(section)) {
      res.status(400).json({ error: 'Sección institucional inválida.' });
      return;
    }

    const body = req.body as Record<string, unknown> | undefined;
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const content = typeof body?.body === 'string' ? body.body.trim() : '';

    if (!title || title.length > 200) {
      res.status(400).json({
        error: 'Indicá un título válido (entre 1 y 200 caracteres).',
      });
      return;
    }

    if (!content || content.length > 5000) {
      res.status(400).json({
        error: 'Indicá el contenido o descripción institucional (máximo 5000 caracteres).',
      });
      return;
    }

    const dateLabel =
      typeof body?.dateLabel === 'string' ? body.dateLabel.trim().slice(0, 80) : undefined;
    const categoryTag =
      typeof body?.categoryTag === 'string' ? body.categoryTag.trim().slice(0, 80) : undefined;
    const authorizedBy =
      typeof body?.authorizedBy === 'string' ? body.authorizedBy.trim().slice(0, 120) : undefined;

    const updated = updateGestionItem(section, id, {
      title,
      body: content,
      dateLabel,
      categoryTag,
      authorizedBy,
    });

    if (!updated) {
      res.status(404).json({ error: 'No se encontró el documento solicitado para editar.' });
      return;
    }

    res.json({ item: updated });
  });

  app.delete('/api/gestion/:section/:id', (req, res) => {
    const section = req.params.section;
    const id = req.params.id;
    if (!isValidGestionSection(section)) {
      res.status(400).json({ error: 'Sección institucional inválida.' });
      return;
    }

    const deleted = deleteGestionItem(section, id);
    if (!deleted) {
      res.status(404).json({ error: 'No se encontró el documento solicitado.' });
      return;
    }

    res.json({ ok: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(
      express.static(distDir, {
        maxAge: '1h',
      })
    );
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Aplicación no compilada. Ejecutá npm run build.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EDUCA.IA escuchando en http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Error al iniciar el servidor EDUCA.IA:', err);
  process.exit(1);
});
