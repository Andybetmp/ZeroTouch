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
  MapPin,
  Plus,
  Presentation,
  RefreshCw,
  Trash2,
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
  targetArea?: string | null;
  targetAreaLabel?: string;
  stageLabel?: string;
  orderIndex: number;
  isActive: boolean;
  resources: CourseResource[];
  questions: CourseQuestion[];
  _count?: { assignments: number };
}

interface AreaSummaryItem {
  areaKey: string;
  label: string;
  courseCount: number;
  totalHours: number;
}

interface Props {
  apiFetch: (path: string, options?: RequestInit) => Promise<any>;
  workers: Array<{ id: string; fullName: string; dni: string; jobPosition: string; contractorId: string }>;
  contractors: Array<{ id: string; name: string }>;
  onNotify: (msg: string) => void;
}

const AREA_OPTIONS = [
  { value: '', label: 'Etapa 1: Inducción General (Todas las áreas)' },
  { value: 'SOCAVON', label: 'Etapa 2: Interior Mina / Socavón' },
  { value: 'PLANTA_CONCENTRADORA', label: 'Etapa 2: Planta Concentradora' },
  { value: 'SUPERFICIE', label: 'Etapa 2: Superficie / Talleres' },
  { value: 'OFICINAS_ADMINISTRATIVAS', label: 'Etapa 2: Oficinas Administrativas' },
];

