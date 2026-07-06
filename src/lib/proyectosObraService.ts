import { supabase } from './supabase';
import {
  ProyectoObra,
  PresupuestoProyecto,
  ContratoObra,
  ContratoGarantia,
  ProyectoDocumento,
  ProyectoDonacion,
  ProyectoHito,
  ProyectoPermiso,
  FaseProyecto,
  SeguimientoProyecto,
  ProyectoObraConDetalles,
  FiltrosProyectoObra
} from '../types/proyectosObra';

const PROYECTOS_DOCUMENTOS_BUCKET = 'proyectos-documentos';

const AUDITED_PROJECT_FIELDS: Array<keyof ProyectoObra> = [
  'nombre_proyecto',
  'codigo_meta',
  'descripcion_general',
  'tipo_proyecto',
  'prioridad',
  'justificacion',
  'dependencia',
  'profesional_responsable',
  'tipo_contrato',
  'tipo_ejecucion',
  'poa_origen',
  'origen_presupuesto',
  'linea_estrategica',
  'programa',
  'canton',
  'distrito',
  'direccion_exacta',
  'barrio_comunidad',
  'estado',
  'fecha_solicitud',
  'requiere_contratacion',
  'anio',
  'observaciones_meta_poa',
  'activo'
];

const toAuditValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return 'Sin definir';
  if (typeof value === 'boolean') return value ? 'Si' : 'No';
  return String(value);
};

const sanitizeStorageName = (name: string): string => {
  const parts = name.split('.');
  const ext = parts.length > 1 ? parts.pop() : '';
  const base = parts.join('.') || name;
  const cleanBase = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'documento';
  const cleanExt = ext?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return cleanExt ? `${cleanBase}.${cleanExt}` : cleanBase;
};

// Utilidades de formateo
export const formatMonedaCRC = (monto: number | null | undefined): string => {
  if (monto === null || monto === undefined || isNaN(monto)) return '₡0';
  const dects = Math.round(monto);
  return '₡' + dects.toLocaleString('es-CR');
};

export const formatFechaCR = (fechaStr: string | null | undefined): string => {
  if (!fechaStr) return '-';
  try {
    const parts = fechaStr.split('T')[0].split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
    return fechaStr;
  } catch {
    return fechaStr;
  }
};

export const normalizeProgressFraction = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined || value === '') return 0;
  const numeric = typeof value === 'string'
    ? Number(value.replace('%', '').trim())
    : Number(value);

  if (!Number.isFinite(numeric)) return 0;
  const fraction = numeric > 1 ? numeric / 100 : numeric;
  return Math.min(Math.max(fraction, 0), 1);
};

export const formatProgressPercent = (value: number | string | null | undefined): number => {
  return Math.round(normalizeProgressFraction(value) * 100);
};

/**
 * Obtener lista paginada de proyectos con filtros
 */
export async function getProyectosObra(
  filtros: FiltrosProyectoObra = {},
  pagina: number = 1,
  porPagina: number = 15
) {
  try {
    let query = supabase
      .from('proyecto_obra')
      .select('*, presupuesto_proyecto!left(*)', { count: 'exact' });

    if (filtros.nombre && filtros.nombre.trim() !== '') {
      query = query.ilike('nombre_proyecto', `%${filtros.nombre.trim()}%`);
    }

    if (filtros.dependencia && filtros.dependencia.trim() !== '') {
      query = query.eq('dependencia', filtros.dependencia.trim());
    }

    if (filtros.anio && filtros.anio !== '') {
      query = query.eq('anio', Number(filtros.anio));
    }


    const desde = (pagina - 1) * porPagina;
    const hasta = desde + porPagina - 1;

    query = query.order('id', { ascending: false }).range(desde, hasta);

    const { data, count, error } = await query;

    if (error) throw error;

    if (!data || data.length === 0) {
      return { proyectos: [], totalCount: count || 0 };
    }

    // Obtener identificaciones/alias únicos de colaboradores para traer sus nombres o alias
    const valoresResp = Array.from(new Set(data.map(p => p.profesional_responsable).filter(Boolean)));
    
    const colabMap: Record<string, string> = {};
    if (valoresResp.length > 0) {
      const { data: colabs } = await supabase
        .from('colaboradores_06')
        .select('identificacion, colaborador, alias');

      if (colabs) {
        colabs.forEach((c: any) => {
          if (c.identificacion) colabMap[c.identificacion] = c.alias || c.colaborador;
          if (c.alias) colabMap[c.alias] = c.alias;
        });
      }
    }

    const proyectosFormateados: ProyectoObraConDetalles[] = data.map((item: any) => {
      const presupuestos = item.presupuesto_proyecto || [];
      const presupuestoVigente = Array.isArray(presupuestos) 
        ? presupuestos.find((p: any) => p.es_vigente) || presupuestos[0] || null
        : presupuestos;

      return {
        ...item,
        nombre_responsable: colabMap[item.profesional_responsable] || item.profesional_responsable || 'No asignado',
        presupuesto_vigente: presupuestoVigente
      };
    });

    return { proyectos: proyectosFormateados, totalCount: count || 0 };
  } catch (err) {
    console.error('Error cargando proyectos de obra:', err);
    throw err;
  }
}

