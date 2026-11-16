import type {
  GestionSectionId,
  PlatformModule,
  SchoolYear,
  StudyDayId,
  Subject,
  TeacherMaterialOption,
  TeacherMaterialType,
} from '../types/educaia.ts';

export const SCHOOL_YEARS: SchoolYear[] = [
  {
    id: '1.º',
    label: '1.º año',
    cycle: 'Ciclo Básico',
    pedagogicalLevel:
      'Inicio de la escuela secundaria técnica agropecuaria (aprox. 12-13 años). Lenguaje claro, cercano, concreto y con ejemplos cotidianos de la vida rural y la huerta escolar.',
  },
  {
    id: '2.º',
    label: '2.º año',
    cycle: 'Ciclo Básico',
    pedagogicalLevel:
      'Segundo año del Ciclo Básico (aprox. 13-14 años). Explicaciones accesibles que conectan conceptos escolares con observaciones prácticas del entorno productivo.',
  },
  {
    id: '3.º',
    label: '3.º año',
    cycle: 'Ciclo Básico',
    pedagogicalLevel:
      'Cierre del Ciclo Básico (aprox. 14-15 años). Introducción progresiva al vocabulario técnico agropecuario, relaciones causa-efecto y cálculos aplicados sencillos.',
  },
  {
    id: '4.º',
    label: '4.º año',
    cycle: 'Ciclo Superior Técnico',
    pedagogicalLevel:
      'Inicio del Ciclo Superior Técnico (aprox. 15-16 años). Lenguaje técnico intermedio, interpretación de variables productivas y análisis de procesos biológicos y mecánicos.',
  },
  {
    id: '5.º',
    label: '5.º año',
    cycle: 'Ciclo Superior Técnico',
    pedagogicalLevel:
      'Quinto año técnico (aprox. 16-17 años). Rigor conceptual creciente, resolución de problemas productivos, manejo de unidades agronómicas e integración entre materias.',
  },
  {
    id: '6.º',
    label: '6.º año',
    cycle: 'Ciclo Superior Técnico',
    pedagogicalLevel:
      'Sexto año técnico (aprox. 17-18 años). Enfoque técnico profesionalizante, toma de decisiones fundamentadas, criterios productivos, económicos y de sustentabilidad.',
  },
];

