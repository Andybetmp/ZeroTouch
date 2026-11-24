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