/**
 * Obtener lista de dependencias únicas para selectores de filtro
 */
export async function getDependenciasProyectos() {
  try {
    const { data, error } = await supabase
      .from('proyecto_obra')
      .select('dependencia')
      .not('dependencia', 'is', null);
      
    if (error) throw error;
    const dependenciasUnicas = Array.from(new Set(data.map(d => d.dependencia))).sort();
    return dependenciasUnicas;
  } catch (err) {
    console.error('Error obteniendo dependencias:', err);
    return [];
  }
}

/**
 * Obtener lista de años únicos para el filtro
 */
export async function getAniosProyectos() {
  try {
    const { data, error } = await supabase
      .from('proyecto_obra')
      .select('anio')
      .not('anio', 'is', null);
      
    if (error) throw error;
    const aniosUnicos = Array.from(new Set(data.map(d => d.anio))).sort((a, b) => b - a);
    return aniosUnicos;
  } catch (err) {
    console.error('Error obteniendo años:', err);
    return [];
  }
}

/**
 * Obtener detalle completo de un proyecto por ID
 */
export async function getProyectoObraPorId(id: string | number): Promise<ProyectoObraConDetalles | null> {
  try {
    const { data: proyecto, error: errProyecto } = await supabase
      .from('proyecto_obra')
      .select('*')
      .eq('id', id)
      .single();

    if (errProyecto || !proyecto) throw errProyecto || new Error('Proyecto no encontrado');

    // Consultas paralelas de tablas secundarias
    const [resPresupuestos, resContrato, resFases, resSeguimientos, resHistorialFases, resHistorialEstados, resHistorialProyecto, resDocumentos, resPermisos, resHitos, resDonaciones, resGarantias, resColab] = await Promise.all([
      supabase.from('presupuesto_proyecto').select('*').eq('proyecto_id', id),
      supabase.from('contrato_obra').select('*').eq('proyecto_id', id).limit(1),
      supabase.from('fase_proyecto').select('*').eq('proyecto_id', id).order('id', { ascending: true }),
      supabase.from('seguimiento_proyecto').select('*').eq('proyecto_id', id).order('fecha_corte', { ascending: false }),
      supabase.from('historial_fase_proyecto').select('*').eq('proyecto_id', id).order('creado_en', { ascending: false }),
      supabase.from('historial_estado_proyecto').select('*').eq('proyecto_id', id).order('creado_en', { ascending: false }),
      supabase.from('historial_proyecto').select('*').eq('proyecto_id', id).order('creado_en', { ascending: false }).limit(50),
      supabase.from('proyecto_documento').select('*').eq('proyecto_id', id).order('creado_en', { ascending: false }),
      supabase.from('proyecto_permiso').select('*').eq('proyecto_id', id).order('creado_en', { ascending: false }),
      supabase.from('proyecto_hito').select('*').eq('proyecto_id', id).order('fecha_plan', { ascending: true, nullsFirst: false }).order('creado_en', { ascending: true }),
      supabase.from('proyecto_donacion').select('*').eq('proyecto_id', id).order('creado_en', { ascending: false }),
      supabase.from('contrato_garantia').select('*').eq('proyecto_id', id).order('fecha_vencimiento', { ascending: true, nullsFirst: false }).order('creado_en', { ascending: true }),
      proyecto.profesional_responsable 
        ? supabase.from('colaboradores_06').select('colaborador, alias').or(`identificacion.eq.${proyecto.profesional_responsable},alias.eq.${proyecto.profesional_responsable}`).maybeSingle()
        : Promise.resolve({ data: null, error: null })
    ]);

    const presupuestos: PresupuestoProyecto[] = resPresupuestos.data || [];
    const presupuestoVigente = presupuestos.find(p => p.es_vigente) || presupuestos[0] || null;

    return {
      ...proyecto,
      nombre_responsable: resColab.data?.alias || resColab.data?.colaborador || proyecto.profesional_responsable || 'No asignado',
      presupuesto_vigente: presupuestoVigente,
      contrato: Array.isArray(resContrato.data) ? resContrato.data[0] || null : resContrato.data || null,
      documentos: resDocumentos.data || [],
      permisos: resPermisos.data || [],
      hitos: resHitos.data || [],
      donaciones: resDonaciones.data || [],
      garantias: resGarantias.data || [],
      fases: resFases.data || [],
      seguimientos: resSeguimientos.data || [],
      historial_fases: resHistorialFases.data || [],
      historial_estados: resHistorialEstados.data || [],
      historial_proyecto: resHistorialProyecto.data || []
    };
  } catch (err) {
    console.error('Error cargando detalle del proyecto:', err);
    return null;
  }
}