export const SUBJECTS: Subject[] = [
  // Materias Generales
  {
    id: 'matematica',
    name: 'Matemática',
    category: 'general',
    shortDescription: 'Cálculo, proporciones, funciones, geometría y estadística aplicada.',
    starterQuestions: [
      '¿Cómo calculo el porcentaje de germinación de un lote de semillas?',
      'No entiendo cómo despejar una incógnita en ecuaciones lineales, ¿me guiás paso a paso?',
      '¿Cómo saco la superficie en hectáreas de un potrero rectangular o irregular?',
    ],
  },
  {
    id: 'lengua-literatura',
    name: 'Lengua y Literatura',
    category: 'general',
    shortDescription: 'Comprensión lectora, redacción técnica, argumentación y literatura.',
    starterQuestions: [
      '¿Cómo estructuro un informe técnico claro después de una práctica en la huerta?',
      '¿Qué diferencia hay entre un texto expositivo y uno argumentativo?',
      '¿Me ayudás a mejorar la coherencia de un párrafo sin reescribirlo todo por mí?',
    ],
  },
  {
    id: 'historia',
    name: 'Historia',
    category: 'general',
    shortDescription: 'Procesos históricos argentinos y mundiales, economía agraria y sociedad.',
    starterQuestions: [
      '¿Qué papel cumplió el modelo agroexportador en la Argentina de fines del siglo XIX?',
      '¿Cómo analizo una fuente histórica sin confundir hechos con opiniones?',
      '¿Qué cambios trajo la Revolución Industrial para la producción del campo?',
    ],
  },
  {
    id: 'geografia',
    name: 'Geografía',
    category: 'general',
    shortDescription: 'Relieve, climas, cuencas hídricas, biomas y regiones productivas argentinas.',
    starterQuestions: [
      '¿Por qué varía tanto el clima entre la región pampeana y la región cuyana?',
      '¿Cómo se interpreta un climograma para decidir qué cultivo se adapta mejor?',
      '¿Qué características tienen los principales biomas rurales de Argentina?',
    ],
  },
  {
    id: 'fisica',
    name: 'Física',
    category: 'general',
    shortDescription: 'Fuerzas, movimiento, energía, presión, hidráulica y electricidad básica.',
    starterQuestions: [
      '¿Cómo se relaciona la presión hidráulica con el funcionamiento de una bomba de riego?',
      'No entiendo cómo convertir unidades de velocidad y caudal, ¿practicamos?',
      '¿Qué son las palancas y dónde las vemos en herramientas del taller rural?',
    ],
  },
  {
    id: 'quimica',
    name: 'Química',
    category: 'general',
    shortDescription: 'Materia, soluciones, pH, reacciones químicas y nutrientes esenciales.',
    starterQuestions: [
      '¿Qué significa que un suelo tenga pH ácido, neutro o alcalino?',
      '¿Cómo calculo la concentración de una solución expresada en porcentaje?',
      '¿Por qué el nitrógeno, el fósforo y el potasio son tan importantes en química agrícola?',
    ],
  },
  {
    id: 'biologia',
    name: 'Biología',
    category: 'general',
    shortDescription: 'Célula, fotosíntesis, genética, fisiología vegetal y ecosistemas.',
    starterQuestions: [
      '¿Cómo explico la fotosíntesis y la respiración celular sin confundirlas?',
      '¿Qué función cumplen el xilema y el floema en una planta?',
      '¿Cómo influye la biodiversidad de insectos en el equilibrio de un cultivo?',
    ],
  },
  {
    id: 'educacion-ciudadana',
    name: 'Educación Ciudadana',
    category: 'general',
    shortDescription: 'Derechos, convivencia democrática, trabajo rural y ciudadanía responsable.',
    starterQuestions: [
      '¿Qué derechos y responsabilidades tenemos como estudiantes en la escuela técnica?',
      '¿Cómo se organiza una cooperativa escolar o comunitaria en el ámbito rural?',
      '¿Por qué la participación ciudadana es clave para el cuidado ambiental local?',
    ],
  },

  // Materias Técnicas
  {
    id: 'agricultura',
    name: 'Agricultura',
    category: 'tecnica',
    shortDescription: 'Cultivos extensivos, rotaciones, implantación y manejo sustentable.',
    starterQuestions: [
      '¿Por qué conviene rotar gramíneas con leguminosas en un lote agrícola?',
      '¿Qué factores evaluamos antes de definir la fecha de siembra de un cultivo?',
      '¿Qué diferencia hay entre labranza convencional y siembra directa?',
    ],
  },
  {
    id: 'produccion-vegetal',
    name: 'Producción Vegetal',
    category: 'tecnica',
    shortDescription: 'Fisiología de cultivos, propagación, sanidad vegetal y manejo integrado.',
    starterQuestions: [
      '¿Qué etapas fenológicas atraviesa un cultivo desde la emergencia hasta la cosecha?',
      '¿Qué significa realizar un manejo integrado en producción vegetal?',
      '¿En qué se diferencia la propagación sexual por semilla de la multiplicación vegetativa?',
    ],
  },
  {
    id: 'produccion-animal',
    name: 'Producción Animal',
    category: 'tecnica',
    shortDescription: 'Nutrición, bienestar animal, reproducción, instalaciones y sanidad básica.',
    starterQuestions: [
      '¿Qué diferencia hay entre la digestión de un rumiante y la de un monogástrico?',
      '¿Por qué el bienestar animal mejora la eficiencia de un tambo o corral?',
      '¿Cómo se calcula la carga animal aproximada de una pastura?',
    ],
  },
  {
    id: 'viticultura',
    name: 'Viticultura',
    category: 'tecnica',
    shortDescription: 'Cultivo de la vid, sistemas de conducción, poda, brotación y vendimia.',
    starterQuestions: [
      '¿Qué diferencias prácticas hay entre conducir la vid en espaldero y en parral?',
      '¿Cuál es el objetivo principal de la poda invernal en un viñedo?',
      '¿Cómo influye el clima de montaña o valle en la maduración de la uva?',
    ],
  },
  {
    id: 'fruticultura',
    name: 'Fruticultura',
    category: 'tecnica',
    shortDescription: 'Montes frutales, injertos, poda de formación, polinización y cosecha.',
    starterQuestions: [
      '¿Por qué se utiliza un pie o portainjerto en la implantación de frutales?',
      '¿Qué es el requerimiento de horas de frío en frutales de pepita y carozo?',
      '¿Cómo se diferencia una yema vegetativa de una yema floral en invierno?',
    ],
  },
  {
    id: 'horticultura',
    name: 'Horticultura',
    category: 'tecnica',
    shortDescription: 'Huerta intensiva, almácigos, invernaderos, trasplante y rotación hortícola.',
    starterQuestions: [
      '¿Qué cuidados necesita un almácigo antes de pasar al trasplante definitivo?',
      '¿Cómo planifico una rotación de hortalizas de hoja, raíz y fruto?',
      '¿Qué ventajas y desafíos tiene producir bajo cubierta en invernadero?',
    ],
  },
  {
    id: 'suelos',
    name: 'Suelos',
    category: 'tecnica',
    shortDescription: 'Textura, estructura, materia orgánica, fertilidad y conservación del suelo.',
    starterQuestions: [
      '¿Cómo se distinguen la textura y la estructura de un suelo?',
      '¿Por qué la materia orgánica mejora tanto la fertilidad como la retención de agua?',
      '¿Qué prácticas ayudan a prevenir la erosión hídrica y eólica en un campo?',
    ],
  },
  {
    id: 'riego',
    name: 'Riego',
    category: 'tecnica',
    shortDescription: 'Sistemas de riego, lámina de agua, evapotranspiración y eficiencia hídrica.',
    starterQuestions: [
      '¿En qué casos conviene usar riego por goteo frente a riego por surco o aspersión?',
      '¿Qué significa lámina neta y lámina bruta de riego?',
      '¿Cómo influye el tipo de suelo en la frecuencia con la que conviene regar?',
    ],
  },
  {
    id: 'maquinaria-agricola',
    name: 'Maquinaria Agrícola',
    category: 'tecnica',
    shortDescription: 'Principios mecánicos, implementos, calibración teórica y mantenimiento preventivo.',
    starterQuestions: [
      '¿Qué función cumple la toma de fuerza y el enganche de tres puntos en un tractor?',
      '¿Qué variables teóricas intervienen para calcular el ancho de labor efectivo?',
      '¿Por qué es clave el mantenimiento preventivo de filtros y neumáticos antes de la campaña?',
    ],
  },
  {
    id: 'agroindustria',
    name: 'Agroindustria',
    category: 'tecnica',
    shortDescription: 'Transformación de materias primas, conservación de alimentos, calidad e inocuidad.',
    starterQuestions: [
      '¿Qué principios básicos permiten conservar dulces, conservas o lácteos en agroindustria?',
      '¿Qué son las Buenas Prácticas de Manufactura (BPM) en una sala de elaboración escolar?',
      '¿Cómo se calcula el rendimiento industrial al transformar fruta fresca en pulpa?',
    ],
  },
  {
    id: 'gestion-agropecuaria',
    name: 'Gestión Agropecuaria',
    category: 'tecnica',
    shortDescription: 'Costos productivos, márgenes brutos, registros y planificación de emprendimientos.',
    starterQuestions: [
      '¿Qué diferencia hay entre costos directos y costos indirectos en una actividad productiva?',
      '¿Cómo se calcula el margen bruto de un cultivo o módulo productivo?',
      '¿Por qué es importante llevar registros productivos y económicos durante todo el ciclo?',
    ],
  },
];

