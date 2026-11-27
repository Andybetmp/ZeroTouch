import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Award,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import { downloadOfficialCertificatePdf } from '../utils/certificatePdf';
import { LoadingButton, SkeletonCard, SkeletonTable } from './ui/LoadingStates';

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

  // Micro-estados de exportación
  const [exportingExcel, setExportingExcel] = useState(false);
  const [excelSuccess, setExcelSuccess] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [generatingCertId, setGeneratingCertId] = useState<string | null>(null);
  const [certSuccessId, setCertSuccessId] = useState<string | null>(null);

  const loadReport = async (overrides?: {
    contractorId?: string;
    statusFilter?: string;
    search?: string;
  }) => {
    setLoading(true);
    try {
      const effectiveContractor = overrides?.contractorId ?? contractorId;
      const effectiveStatus = overrides?.statusFilter ?? statusFilter;
      const effectiveSearch = overrides?.search ?? search;
      const qs = new URLSearchParams();
      if (effectiveContractor) qs.set('contractorId', effectiveContractor);
      if (effectiveStatus !== 'ALL') qs.set('status', effectiveStatus);
      if (effectiveSearch.trim()) qs.set('search', effectiveSearch.trim());
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

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
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
      setExcelSuccess(true);
      window.setTimeout(() => setExcelSuccess(false), 1800);
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportCorporatePdf = async () => {
    setExportingPdf(true);
    try {
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
      setPdfSuccess(true);
      window.setTimeout(() => setPdfSuccess(false), 1800);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleDownloadWorkerCertificate = async (row: TrackingRow) => {
    setGeneratingCertId(row.workerId);
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
      setCertSuccessId(row.workerId);
      window.setTimeout(() => {
        setCertSuccessId((prev) => (prev === row.workerId ? null : prev));
      }, 1800);
    } catch (err: any) {
      onNotify(`Error generando constancia: ${err.message}`);
    } finally {
      setGeneratingCertId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      {loading && rows.length === 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <SkeletonCard key={n} variant="kpi" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <div className="text-xs text-slate-500 font-medium">Trabajadores Filtrados</div>
            <div className="text-2xl font-bold text-slate-900 mt-1.5">{kpis.totalWorkers}</div>
            <div className="text-[11px] text-slate-400 mt-1">Padrón en seguimiento</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <div className="text-xs text-slate-500 font-medium">100% Completado</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1.5">{kpis.completedWorkers}</div>
            <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Habilitados en malla
            </span>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <div className="text-xs text-slate-500 font-medium">En Progreso</div>
            <div className="text-2xl font-bold text-slate-900 mt-1.5">{kpis.inProgressWorkers}</div>
            <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
              Cursando
            </span>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <div className="text-xs text-slate-500 font-medium">Pendientes</div>
            <div className="text-2xl font-bold text-amber-700 mt-1.5">{kpis.pendingWorkers}</div>
            <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              Sin iniciar
            </span>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <div className="text-xs text-slate-500 font-medium">Cumplimiento Promedio</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1.5">
              {kpis.averageCompliancePercent}%
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                style={{ width: `${kpis.averageCompliancePercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Filtros y Botones de Exportación */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar DNI o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadReport()}
              className="pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 w-52"
            />
          </div>
          <select
            value={contractorId}
            onChange={(e) => setContractorId(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
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
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
          >
            <option value="ALL">Todos los estados</option>
            <option value="COMPLETADO">Completado</option>
            <option value="EN_PROGRESO">En Progreso</option>
            <option value="PENDIENTE">Pendiente</option>
          </select>
          <LoadingButton
            type="button"
            variant="secondary"
            isLoading={loading}
            loadingText="Filtrando..."
            onClick={() => loadReport()}
            icon={<Filter className="w-3.5 h-3.5" />}
          >
            Filtrar
          </LoadingButton>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <LoadingButton
            type="button"
            variant="secondary"
            isLoading={exportingPdf}
            loadingText="Generando PDF..."
            isSuccess={pdfSuccess}
            successText="PDF descargado"
            disabled={rows.length === 0}
            onClick={handleExportCorporatePdf}
            icon={<FileText className="w-3.5 h-3.5" />}
          >
            Exportar PDF
          </LoadingButton>
          <LoadingButton
            type="button"
            variant="primary"
            isLoading={exportingExcel}
            loadingText="Exportando..."
            isSuccess={excelSuccess}
            successText="Excel listo"
            disabled={rows.length === 0}
            onClick={handleExportExcel}
            icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
          >
            Exportar Excel (.xlsx)
          </LoadingButton>
        </div>
      </div>

      {/* Tabla Matriz Grupal */}
      {loading ? (
        <SkeletonTable rows={6} columns={8} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase text-[11px] font-semibold border-b border-slate-200">
                <th className="py-3.5 px-4">Trabajador / DNI</th>
                <th className="py-3.5 px-3">Contratista / Puesto</th>
                <th className="py-3.5 px-3">Avance</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Horas (V / P)</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">D1 · D2 · D3 · D4</th>
                <th className="py-3.5 px-3">Nota</th>
                <th className="py-3.5 px-3">Estado</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 px-4 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-sm font-semibold text-slate-700">
                        No se encontraron registros para los filtros seleccionados.
                      </p>
                      {(search.trim() || contractorId || statusFilter !== 'ALL') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setContractorId('');
                            setStatusFilter('ALL');
                            loadReport({ search: '', contractorId: '', statusFilter: 'ALL' });
                          }}
                          className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-emerald-700 transition cursor-pointer"
                        >
                          Limpiar filtros
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.workerId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{r.fullName}</div>
                      <div className="text-[11px] text-slate-500">DNI: {r.dni}</div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-medium text-slate-700">{r.contractorName}</div>
                      <div className="text-[11px] text-slate-500">{r.jobPosition}</div>
                    </td>
                    <td className="py-3.5 px-3 w-36">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 mb-1.5">
                        <span>{r.progressPercent}%</span>
                        <span className="text-slate-500 font-medium">
                          {r.completedCourses}/{r.totalCourses}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${r.progressPercent}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">
                        {r.completedHours}/{r.requiredHours} h
                      </div>
                      <div className="text-[11px] text-slate-500">
                        V: {r.virtualHours}h · P: {r.presentialHours}h
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center justify-center gap-1">
                        {r.dayBreakdown.map((d) => (
                          <span
                            key={d.dayNumber}
                            title={`Día ${d.dayNumber}: ${d.completed}/${d.total}`}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${
                              d.done
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : d.total === 0
                                ? 'bg-slate-50 text-slate-400 border-slate-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            D{d.dayNumber}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                      {r.averageScore !== null ? `${r.averageScore}%` : '—'}
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${
                          r.overallStatus === 'COMPLETADO'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : r.overallStatus === 'EN_PROGRESO'
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {r.overallStatus === 'COMPLETADO'
                          ? 'Completado'
                          : r.overallStatus === 'EN_PROGRESO'
                          ? 'En progreso'
                          : 'Pendiente'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedWorker(r)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold whitespace-nowrap transition cursor-pointer"
                        >
                          Detalle
                        </button>
                        <LoadingButton
                          type="button"
                          variant="secondary"
                          isLoading={generatingCertId === r.workerId}
                          loadingText="Generando PDF..."
                          isSuccess={certSuccessId === r.workerId}
                          successText="Listo"
                          onClick={() => handleDownloadWorkerCertificate(r)}
                          icon={<Award className="w-3.5 h-3.5 text-emerald-700 shrink-0" />}
                          className="py-1.5 px-2.5 whitespace-nowrap"
                        >
                          Constancia PDF
                        </LoadingButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Reporte Individual */}
      {selectedWorker && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4 bateas-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Reporte Individual: {selectedWorker.fullName}
                </h3>
                <p className="text-xs text-slate-500">
                  DNI: {selectedWorker.dni} · {selectedWorker.contractorName} · {selectedWorker.jobPosition}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LoadingButton
                type="button"
                variant="primary"
                isLoading={generatingCertId === selectedWorker.workerId}
                loadingText="Generando PDF..."
                isSuccess={certSuccessId === selectedWorker.workerId}
                successText="Descargado"
                onClick={() => handleDownloadWorkerCertificate(selectedWorker)}
                icon={<Download className="w-3.5 h-3.5" />}
              >
                Descargar Constancia PDF
              </LoadingButton>
              <button
                type="button"
                onClick={() => setSelectedWorker(null)}
                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 cursor-pointer"
                aria-label="Cerrar reporte individual"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {selectedWorker.assignments.map((a) => (
              <div
                key={a.assignmentId}
                className="p-4 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs bg-slate-50/40"
              >
                <div>
                  <div className="font-semibold text-slate-900">{a.courseTitle}</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Día {a.dayNumber} · {a.modality === 'VIRTUAL' ? 'E-learning' : 'Presencial'} · Avance:{' '}
                    {a.progressPercent}% ({a.hoursCompleted}/{a.durationHours}h)
                    {(a.presentialScore ?? a.examScore) !== null &&
                      ` · Nota: ${a.presentialScore ?? a.examScore}%`}
                  </div>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${
                    a.status === 'COMPLETED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {a.status === 'COMPLETED' ? 'Completado' : 'Pendiente'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
