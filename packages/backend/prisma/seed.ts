import { prisma } from '../src/config/prisma.js';
import { createDemoScenarioWorkflow } from '../src/services/workflow.service.js';

async function main() {
  console.log('🌱 Sembrando tablas maestras de App Bateas v2.1.0 en PostgreSQL...');

  // 1. Requisitos por Tipo de Estadía (Réplica exacta de Entregable 3, Figura 3 + Perfiles)
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

  // 3. Banco de Preguntas E-Learning Asíncrono 24/7
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

  // 4. Crear los 3 casos demostrativos iniciales para que el dashboard arranque con datos ricos
  console.log('⚡ Generando expedientes demostrativos con motor OCR real...');
  await createDemoScenarioWorkflow('ZERO_TOUCH_GREEN');
  await createDemoScenarioWorkflow('EXCEPTION_AMBER');
  await createDemoScenarioWorkflow('EXPIRED_RED');

  console.log('✅ Seed completado exitosamente.');
}

main()
  .catch((err) => {
    console.error('❌ Error en seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