export const PLATFORM_MODULES: PlatformModule[] = [
  {
    id: 'edu-alumno',
    name: 'EDU-ALUMNO',
    subtitle: 'Tutor académico inteligente',
    description:
      'Acompañamiento personalizado por año escolar y materia general o técnica, con explicaciones adaptadas, situaciones agropecuarias y ejercicios paso a paso.',
    status: 'active',
    ctaLabel: 'Abrir EDU-ALUMNO',
    plannedFeatures: [
      'Selección de 1.º a 6.º año de escuela técnica agropecuaria',
      'Tutoría en 8 materias generales y 11 materias técnicas',
      'Conversación contextual con ejercicios progresivos y guía socrática',
    ],
  },
  {
    id: 'edu-docente',
    name: 'EDU-DOCENTE',
    subtitle: 'Asistente para docentes',
    description:
      'Espacio para planificar actividades educativas, preguntas de evaluación, guías de estudio, rúbricas y proyectos interdisciplinarios adaptados a la escuela técnica agropecuaria.',
    status: 'active',
    ctaLabel: 'Abrir EDU-DOCENTE',
    plannedFeatures: [
      'Generación de actividades y guías de estudio por año y materia',
      'Preguntas de evaluación y rúbricas por criterios y niveles',
      'Diseño de proyectos interdisciplinarios vinculados a entornos agropecuarios',
    ],
  },
  {
    id: 'edu-organiza',
    name: 'EDU-ORGANIZA',
    subtitle: 'Organizador escolar',
    description:
      'Calendario de entregas, lista de tareas por materia, división de trabajos grandes en pasos pequeños y planes de estudio semanales guardados en tu navegador.',
    status: 'active',
    ctaLabel: 'Abrir EDU-ORGANIZA',
    plannedFeatures: [
      'Calendario mensual y lista de tareas con fechas de entrega por materia',
      'División de trabajos prácticos en actividades pequeñas con seguimiento',
      'Planificador semanal de estudio guardado localmente sin cuentas',
    ],
  },
  {
    id: 'edu-gestion',
    name: 'EDU-GESTIÓN',
    subtitle: 'Información institucional',
    description:
      'Espacio público para consultar calendario escolar, comunicados, reglamentos, información de materias y preguntas frecuentes autorizadas por la escuela, con panel de administración.',
    status: 'active',
    ctaLabel: 'Abrir EDU-GESTIÓN',
    plannedFeatures: [
      'Consulta de calendario escolar, comunicados y reglamentos autorizados',
      'Información pública de materias y preguntas frecuentes institucionales',
      'Sección de administración para cargar y editar documentación escolar',
    ],
  },
];

