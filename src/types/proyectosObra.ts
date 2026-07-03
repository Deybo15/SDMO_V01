export type FaseProyectoEnum =
  | 'Inicio_y_Estudios_Preliminares'
  | 'Planeacion_y_Disenos'
  | 'Ejecucion_y_Construccion'
  | 'Recepcion_y_Cierre'
  | 'Planeación_y_Diseños'
  | 'Ejecución_y_Construcción'
  | 'Recepción_y_Cierre';

export interface ProyectoObra {
  id: string | number;
  codigo_meta?: string | null;
  nombre_proyecto: string;
  descripcion_general?: string | null;
  tipo_proyecto?: string | null;
  prioridad?: number | null;
  justificacion?: string | null;
  gerencia?: string | null;
  dependencia?: string | null;
  profesional_responsable?: string | null;
  tipo_contrato?: string | null;
  tipo_ejecucion?: string | null;
  poa_origen?: string | null;
  origen_presupuesto?: string | null;
  linea_estrategica?: string | null;
  programa?: string | null;
  pais?: string | null;
  canton?: string | null;
  distrito?: string | null;
  direccion_exacta?: string | null;
  barrio_comunidad?: string | null;
  georeferencia?: any; // PostGIS Point SRID 4326
  estado?: string | null;
  fecha_solicitud?: string | null;
  requiere_contratacion?: boolean | null;
  anio?: number | null;
  cumplimiento_poa?: boolean | null;
  avance_poa?: number | null; // escala normalizada 0-1
  observaciones_meta_poa?: string | null;
  activo?: boolean | null;
  creado_por?: string | null;
  creado_en?: string | null;
  actualizado_en?: string | null;
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
  codigo_presupuestario?: string | null;
  es_vigente: boolean;
  registrado_por?: string | null;
  creado_en?: string | null;
  actualizado_en?: string | null;
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
  creado_en?: string | null;
  actualizado_en?: string | null;
}

export interface FaseProyecto {
  id: string | number;
  proyecto_id: string | number;
  fase: FaseProyectoEnum;
  fecha_inicio_plan?: string | null;
  fecha_fin_plan?: string | null;
  fecha_inicio_real?: string | null;
  fecha_fin_real?: string | null;
  porcentaje_avance: number; // escala normalizada 0-1
  entregables?: string | null;
  completada: boolean;
  creado_en?: string | null;
  actualizado_en?: string | null;
}

export interface SeguimientoProyecto {
  id: string | number;
  proyecto_id: string | number;
  fecha_corte: string;
  avance_registrado: number; // escala normalizada 0-1
  observaciones?: string | null;
  etapa?: string | null;
  registrado_por?: string | null;
  creado_en?: string | null;
}

export interface HistorialFaseProyecto {
  id?: string | number;
  proyecto_id: string | number;
  fase_id?: string | number;
  fase: string;
  campo_modificado: string;
  valor_anterior?: string | null;
  valor_nuevo?: string | null;
  modificado_por?: string | null;
  creado_en?: string | null;
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
}
