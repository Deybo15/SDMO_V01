export type CatalogOption = {
  value: string;
  label: string;
  aliases?: string[];
};

const normalizeKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export const PRIORIDAD_OPTIONS = [
  { value: '1', label: 'Alta' },
  { value: '2', label: 'Media' },
  { value: '3', label: 'Baja' }
] as const;

export const GERENCIA_OPTIONS: CatalogOption[] = [
  { value: 'Provisión de Servicios', label: 'Provisión de Servicios', aliases: ['Provision de Servicios'] }
];

export const TIPO_PROYECTO_OPTIONS: CatalogOption[] = [
  { value: 'Mantenimiento', label: 'Mantenimiento' },
  { value: 'Obra nueva', label: 'Obra nueva' },
  { value: 'Espacio publico', label: 'Espacio público', aliases: ['Espacio público'] },
  { value: 'Instalacion municipal', label: 'Instalación municipal', aliases: ['Instalación municipal'] },
  { value: 'Emergencia', label: 'Emergencia' },
  { value: 'Mejora urbana', label: 'Mejora urbana' }
];

export const TIPO_CONTRATO_OPTIONS: CatalogOption[] = [
  { value: 'Obra Pública', label: 'Obra Pública', aliases: ['Obra Publica'] },
  { value: 'Servicio', label: 'Servicio' },
  { value: 'Insumos', label: 'Insumos' }
];

export const TIPO_EJECUCION_OPTIONS: CatalogOption[] = [
  { value: 'Contrato', label: 'Contrato' },
  { value: 'Administración', label: 'Administración', aliases: ['Administracion'] },
  { value: 'Mixto', label: 'Mixto' }
];

export const ORIGEN_PRESUPUESTO_OPTIONS: CatalogOption[] = [
  { value: 'Ordinario', label: 'Ordinario' },
  { value: 'Extraordinario', label: 'Extraordinario' },
  { value: 'Fondo de emergencias', label: 'Fondo de emergencias' }
];

export const LINEA_ESTRATEGICA_OPTIONS: CatalogOption[] = [
  {
    value: 'Planificación_urbana_y_movilidad_sostenible',
    label: 'Planificación urbana y movilidad sostenible',
    aliases: ['Planificacion_urbana_y_movilidad_sostenible']
  },
  {
    value: 'Resiliencia_y_sostenibilidad_ambiental',
    label: 'Resiliencia y sostenibilidad ambiental'
  },
  {
    value: 'Equilibrio_y_Derecho_a_la_Ciudad',
    label: 'Equilibrio y Derecho a la Ciudad'
  },
  {
    value: 'Gestión_Operativa_y_Administrativa_Ordinaria',
    label: 'Gestión Operativa y Administrativa Ordinaria',
    aliases: ['Gestion_Operativa_y_Administrativa_Ordinaria']
  },
  {
    value: 'Competitividad_e_Innovación',
    label: 'Competitividad e Innovación',
    aliases: ['Competitividad_e_Innovacion']
  }
];

export const CANTON_OPTIONS: CatalogOption[] = [
  { value: 'San José', label: 'San José', aliases: ['San Jose'] }
];

export const ESTADO_PROYECTO_OPTIONS: CatalogOption[] = [
  { value: 'Activo', label: 'Activo' },
  { value: 'Adjudicado', label: 'Adjudicado' },
  { value: 'Finalizado', label: 'Finalizado' },
  { value: 'Suspendido', label: 'Suspendido' }
];

export const ESTADO_CONTRATACION_OPTIONS: CatalogOption[] = [
  { value: 'Sin iniciar', label: 'Sin iniciar' },
  { value: 'En trámite', label: 'En trámite', aliases: ['En tramite'] },
  { value: 'Publicado', label: 'Publicado' },
  { value: 'Adjudicado', label: 'Adjudicado' },
  { value: 'Orden de compra emitida', label: 'Orden de compra emitida' },
  { value: 'Suspendido', label: 'Suspendido' },
  { value: 'Finalizado', label: 'Finalizado' }
];

export const FASE_PROYECTO_OPTIONS: CatalogOption[] = [
  {
    value: 'Inicio_y_Estudios_Preliminares',
    label: 'Inicio y estudios preliminares'
  },
  {
    value: 'Planeación_y_Diseños',
    label: 'Planeación y diseños',
    aliases: ['Planeacion_y_Disenos']
  },
  {
    value: 'Ejecución_y_Construcción',
    label: 'Ejecución y construcción',
    aliases: ['Ejecucion_y_Construccion']
  },
  {
    value: 'Recepción_y_Cierre',
    label: 'Recepción y cierre',
    aliases: ['Recepcion_y_Cierre']
  }
];

export function normalizeCatalogValue(
  value: string | null | undefined,
  options: CatalogOption[]
): string {
  if (!value) return '';
  const normalized = normalizeKey(value);
  const match = options.find((option) => {
    const candidates = [option.value, option.label, ...(option.aliases || [])];
    return candidates.some((candidate) => normalizeKey(candidate) === normalized);
  });

  return match?.value || value;
}

export function getCatalogLabel(
  value: string | null | undefined,
  options: CatalogOption[],
  fallback = '-'
): string {
  if (!value) return fallback;
  const normalized = normalizeCatalogValue(value, options);
  const match = options.find((option) => option.value === normalized);
  return match?.label || value.replace(/_/g, ' ');
}

export function hasCatalogOption(value: string | null | undefined, options: CatalogOption[]): boolean {
  if (!value) return true;
  const normalized = normalizeCatalogValue(value, options);
  return options.some((option) => option.value === normalized);
}

export function getFaseProyectoOrder(value: string | null | undefined): number {
  const normalized = normalizeCatalogValue(value, FASE_PROYECTO_OPTIONS);
  const index = FASE_PROYECTO_OPTIONS.findIndex((option) => option.value === normalized);
  return index === -1 ? 99 : index;
}
