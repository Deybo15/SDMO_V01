import { supabase } from './supabase';
import {
  ProyectoObra,
  PresupuestoProyecto,
  ContratoObra,
  FaseProyecto,
  SeguimientoProyecto,
  ProyectoObraConDetalles,
  FiltrosProyectoObra
} from '../types/proyectosObra';

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
    const [resPresupuestos, resContrato, resFases, resSeguimientos, resHistorialFases, resColab] = await Promise.all([
      supabase.from('presupuesto_proyecto').select('*').eq('proyecto_id', id),
      supabase.from('contrato_obra').select('*').eq('proyecto_id', id).maybeSingle(),
      supabase.from('fase_proyecto').select('*').eq('proyecto_id', id).order('id', { ascending: true }),
      supabase.from('seguimiento_proyecto').select('*').eq('proyecto_id', id).order('fecha_corte', { ascending: false }),
      supabase.from('historial_fase_proyecto').select('*').eq('proyecto_id', id).order('creado_en', { ascending: false }),
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
      contrato: resContrato.data || null,
      fases: resFases.data || [],
      seguimientos: resSeguimientos.data || [],
      historial_fases: resHistorialFases.data || []
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
      if (p >= 1) {
        updatePayload.completada = true;
      }
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
        fase_id,
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
export async function crearProyectoObra(proyectoData: Partial<ProyectoObra>, presupuestoAsignado: number = 0) {
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
