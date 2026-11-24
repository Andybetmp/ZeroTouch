import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Award,
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Search,
  UserCheck,
} from 'lucide-react';
import { downloadOfficialCertificatePdf } from '../utils/certificatePdf';

interface TrackingRow {
  workerId: string;
  dni: string;
  fullName: string;
  jobPosition: string;
  contractorId: string;
  contractorName: string;
  trafficLightStatus: string;
  totalCourses: number;
  completedCourses: number;
  requiredHours: number;
  completedHours: number;
  virtualHours: number;
  presentialHours: number;
  progressPercent: number;
  averageScore: number | null;
  overallStatus: string;
  dayBreakdown: Array<{ dayNumber: number; total: number; completed: number; done: boolean }>;
  certificate: {
    verificationCode: string;
    totalHours: number;
    averageScore: number | null;
    issuedAt: string;
    issuedBy: string;
  } | null;
  assignments: Array<{
    assignmentId: string;
    courseId: string;
    courseTitle: string;
    dayNumber: number;
    modality: string;
    durationHours: number;
    hoursCompleted: number;
    progressPercent: number;
    status: string;
    examScore: number | null;
    presentialScore: number | null;
  }>;
}

interface Props {
  apiFetch: (path: string, options?: RequestInit) => Promise<any>;
  contractors: Array<{ id: string; name: string }>;
  onNotify: (msg: string) => void;
}

