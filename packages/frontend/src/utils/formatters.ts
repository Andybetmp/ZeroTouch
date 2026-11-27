export const AREA_LABEL_MAP: Record<string, string> = {
  SSOMA: 'SSOMA',
  DHO: 'DHO',
  AREA_MEDICA: 'Área Médica',
  AREA_USUARIA: 'Área Usuaria',
  SOCAVON: 'Interior Mina / Socavón',
  PLANTA_CONCENTRADORA: 'Planta Concentradora',
  SUPERFICIE: 'Superficie / Talleres',
  OFICINAS_ADMINISTRATIVAS: 'Oficinas Administrativas',
  GARITA: 'Garita',
  ADMIN_ECM: 'Admin ECM',
  SISTEMA: 'Sistema',
};

export const STAY_TYPE_LABEL_MAP: Record<string, string> = {
  PERMANENTE_CIA: 'Permanente CIA',
  VISITA_TECNICA: 'Visita Técnica',
  TEMPORAL: 'Temporal',
  PROYECTO_CORTO: 'Proyecto Corto',
  CONTRATISTA_PERMANENTE: 'Contratista Permanente',
};

export const JOB_PROFILE_LABEL_MAP: Record<string, string> = {
  PERSONAL_COCINA: 'Personal de Cocina',
  OPERARIO: 'Operario',
  CONDUCTOR: 'Conductor',
  INGENIERO_SUPERVISOR: 'Ingeniero / Supervisor',
  TECNICO_MANTENIMIENTO: 'Técnico de Mantenimiento',
  SUPERVISOR_SSOMA: 'Supervisor SSOMA',
  ELECTRICISTA: 'Electricista',
  MECANICO: 'Mecánico',
  SOLDADOR: 'Soldador',
  TODOS: 'Todos los perfiles',
};

export const PVC_STATUS_LABEL_MAP: Record<string, string> = {
  QUEUED_GARITA: 'En cola de impresión',
  PRINTED: 'Impreso',
  DELIVERED: 'Entregado',
};

export const PROVIDER_TYPE_LABEL_MAP: Record<string, string> = {
  CLINIC_EMO: 'Clínica EMO',
  SCTR_SALUD: 'SCTR Salud',
  SCTR_PENSION: 'SCTR Pensión',
  VIDA_LEY: 'Vida Ley',
};

function humanizeFallback(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function formatAreaName(area?: string | null): string {
  if (!area) return 'General';
  return AREA_LABEL_MAP[area] || humanizeFallback(area);
}

export function formatStayType(stayType?: string | null): string {
  if (!stayType) return 'Permanente CIA';
  return STAY_TYPE_LABEL_MAP[stayType] || humanizeFallback(stayType);
}

export function formatJobProfile(job?: string | null): string {
  if (!job || job === 'TODOS LOS PERFILES') return 'Todos los perfiles';
  return JOB_PROFILE_LABEL_MAP[job] || humanizeFallback(job);
}

export function formatPvcStatus(status?: string | null): string {
  if (!status) return 'Sin emitir';
  return PVC_STATUS_LABEL_MAP[status] || humanizeFallback(status);
}

export function formatProviderType(providerType?: string | null): string {
  if (!providerType) return 'Proveedor';
  return PROVIDER_TYPE_LABEL_MAP[providerType] || humanizeFallback(providerType);
}

export function pluralize(count: number, singular: string, plural?: string): string {
  const word = count === 1 ? singular : plural || `${singular}s`;
  return `${count} ${word}`;
}