export const CourseManagementPanel: React.FC<Props> = ({
  apiFetch,
  workers,
  onNotify,
}) => {
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [areaSummary, setAreaSummary] = useState<AreaSummaryItem[]>([]);
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Form crear/editar curso
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetArea, setTargetArea] = useState<string>('');
  const [modality, setModality] = useState<'VIRTUAL' | 'PRESENCIAL'>('VIRTUAL');
  const [durationHours, setDurationHours] = useState('4.0');
  const [minPassScore, setMinPassScore] = useState('75');
  const [maxAttempts, setMaxAttempts] = useState('3');

  // Editor de recursos y preguntas
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

  // Registro presencial SSOMA
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
      setAreaSummary(res.data.areaSummary || []);
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
    setTargetArea('');
    setModality('VIRTUAL');
    setDurationHours('4.0');
    setMinPassScore('75');
    setMaxAttempts('3');
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const payload = {
        title,
        description,
        targetArea: targetArea || null,
        dayNumber: targetArea ? (modality === 'PRESENCIAL' ? 3 : 2) : 1,
        modality,
        durationHours: parseFloat(durationHours) || 1,
        minPassScore: parseInt(minPassScore, 10) || 75,
        maxAttempts: parseInt(maxAttempts, 10) || 3,
      };
      if (editingId) {
        await apiFetch(`/courses/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        onNotify('Curso actualizado y asignaciones sincronizadas automáticamente según área.');
      } else {
        await apiFetch('/courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        onNotify('Curso creado y asignado automáticamente a los trabajadores del área seleccionada.');
      }
      resetForm();
      await loadCourses();
    } catch (err: any) {
      onNotify(`Error: ${err.message}`);
    }
  };

  const handleSyncAllAreas = async () => {
    setSyncing(true);
    try {
      const res = await apiFetch('/courses/sync-areas', { method: 'POST' });
      onNotify(
        `Sincronización automática completada en ${res.data.workersSynced} trabajador(es) (${res.data.totalAssigned} asignaciones actualizadas).`
      );
      await loadCourses();
    } catch (err: any) {
      onNotify(`Error sincronizando: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleActive = async (course: TrainingCourse) => {
    try {
      await apiFetch(`/courses/${course.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !course.isActive }),
      });
      onNotify(`Curso ${!course.isActive ? 'activado' : 'desactivado'} y malla sincronizada.`);
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
      onNotify('Recurso agregado.');
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
      onNotify('Ingresa al menos 2 opciones.');
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
      onNotify('Pregunta agregada.');
      await loadCourses();
    } catch (err: any) {
      onNotify(`Error: ${err.message}`);
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
      onNotify('Asistencia y calificación presencial registrada.');
      setPresNotes('');
    } catch (err: any) {
      onNotify(`Error: ${err.message}`);
    }
  };

  const filteredCourses =
    selectedAreaFilter === 'ALL'
      ? courses
      : selectedAreaFilter === 'GENERAL'
      ? courses.filter((c) => !c.targetArea)
      : courses.filter((c) => c.targetArea === selectedAreaFilter);

  const presentialCourses = courses.filter((c) => c.modality === 'PRESENCIAL' && c.isActive);

  return (
    <div className="space-y-6">
      {/* Cabecera: Malla Automática por Área de Ingreso */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-600" />
              Malla de Capacitación Automática por Área de Ingreso
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Asocia cada curso a un Área de Ingreso. El sistema asigna automáticamente a cada trabajador su Inducción General + cursos del área asignada.
            </p>
          </div>
          <button
            type="button"
            disabled={syncing}
            onClick={handleSyncAllAreas}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar trabajadores por área
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {areaSummary.map((area) => (
            <button
              key={area.areaKey}
              type="button"
              onClick={() =>
                setSelectedAreaFilter(selectedAreaFilter === area.areaKey ? 'ALL' : area.areaKey)
              }
              className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                selectedAreaFilter === area.areaKey
                  ? 'border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-400'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 mb-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{area.label}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span className="font-bold text-slate-800">{area.courseCount} cursos</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {area.totalHours.toFixed(1)} h
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Formulario Crear/Editar + Catálogo por Área */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleSaveCourse}
          className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3 h-fit"
        >
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-600" />
            {editingId ? 'Editar Curso' : 'Nuevo Curso Obligatorio'}
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Área de Ingreso Asociada
            </label>
            <select
              value={targetArea}
              onChange={(e) => setTargetArea(e.target.value)}
              className="w-full px-2.5 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-slate-50"
            >
              {AREA_OPTIONS.map((opt) => (
                <option key={opt.value || 'GENERAL'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Título del Curso</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Seguridad en Planta Concentradora"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Descripción breve</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Modalidad</label>
              <select
                value={modality}
                onChange={(e) => setModality(e.target.value as 'VIRTUAL' | 'PRESENCIAL')}
                className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg"
              >
                <option value="VIRTUAL">E-learning</option>
                <option value="PRESENCIAL">Presencial</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Duración (h)</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nota mínima %</label>
              <input
                type="number"
                min="1"
                max="100"
                value={minPassScore}
                onChange={(e) => setMinPassScore(e.target.value)}
                className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Intentos máx.</label>
              <input
                type="number"
                min="1"
                max="10"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
                className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2 rounded-lg cursor-pointer"
            >
              {editingId ? 'Guardar Cambios' : 'Crear y Asociar al Área'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 cursor-pointer"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>

        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">
              Cursos Configurados ({filteredCourses.length})
            </h3>
            {selectedAreaFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedAreaFilter('ALL')}
                className="text-xs text-emerald-600 font-semibold hover:underline cursor-pointer"
              >
                Ver todas las áreas
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
                  className={`border rounded-xl p-4 transition-all ${
                    c.isActive ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-60'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                            !c.targetArea
                              ? 'bg-slate-800 text-white'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {!c.targetArea
                            ? 'Etapa 1 · Inducción General'
                            : `Etapa 2 · ${c.targetAreaLabel || c.targetArea}`}
                        </span>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            c.modality === 'VIRTUAL'
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {c.modality === 'VIRTUAL' ? 'E-learning' : 'Presencial'}
                        </span>
                        <span className="text-xs font-semibold text-emerald-700">
                          {c.durationHours} h
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 mt-1.5">{c.title}</h4>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-slate-500">
                        <span>Recursos: {c.resources.length}</span>
                        <span>Preguntas: {c.questions.length}</span>
                        <span>Asignados automáticamente: {c._count?.assignments ?? 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActiveCourse(activeCourse?.id === c.id ? null : c)}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1 cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        Contenido / Quiz
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(c.id);
                          setTitle(c.title);
                          setDescription(c.description || '');
                          setTargetArea(c.targetArea || '');
                          setModality(c.modality);
                          setDurationHours(String(c.durationHours));
                          setMinPassScore(String(c.minPassScore));
                          setMaxAttempts(String(c.maxAttempts));
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                        title="Editar"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(c)}
                        className={`px-2 py-1 text-[11px] font-semibold rounded-lg border cursor-pointer ${
                          c.isActive
                            ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                            : 'border-slate-300 text-slate-600 bg-white'
                        }`}
                      >
                        {c.isActive ? 'Activo' : 'Inactivo'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCourse(c.id)}
                        className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
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

      {/* Editor de Recursos Multimedia y Preguntas */}
      {activeCourse && (
        <div className="bg-white rounded-xl border-2 border-indigo-200 p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-indigo-900">
              Contenido y Evaluación: {activeCourse.title}
            </h3>
            <button
              type="button"
              onClick={() => setActiveCourse(null)}
              className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cerrar editor
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-600">
                1. Recursos (Videos, PDFs, Presentaciones)
              </h4>
              <form
                onSubmit={handleAddResource}
                className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2.5"
              >
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={resType}
                    onChange={(e) => setResType(e.target.value as any)}
                    className="px-2 py-1.5 text-xs border border-slate-300 rounded"
                  >
                    <option value="VIDEO">Video</option>
                    <option value="PDF">PDF</option>
                    <option value="PRESENTATION">Presentación</option>
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
                    placeholder="URL o enlace"
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
                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700 cursor-pointer"
                  >
                    + Agregar
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                {activeCourse.resources.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2.5 border border-slate-200 rounded text-xs"
                  >
                    <div className="flex items-center gap-2">
                      {r.type === 'VIDEO' && <Film className="w-4 h-4 text-sky-600" />}
                      {r.type === 'PDF' && <FileText className="w-4 h-4 text-rose-600" />}
                      {r.type === 'PRESENTATION' && <Presentation className="w-4 h-4 text-amber-600" />}
                      <div>
                        <div className="font-semibold text-slate-800">{r.title}</div>
                        <div className="text-[11px] text-slate-500">
                          {r.type} · {r.durationMinutes} min
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/courses/resources/${r.id}`, { method: 'DELETE' });
                        loadCourses();
                      }}
                      className="text-rose-600 hover:underline cursor-pointer"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-600">
                2. Evaluación (Opción Múltiple)
              </h4>
              <form
                onSubmit={handleAddQuestion}
                className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2"
              >
                <input
                  type="text"
                  required
                  placeholder="Pregunta"
                  value={qPrompt}
                  onChange={(e) => setQPrompt(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                />
                <input
                  type="text"
                  required
                  placeholder="Opción A"
                  value={qOpt0}
                  onChange={(e) => setQOpt0(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                />
                <input
                  type="text"
                  required
                  placeholder="Opción B"
                  value={qOpt1}
                  onChange={(e) => setQOpt1(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                />
                <input
                  type="text"
                  placeholder="Opción C (opcional)"
                  value={qOpt2}
                  onChange={(e) => setQOpt2(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                />
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
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700 cursor-pointer"
                  >
                    + Agregar
                  </button>
                </div>
              </form>

              <div className="space-y-2 max-h-52 overflow-y-auto">
                {activeCourse.questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-2.5 border border-slate-200 rounded text-xs flex justify-between gap-2"
                  >
                    <div>
                      <div className="font-semibold text-slate-800 flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
                        {idx + 1}. {q.prompt}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Correcta: Opción {String.fromCharCode(65 + q.correctIndex)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/courses/questions/${q.id}`, { method: 'DELETE' });
                        loadCourses();
                      }}
                      className="text-rose-600 hover:underline h-fit cursor-pointer"
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

      {/* Validación de Cursos Presenciales (SSOMA) */}
      <form
        onSubmit={handleRecordPresential}
        className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3"
      >
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-600" />
          Registro de Asistencia Presencial (SSOMA)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            required
            value={presWorkerId}
            onChange={(e) => setPresWorkerId(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
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
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
          >
            <option value="">Seleccionar curso presencial...</option>
            {presentialCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.targetAreaLabel || 'General'})
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            max="100"
            value={presScore}
            onChange={(e) => setPresScore(e.target.value)}
            placeholder="Nota (0-100)"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
          />
          <button
            type="submit"
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            Registrar Presencial
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={presAttended}
              onChange={(e) => setPresAttended(e.target.checked)}
            />
            Asistió a la jornada presencial
          </label>
          <input
            type="text"
            value={presNotes}
            onChange={(e) => setPresNotes(e.target.value)}
            placeholder="Observaciones de campo (opcional)"
            className="flex-1 min-w-[220px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
          />
        </div>
      </form>
    </div>
  );
};
