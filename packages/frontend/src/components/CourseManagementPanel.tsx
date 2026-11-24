import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  FileText,
  Film,
  HelpCircle,
  Layers,
  Plus,
  Presentation,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';

interface CourseResource {
  id: string;
  type: 'VIDEO' | 'PDF' | 'PRESENTATION' | 'QUIZ';
  title: string;
  contentUrl?: string | null;
  fileName?: string | null;
  durationMinutes: number;
  orderIndex: number;
}

interface CourseQuestion {
  id: string;
  prompt: string;
  optionsJson: string;
  correctIndex: number;
  points: number;
}

interface TrainingCourse {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  dayNumber: number;
  modality: 'VIRTUAL' | 'PRESENCIAL';
  durationHours: number;
  minPassScore: number;
  maxAttempts: number;
  jobSpecialty?: string | null;
  orderIndex: number;
  isActive: boolean;
  resources: CourseResource[];
  questions: CourseQuestion[];
  _count?: { assignments: number };
}

interface DaySubtotal {
  dayNumber: number;
  title: string;
  modality: 'VIRTUAL' | 'PRESENCIAL';
  totalHours: number;
  courseCount: number;
}

interface Props {
  apiFetch: (path: string, options?: RequestInit) => Promise<any>;
  workers: Array<{ id: string; fullName: string; dni: string; jobPosition: string; contractorId: string }>;
  contractors: Array<{ id: string; name: string }>;
  onNotify: (msg: string) => void;
}

