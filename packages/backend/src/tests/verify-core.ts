import assert from 'node:assert/strict';
import {
  extractDocumentContent,
  generateSyntheticPdfBuffer,
  parseFlexibleDate,
} from '../services/ocr.service.js';
import { evaluateDocumentRules } from '../services/rules.service.js';
import { computeGlobalTrafficLight } from '../services/trafficLight.service.js';

async function runCoreTests() {
  console.log('🧪 Ejecutando pruebas unitarias y de integración del Core Domain (SDD)...');

  // 1. Prueba de generación de PDF sintético y extracción OCR PDF_TEXT
  const pdfBuffer = await generateSyntheticPdfBuffer({
    documentTitle: 'CONSTANCIA DE SCTR',
    workerName: 'CARLOS ANTONIO RAMIREZ RAMIREZ',
    workerDni: '72458910',
    companyName: 'INGENIERIA Y SERVICIOS MINEROS S.A.C.',
    expiryDateStr: '31/12/2027',
  });

  const ocrResult = await extractDocumentContent({
    fileName: 'SCTR_72458910.pdf',
    mimeType: 'application/pdf',
    buffer: pdfBuffer,
  });

  assert.equal(ocrResult.detectedDni, '72458910', 'El motor OCR debe detectar el DNI de 8 dígitos');
  assert.ok(ocrResult.detectedExpiryDate instanceof Date, 'El motor OCR debe detectar la fecha de vencimiento');
  console.log('  ✅ 1. Extracción OCR de PDF (DNI + Fecha de vencimiento) verificada.');

  // 2. Prueba del Motor de Reglas — Caso VERDE Zero-Touch
  const ruleGreen = evaluateDocumentRules({
    workerDni: '72458910',
    requiresValidity: true,
    extractedText: ocrResult.extractedText,
    ocrConfidence: ocrResult.ocrConfidence,
    detectedDni: ocrResult.detectedDni,
    detectedExpiryDate: ocrResult.detectedExpiryDate,
  });
  assert.equal(ruleGreen.status, 'VERDE');
  assert.equal(ruleGreen.shouldCreateException, false);
  console.log('  ✅ 2. Regla Zero-Touch VERDE verificada.');

  // 3. Prueba del Motor de Reglas — Caso ROJO por fecha vencida
  const pastDate = parseFlexibleDate('15/01/2023');
  const ruleRed = evaluateDocumentRules({
    workerDni: '72458910',
    requiresValidity: true,
    extractedText: 'CERTIFICADO SCTR VENCIDO DNI: 72458910 Fecha de vencimiento: 15/01/2023',
    ocrConfidence: 99,
    detectedDni: '72458910',
    detectedExpiryDate: pastDate,
  });
  assert.equal(ruleRed.status, 'ROJO');
  assert.equal(ruleRed.shouldCreateException, false);
  console.log('  ✅ 3. Regla ROJO (Documento vencido) verificada.');

  // 4. Prueba del Motor de Reglas — Caso ÁMBAR (Bandeja de Excepciones por DNI discrepante)
  const ruleAmber = evaluateDocumentRules({
    workerDni: '72458910',
    requiresValidity: false,
    extractedText: 'DOCUMENTO DNI: 99998888 NOMBRE: OTRO TRABAJADOR',
    ocrConfidence: 95,
    detectedDni: '99998888',
    detectedExpiryDate: null,
  });
  assert.equal(ruleAmber.status, 'AMBAR');
  assert.equal(ruleAmber.shouldCreateException, true);
  console.log('  ✅ 4. Regla ÁMBAR (Derivación a Bandeja de Excepciones) verificada.');

  // 5. Prueba del Semáforo Operativo Global
  const globalGreen = computeGlobalTrafficLight({
    isBlacklisted: false,
    mandatoryDocs: [
      { status: 'VERDE', requirementName: 'DNI' },
      { status: 'VERDE', requirementName: 'SCTR' },
      { status: 'VERDE', requirementName: 'EMO' },
    ],
    elearningPassed: true,
  });
  assert.equal(globalGreen.trafficLight, 'VERDE');
  assert.equal(globalGreen.shouldIssueQr, true);

  const globalBlacklisted = computeGlobalTrafficLight({
    isBlacklisted: true,
    mandatoryDocs: [{ status: 'VERDE', requirementName: 'DNI' }],
    elearningPassed: true,
  });
  assert.equal(globalBlacklisted.trafficLight, 'ROJO');
  assert.equal(globalBlacklisted.shouldIssueQr, false);

  console.log('  ✅ 5. Máquina de Estados del Semáforo Operativo Global (VERDE/ÁMBAR/ROJO) verificada.');
  console.log('🎉 Todas las pruebas SDD del Core Domain finalizaron con éxito.');
}

runCoreTests().catch((err) => {
  console.error('❌ Falló la suite de pruebas:', err);
  process.exit(1);
});