/**
 * Actualizar una fase del proyecto y registrar la auditaría en historial_fase_proyecto
 */
export async function actualizarFaseProyecto(
  proyecto_id: string | number,
  fase_id: string | number,
  fase: string,
  campo_modificado: string,
  valor_anterior: any,
  valor_nuevo: any,
  modificado_por: string
) {
  try {
    // 1. Actualizar el campo en la tabla fase_proyecto
    const valorParaActualizar = campo_modificado === 'porcentaje_avance'
      ? normalizeProgressFraction(valor_nuevo)
      : valor_nuevo;

    const updatePayload: Record<string, any> = {
      [campo_modificado]: valorParaActualizar
    };

    // Si se modifica el porcentaje de avance, actualizar completada si es 1 (100%)
    if (campo_modificado === 'porcentaje_avance') {
      const p = normalizeProgressFraction(valor_nuevo);
      updatePayload.completada = p >= 1;
    }

    const { error: errFase } = await supabase
      .from('fase_proyecto')
      .update(updatePayload)
      .eq('id', fase_id);

    if (errFase) throw errFase;

    // 2. Insertar registro de auditoría en historial_fase_proyecto
    const { error: errHistorial } = await supabase
      .from('historial_fase_proyecto')
      .insert([{
        proyecto_id,
        fase,
        campo_modificado,
        valor_anterior: valor_anterior !== null && valor_anterior !== undefined ? String(valor_anterior) : '',
        valor_nuevo: valor_nuevo !== null && valor_nuevo !== undefined ? String(valor_nuevo) : '',
        modificado_por
      }]);

    if (errHistorial) {
      console.error('Error insertando en historial_fase_proyecto:', errHistorial);
    }

    return true;
  } catch (err) {
    console.error('Error al actualizar fase de proyecto:', err);
    throw err;
  }
}

/**
 * Insertar nueva entrada de seguimiento (APPEND-ONLY)
 */
export async function registrarSeguimiento(seguimiento: Omit<SeguimientoProyecto, 'id' | 'creado_en'>) {
  try {
    const { data, error } = await supabase.rpc('registrar_seguimiento_proyecto', {
      p_seguimiento: seguimiento
    });

    if (error) throw error;

    return data;
  } catch (err) {
    console.error('Error registrando seguimiento:', err);
    throw err;
  }
}

/**
 * Obtener métricas y datos completos para el Dashboard ejecutivo
 */
