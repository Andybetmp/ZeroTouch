import { prisma } from '../src/config/prisma.js';
import { createDemoScenarioWorkflow } from '../src/services/workflow.service.js';
import { ensureWorkerTrainingPlan, upsertTrainingModuleCms } from '../src/services/training.service.js';
import { ensureWorkerExternalIntegrations } from '../src/services/integrations.service.js';
import { recalculateWorkerTrafficLight } from '../src/services/trafficLight.service.js';

async function main() {
  console.log('🌱 Sembrando tablas maestras de App Bateas v2.1.0 + Normativa D.S. 024-2016-EM en Supabase...');

  // 1. Requisitos por Tipo de Estadía (App Bateas v2.1.0)
  const requirementsData = [
    {
      code: 'DNI',
      name: 'DNI (Documento Nacional de Identidad)',
      stayType: 'PERMANENTE_CIA' as const,
      applicableJob: null,
      isMandatory: true,
      requiresValidity: false,
      responsibleArea: 'DHO' as const,
    },
    {
      code: 'SCTR',
      name: 'CONSTANCIA DE SCTR (Salud y Pensión)',
      stayType: 'PERMANENTE_CIA' as const,
      applicableJob: null,
      isMandatory: true,
      requiresValidity: true,
      responsibleArea: 'SSOMA' as const,
    },
    {
      code: 'EMO_16',
      name: 'EMO - ANEXO 16-16A (Examen Médico Ocupacional)',
      stayType: 'PERMANENTE_CIA' as const,
      applicableJob: null,
      isMandatory: true,
      requiresValidity: true,
      responsibleArea: 'AREA_MEDICA' as const,
    },
    {
      code: 'CV_DOC',
      name: 'CV DOCUMENTADO',
      stayType: 'PERMANENTE_CIA' as const,
      applicableJob: null,
      isMandatory: true,
      requiresValidity: false,
      responsibleArea: 'DHO' as const,
    },
    {
      code: 'DDJJ_DOM',
      name: 'DDJJ SIMPLE DE DOMICILIO',
      stayType: 'PERMANENTE_CIA' as const,
      applicableJob: null,
      isMandatory: true,
      requiresValidity: false,
      responsibleArea: 'DHO' as const,
    },
    {
      code: 'FOTO',
      name: 'FOTO PARA FOTOCHECK',
      stayType: 'PERMANENTE_CIA' as const,
      applicableJob: null,
      isMandatory: true,
      requiresValidity: false,
      responsibleArea: 'DHO' as const,
    },
    {
      code: 'ISEM_CONST',
      name: 'CONSTANCIA - ISEM (AUTOMÁTICO)',
      stayType: 'PERMANENTE_CIA' as const,
      applicableJob: null,
      isMandatory: false,
      requiresValidity: false,
      responsibleArea: 'SSOMA' as const,
    },
    {
      code: 'CERT_HAB',
      name: 'CERTIFICADO DE HABILIDAD VIGENTE (CIP)',
      stayType: 'PERMANENTE_CIA' as const,
      applicableJob: 'INGENIERO' as const,
      isMandatory: true,
      requiresValidity: true,
      responsibleArea: 'AREA_USUARIA' as const,
    },
    {
      code: 'LIC_COND',
      name: 'LICENCIA DE CONDUCIR Y RÉCORD MTC',
      stayType: 'PERMANENTE_CIA' as const,
      applicableJob: 'CONDUCTOR' as const,
      isMandatory: true,
      requiresValidity: true,
      responsibleArea: 'SSOMA' as const,
    },
    {
      code: 'CARNET_SAN',
      name: 'CARNÉ DE SANIDAD VIGENTE',
      stayType: 'PERMANENTE_CIA' as const,
      applicableJob: 'PERSONAL_COCINA' as const,
      isMandatory: true,
      requiresValidity: true,
      responsibleArea: 'AREA_MEDICA' as const,
    },
  ];

  for (const req of requirementsData) {
    await prisma.stayTypeRequirement.upsert({
      where: { code: req.code },
      update: req,
      create: req,
    });
  }

  // 2. Lista Negra (Blacklist) de Minera Bateas
  const blacklistEntries = [
    {
      dni: '49998887',
      fullName: 'MARCOS VARGAS QUISPE',
      reason: 'Infracción grave de reglamento interno de seguridad en unidad minera (Reporte DHO-2025).',
      isActive: true,
    },
    {
      dni: '40011223',
      fullName: 'ROBERTO GOMEZ CACERES',
      reason: 'Presentación de certificado SCTR adulterado detectado en auditoría.',
      isActive: true,
    },
  ];

  for (const item of blacklistEntries) {
    await prisma.blacklistEntry.upsert({
      where: { dni: item.dni },
      update: item,
      create: item,
    });
  }

  // 3. Banco de Preguntas E-Learning Clásico (compatibilidad)
  await prisma.quizQuestion.deleteMany({});
  await prisma.quizQuestion.createMany({
    data: [
      {
        category: 'SEGURIDAD_GENERAL',
        questionText: 'Antes de ingresar a una zona restringida de la Unidad Minera Bateas, ¿qué corresponde hacer?',
        optionsJson: JSON.stringify([
          'Ingresar si otro trabajador ya entró antes',
          'Confirmar la autorización vigente, portar EPP completo y seguir el control de acceso en garita',
          'Ingresar directamente si el trabajo es urgente',
        ]),
        correctIndex: 1,
      },
      {
        category: 'SEGURIDAD_GENERAL',
        questionText: 'Si observas una condición o acto subestándar de alto riesgo en tu frente de trabajo, ¿cuál es la acción correcta?',
        optionsJson: JSON.stringify([
          'Continuar operando para cumplir la meta del turno',
          'Esperar al final de la guardia para comentarlo',
          'Aplicar el derecho a decir NO / detener la tarea y reportar inmediatamente al supervisor y SSOMA',
        ]),
        correctIndex: 2,
      },
      {
        category: 'MEDIO_AMBIENTE',
        questionText: '¿Cómo se deben gestionar los residuos sólidos generados durante las actividades del contratista?',
        optionsJson: JSON.stringify([
          'Segregarlos según el código de colores NTP y disponerlos en los puntos autorizados',
          'Dejarlos apilados junto a la maquinaria',
          'Mezclarlos en un solo contenedor para ahorrar tiempo',
        ]),
        correctIndex: 0,
      },
      {
        category: 'SEGURIDAD_GENERAL',
        questionText: 'Respecto al uso del Carné Digital QR y el Fotocheck físico en PVC dentro de la unidad minera:',
        optionsJson: JSON.stringify([
          'Solo se requiere mostrar el celular en socavón con los guantes puestos',
          'El Semáforo VERDE habilita el Carné Digital QR y vincula la entrega del Fotocheck físico en PVC obligatorio en campo',
          'No es necesario portar ninguna credencial una vez dentro del campamento',
        ]),
        correctIndex: 1,
      },
    ],
  });

  // 4. MÓDULO 2: Programa Oficial de Capacitación Híbrida (4 Días / 32 Horas - D.S. 024-2016-EM)
  console.log('📚 Sembrando Malla Curricular de 4 Días / 32 Horas (D.S. 024-2016-EM)...');
  const day1Mod = await upsertTrainingModuleCms({
    code: 'D1-IND-GEN',
    title: 'Día 1: Inducción General y Cultura de Seguridad Minera',
    description:
      'Políticas de SSO Minera Bateas, Reglamento Interno de Trabajo (RIT), Derecho a Decir NO, IPERC Base y Gestión Ambiental NTP.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    dayNumber: 1,
    modality: 'ELEARNING',
    requiredHours: 8,
    jobSpecialty: null,
    orderIndex: 1,
    isActive: true,
  });

  const day2Transversal = await upsertTrainingModuleCms({
    code: 'D2-ESP-TRANS',
    title: 'Día 2: Estándares Operativos, PETS, MATPEL e IPERC Continuo',
    description:
      'Capacitación específica obligatoria en trabajos de alto riesgo (altura, espacios confinados, bloqueo LOTO, MATPEL) + Examen Teórico.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    dayNumber: 2,
    modality: 'ELEARNING',
    requiredHours: 8,
    jobSpecialty: null,
    orderIndex: 2,
    isActive: true,
  });

  const day2Conductor = await upsertTrainingModuleCms({
    code: 'D2-ESP-COND',
    title: 'Día 2 (Especialidad Conductor): Manejo Defensivo y Fatiga en Mina',
    description:
      'Protocolo de transporte de personal y carga en interior mina/superficie, control de fatiga, somnolencia y check-list pre-uso.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoy.mp4',
    dayNumber: 2,
    modality: 'ELEARNING',
    requiredHours: 8,
    jobSpecialty: 'CONDUCTOR',
    orderIndex: 3,
    isActive: true,
  });

  const day3Mod = await upsertTrainingModuleCms({
    code: 'D3-PRAC-CAMPO',
    title: 'Día 3: Práctica Presencial en Campo — Control de Riesgos Críticos (8h)',
    description:
      'Entrenamiento presencial guiado por instructor SSOMA en unidad minera: inspección de labores, uso de detector multigás y refugios.',
    dayNumber: 3,
    modality: 'PRESENTIAL',
    requiredHours: 8,
    jobSpecialty: null,
    orderIndex: 4,
    isActive: true,
  });

  const day4Mod = await upsertTrainingModuleCms({
    code: 'D4-PRAC-RV',
    title: 'Día 4: Evaluación Práctica en Campo + Simulador RV Socavón (8h)',
    description:
      'Evaluación práctica en campo (nota mínima 14/20) + Aprobación de los 4 escenarios críticos de Realidad Virtual subterránea.',
    dayNumber: 4,
    modality: 'VR',
    requiredHours: 8,
    jobSpecialty: null,
    orderIndex: 5,
    isActive: true,
  });

  // Preguntas para Día 2 (Transversal y Conductor)
  await prisma.trainingQuestion.deleteMany({
    where: { moduleId: { in: [day2Transversal.id, day2Conductor.id] } },
  });

  await prisma.trainingQuestion.createMany({
    data: [
      {
        moduleId: day2Transversal.id,
        questionText: 'Según el D.S. 024-2016-EM, ¿qué porcentaje mínimo de oxígeno debe existir en una labor subterránea para ingresar?',
        optionsJson: JSON.stringify(['16.5% O2', '19.5% O2', '23.5% O2']),
        correctIndex: 1,
      },
      {
        moduleId: day2Transversal.id,
        questionText: 'En el procedimiento de Bloqueo y Etiquetado (LOTO), ¿quién puede retirar un candado personal?',
        optionsJson: JSON.stringify([
          'El supervisor de guardia si hay prisa',
          'Únicamente el trabajador que lo colocó tras verificar energía cero',
          'Cualquier electricista de turno',
        ]),
        correctIndex: 1,
      },
      {
        moduleId: day2Transversal.id,
        questionText: 'Antes de iniciar cualquier tarea en socavón, ¿qué herramienta de gestión debe elaborarse obligatoriamente en el frente?',
        optionsJson: JSON.stringify(['IPERC Continuo firmado por todo el equipo y supervisor', 'Solo la lista de asistencia', 'Ninguna si es tarea rutinaria']),
        correctIndex: 0,
      },
      {
        moduleId: day2Transversal.id,
        questionText: 'Durante el desate de rocas sueltas con barretilla, el trabajador debe ubicarse:',
        optionsJson: JSON.stringify([
          'Directamente debajo de la roca suelta',
          'Bajo techo ya sostenido y en ángulo seguro de 45°',
          'De espaldas al frente de avance',
        ]),
        correctIndex: 1,
      },
      {
        moduleId: day2Conductor.id,
        questionText: 'Al aproximarse a un equipo pesado (Scooptram/Dumper) en galería subterránea, el conductor o peatón debe:',
        optionsJson: JSON.stringify([
          'Acelerar para pasarlo rápido',
          'Establecer contacto visual/radial, usar refugio peatonal y respetar puntos ciegos',
          'Apagar sus luces para no encandilar',
        ]),
        correctIndex: 1,
      },
    ],
  });

  // 5. Crear los 3 casos demostrativos iniciales con sus planes 32h + integraciones API
  console.log('⚡ Generando expedientes demostrativos con motor OCR, Capacitación 32h e Integraciones API...');
  const greenWorker = await createDemoScenarioWorkflow('ZERO_TOUCH_GREEN');
  const amberWorker = await createDemoScenarioWorkflow('EXCEPTION_AMBER');
  const redWorker = await createDemoScenarioWorkflow('EXPIRED_RED');

  for (const w of [greenWorker, amberWorker, redWorker]) {
    if (!w) continue;
    await ensureWorkerTrainingPlan(w.id);
    await ensureWorkerExternalIntegrations(w.id);
  }

  // Completar las 32h + RV para el trabajador ZERO_TOUCH_GREEN (Carlos Antonio Ramírez) para que mantenga su Semáforo VERDE
  if (greenWorker) {
    for (const m of [day1Mod, day2Transversal, day3Mod, day4Mod]) {
      await prisma.workerTrainingProgress.upsert({
        where: { workerId_moduleId: { workerId: greenWorker.id, moduleId: m.id } },
        update: {
          completedSeconds: m.requiredHours * 3600,
          requiredSeconds: m.requiredHours * 3600,
          status: 'COMPLETED',
          examScore: m.dayNumber === 2 ? 100 : null,
          practicalScore: m.dayNumber >= 3 ? 18 : null,
          attendanceVerifiedBy: m.dayNumber >= 3 ? 'Ing. SSOMA Víctor Cayata' : null,
          completedAt: new Date(),
        },
        create: {
          workerId: greenWorker.id,
          moduleId: m.id,
          completedSeconds: m.requiredHours * 3600,
          requiredSeconds: m.requiredHours * 3600,
          status: 'COMPLETED',
          examScore: m.dayNumber === 2 ? 100 : null,
          practicalScore: m.dayNumber >= 3 ? 18 : null,
          attendanceVerifiedBy: m.dayNumber >= 3 ? 'Ing. SSOMA Víctor Cayata' : null,
          completedAt: new Date(),
        },
      });
    }

    for (const sc of ['SCALING_ROCK', 'GAS_VENTILATION', 'HEAVY_MACHINERY', 'LOTO_LOCKOUT']) {
      await prisma.vrSimulationSession.create({
        data: {
          workerId: greenWorker.id,
          pairingCode: '842910',
          scenarioCode: sc,
          score: 95,
          criticalErrorsJson: '[]',
          passed: true,
          durationSeconds: 420,
          syncedToPractical: true,
          completedAt: new Date(),
        },
      });
    }

    await recalculateWorkerTrafficLight(greenWorker.id);
  }

  // 6. Sembrar Usuarios RBAC (SSOMA, ECM, GARITA, TRABAJADOR vinculado a Jorge Luis Huamán Condori)
  const usersSeed = [
    {
      email: 'ssoma@bateas.pe',
      passwordHash: 'Bateas2026!',
      role: 'SSOMA' as const,
      fullName: 'Esp. Víctor Cayata (DHO / SSOMA)',
      areaLabel: 'Auditoría Interna Minera Bateas (SSOMA / Médico / DHO)',
      workerId: null,
    },
    {
      email: 'ecm@bateas.pe',
      passwordHash: 'Bateas2026!',
      role: 'ECM' as const,
      fullName: 'Ing. Roberto Salazar (Admin ECM)',
      areaLabel: 'Empresa Contratista Minera (ECM)',
      workerId: null,
    },
    {
      email: 'garita@bateas.pe',
      passwordHash: 'Bateas2026!',
      role: 'GARITA' as const,
      fullName: 'Sup. Control Patrimonial Garita',
      areaLabel: 'Control de Accesos y Fotocheck PVC',
      workerId: null,
    },
    {
      email: 'trabajador@bateas.pe',
      passwordHash: 'Bateas2026!',
      role: 'TRABAJADOR' as const,
      fullName: amberWorker?.fullName || 'Jorge Luis Huamán Condori',
      areaLabel: 'Portal Exclusivo del Trabajador (Ruta 32h / Biometría / RV)',
      workerId: amberWorker?.id || null,
    },
  ];

  for (const u of usersSeed) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: u,
      create: u,
    });
  }

  // 7. CMS DE CAPACITACIONES POR ÁREA DE INGRESO (ETAPA 1 GENERAL + ETAPA 2 ESPECÍFICA POR ÁREA)
  console.log('🎓 Sembrando Malla de Capacitaciones por Área de Ingreso y Perfil CV...');

  // Desactivar cursos genéricos antiguos que no pertenecen a la malla limpia por áreas
  await prisma.trainingCourse.updateMany({
    where: { code: { in: ['DS-024-2016-EM', 'CMS-D2-TECNICO', 'CMS-D3-PRACTICA', 'CMS-D4-SIMULACION'] } },
    data: { isActive: false },
  });

  const cmsCoursesSeed = [
    // ETAPA 1: INDUCCIÓN GENERAL (targetArea: null — Obligatorio para todas las áreas)
    {
      code: 'CMS-D1-INDUCCION',
      title: 'Inducción General Minera Bateas y RIT',
      description: 'Política Integrada SSO, Derecho a Decir NO, Reglamento Interno de Trabajo y estándares de convivencia.',
      dayNumber: 1,
      modality: 'VIRTUAL' as const,
      durationHours: 4.5,
      minPassScore: 75,
      maxAttempts: 3,
      jobSpecialty: null,
      targetArea: null,
      orderIndex: 1,
      resources: [
        {
          type: 'VIDEO' as const,
          title: 'Video Oficial: Cultura de Seguridad Cero Daño Bateas',
          fileUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          durationMinutes: 45,
          orderIndex: 1,
        },
        {
          type: 'PDF' as const,
          title: 'Manual del Reglamento Interno de Seguridad y Salud Ocupacional (RISSO)',
          fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          fileName: 'RISSO_Bateas_2026.pdf',
          durationMinutes: 30,
          orderIndex: 2,
        },
      ],
      questions: [
        {
          questionText: '¿Qué debe hacer un trabajador ante un riesgo grave o inminente no controlado?',
          options: [
            'Continuar la labor bajo presión del supervisor',
            'Aplicar el Derecho a Decir NO, detener la tarea y reportar inmediatamente a SSOMA',
            'Esperar al cambio de guardia',
          ],
          correctIndex: 1,
          points: 2,
        },
        {
          questionText: '¿Qué normativa peruana regula la Seguridad y Salud Ocupacional en Minería?',
          options: ['D.S. 024-2016-EM y D.S. 023-2017-EM', 'Ley 27444', 'Código Civil Art. 120'],
          correctIndex: 0,
          points: 2,
        },
      ],
    },
    {
      code: 'CMS-D1-AMBIENTE',
      title: 'Gestión Ambiental y Segregación de Residuos NTP',
      description: 'Código de colores para residuos sólidos mineros, control de derrames y cuidado hídrico.',
      dayNumber: 1,
      modality: 'VIRTUAL' as const,
      durationHours: 3.5,
      minPassScore: 75,
      maxAttempts: 3,
      jobSpecialty: null,
      targetArea: null,
      orderIndex: 2,
      resources: [
        {
          type: 'PRESENTATION' as const,
          title: 'Presentación: Código de Colores NTP 900.058 y Manejo de Hidrocarburos',
          fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          fileName: 'Presentacion_MedioAmbiente_NTP.pdf',
          durationMinutes: 25,
          orderIndex: 1,
        },
      ],
      questions: [
        {
          questionText: '¿En qué color de contenedor se disponen los residuos peligrosos (trapos con aceite, envases químicos)?',
          options: ['Verde', 'Rojo', 'Azul'],
          correctIndex: 1,
          points: 2,
        },
      ],
    },

    // ETAPA 2: INTERIOR MINA / SOCAVÓN
    {
      code: 'CMS-AREA-SOC-1',
      title: 'Desate de Rocas, Ventilación y Gases en Socavón',
      description: 'Procedimientos PETS para labores subterráneas, monitoreo de O2/CO y control de techo.',
      dayNumber: 2,
      modality: 'VIRTUAL' as const,
      durationHours: 4.0,
      minPassScore: 75,
      maxAttempts: 3,
      jobSpecialty: null,
      targetArea: 'SOCAVON' as const,
      orderIndex: 1,
      resources: [
        {
          type: 'VIDEO' as const,
          title: 'PETS Subterráneo: Desate de Rocas y Monitoreo de Gases',
          fileUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
          durationMinutes: 50,
          orderIndex: 1,
        },
      ],
      questions: [
        {
          questionText: '¿Cuál es el porcentaje mínimo permisible de Oxígeno (O2) en labores subterráneas?',
          options: ['16.0 %', '19.5 %', '25.0 %'],
          correctIndex: 1,
          points: 2,
        },
      ],
    },
    {
      code: 'CMS-AREA-SOC-2',
      title: 'Práctica de Rescate y Refugios Subterráneos',
      description: 'Entrenamiento práctico en campo con autorrescatador, refugios mineros y evacuación en socavón.',
      dayNumber: 3,
      modality: 'PRESENCIAL' as const,
      durationHours: 4.0,
      minPassScore: 70,
      maxAttempts: 2,
      jobSpecialty: null,
      targetArea: 'SOCAVON' as const,
      orderIndex: 2,
      resources: [],
      questions: [],
    },

    // ETAPA 2: SUPERFICIE / TALLERES
    {
      code: 'CMS-AREA-SUP-1',
      title: 'IPERC Continuo, Manejo Defensivo y Bloqueo LOTO',
      description: 'Control de riesgos críticos en superficie, tránsito de equipos pesados y aislamiento de energías.',
      dayNumber: 2,
      modality: 'VIRTUAL' as const,
      durationHours: 4.0,
      minPassScore: 75,
      maxAttempts: 3,
      jobSpecialty: null,
      targetArea: 'SUPERFICIE' as const,
      orderIndex: 1,
      resources: [
        {
          type: 'VIDEO' as const,
          title: 'Estándar LOTO y Manejo Defensivo en Superficie',
          fileUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
          durationMinutes: 45,
          orderIndex: 1,
        },
      ],
      questions: [
        {
          questionText: '¿En qué orden se ejecuta el bloqueo LOTO?',
          options: [
            'Bloquear después de reparar',
            'Cortar energía, bloquear con candado/tarjeta personal y verificar energía cero',
            'Solo avisar por radio',
          ],
          correctIndex: 1,
          points: 2,
        },
      ],
    },
    {
      code: 'CMS-AREA-SUP-2',
      title: 'Práctica de Campo: EPP y Control de Riesgos en Talleres',
      description: 'Verificación presencial de uso de EPP, extintores y respuesta ante emergencias en superficie.',
      dayNumber: 3,
      modality: 'PRESENCIAL' as const,
      durationHours: 4.0,
      minPassScore: 70,
      maxAttempts: 2,
      jobSpecialty: null,
      targetArea: 'SUPERFICIE' as const,
      orderIndex: 2,
      resources: [],
      questions: [],
    },

    // ETAPA 2: PLANTA CONCENTRADORA
    {
      code: 'CMS-AREA-PLA-1',
      title: 'Seguridad en Procesos Metalúrgicos y MATPEL',
      description: 'Manipulación segura de reactivos químicos, hojas MSDS y control de derrames en planta.',
      dayNumber: 2,
      modality: 'VIRTUAL' as const,
      durationHours: 4.0,
      minPassScore: 75,
      maxAttempts: 3,
      jobSpecialty: null,
      targetArea: 'PLANTA_CONCENTRADORA' as const,
      orderIndex: 1,
      resources: [
        {
          type: 'PDF' as const,
          title: 'Guía Técnica MATPEL y Reactivos de Planta',
          fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          fileName: 'Guia_MATPEL_Planta.pdf',
          durationMinutes: 35,
          orderIndex: 1,
        },
      ],
      questions: [
        {
          questionText: '¿Qué documento debe consultarse antes de manipular cualquier reactivo químico en planta?',
          options: ['Hoja de Seguridad (MSDS / FDS)', 'Boleta de pago', 'Factura comercial'],
          correctIndex: 0,
          points: 2,
        },
      ],
    },
    {
      code: 'CMS-AREA-PLA-2',
      title: 'Bloqueo LOTO en Equipos de Molienda y Flotación',
      description: 'Práctica presencial de aislamiento de energía en fajas transportadoras, molinos y bombas.',
      dayNumber: 3,
      modality: 'PRESENCIAL' as const,
      durationHours: 4.0,
      minPassScore: 70,
      maxAttempts: 2,
      jobSpecialty: null,
      targetArea: 'PLANTA_CONCENTRADORA' as const,
      orderIndex: 2,
      resources: [],
      questions: [],
    },

    // ETAPA 2: OFICINAS ADMINISTRATIVAS
    {
      code: 'CMS-AREA-OFI-1',
      title: 'Ergonomía, Evacuación y Seguridad en Oficinas',
      description: 'Prevención de riesgos disergonómicos, rutas de evacuación y seguridad eléctrica en sede administrativa.',
      dayNumber: 2,
      modality: 'VIRTUAL' as const,
      durationHours: 2.0,
      minPassScore: 75,
      maxAttempts: 3,
      jobSpecialty: null,
      targetArea: 'OFICINAS_ADMINISTRATIVAS' as const,
      orderIndex: 1,
      resources: [
        {
          type: 'PRESENTATION' as const,
          title: 'Protocolo de Seguridad y Evacuación en Oficinas',
          fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          fileName: 'Seguridad_Oficinas.pdf',
          durationMinutes: 20,
          orderIndex: 1,
        },
      ],
      questions: [
        {
          questionText: '¿Qué se debe hacer ante una señal de evacuación por sismo en oficinas?',
          options: [
            'Usar el ascensor rápidamente',
            'Mantener la calma y desplazarse ordenadamente hacia la zona segura señalizada',
            'Permanecer bajo el escritorio todo el día',
          ],
          correctIndex: 1,
          points: 2,
        },
      ],
    },
  ];

  const createdCourses: any[] = [];
  for (const c of cmsCoursesSeed) {
    const existing = await prisma.trainingCourse.findUnique({ where: { code: c.code } });
    if (!existing) {
      const created = await prisma.trainingCourse.create({
        data: {
          code: c.code,
          title: c.title,
          description: c.description,
          dayNumber: c.dayNumber,
          modality: c.modality,
          durationHours: c.durationHours,
          minPassScore: c.minPassScore,
          maxAttempts: c.maxAttempts,
          jobSpecialty: c.jobSpecialty,
          targetArea: c.targetArea,
          orderIndex: c.orderIndex,
          isActive: true,
          resources: {
            create: c.resources,
          },
          questions: {
            create: c.questions.map((q) => ({
              questionText: q.questionText,
              optionsJson: JSON.stringify(q.options),
              correctIndex: q.correctIndex,
              points: q.points,
            })),
          },
        },
      });
      createdCourses.push(created);
    } else {
      const updated = await prisma.trainingCourse.update({
        where: { id: existing.id },
        data: { targetArea: c.targetArea, isActive: true, title: c.title, durationHours: c.durationHours },
      });
      createdCourses.push(updated);
    }
  }

  // Sincronizar automáticamente todos los trabajadores según su Área de Ingreso
  const allWorkersSeed = await prisma.worker.findMany({ select: { id: true, dni: true, accessZone: true } });
  for (const w of allWorkersSeed) {
    // Limpiar asignaciones pendientes de cursos inactivos o de otra área
    await prisma.workerCourseAssignment.deleteMany({
      where: {
        workerId: w.id,
        status: { not: 'COMPLETED' },
        course: {
          OR: [
            { isActive: false },
            { AND: [{ targetArea: { not: null } }, { targetArea: { not: w.accessZone } }] },
          ],
        },
      },
    });

    const areaCourses = createdCourses.filter(
      (c) => c.targetArea === null || c.targetArea === w.accessZone
    );
    for (const c of areaCourses) {
      const isAmberStage1 = amberWorker && w.id === amberWorker.id && c.targetArea === null;
      const isGreen = w.dni === '72458910' || w.dni === '71234561';
      await prisma.workerCourseAssignment.upsert({
        where: { workerId_courseId: { workerId: w.id, courseId: c.id } },
        update: {},
        create: {
          workerId: w.id,
          courseId: c.id,
          status: isGreen || isAmberStage1 ? 'COMPLETED' : 'PENDING',
          progressPercent: isGreen || isAmberStage1 ? 100 : 0,
          hoursCompleted: isGreen || isAmberStage1 ? c.durationHours : 0,
          watchedSeconds: isGreen || isAmberStage1 ? Math.round(c.durationHours * 3600) : 0,
          examScore: isGreen || isAmberStage1 ? 92 : null,
          attemptsUsed: isGreen || isAmberStage1 ? 1 : 0,
          notes: `Asignado automáticamente según área ${w.accessZone}`,
          completedAt: isGreen || isAmberStage1 ? new Date() : null,
        },
      });
    }
  }

  if (amberWorker) {
    await prisma.workerCvProfile.upsert({
      where: { workerId: amberWorker.id },
      update: {},
      create: {
        workerId: amberWorker.id,
        educationJson: JSON.stringify([
          { institution: 'TECSUP Arequipa', degree: 'Técnico en Operación de Equipo Pesado', year: '2018' },
        ]),
        workExperienceJson: JSON.stringify([
          { company: 'Transportes del Sur S.A.C.', role: 'Operador Logístico', period: '2019 - 2021' },
        ]),
        miningExperienceJson: JSON.stringify([
          { mineOrUnit: 'U.M. San Cristóbal - Bateas', role: 'Operador Socavón', years: '4 años', undergroundOrSurface: 'Socavón' },
        ]),
        specializationsJson: JSON.stringify([
          { name: 'IPERC Continuo y Desate de Rocas', level: 'Avanzado' },
          { name: 'Bloqueo LOTO y Ventilación Subterránea', level: 'Intermedio' },
        ]),
        certificationsJson: JSON.stringify([
          { name: 'Licencia MTC A-IIb', issuer: 'MTC Perú', validUntil: '2027-08-15' },
        ]),
        coursesJson: JSON.stringify([
          { name: 'Primeros Auxilios y Respuesta a Emergencias Mineras', hours: '16h', year: '2025' },
        ]),
        updatedBy: 'ecm@bateas.pe',
      },
    });
  }

  const greenWorkerCms = await prisma.worker.findUnique({ where: { dni: '72458910' } });
  if (greenWorkerCms) {
    const existingCert = await prisma.trainingCertificate.findFirst({ where: { workerId: greenWorkerCms.id } });
    if (!existingCert) {
      await prisma.trainingCertificate.create({
        data: {
          workerId: greenWorkerCms.id,
          certificateCode: 'BAT-CERT-2026-0001',
          virtualHours: 12,
          presentialHours: 4,
          totalHours: 16,
          averageScore: 93.8,
          issuedBy: 'ssoma@bateas.pe',
        },
      });
    }
  }

  console.log('✅ Seed completo de los 5 módulos finalizado exitosamente.');
}

main()
  .catch((err) => {
    console.error('❌ Error en seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
