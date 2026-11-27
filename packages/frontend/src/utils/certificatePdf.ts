import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface CertificatePdfInput {
  workerName: string;
  workerDni: string;
  jobPosition: string;
  contractorName: string;
  areaLabel?: string;
  verificationCode: string;
  issuedAt: string;
  issuedBy: string;
  totalHours: number;
  virtualHours: number;
  presentialHours: number;
  averageScore: number | null;
  dayBreakdown: Array<{
    dayNumber: number;
    title: string;
    modality: string;
    hours: number;
    status: string;
  }>;
}

export async function downloadOfficialCertificatePdf(input: CertificatePdfInput) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Membrete corporativo oscuro Bateas
  doc.setFillColor(34, 45, 50); // #222d32
  doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setFillColor(16, 185, 129); // esmeralda
  doc.rect(0, 34, pageWidth, 2.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('MINERA BATEAS S.A.C.', 15, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('SISTEMA INTEGRADO DE GESTION SSOMA · BATEAS ZERO-TOUCH', 15, 21);
  doc.text('Cumplimiento Normativo D.S. 024-2016-EM y Modificatoria D.S. 023-2017-EM', 15, 27);

  // Título del certificado
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('CONSTANCIA OFICIAL DE CAPACITACION', pageWidth / 2, 48, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Se certifica que el trabajador ha completado satisfactoriamente su malla de capacitacion obligatoria:',
    pageWidth / 2,
    56,
    { align: 'center' }
  );

  // Tarjeta de datos del trabajador
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, 62, pageWidth - 30, 42, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Apellidos y Nombres:', 20, 71);
  doc.text('DNI / Documento:', 20, 79);
  doc.text('Empresa Contratista:', 20, 87);
  doc.text('Area de Ingreso / Puesto:', 20, 95);

  doc.setFont('helvetica', 'normal');
  doc.text(input.workerName, 72, 71);
  doc.text(input.workerDni, 72, 79);
  doc.text(input.contractorName, 72, 87);
  doc.text(`${input.areaLabel || 'Unidad Minera'} (${input.jobPosition})`, 72, 95);

  // Resumen de horas y nota
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(15, 110, pageWidth - 30, 16, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(6, 95, 70);
  doc.text(
    `Total Horas: ${input.totalHours.toFixed(1)} h   |   E-learning: ${input.virtualHours.toFixed(1)} h   |   Presencial: ${input.presentialHours.toFixed(1)} h   |   Promedio: ${input.averageScore !== null ? `${input.averageScore}%` : 'Aprobado'}`,
    pageWidth / 2,
    120,
    { align: 'center' }
  );

  // Tabla desglose
  autoTable(doc, {
    startY: 132,
    head: [['Etapa / Jornada', 'Programa / Descripcion', 'Modalidad', 'Horas', 'Estado']],
    body: input.dayBreakdown.map((d) => [
      `Dia ${d.dayNumber}`,
      d.title,
      d.modality === 'VIRTUAL' ? 'E-learning' : 'Presencial',
      `${d.hours.toFixed(1)} h`,
      d.status,
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [34, 45, 50], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 15, right: 15 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 16 : 205;

  // Bloque de validación por código y DNI (sin QR)
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, finalY, 102, 30, 2, 2, 'FD');

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('REGISTRO DE VALIDACION SSOMA', 20, finalY + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Codigo de Constancia: ${input.verificationCode}`, 20, finalY + 15);
  doc.text(`DNI Verificado: ${input.workerDni}`, 20, finalY + 21);
  doc.text(`Fecha de Emision: ${new Date(input.issuedAt).toLocaleString('es-PE')}`, 20, finalY + 27);

  // Firma SSOMA
  doc.setDrawColor(100, 116, 139);
  doc.line(130, finalY + 22, pageWidth - 15, finalY + 22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Gerencia SSOMA - Minera Bateas', (130 + pageWidth - 15) / 2, finalY + 28, {
    align: 'center',
  });

  doc.save(`Constancia_Capacitacion_${input.workerDni}_${input.verificationCode}.pdf`);
}