export async function getDashboardStats() {
  try {
    const [resProyectos, resPresupuestos, resFases, resSeguimientos, resColabs] = await Promise.all([
      supabase.from('proyecto_obra').select('*'),
      supabase.from('presupuesto_proyecto').select('*').eq('es_vigente', true),
      supabase.from('fase_proyecto').select('*'),
      supabase.from('seguimiento_proyecto').select('*').order('fecha_corte', { ascending: false }),
      supabase.from('colaboradores_06').select('identificacion, colaborador, alias')
    ]);

    const proyectos = resProyectos.data || [];
    const presupuestos = resPresupuestos.data || [];
    const fases = resFases.data || [];
    const seguimientos = resSeguimientos.data || [];
    const colaboradores = resColabs.data || [];

    // Mapa de colaboradores (identificacion o alias -> alias/nombre)
    const colabMap = new Map<string, string>();
    colaboradores.forEach((c: any) => {
      if (c.identificacion) colabMap.set(String(c.identificacion).trim(), c.alias || c.colaborador);
      if (c.alias) colabMap.set(String(c.alias).trim(), c.alias);
    });

    // Mapa del último seguimiento por proyecto
    const ultimosSeguimientosMap = new Map<string | number, any>();
    seguimientos.forEach((s: any) => {
      if (!ultimosSeguimientosMap.has(s.proyecto_id)) {
        ultimosSeguimientosMap.set(s.proyecto_id, s);
      }
    });

    // Mapa del presupuesto vigente por proyecto
    const presupuestosMap = new Map<string | number, any>();
    presupuestos.forEach((p: any) => {
      presupuestosMap.set(p.proyecto_id, p);
    });

    // Mapa de fases por proyecto
    const fasesMap = new Map<string | number, any[]>();
    fases.forEach((f: any) => {
      if (!fasesMap.has(f.proyecto_id)) fasesMap.set(f.proyecto_id, []);
      fasesMap.get(f.proyecto_id)!.push(f);
    });

    return {
      proyectos,
      presupuestos,
      fases,
      seguimientos,
      colaboradores,
      colabMap,
      ultimosSeguimientosMap,
      presupuestosMap,
      fasesMap
    };
  } catch (err) {
    console.error('Error obteniendo métricas del dashboard:', err);
    throw err;
  }
}

/**
 * Obtener lista de colaboradores para el selector de responsable
 */