export function findSchoolYear(yearId: string): SchoolYear | undefined {
  return SCHOOL_YEARS.find((item) => item.id === yearId);
}

export function findSubject(subjectId: string): Subject | undefined {
  return SUBJECTS.find((item) => item.id === subjectId);
}

export const TEACHER_MATERIAL_OPTIONS: TeacherMaterialOption[] = [
  {
    id: 'actividades',
    label: 'Actividades educativas',
    shortDescription: 'Secuencia de consignas áulicas o de campo con progresión didáctica.',
    outputHint: 'Incluye apertura, desarrollo práctico agropecuario y cierre reflexivo.',
  },
  {
    id: 'evaluacion',
    label: 'Preguntas de evaluación',
    shortDescription: 'Banco de consignas variadas con criterios orientativos de corrección.',
    outputHint: 'Combina comprensión conceptual, análisis de casos y resolución aplicada.',
  },
  {
    id: 'guia-estudio',
    label: 'Guía de estudio',
    shortDescription: 'Material ordenado para orientar la lectura y repaso del estudiante.',
    outputHint: 'Incluye ideas clave, glosario técnico, preguntas guía y autoevaluación.',
  },
  {
    id: 'rubrica',
    label: 'Rúbrica de evaluación',
    shortDescription: 'Matriz de criterios y niveles de desempeño en tabla estructurada.',
    outputHint: 'Evalúa comprensión técnica, procedimiento, seguridad y comunicación.',
  },
  {
    id: 'proyecto',
    label: 'Proyecto interdisciplinario',
    shortDescription: 'Propuesta articulada entre materias generales, técnicas y entorno escolar.',
    outputHint: 'Define articulación curricular, etapas, roles, producto final y evaluación.',
  },
];

export function findTeacherMaterialOption(
  id: TeacherMaterialType
): TeacherMaterialOption | undefined {
  return TEACHER_MATERIAL_OPTIONS.find((item) => item.id === id);
}

export const STUDY_DAYS: Array<{ id: StudyDayId; label: string; shortLabel: string }> = [
  { id: 'lunes', label: 'Lunes', shortLabel: 'Lun' },
  { id: 'martes', label: 'Martes', shortLabel: 'Mar' },
  { id: 'miercoles', label: 'Miércoles', shortLabel: 'Mié' },
  { id: 'jueves', label: 'Jueves', shortLabel: 'Jue' },
  { id: 'viernes', label: 'Viernes', shortLabel: 'Vie' },
  { id: 'sabado', label: 'Sábado', shortLabel: 'Sáb' },
  { id: 'domingo', label: 'Domingo', shortLabel: 'Dom' },
];

