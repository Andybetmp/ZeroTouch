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
  X,
} from 'lucide-react';
import { LoadingButton, SkeletonCard, SmartProcessLoader } from './ui/LoadingStates';
import { pluralize } from '../utils/formatters';

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
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Slide-over Drawer para Crear / Editar Curso
  const [showCourseDrawer, setShowCourseDrawer] = useState(false);
  const [savingCourse, setSavingCourse] = useState(false);
  const [saveCourseSuccess, setSaveCourseSuccess] = useState(false);
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
  const [savingResource, setSavingResource] = useState(false);

  const [qPrompt, setQPrompt] = useState('');
  const [qOpt0, setQOpt0] = useState('');
  const [qOpt1, setQOpt1] = useState('');
  const [qOpt2, setQOpt2] = useState('');
  const [qCorrect, setQCorrect] = useState(0);
  const [savingQuestion, setSavingQuestion] = useState(false);

  // Registro presencial SSOMA
  const [presWorkerId, setPresWorkerId] = useState('');
  const [presCourseId, setPresCourseId] = useState('');
  const [presAttended, setPresAttended] = useState(true);
  const [presScore, setPresScore] = useState('90');
  const [presNotes, setPresNotes] = useState('');
  const [savingPresential, setSavingPresential] = useState(false);
  const [presentialSuccess, setPresentialSuccess] = useState(false);

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

  const openNewCourseDrawer = () => {
    resetForm();
    if (selectedAreaFilter !== 'ALL' && selectedAreaFilter !== 'GENERAL') {
      setTargetArea(selectedAreaFilter);
    }
    setShowCourseDrawer(true);
  };

  const openEditCourseDrawer = (c: TrainingCourse) => {
    setEditingId(c.id);
    setTitle(c.title);
    setDescription(c.description || '');
    setTargetArea(c.targetArea || '');
    setModality(c.modality);
    setDurationHours(String(c.durationHours));
    setMinPassScore(String(c.minPassScore));
    setMaxAttempts(String(c.maxAttempts));
    setShowCourseDrawer(true);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSavingCourse(true);
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
      setSaveCourseSuccess(true);
      await loadCourses();
      window.setTimeout(() => {
        setSaveCourseSuccess(false);
        setShowCourseDrawer(false);
        resetForm();
      }, 650);
    } catch (err: any) {
      onNotify(`Error: ${err.message}`);
    } finally {
      setSavingCourse(false);
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
      setSyncSuccess(true);
      window.setTimeout(() => setSyncSuccess(false), 1800);
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
    setSavingResource(true);
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
    } finally {
      setSavingResource(false);
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
    setSavingQuestion(true);
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
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleRecordPresential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presWorkerId || !presCourseId) return;
    setSavingPresential(true);
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
      setPresentialSuccess(true);
      window.setTimeout(() => setPresentialSuccess(false), 1800);
    } catch (err: any) {
      onNotify(`Error: ${err.message}`);
    } finally {
      setSavingPresential(false);
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
      {/* Cabecera + 5 Tarjetas de Área como Filtros Clicables */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-700" />
              Malla de Capacitación Automática por Área
            </h2>
            <p className="text-xs text-slate-500">
              Selecciona una tarjeta de área para filtrar el catálogo. Los trabajadores reciben automáticamente su
              Inducción General y los cursos de su área asignada.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <LoadingButton
              type="button"
              variant="secondary"
              isLoading={syncing}
              loadingText="Sincronizando..."
              isSuccess={syncSuccess}
              successText="Sincronizado"
              onClick={handleSyncAllAreas}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Sincronizar por área
            </LoadingButton>
            <LoadingButton
              type="button"
              variant="primary"
              onClick={openNewCourseDrawer}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Nuevo Curso
            </LoadingButton>
          </div>
        </div>

        <SmartProcessLoader active={syncing} mode="sync" />

        {loading && areaSummary.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <SkeletonCard key={n} variant="kpi" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {areaSummary.map((area) => {
              const isSelected = selectedAreaFilter === area.areaKey;
              return (
                <button
                  key={area.areaKey}
                  type="button"
                  onClick={() =>
                    setSelectedAreaFilter(isSelected ? 'ALL' : area.areaKey)
                  }
                  className={`text-left p-4 rounded-xl border transition-all duration-200 ease-out cursor-pointer ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-500/30 shadow-2xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${
                        isSelected
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                        Activo
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-slate-900 line-clamp-2 leading-snug min-h-[2.1rem]">
                    {area.label}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700">{pluralize(area.courseCount, 'curso')}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {area.totalHours.toFixed(1)} h
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Catálogo de Cursos a Ancho Completo */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-bold text-slate-900">
              Cursos Configurados
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {filteredCourses.length}
            </span>
          </div>
          {selectedAreaFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setSelectedAreaFilter('ALL')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
            >
              Mostrar todas las áreas
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <SkeletonCard key={n} variant="course" />
            ))}
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="py-12 text-center space-y-2 border border-dashed border-slate-200 rounded-xl">
            <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No hay cursos registrados en esta área</p>
            <p className="text-xs text-slate-500">
              Crea un nuevo curso obligatorio desde el botón superior &ldquo;Nuevo Curso&rdquo;.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredCourses.map((c) => {
              const isEditingContent = activeCourse?.id === c.id;
              return (
                <div
                  key={c.id}
                  className={`rounded-xl border p-5 transition-all duration-200 ease-out flex flex-col justify-between gap-4 ${
                    isEditingContent
                      ? 'border-emerald-500 bg-emerald-50/20 ring-1 ring-emerald-500/20'
                      : c.isActive
                      ? 'border-slate-200 bg-white hover:border-slate-300'
                      : 'border-slate-200 bg-slate-50/70 opacity-70'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                            !c.targetArea
                              ? 'bg-slate-100 text-slate-700 border-slate-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {!c.targetArea
                            ? 'Etapa 1 · Inducción General'
                            : `Etapa 2 · ${c.targetAreaLabel || c.targetArea}`}
                        </span>
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                            c.modality === 'VIRTUAL'
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {c.modality === 'VIRTUAL' ? 'E-learning' : 'Presencial'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(c)}
                        className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full border transition cursor-pointer ${
                          c.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {c.isActive ? 'Activo' : 'Inactivo'}
                      </button>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{c.title}</h4>
                      {c.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{c.description}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {c.durationHours} h
                      </span>
                      <span>·</span>
                      <span>{pluralize(c.resources.length, 'recurso')}</span>
                      <span>·</span>
                      <span>{pluralize(c.questions.length, 'pregunta')}</span>
                      <span>·</span>
                      <span>{pluralize(c._count?.assignments ?? 0, 'asignado')}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setActiveCourse(isEditingContent ? null : c)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition flex items-center gap-1.5 cursor-pointer ${
                        isEditingContent
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      {isEditingContent ? 'Ocultar Contenido' : 'Contenido y Quiz'}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditCourseDrawer(c)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium inline-flex items-center gap-1 transition cursor-pointer"
                        title="Editar curso"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCourse(c.id)}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                        title="Eliminar curso"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Editor de Recursos Multimedia y Preguntas */}
      {activeCourse && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5 bateas-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                Editor de Contenido y Evaluación
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-0.5">{activeCourse.title}</h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveCourse(null)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 inline-flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Cerrar editor
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recursos */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                1. Recursos (Videos, PDFs, Presentaciones)
              </h4>
              <form
                onSubmit={handleAddResource}
                className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3"
              >
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tipo</label>
                    <select
                      value={resType}
                      onChange={(e) => setResType(e.target.value as any)}
                      className="w-full px-2.5 py-2 text-xs border border-slate-200 bg-white rounded-lg"
                    >
                      <option value="VIDEO">Video</option>
                      <option value="PDF">PDF</option>
                      <option value="PRESENTATION">Presentación</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Título del recurso
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Video de Inducción General"
                      value={resTitle}
                      onChange={(e) => setResTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      URL o enlace (opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={resUrl}
                      onChange={(e) => setResUrl(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Minutos</label>
                    <input
                      type="number"
                      min="1"
                      value={resMinutes}
                      onChange={(e) => setResMinutes(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs border border-slate-200 bg-white rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <input
                    type="file"
                    accept=".mp4,.webm,.pdf,.ppt,.pptx"
                    onChange={(e) => setResFile(e.target.files?.[0] || null)}
                    className="text-xs text-slate-600 max-w-[240px]"
                  />
                  <LoadingButton
                    type="submit"
                    variant="primary"
                    isLoading={savingResource}
                    loadingText="Agregando..."
                    icon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Agregar recurso
                  </LoadingButton>
                </div>
              </form>

              <div className="space-y-2">
                {activeCourse.resources.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-white text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      {r.type === 'VIDEO' && <Film className="w-4 h-4 text-sky-600 shrink-0" />}
                      {r.type === 'PDF' && <FileText className="w-4 h-4 text-rose-600 shrink-0" />}
                      {r.type === 'PRESENTATION' && <Presentation className="w-4 h-4 text-amber-600 shrink-0" />}
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
                      className="text-xs font-medium text-rose-600 hover:underline cursor-pointer"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Preguntas */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                2. Evaluación (Opción Múltiple)
              </h4>
              <form
                onSubmit={handleAddQuestion}
                className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5"
              >
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Pregunta</label>
                  <input
                    type="text"
                    required
                    placeholder="Enunciado de la pregunta"
                    value={qPrompt}
                    onChange={(e) => setQPrompt(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Opción A"
                    value={qOpt0}
                    onChange={(e) => setQOpt0(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-lg"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Opción B"
                    value={qOpt1}
                    onChange={(e) => setQOpt1(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Opción C (opcional)"
                    value={qOpt2}
                    onChange={(e) => setQOpt2(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-lg"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <select
                    value={qCorrect}
                    onChange={(e) => setQCorrect(Number(e.target.value))}
                    className="px-2.5 py-2 text-xs border border-slate-200 bg-white rounded-lg"
                  >
                    <option value={0}>Correcta: Opción A</option>
                    <option value={1}>Correcta: Opción B</option>
                    <option value={2}>Correcta: Opción C</option>
                  </select>
                  <LoadingButton
                    type="submit"
                    variant="primary"
                    isLoading={savingQuestion}
                    loadingText="Agregando..."
                    icon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Agregar pregunta
                  </LoadingButton>
                </div>
              </form>

              <div className="space-y-2 max-h-56 overflow-y-auto">
                {activeCourse.questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-3 border border-slate-200 rounded-xl bg-white text-xs flex justify-between gap-2"
                  >
                    <div>
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>
                          {idx + 1}. {q.prompt}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Respuesta correcta: Opción {String.fromCharCode(65 + q.correctIndex)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/courses/questions/${q.id}`, { method: 'DELETE' });
                        loadCourses();
                      }}
                      className="text-xs font-medium text-rose-600 hover:underline h-fit cursor-pointer"
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
        className="bg-white rounded-xl border border-slate-200 p-6 space-y-4"
      >
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-700" />
            Registro de Asistencia Presencial (SSOMA)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Valida la participación en jornadas prácticas de campo para cursos en modalidad presencial.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Trabajador</label>
            <select
              required
              value={presWorkerId}
              onChange={(e) => setPresWorkerId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="">Seleccionar trabajador...</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.fullName} ({w.dni})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Curso Presencial</label>
            <select
              required
              value={presCourseId}
              onChange={(e) => setPresCourseId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="">Seleccionar curso...</option>
              {presentialCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.targetAreaLabel || 'General'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nota (0 - 100)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={presScore}
              onChange={(e) => setPresScore(e.target.value)}
              placeholder="90"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            />
          </div>

          <LoadingButton
            type="submit"
            variant="primary"
            isLoading={savingPresential}
            loadingText="Registrando..."
            isSuccess={presentialSuccess}
            successText="Registrado"
            icon={<CheckCircle2 className="w-4 h-4" />}
            className="w-full py-2.5"
          >
            Registrar Presencial
          </LoadingButton>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-1">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={presAttended}
              onChange={(e) => setPresAttended(e.target.checked)}
              className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
            />
            Asistió a la jornada presencial
          </label>
          <input
            type="text"
            value={presNotes}
            onChange={(e) => setPresNotes(e.target.value)}
            placeholder="Observaciones de campo (opcional)"
            className="flex-1 min-w-[240px] px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
          />
        </div>
      </form>

      {/* Slide-over Drawer: Nuevo Curso / Editar Curso */}
      {showCourseDrawer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? 'Editar Curso Obligatorio' : 'Nuevo Curso Obligatorio'}
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/35 backdrop-blur-[1px]"
          onClick={() => setShowCourseDrawer(false)}
        >
          <div
            className="w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col bateas-slide-in-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingId ? 'Editar Curso Obligatorio' : 'Nuevo Curso Obligatorio'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  El curso se asignará automáticamente a los trabajadores del área seleccionada.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCourseDrawer(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                aria-label="Cerrar panel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Área de Ingreso Asociada
                </label>
                <select
                  value={targetArea}
                  onChange={(e) => setTargetArea(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs font-medium border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                >
                  {AREA_OPTIONS.map((opt) => (
                    <option key={opt.value || 'GENERAL'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Título del Curso *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej. Seguridad en Planta Concentradora"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Descripción breve
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Resumen de objetivos o alcance normativo (D.S. 024-2016-EM)"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Modalidad</label>
                  <select
                    value={modality}
                    onChange={(e) => setModality(e.target.value as 'VIRTUAL' | 'PRESENCIAL')}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="VIRTUAL">E-learning</option>
                    <option value="PRESENCIAL">Presencial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Duración (horas)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nota mínima (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={minPassScore}
                    onChange={(e) => setMinPassScore(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Intentos máximos</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center gap-2.5">
                <LoadingButton
                  type="submit"
                  variant="primary"
                  isLoading={savingCourse}
                  loadingText="Guardando..."
                  isSuccess={saveCourseSuccess}
                  successText="Guardado"
                  className="flex-1 py-2.5"
                >
                  {editingId ? 'Guardar Cambios' : 'Crear y Asociar al Área'}
                </LoadingButton>
                <LoadingButton
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCourseDrawer(false)}
                  className="py-2.5"
                >
                  Cancelar
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