export async function getColaboradores() {
  try {
    const { data, error } = await supabase
      .from('colaboradores_06')
      .select('identificacion, colaborador, alias')
      .eq('profesional_responsable', true)
      .not('alias', 'is', null)
      .order('alias', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error obteniendo colaboradores:', err);
    return [];
  }
}

/**
 * Crear un nuevo proyecto de obra con presupuesto inicial opcional
 */
type CrearProyectoObraPayload = Partial<ProyectoObra> & {
  codigo_presupuestario?: string | null;
};

export async function crearProyectoObra(proyectoData: CrearProyectoObraPayload, presupuestoAsignado: number = 0) {
  try {
    const { data: proyecto, error } = await supabase.rpc('crear_proyecto_obra_con_presupuesto', {
      p_proyecto: {
        ...proyectoData,
        activo: proyectoData.activo ?? true
      },
      p_presupuesto_asignado: Number(presupuestoAsignado) || 0
    });

    if (error || !proyecto) throw error || new Error('Error creando proyecto');

    return proyecto;
  } catch (err) {
    console.error('Error al crear proyecto de obra:', err);
    throw err;
  }
}

/**
 * Actualizar datos generales de un proyecto existente
 */
export async function actualizarProyectoObra(id: string | number, proyectoData: Partial<ProyectoObra>) {
  try {
    const { data: proyectoActual, error: errActual } = await supabase
      .from('proyecto_obra')
      .select(AUDITED_PROJECT_FIELDS.join(','))
      .eq('id', id)
      .single();

    if (errActual) throw errActual;

    const { data, error } = await supabase
      .from('proyecto_obra')
      .update(proyectoData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error actualizando proyecto de obra:', err);
    throw err;
  }
}

export async function actualizarCodigoPresupuestario(
  proyectoId: string | number,
  codigoPresupuestario: string | null | undefined
) {
  try {
    const codigo = codigoPresupuestario?.trim() || null;
    const { data: presupuestos, error: errConsulta } = await supabase
      .from('presupuesto_proyecto')
      .select('id')
      .eq('proyecto_id', proyectoId)
      .order('es_vigente', { ascending: false })
      .order('version', { ascending: false })
      .limit(1);

    if (errConsulta) throw errConsulta;

    const presupuestoId = presupuestos?.[0]?.id;
    if (presupuestoId) {
      const { data, error } = await supabase
        .from('presupuesto_proyecto')
        .update({ codigo_presupuestario: codigo })
        .eq('id', presupuestoId)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    if (!codigo) return null;

    const { data, error } = await supabase
      .from('presupuesto_proyecto')
      .insert([{
        proyecto_id: proyectoId,
        version: 1,
        descripcion_modificacion: 'Registro inicial de codigo presupuestario',
        presupuesto_asignado: 0,
        presupuesto_adjudicado: 0,
        presupuesto_ejecutado: 0,
        presupuesto_comprometido: 0,
        presupuesto_reserva: 0,
        codigo_presupuestario: codigo,
        es_vigente: true
      }])
      .select()
      .single();

    if (error) throw error;

    const { data: { user } } = await supabase.auth.getUser();
    const modificadoPor = user?.email || 'Usuario SDMO';
    const cambios = AUDITED_PROJECT_FIELDS
      .filter((field) => Object.prototype.hasOwnProperty.call(proyectoData, field))
      .map((field) => {
        const anterior = (proyectoActual as any)?.[field];
        const nuevo = (data as any)?.[field];
        return {
          field,
          anterior,
          nuevo
        };
      })
      .filter(({ anterior, nuevo }) => toAuditValue(anterior) !== toAuditValue(nuevo));

    if (cambios.length > 0) {
      const { error: errHistorial } = await supabase
        .from('historial_proyecto')
        .insert(cambios.map(({ field, anterior, nuevo }) => ({
          proyecto_id: id,
          entidad: 'proyecto_obra',
          campo_modificado: field,
          valor_anterior: toAuditValue(anterior),
          valor_nuevo: toAuditValue(nuevo),
          modificado_por: modificadoPor
        })));

      if (errHistorial) {
        console.error('Error registrando historial de proyecto:', errHistorial);
      }

      const cambioEstado = cambios.find(({ field }) => field === 'estado');
      if (cambioEstado) {
        const { error: errEstado } = await supabase
          .from('historial_estado_proyecto')
          .insert([{
            proyecto_id: id,
            estado_anterior: toAuditValue(cambioEstado.anterior),
            estado_nuevo: toAuditValue(cambioEstado.nuevo),
            motivo: 'Actualizacion desde ficha editable',
            modificado_por: modificadoPor
          }]);

        if (errEstado) {
          console.error('Error registrando historial de estado:', errEstado);
        }
      }
    }

    return data;
  } catch (err) {
    console.error('Error actualizando codigo presupuestario:', err);
    throw err;
  }
}

export async function guardarContratoObra(
  proyectoId: string | number,
  contratoData: Partial<ContratoObra>
) {
  try {
    const payload: Partial<ContratoObra> = {
      numero_solicitud_contratacion: contratoData.numero_solicitud_contratacion?.trim() || null,
      numero_procedimiento_sicop: contratoData.numero_procedimiento_sicop?.trim() || null,
      numero_contrato_sicop: contratoData.numero_contrato_sicop?.trim() || null,
      numero_orden_compra: contratoData.numero_orden_compra?.trim() || null,
      empresa_adjudicada: contratoData.empresa_adjudicada?.trim() || null,
      contratista: contratoData.contratista?.trim() || null,
      estado_contratacion: contratoData.estado_contratacion?.trim() || null
    };

    const { data: contratos, error: errConsulta } = await supabase
      .from('contrato_obra')
      .select('id')
      .eq('proyecto_id', proyectoId)
      .limit(1);

    if (errConsulta) throw errConsulta;

    const contratoId = contratos?.[0]?.id;
    const tieneDatos = Object.values(payload).some(value => value !== null && value !== undefined && String(value).trim() !== '');

    if (contratoId) {
      const { data, error } = await supabase
        .from('contrato_obra')
        .update(payload)
        .eq('id', contratoId)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    if (!tieneDatos) return null;

    const { data, error } = await supabase
      .from('contrato_obra')
      .insert([{ ...payload, proyecto_id: proyectoId }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error guardando contrato de obra:', err);
    throw err;
  }
}

export async function getDocumentosProyecto(proyectoId: string | number): Promise<ProyectoDocumento[]> {
  try {
    const { data, error } = await supabase
      .from('proyecto_documento')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('creado_en', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error obteniendo documentos del proyecto:', err);
    throw err;
  }
}

export async function crearUrlDocumentoProyecto(rutaStorage: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PROYECTOS_DOCUMENTOS_BUCKET)
    .createSignedUrl(rutaStorage, 60 * 10);

  if (error || !data?.signedUrl) throw error || new Error('No se pudo generar URL del documento');
  return data.signedUrl;
}

export async function subirDocumentoProyecto(
  proyectoId: string | number,
  file: File,
  tipoDocumento: string,
  descripcion: string,
  subidoPor: string
): Promise<ProyectoDocumento> {
  try {
    const cleanName = sanitizeStorageName(file.name);
    const filePath = `proyectos/${proyectoId}/${Date.now()}-${cleanName}`;

    const { error: uploadError } = await supabase.storage
      .from(PROYECTOS_DOCUMENTOS_BUCKET)
      .upload(filePath, file, {
        contentType: file.type || undefined,
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from('proyecto_documento')
      .insert([{
        proyecto_id: proyectoId,
        tipo_documento: tipoDocumento,
        nombre_archivo: file.name,
        ruta_storage: filePath,
        mime_type: file.type || null,
        tamano_bytes: file.size,
        descripcion: descripcion.trim() || null,
        subido_por: subidoPor
      }])
      .select()
      .single();

    if (error) {
      await supabase.storage.from(PROYECTOS_DOCUMENTOS_BUCKET).remove([filePath]);
      throw error;
    }

    return data;
  } catch (err) {
    console.error('Error subiendo documento del proyecto:', err);
    throw err;
  }
}

export async function eliminarDocumentoProyecto(documento: ProyectoDocumento) {
  try {
    const { error: storageError } = await supabase.storage
      .from(PROYECTOS_DOCUMENTOS_BUCKET)
      .remove([documento.ruta_storage]);

    if (storageError) throw storageError;

    const { error } = await supabase
      .from('proyecto_documento')
      .delete()
      .eq('id', documento.id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error eliminando documento del proyecto:', err);
    throw err;
  }
}

export async function crearPermisoProyecto(
  permiso: Omit<ProyectoPermiso, 'id' | 'creado_en' | 'actualizado_en'>
): Promise<ProyectoPermiso> {
  try {
    const payload = {
      ...permiso,
      tipo_permiso: permiso.tipo_permiso.trim(),
      entidad_emisora: permiso.entidad_emisora.trim(),
      estado: permiso.estado.trim(),
      numero_referencia: permiso.numero_referencia?.trim() || null,
      responsable: permiso.responsable?.trim() || null,
      observaciones: permiso.observaciones?.trim() || null
    };

    const { data, error } = await supabase
      .from('proyecto_permiso')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error creando permiso del proyecto:', err);
    throw err;
  }
}

export async function eliminarPermisoProyecto(permisoId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('proyecto_permiso')
      .delete()
      .eq('id', permisoId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error eliminando permiso del proyecto:', err);
    throw err;
  }
}

export async function crearHitoProyecto(
  hito: Omit<ProyectoHito, 'id' | 'creado_en' | 'actualizado_en'>
): Promise<ProyectoHito> {
  try {
    const payload = {
      ...hito,
      nombre: hito.nombre.trim(),
      descripcion: hito.descripcion?.trim() || null,
      responsable: hito.responsable?.trim() || null,
      porcentaje_avance: normalizeProgressFraction(hito.porcentaje_avance)
    };

    const { data, error } = await supabase
      .from('proyecto_hito')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error creando hito del proyecto:', err);
    throw err;
  }
}

export async function actualizarHitoProyecto(
  hitoId: string,
  hito: Partial<ProyectoHito>
): Promise<ProyectoHito> {
  try {
    const payload: Partial<ProyectoHito> = {
      ...hito,
      porcentaje_avance: hito.porcentaje_avance !== undefined
        ? normalizeProgressFraction(hito.porcentaje_avance)
        : undefined
    };

    const { data, error } = await supabase
      .from('proyecto_hito')
      .update(payload)
      .eq('id', hitoId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error actualizando hito del proyecto:', err);
    throw err;
  }
}

export async function eliminarHitoProyecto(hitoId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('proyecto_hito')
      .delete()
      .eq('id', hitoId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error eliminando hito del proyecto:', err);
    throw err;
  }
}

export async function crearDonacionProyecto(
  donacion: Omit<ProyectoDonacion, 'id' | 'creado_en' | 'actualizado_en'>
): Promise<ProyectoDonacion> {
  try {
    const payload = {
      ...donacion,
      tipo_donacion: donacion.tipo_donacion.trim(),
      donante: donacion.donante.trim(),
      descripcion: donacion.descripcion?.trim() || null,
      responsable: donacion.responsable?.trim() || null,
      observaciones: donacion.observaciones?.trim() || null,
      valor_estimado: Number(donacion.valor_estimado) || 0
    };

    const { data, error } = await supabase
      .from('proyecto_donacion')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error creando donacion del proyecto:', err);
    throw err;
  }
}

export async function eliminarDonacionProyecto(donacionId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('proyecto_donacion')
      .delete()
      .eq('id', donacionId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error eliminando donacion del proyecto:', err);
    throw err;
  }
}

export async function crearGarantiaContrato(
  garantia: Omit<ContratoGarantia, 'id' | 'creado_en' | 'actualizado_en'>
): Promise<ContratoGarantia> {
  try {
    const payload = {
      ...garantia,
      tipo_garantia: garantia.tipo_garantia.trim(),
      entidad_emisora: garantia.entidad_emisora?.trim() || null,
      numero_referencia: garantia.numero_referencia?.trim() || null,
      observaciones: garantia.observaciones?.trim() || null,
      monto: Number(garantia.monto) || 0
    };

    const { data, error } = await supabase
      .from('contrato_garantia')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error creando garantia contractual:', err);
    throw err;
  }
}

export async function eliminarGarantiaContrato(garantiaId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('contrato_garantia')
      .delete()
      .eq('id', garantiaId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error eliminando garantia contractual:', err);
    throw err;
  }
}

/**
 * Helper para extraer coordenadas [lat, lng] desde formatos GeoJSON, EWKT o WKB de PostGIS
 */
export function parseCoordinates(geo: any): [number, number] | null {
  if (!geo) return null;

  try {
    let obj = geo;
    if (typeof geo === 'string') {
      const trimmed = geo.trim();
      if (trimmed.startsWith('{')) {
        obj = JSON.parse(trimmed);
      } else if (trimmed.includes('POINT')) {
        const match = trimmed.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
        if (match) {
          const lng = parseFloat(match[1]);
          const lat = parseFloat(match[2]);
          if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
        }
      }
    }

    if (obj && typeof obj === 'object') {
      if (obj.type === 'Point' && Array.isArray(obj.coordinates) && obj.coordinates.length >= 2) {
        const lng = parseFloat(obj.coordinates[0]);
        const lat = parseFloat(obj.coordinates[1]);
        if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
      }
    }
  } catch (e) {
    console.error('Error parseando coordenadas:', e);
  }
  return null;
}

/**
 * Obtener proyectos con georeferencia para el mapa
 */
export async function getProyectosConGeo() {
  try {
    const { data, error } = await supabase
      .from('proyecto_obra')
      .select('id, nombre_proyecto, dependencia, estado, georeferencia')
      .not('georeferencia', 'is', null);

    if (error) throw error;
    if (!data) return [];

    return data
      .map((p: any) => {
        const coords = parseCoordinates(p.georeferencia);
        if (!coords) return null;
        return {
          ...p,
          lat: coords[0],
          lng: coords[1]
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.error('Error obteniendo proyectos georeferenciados:', err);
    return [];
  }
}