export const TrackingReportsPanel: React.FC<Props> = ({ apiFetch, contractors, onNotify }) => {
  const [rows, setRows] = useState<TrackingRow[]>([]);
  const [kpis, setKpis] = useState({
    totalWorkers: 0,
    completedWorkers: 0,
    inProgressWorkers: 0,
    pendingWorkers: 0,
    averageCompliancePercent: 0,
  });
  const [contractorId, setContractorId] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedWorker, setSelectedWorker] = useState<TrackingRow | null>(null);
  const [loading, setLoading] = useState(false);

  const loadReport = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (contractorId) qs.set('contractorId', contractorId);
      if (statusFilter !== 'ALL') qs.set('status', statusFilter);
      if (search.trim()) qs.set('search', search.trim());
      const res = await apiFetch(`/reports/training?${qs.toString()}`);
      setRows(res.data.rows || []);
      setKpis(res.data.kpis);
    } catch (err: any) {
      onNotify(`Error cargando reporte: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [contractorId, statusFilter]);

  const handleExportExcel = () => {
    const summaryData = rows.map((r) => ({
      DNI: r.dni,
      Trabajador: r.fullName,
      Puesto: r.jobPosition,
      Contratista: r.contractorName,
      Semaforo: r.trafficLightStatus,
      Estado_Capacitacion: r.overallStatus,
      Avance_Porcentaje: r.progressPercent,
      Horas_Completadas: r.completedHours,
      Horas_Requeridas: r.requiredHours,
      Horas_Virtuales: r.virtualHours,
      Horas_Presenciales: r.presentialHours,
      Promedio_Notas: r.averageScore ?? 'N/A',
      Certificado: r.certificate?.verificationCode || 'Pendiente',
    }));

    const detailData = rows.flatMap((r) =>
      r.assignments.map((a) => ({
        DNI: r.dni,
        Trabajador: r.fullName,
        Dia: `Día ${a.dayNumber}`,
        Capacitacion: a.courseTitle,
        Modalidad: a.modality,
        Horas_Curso: a.durationHours,
        Horas_Completadas: a.hoursCompleted,
        Avance_Porcentaje: a.progressPercent,
        Estado: a.status,
        Nota: a.presentialScore ?? a.examScore ?? '-',
      }))
    );

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(summaryData);
    const ws2 = XLSX.utils.json_to_sheet(detailData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Resumen_Trabajadores');
    XLSX.utils.book_append_sheet(wb, ws2, 'Detalle_Cursos_4Dias');
    XLSX.writeFile(wb, `Reporte_Capacitaciones_Bateas_${new Date().toISOString().slice(0, 10)}.xlsx`);
    onNotify('Archivo Excel (.xlsx) descargado con 2 hojas.');
  };

  const handleExportCorporatePdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFillColor(34, 45, 50);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('MINERA BATEAS S.A.C. — REPORTE CONSOLIDADO DE CAPACITACION (4 DIAS)', 14, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(
      `Cumplimiento D.S. 024-2016-EM | Generado: ${new Date().toLocaleString('es-PE')} | Cumplimiento Global: ${kpis.averageCompliancePercent}%`,
      14,
      18
    );

    autoTable(doc, {
      startY: 30,
      head: [
        [
          'DNI',
          'Trabajador',
          'Puesto',
          'Contratista',
          'Avance',
          'Horas',
          'D1',
          'D2',
          'D3',
          'D4',
          'Nota Prom.',
          'Estado',
        ],
      ],
      body: rows.map((r) => [
        r.dni,
        r.fullName,
        r.jobPosition,
        r.contractorName,
        `${r.progressPercent}%`,
        `${r.completedHours}/${r.requiredHours}h`,
        r.dayBreakdown[0]?.done ? 'OK' : `${r.dayBreakdown[0]?.completed || 0}/${r.dayBreakdown[0]?.total || 0}`,
        r.dayBreakdown[1]?.done ? 'OK' : `${r.dayBreakdown[1]?.completed || 0}/${r.dayBreakdown[1]?.total || 0}`,
        r.dayBreakdown[2]?.done ? 'OK' : `${r.dayBreakdown[2]?.completed || 0}/${r.dayBreakdown[2]?.total || 0}`,
        r.dayBreakdown[3]?.done ? 'OK' : `${r.dayBreakdown[3]?.completed || 0}/${r.dayBreakdown[3]?.total || 0}`,
        r.averageScore !== null ? `${r.averageScore}%` : '-',
        r.overallStatus,
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [34, 45, 50] },
    });

    doc.save(`Reporte_Consolidado_SSOMA_${new Date().toISOString().slice(0, 10)}.pdf`);
    onNotify('Reporte PDF corporativo descargado.');
  };

  const handleDownloadWorkerCertificate = async (row: TrackingRow) => {
    try {
      let cert = row.certificate;
      if (!cert) {
        const res = await apiFetch(`/certificates/worker/${row.workerId}/issue`, { method: 'POST' });
        cert = res.data;
        await loadReport();
      }
      if (!cert) return;

      await downloadOfficialCertificatePdf({
        workerName: row.fullName,
        workerDni: row.dni,
        jobPosition: row.jobPosition,
        contractorName: row.contractorName,
        verificationCode: cert.verificationCode,
        issuedAt: cert.issuedAt,
        issuedBy: cert.issuedBy,
        totalHours: row.completedHours,
        virtualHours: row.virtualHours,
        presentialHours: row.presentialHours,
        averageScore: row.averageScore,
        dayBreakdown: [1, 2, 3, 4].map((d) => {
          const dayCourses = row.assignments.filter((a) => a.dayNumber === d);
          const hours = dayCourses.reduce((acc, a) => acc + a.durationHours, 0);
          const done = dayCourses.length > 0 && dayCourses.every((a) => a.status === 'COMPLETED');
          return {
            dayNumber: d,
            title:
              d === 1
                ? 'Induccion General de la Empresa'
                : d === 2
                ? 'Conocimientos Tecnicos y Seguridad'
                : d === 3
                ? 'Capacitacion Presencial y Practicas'
                : 'Simulaciones y Evaluacion Final',
            modality: d <= 2 ? 'VIRTUAL' : 'PRESENCIAL',
            hours,
            status: done ? 'COMPLETADO' : 'PENDIENTE',
          };
        }),
      });
      onNotify(`Constancia PDF descargada para ${row.fullName}.`);
    } catch (err: any) {
      onNotify(`Error generando constancia: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold">Trabajadores Filtrados</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{kpis.totalWorkers}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-emerald-200 shadow-sm">
          <div className="text-xs text-emerald-700 font-semibold">100% Completado</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{kpis.completedWorkers}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-sky-200 shadow-sm">
          <div className="text-xs text-sky-700 font-semibold">En Progreso</div>
          <div className="text-2xl font-bold text-sky-700 mt-1">{kpis.inProgressWorkers}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-amber-200 shadow-sm">
          <div className="text-xs text-amber-700 font-semibold">Pendientes</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{kpis.pendingWorkers}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-indigo-200 shadow-sm">
          <div className="text-xs text-indigo-700 font-semibold">Cumplimiento Promedio</div>
          <div className="text-2xl font-bold text-indigo-700 mt-1">{kpis.averageCompliancePercent}%</div>
        </div>
      </div>

      {/* Filtros y Botones de Exportación */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Buscar DNI o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadReport()}
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md"
            />
          </div>
          <select
            value={contractorId}
            onChange={(e) => setContractorId(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
          >
            <option value="">Todas las ECM</option>
            {contractors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
          >
            <option value="ALL">Todos los estados</option>
            <option value="COMPLETADO">Completado</option>
            <option value="EN_PROGRESO">En Progreso</option>
            <option value="PENDIENTE">Pendiente</option>
          </select>
          <button
            onClick={loadReport}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-800 text-white rounded-md flex items-center gap-1"
          >
            <Filter className="w-3.5 h-3.5" />
            Filtrar
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Exportar Excel (.xlsx)
          </button>
          <button
            onClick={handleExportCorporatePdf}
            className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-md flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4" />
            Exportar PDF Corporativo
          </button>
        </div>
      </div>

      {/* Tabla Matriz Grupal */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-600 uppercase text-[11px] border-b border-slate-200">
              <th className="py-3 px-4">Trabajador / DNI</th>
              <th className="py-3 px-3">Contratista / Puesto</th>
              <th className="py-3 px-3">Avance</th>
              <th className="py-3 px-3">Horas (V / P)</th>
              <th className="py-3 px-3 text-center">D1 · D2 · D3 · D4</th>
              <th className="py-3 px-3">Nota</th>
              <th className="py-3 px-3">Estado</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  Cargando matriz de cumplimiento...
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.workerId} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-800">{r.fullName}</div>
                    <div className="text-[11px] text-slate-500">DNI: {r.dni}</div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-slate-700">{r.contractorName}</div>
                    <div className="text-[11px] text-slate-500">{r.jobPosition}</div>
                  </td>
                  <td className="py-3 px-3 w-36">
                    <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                      <span>{r.progressPercent}%</span>
                      <span>
                        {r.completedCourses}/{r.totalCourses}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div
                        className="bg-emerald-600 h-1.5 rounded-full"
                        style={{ width: `${r.progressPercent}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-800">
                      {r.completedHours}/{r.requiredHours} h
                    </div>
                    <div className="text-[11px] text-slate-500">
                      V: {r.virtualHours}h · P: {r.presentialHours}h
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-center gap-1">
                      {r.dayBreakdown.map((d) => (
                        <span
                          key={d.dayNumber}
                          title={`Día ${d.dayNumber}: ${d.completed}/${d.total}`}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            d.done
                              ? 'bg-emerald-100 text-emerald-700'
                              : d.total === 0
                              ? 'bg-slate-100 text-slate-400'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          D{d.dayNumber}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-700">
                    {r.averageScore !== null ? `${r.averageScore}%` : '-'}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.overallStatus === 'COMPLETADO'
                          ? 'bg-emerald-100 text-emerald-700'
                          : r.overallStatus === 'EN_PROGRESO'
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {r.overallStatus}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-1.5">
                    <button
                      onClick={() => setSelectedWorker(r)}
                      className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold"
                    >
                      Detalle
                    </button>
                    <button
                      onClick={() => handleDownloadWorkerCertificate(r)}
                      className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold inline-flex items-center gap-1"
                    >
                      <Award className="w-3.5 h-3.5" />
                      Constancia PDF
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Reporte Individual Modal / Drawer */}
      {selectedWorker && (
        <div className="bg-white rounded-lg border-2 border-indigo-200 p-5 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              Reporte Individual: {selectedWorker.fullName} ({selectedWorker.dni})
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownloadWorkerCertificate(selectedWorker)}
                className="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar Constancia PDF
              </button>
              <button
                onClick={() => setSelectedWorker(null)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Cerrar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {selectedWorker.assignments.map((a) => (
              <div
                key={a.assignmentId}
                className="p-3 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-800">
                    [Día {a.dayNumber} · {a.modality}] {a.courseTitle}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Avance: {a.progressPercent}% ({a.hoursCompleted}/{a.durationHours}h)
                    {(a.presentialScore ?? a.examScore) !== null &&
                      ` · Nota: ${a.presentialScore ?? a.examScore}%`}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    a.status === 'COMPLETED'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