export interface GestionSectionMeta {
  id: GestionSectionId;
  label: string;
  description: string;
  titleLabel: string;
  titlePlaceholder: string;
  bodyLabel: string;
  bodyPlaceholder: string;
  dateFieldLabel?: string;
  dateFieldPlaceholder?: string;
  tagFieldLabel: string;
  tagFieldPlaceholder: string;
}

export const GESTION_SECTIONS: GestionSectionMeta[] = [
  {
    id: 'calendario-escolar',
    label: 'Calendario escolar',
    description:
      'Fechas oficiales de actos, mesas de examen, jornadas institucionales, inscripciones y períodos lectivos.',
    titleLabel: 'Nombre de la instancia o evento',
    titlePlaceholder: 'Ej.: Período de mesas de exámenes previos',
    bodyLabel: 'Detalle público e indicaciones',
    bodyPlaceholder: 'Indicá horarios generales, modalidad de inscripción o aclaraciones autorizadas.',
    dateFieldLabel: 'Fecha o período',
    dateFieldPlaceholder: 'Ej.: 10 al 14 de diciembre',
    tagFieldLabel: 'Categoría',
    tagFieldPlaceholder: 'Ej.: Mesa de examen / Acto escolar',
  },
  {
    id: 'comunicados',
    label: 'Comunicados',
    description:
      'Avisos oficiales y novedades públicas emitidas por la dirección o áreas de la escuela.',
    titleLabel: 'Título del comunicado',
    titlePlaceholder: 'Ej.: Horarios de atención de Secretaría',
    bodyLabel: 'Texto del comunicado',
    bodyPlaceholder: 'Redactá el comunicado oficial autorizado para familias y estudiantes.',
    dateFieldLabel: 'Fecha de emisión',
    dateFieldPlaceholder: 'Ej.: 16/11/2026',
    tagFieldLabel: 'Área emisora',
    tagFieldPlaceholder: 'Ej.: Dirección / Regencia / Secretaría',
  },
  {
    id: 'reglamentos',
    label: 'Reglamentos',
    description:
      'Acuerdos de convivencia, normas de seguridad en talleres y entornos agropecuarios, y pautas institucionales.',
    titleLabel: 'Nombre del reglamento o normativa',
    titlePlaceholder: 'Ej.: Normas básicas de ingreso a entornos formativos',
    bodyLabel: 'Síntesis o texto autorizado',
    bodyPlaceholder: 'Transcribí los artículos, pautas o condiciones aprobadas por la institución.',
    dateFieldLabel: 'Vigencia o actualización',
    dateFieldPlaceholder: 'Ej.: Ciclo lectivo vigente',
    tagFieldLabel: 'Referencia o ámbito',
    tagFieldPlaceholder: 'Ej.: Convivencia / Taller y campo',
  },
  {
    id: 'materias',
    label: 'Información de materias',
    description:
      'Lineamientos públicos de materias generales y técnicas, departamentos y entornos formativos de la escuela.',
    titleLabel: 'Materia o espacio curricular',
    titlePlaceholder: 'Ej.: Riego — 5.º año',
    bodyLabel: 'Información pública autorizada',
    bodyPlaceholder: 'Describí propósitos de la materia, modalidad de cursada o criterios generales aprobados.',
    dateFieldLabel: 'Ciclo o año escolar',
    dateFieldPlaceholder: 'Ej.: 5.º año · Ciclo Superior',
    tagFieldLabel: 'Departamento o área',
    tagFieldPlaceholder: 'Ej.: Área Técnica Agropecuaria',
  },
  {
    id: 'preguntas-frecuentes',
    label: 'Preguntas frecuentes',
    description:
      'Respuestas oficiales a consultas habituales sobre trámites, cursada, prácticas y funcionamiento escolar.',
    titleLabel: 'Pregunta frecuente',
    titlePlaceholder: 'Ej.: ¿Cómo se solicitan constancias de alumno regular?',
    bodyLabel: 'Respuesta institucional oficial',
    bodyPlaceholder: 'Escribí la respuesta oficial autorizada por la escuela.',
    tagFieldLabel: 'Tema de consulta',
    tagFieldPlaceholder: 'Ej.: Trámites / Cursada / Prácticas',
  },
];
