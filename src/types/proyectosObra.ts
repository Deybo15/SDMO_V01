export type SemaforoColor = 'Verde' | 'Rojo' | 'Amarillo' | 'Morado' | 'Azul';

export type FaseProyectoEnum = 
  | 'Inicio_y_Estudios_Preliminares'
  | 'Planeación_y_Diseños'
  | 'Ejecución_y_Construcción'
  | 'Recepción_y_Cierre';

export interface ProyectoObra {
  id: string | number;
  codigo_meta: string;
  nombre_proyecto: string;
  gerencia: string;
  dependencia: string;
  profesional_responsable: string; // Cédula/Identificación
  tipo_contrato: string;
  tipo_ejecucion: string;
  poa_origen?: string | null;
  origen_presupuesto?: string | null;
  linea_estrategica?: string | null;
  programa?: string | null;
  canton?: string | null;
  distrito?: string | null;
  georeferencia?: any; // PostGIS Point SRID 4326
  semaforo: SemaforoColor;
  estado: string;
  anio: number;
  cumplimiento_poa?: number | null;
  avance_poa?: number | null; // porcentaje o valor 0-1 o 0-100 según BD
  observaciones_meta_poa?: string | null;
  activo: boolean;
}

export interface PresupuestoProyecto {
  id: string | number;
  proyecto_id: string | number;
  version?: number | string | null;
  descripcion_modificacion?: string | null;
  presupuesto_asignado: number;
  presupuesto_adjudicado: number;
  presupuesto_ejecutado: number;
  presupuesto_comprometido: number;
  presupuesto_reserva: number;
  presupuesto_libre?: number; // Columna GENERADA por Supabase, NUNCA enviar en INSERT/UPDATE
  es_vigente: boolean;
  registrado_por?: string | null;
}

export interface ContratoObra {
  id: string | number;
  proyecto_id: string | number;
  numero_solicitud_contratacion?: string | null;
  numero_procedimiento_sicop?: string | null;
  analista_proveeduria?: string | null;
  empresa_adjudicada?: string | null;
  contratista?: string | null;
  numero_contrato_sicop?: string | null;
  numero_orden_compra?: string | null;
  comentario_proveeduria?: string | null;
  fecha_envio_proveeduria?: string | null;
  fecha_estimacion_adjudicacion?: string | null;
  fecha_adjudicacion?: string | null;
  estado_contratacion?: string | null;
  publicado?: boolean | null;
  registrado_por?: string | null;
}

export interface FaseProyecto {
  id: string | number;
  proyecto_id: string | number;
  fase: FaseProyectoEnum;
  fecha_inicio_plan?: string | null;
  fecha_fin_plan?: string | null;
  fecha_inicio_real?: string | null;
  fecha_fin_real?: string | null;
  porcentaje_avance: number; // 0 a 1
  entregables?: string | null;
  completada: boolean;
}

export interface SeguimientoProyecto {
  id: string | number;
  proyecto_id: string | number;
  fecha_corte: string;
  avance_registrado: number; // 0 a 1
  semaforo: SemaforoColor;
  observaciones?: string | null;
  etapa?: string | null;
  registrado_por?: string | null;
  creado_en?: string;
}

export interface HistorialFaseProyecto {
  id?: string | number;
  proyecto_id: string | number;
  fase_id: string | number;
  fase: string;
  campo_modificado: string;
  valor_anterior?: string | null;
  valor_nuevo?: string | null;
  modificado_por?: string | null;
  creado_en?: string;
}

// Interfaces compuestas para vistas UI
export interface ProyectoObraConDetalles extends ProyectoObra {
  nombre_responsable?: string;
  presupuesto_vigente?: PresupuestoProyecto | null;
  contrato?: ContratoObra | null;
  fases?: FaseProyecto[];
  seguimientos?: SeguimientoProyecto[];
  historial_fases?: HistorialFaseProyecto[];
}

export interface FiltrosProyectoObra {
  nombre?: string;
  dependencia?: string;
  anio?: string | number;
  semaforo?: SemaforoColor | '';
}