export const CourseManagementPanel: React.FC<Props> = ({
  apiFetch,
  workers,
  contractors,
  onNotify,
}) => {
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [daySubtotals, setDaySubtotals] = useState<DaySubtotal[]>([]);
  const [grandTotalHours, setGrandTotalHours] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | 'ALL'>('ALL');
  const [loading, setLoading] = useState(false);

  // Form crear/editar curso
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dayNumber, setDayNumber] = useState(1);
  const [modality, setModality] = useState<'VIRTUAL' | 'PRESENCIAL'>('VIRTUAL');
  const [durationHours, setDurationHours] = useState('2.0');
  const [minPassScore, setMinPassScore] = useState('75');
  const [maxAttempts, setMaxAttempts] = useState('3');
  const [jobSpecialty, setJobSpecialty] = useState('');

  // Modal gestión de recursos & preguntas
  const [activeCourse, setActiveCourse] = useState<TrainingCourse | null>(null);
  const [resType, setResType] = useState<'VIDEO' | 'PDF' | 'PRESENTATION'>('VIDEO');
  const [resTitle, setResTitle] = useState('');
  const [resUrl, setResUrl] = useState('');
  const [resMinutes, setResMinutes] = useState('20');
  const [resFile, setResFile] = useState<File | null>(null);

  const [qPrompt, setQPrompt] = useState('');
  const [qOpt0, setQOpt0] = useState('');
  const [qOpt1, setQOpt1] = useState('');
  const [qOpt2, setQOpt2] = useState('');
  const [qCorrect, setQCorrect] = useState(0);

  // Asignación individual/masiva
  const [assignCourseIds, setAssignCourseIds] = useState<string[]>([]);
  const [assignMode, setAssignMode] = useState<'WORKERS' | 'SPECIALTY' | 'CONTRACTOR'>('WORKERS');
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [assignSpecialty, setAssignSpecialty] = useState('');
  const [assignContractorId, setAssignContractorId] = useState('');

  // Registro presencial Días 3-4
  const [presWorkerId, setPresWorkerId] = useState('');
  const [presCourseId, setPresCourseId] = useState('');
  const [presAttended, setPresAttended] = useState(true);
  const [presScore, setPresScore] = useState('90');
  const [presNotes, setPresNotes] = useState('');

  const loadCourses = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/courses?includeInactive=true');
      setCourses(res.data.courses || []);
      setDaySubtotals(res.data.daySubtotals || []);
      setGrandTotalHours(res.data.grandTotalHours || 0);
      if (activeCourse) {
        const refreshed = (res.data.courses || []).find((c: TrainingCourse) => c.id === activeCourse.id);
        setActiveCourse(refreshed || null);
      }
    } catch (err: any) {
      onNotify(`Error cargando cursos: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setDayNumber(1);
    setModality('VIRTUAL');
    setDurationHours('2.0');
    setMinPassScore('75');
    setMaxAttempts('3');
    setJobSpecialty('');
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const payload = {
        title,
        description,
        dayNumber,
        modality,
        durationHours: parseFloat(durationHours) || 1,
        minPassScore: parseInt(minPassScore, 10) || 75,
        maxAttempts: parseInt(maxAttempts, 10) || 3,
        jobSpecialty: jobSpecialty.trim() || null,
      };
      if (editingId) {
        await apiFetch(`/courses/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        onNotify('Capacitación actualizada correctamente.');
      } else {
        await apiFetch('/courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        onNotify('Nueva capacitación creada en el CMS.');
      }
      resetForm();
      await loadCourses();
    } catch (err: any) {
      onNotify(`Error: ${err.message}`);
    }
  };

  const handleToggleActive = async (course: TrainingCourse) => {
    try {
      await apiFetch(`/courses/${course.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !course.isActive }),
      });
      onNotify(`Curso ${!course.isActive ? 'activado' : 'desactivado'}.`);
      await loadCourses();
    } catch (err: any) {
      onNotify(`Error: ${err.message}`);
    }
  };

  const handleDeleteCourse = async (id: string) => {
    try {
      await apiFetch(`/courses/${id}`, { method: 'DELETE' });
      onNotify('Capacitación eliminada.');
      if (activeCourse?.id === id) setActiveCourse(null);
      await loadCourses();
    } catch (err: any) {
      onNotify(`Error: ${err.message}`);
    }
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCourse || !resTitle.trim()) return;
    try {
      const form = new FormData();
      form.append('type', resType);
      form.append('title', resTitle);
      form.append('durationMinutes', resMinutes);
      if (resUrl.trim()) form.append('contentUrl', resUrl.trim());
      if (resFile) form.append('file', resFile);

      await apiFetch(`/courses/${activeCourse.id}/resources`, {
        method: 'POST',
        body: form,
      });
      setResTitle('');
      setResUrl('');
      setResFile(null);
      onNotify('Recurso agregado a la capacitación.');
      await loadCourses();
    } catch (err: any) {
      onNotify(`Error: ${err.message}`);
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCourse || !qPrompt.trim()) return;
    const options = [qOpt0, qOpt1, qOpt2].map((o) => o.trim()).filter(Boolean);
    if (options.length < 2) {
      onNotify('Ingresa al menos 2 opciones para la pregunta.');
      return;
    }
    try {
      await apiFetch(`/courses/${activeCourse.id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: qPrompt,
          options,
          correctIndex: qCorrect,
          points: 2,
        }),
      });
      setQPrompt('');
      setQOpt0('');
      setQOpt1('');
      setQOpt2('');
      setQCorrect(0);
      onNotify('Pregunta agregada a la evaluación.');
      await loadCourses();
    } catch (err: any) {
      onNotify(`Error: ${err.message}`);
    }
  };

  const handleAssign = async () => {
    if (assignCourseIds.length === 0) {
      onNotify('Selecciona al menos una capacitación para asignar.');
      return;
    }
    try {
      const payload: any = { courseIds: assignCourseIds };
      if (assignMode === 'WORKERS') payload.workerIds = selectedWorkerIds;
      if (assignMode === 'SPECIALTY') payload.jobPosition = assignSpecialty;
      if (assignMode === 'CONTRACTOR') payload.contractorId = assignContractorId;

      const res = await apiFetch('/courses/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      onNotify(
        `Asignación completada: ${res.data.createdCount} nuevas asignaciones en ${res.data.workerCount} trabajador(es).`
      );
      await loadCourses();
    } catch (err: any) {
      onNotify(`Error en asignación: ${err.message}`);
    }
  };

  const handleRecordPresential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presWorkerId || !presCourseId) return;
    try {
      await apiFetch(`/courses/worker/${presWorkerId}/presential`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: presCourseId,
          attended: presAttended,
          presentialScore: parseFloat(presScore) || 0,
          notes: presNotes,
        }),
      });
      onNotify('Asistencia y calificación presencial registrada en auditoría.');
      setPresNotes('');
    } catch (err: any) {
      onNotify(`Error: ${err.message}`);
    }
  };

  const filteredCourses =
    selectedDay === 'ALL' ? courses : courses.filter((c) => c.dayNumber === selectedDay);

  const specialties = Array.from(new Set(workers.map((w) => w.jobPosition))).filter(Boolean);
  const presentialCourses = courses.filter((c) => c.modality === 'PRESENCIAL' && c.isActive);

  return (
    <div className="space-y-6">
      {/* Cabecera de 4 Días Obligatorios */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-600" />
              Gestión de Capacitaciones — Cronograma 4 Días (D.S. 024-2016-EM)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configura módulos Virtuales (Días 1–2) y Presenciales (Días 3–4), recursos multimedia, evaluaciones y asignaciones.
            </p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-right">
            <div className="text-[11px] uppercase font-semibold text-emerald-700">Total Malla Activa</div>
            <div className="text-xl font-bold text-emerald-800">{grandTotalHours.toFixed(1)} horas</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {daySubtotals.map((d) => (
            <button
              key={d.dayNumber}
              onClick={() => setSelectedDay(selectedDay === d.dayNumber ? 'ALL' : d.dayNumber)}
              className={`text-left p-3.5 rounded-lg border transition-all ${
                selectedDay === d.dayNumber
                  ? 'border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-400'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-700">Día {d.dayNumber}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    d.modality === 'VIRTUAL'
                      ? 'bg-sky-100 text-sky-700'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {d.modality}
                </span>
              </div>
              <div className="text-xs font-medium text-slate-600 line-clamp-1">{d.title}</div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1 font-semibold text-slate-800">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  {d.totalHours.toFixed(1)} h
                </span>
                <span>{d.courseCount} cursos</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Formulario Crear/Editar + Lista de Cursos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleSaveCourse}
          className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-3 h-fit"
        >
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-600" />
            {editingId ? 'Editar Capacitación' : 'Nueva Capacitación'}
          </h3>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Título del Curso</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Inducción IPERC Socavón"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Descripción</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Día (1 a 4)</label>
              <select
                value={dayNumber}
                onChange={(e) => {
                  const d = Number(e.target.value);
                  setDayNumber(d);
                  setModality(d <= 2 ? 'VIRTUAL' : 'PRESENCIAL');
                }}
                className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-md"
              >
                <option value={1}>Día 1 - Inducción</option>
                <option value={2}>Día 2 - Técnico</option>
                <option value={3}>Día 3 - Presencial</option>
                <option value={4}>Día 4 - Simulacros</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Modalidad</label>
              <select
                value={modality}
                onChange={(e) => setModality(e.target.value as 'VIRTUAL' | 'PRESENCIAL')}
                className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-md"
              >
                <option value="VIRTUAL">VIRTUAL</option>
                <option value="PRESENCIAL">PRESENCIAL</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Horas</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nota Mín %</label>
              <input
                type="number"
                min="1"
                max="100"
                value={minPassScore}
                onChange={(e) => setMinPassScore(e.target.value)}
                className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Intentos</label>
              <input
                type="number"
                min="1"
                max="10"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
                className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Especialidad (opcional, vacío = todos)
            </label>
            <input
              type="text"
              value={jobSpecialty}
              onChange={(e) => setJobSpecialty(e.target.value)}
              placeholder="Ej. Operador Socavón"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2 rounded-md"
            >
              {editingId ? 'Guardar Cambios' : 'Crear Capacitación'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-2 text-sm border border-slate-300 rounded-md text-slate-600"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>

        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800">
              Catálogo de Capacitaciones ({filteredCourses.length})
            </h3>
            {selectedDay !== 'ALL' && (
              <button
                onClick={() => setSelectedDay('ALL')}
                className="text-xs text-emerald-600 font-semibold hover:underline"
              >
                Ver los 4 días
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-slate-400">Cargando catálogo...</div>
          ) : (
            <div className="space-y-3">
              {filteredCourses.map((c) => (
                <div
                  key={c.id}
                  className={`border rounded-lg p-3.5 transition-all ${
                    c.isActive ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-65'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-white">
                          Día {c.dayNumber}
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                            c.modality === 'VIRTUAL'
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {c.modality}
                        </span>
                        <span className="text-xs font-semibold text-emerald-700">
                          {c.durationHours} h
                        </span>
                        <span className="text-xs text-slate-400">{c.code}</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-800 mt-1">{c.title}</h4>
                      {c.description && <p className="text-xs text-slate-500 mt-0.5">{c.description}</p>}
                      <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-slate-500">
                        <span>Recursos: {c.resources.length}</span>
                        <span>Preguntas: {c.questions.length}</span>
                        <span>Nota mín: {c.minPassScore}%</span>
                        <span>Intentos máx: {c.maxAttempts}</span>
                        <span>Asignados: {c._count?.assignments ?? 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setActiveCourse(activeCourse?.id === c.id ? null : c)}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        Contenido / Quiz
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(c.id);
                          setTitle(c.title);
                          setDescription(c.description || '');
                          setDayNumber(c.dayNumber);
                          setModality(c.modality);
                          setDurationHours(String(c.durationHours));
                          setMinPassScore(String(c.minPassScore));
                          setMaxAttempts(String(c.maxAttempts));
                          setJobSpecialty(c.jobSpecialty || '');
                        }}
                        className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-600"
                        title="Editar"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(c)}
                        className={`px-2 py-1 text-[11px] font-semibold rounded border ${
                          c.isActive
                            ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                            : 'border-slate-300 text-slate-600 bg-white'
                        }`}
                      >
                        {c.isActive ? 'Activo' : 'Inactivo'}
                      </button>
                      <button
                        onClick={() => handleDeleteCourse(c.id)}
                        className="p-1.5 rounded border border-rose-200 text-rose-600 hover:bg-rose-50"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor de Recursos Multimedia y Banco de Preguntas */}
      {activeCourse && (
        <div className="bg-white rounded-lg border-2 border-indigo-200 p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-indigo-900">
              Constructor de Contenido y Evaluación: {activeCourse.title}
            </h3>
            <button
              onClick={() => setActiveCourse(null)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Cerrar editor
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recursos */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-600">
                1. Recursos (Videos, PDFs, Presentaciones)
              </h4>
              <form onSubmit={handleAddResource} className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2.5">
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={resType}
                    onChange={(e) => setResType(e.target.value as any)}
                    className="px-2 py-1.5 text-xs border border-slate-300 rounded"
                  >
                    <option value="VIDEO">Video</option>
                    <option value="PDF">Documento PDF</option>
                    <option value="PRESENTATION">Presentación PPT/PDF</option>
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Título del recurso"
                    value={resTitle}
                    onChange={(e) => setResTitle(e.target.value)}
                    className="col-span-2 px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="URL o enlace embebido"
                    value={resUrl}
                    onChange={(e) => setResUrl(e.target.value)}
                    className="col-span-2 px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="Min"
                    value={resMinutes}
                    onChange={(e) => setResMinutes(e.target.value)}
                    className="px-2 py-1.5 text-xs border border-slate-300 rounded"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="file"
                    accept=".mp4,.webm,.pdf,.ppt,.pptx"
                    onChange={(e) => setResFile(e.target.files?.[0] || null)}
                    className="text-xs text-slate-600"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700"
                  >
                    + Agregar Recurso
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                {activeCourse.resources.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-2.5 border border-slate-200 rounded text-xs">
                    <div className="flex items-center gap-2">
                      {r.type === 'VIDEO' && <Film className="w-4 h-4 text-sky-600" />}
                      {r.type === 'PDF' && <FileText className="w-4 h-4 text-rose-600" />}
                      {r.type === 'PRESENTATION' && <Presentation className="w-4 h-4 text-amber-600" />}
                      <div>
                        <div className="font-semibold text-slate-800">{r.title}</div>
                        <div className="text-[11px] text-slate-500">
                          {r.type} · {r.durationMinutes} min {r.fileName ? `· ${r.fileName}` : ''}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await apiFetch(`/courses/resources/${r.id}`, { method: 'DELETE' });
                        loadCourses();
                      }}
                      className="text-rose-600 hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Evaluaciones */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-600">
                2. Evaluación (Preguntas de Opción Múltiple)
              </h4>
              <form onSubmit={handleAddQuestion} className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                <input
                  type="text"
                  required
                  placeholder="Enunciado de la pregunta"
                  value={qPrompt}
                  onChange={(e) => setQPrompt(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                />
                <div className="grid grid-cols-1 gap-1.5">
                  <input
                    type="text"
                    required
                    placeholder="Opción A"
                    value={qOpt0}
                    onChange={(e) => setQOpt0(e.target.value)}
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Opción B"
                    value={qOpt1}
                    onChange={(e) => setQOpt1(e.target.value)}
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                  />
                  <input
                    type="text"
                    placeholder="Opción C (opcional)"
                    value={qOpt2}
                    onChange={(e) => setQOpt2(e.target.value)}
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <select
                    value={qCorrect}
                    onChange={(e) => setQCorrect(Number(e.target.value))}
                    className="px-2 py-1.5 text-xs border border-slate-300 rounded"
                  >
                    <option value={0}>Correcta: Opción A</option>
                    <option value={1}>Correcta: Opción B</option>
                    <option value={2}>Correcta: Opción C</option>
                  </select>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700"
                  >
                    + Agregar Pregunta
                  </button>
                </div>
              </form>

              <div className="space-y-2 max-h-52 overflow-y-auto">
                {activeCourse.questions.map((q, idx) => (
                  <div key={q.id} className="p-2.5 border border-slate-200 rounded text-xs flex justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-800 flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
                        {idx + 1}. {q.prompt}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Respuesta correcta: Opción {String.fromCharCode(65 + q.correctIndex)}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await apiFetch(`/courses/questions/${q.id}`, { method: 'DELETE' });
                        loadCourses();
                      }}
                      className="text-rose-600 hover:underline h-fit"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Asignación Individual/Masiva y Registro Presencial Días 3-4 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-sky-600" />
            Asignar Capacitaciones (Individual o Masiva)
          </h3>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              1. Selecciona cursos a asignar ({assignCourseIds.length})
            </label>
            <div className="max-h-32 overflow-y-auto border border-slate-200 rounded p-2 space-y-1">
              {courses
                .filter((c) => c.isActive)
                .map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assignCourseIds.includes(c.id)}
                      onChange={(e) =>
                        setAssignCourseIds((prev) =>
                          e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                        )
                      }
                    />
                    <span>
                      [Día {c.dayNumber}] {c.title} ({c.durationHours}h)
                    </span>
                  </label>
                ))}
            </div>
          </div>
          <div className="flex gap-2">
            {(['WORKERS', 'SPECIALTY', 'CONTRACTOR'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setAssignMode(m)}
                className={`px-2.5 py-1 text-xs font-semibold rounded border ${
                  assignMode === m ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 border-slate-300'
                }`}
              >
                {m === 'WORKERS' ? 'Individual' : m === 'SPECIALTY' ? 'Por Puesto' : 'Por Contratista'}
              </button>
            ))}
          </div>

          {assignMode === 'WORKERS' && (
            <div className="max-h-32 overflow-y-auto border border-slate-200 rounded p-2 space-y-1">
              {workers.map((w) => (
                <label key={w.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedWorkerIds.includes(w.id)}
                    onChange={(e) =>
                      setSelectedWorkerIds((prev) =>
                        e.target.checked ? [...prev, w.id] : prev.filter((id) => id !== w.id)
                      )
                    }
                  />
                  <span>
                    {w.fullName} ({w.dni}) — {w.jobPosition}
                  </span>
                </label>
              ))}
            </div>
          )}
          {assignMode === 'SPECIALTY' && (
            <select
              value={assignSpecialty}
              onChange={(e) => setAssignSpecialty(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
            >
              <option value="">Seleccionar puesto / especialidad...</option>
              {specialties.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          {assignMode === 'CONTRACTOR' && (
            <select
              value={assignContractorId}
              onChange={(e) => setAssignContractorId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
            >
              <option value="">Seleccionar empresa contratista...</option>
              {contractors.map((ct) => (
                <option key={ct.id} value={ct.id}>
                  {ct.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handleAssign}
            className="w-full bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold py-2 rounded-md flex items-center justify-center gap-1.5"
          >
            <Users className="w-4 h-4" />
            Ejecutar Asignación
          </button>
        </div>

        {/* Registro Presencial Días 3 y 4 */}
        <form
          onSubmit={handleRecordPresential}
          className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-3"
        >
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-600" />
            Registro Presencial SSOMA (Días 3 y 4)
          </h3>
          <p className="text-xs text-slate-500">
            Registra asistencia y evaluación práctica en campo para habilitar los días presenciales del trabajador.
          </p>
          <select
            required
            value={presWorkerId}
            onChange={(e) => setPresWorkerId(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
          >
            <option value="">Seleccionar trabajador...</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.fullName} ({w.dni})
              </option>
            ))}
          </select>
          <select
            required
            value={presCourseId}
            onChange={(e) => setPresCourseId(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
          >
            <option value="">Seleccionar jornada presencial (Día 3 o 4)...</option>
            {presentialCourses.map((c) => (
              <option key={c.id} value={c.id}>
                [Día {c.dayNumber}] {c.title} ({c.durationHours}h)
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded px-3 py-2">
              <input
                type="checkbox"
                checked={presAttended}
                onChange={(e) => setPresAttended(e.target.checked)}
              />
              Asistió a jornada práctica
            </label>
            <div>
              <input
                type="number"
                min="0"
                max="100"
                value={presScore}
                onChange={(e) => setPresScore(e.target.value)}
                placeholder="Calificación (0-100)"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
              />
            </div>
          </div>
          <input
            type="text"
            value={presNotes}
            onChange={(e) => setPresNotes(e.target.value)}
            placeholder="Observaciones de campo SSOMA (opcional)"
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
          />
          <button
            type="submit"
            className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold py-2 rounded-md flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            Registrar Asistencia y Nota Presencial
          </button>
        </form>
      </div>
    </div>
  );
};
