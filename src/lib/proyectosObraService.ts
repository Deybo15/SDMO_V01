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
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return fechaStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return fechaStr;
  }
};

export const SEMAFORO_COLORS = {
  Verde: { bg: '#22c55e', text: '#ffffff', badgeBg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.4)' },
  Rojo: { bg: '#ef4444', text: '#ffffff', badgeBg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)' },
  Amarillo: { bg: '#eab308', text: '#ffffff', badgeBg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.4)' },
  Morado: { bg: '#a855f7', text: '#ffffff', badgeBg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.4)' },
  Azul: { bg: '#3b82f6', text: '#ffffff', badgeBg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)' },
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

    if (filtros.semaforo) {
      query = query.eq('semaforo', filtros.semaforo);
    }

    const desde = (pagina - 1) * porPagina;
    const hasta = desde + porPagina - 1;

    query = query.order('id', { ascending: false }).range(desde, hasta);

    const { data, count, error } = await query;

    if (error) throw error;

    if (!data || data.length === 0) {
      return { proyectos: [], totalCount: count || 0 };
    }

    // Obtener cédulas únicas de colaboradores para traer sus nombres
    const cedulas = Array.from(new Set(data.map(p => p.profesional_responsable).filter(Boolean)));
    
    let colabMap: Record<string, string> = {};
    if (cedulas.length > 0) {
      const { data: colabs } = await supabase
        .from('colaboradores_06')
        .select('identificacion, colaborador')
        .in('identificacion', cedulas);

      if (colabs) {
        colabs.forEach((c: any) => {
          colabMap[c.identificacion] = c.colaborador;
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
    const [resPresupuestos, resContrato, resFases, resSeguimientos, resColab] = await Promise.all([
      supabase.from('presupuesto_proyecto').select('*').eq('proyecto_id', id),
      supabase.from('contrato_obra').select('*').eq('proyecto_id', id).maybeSingle(),
      supabase.from('fase_proyecto').select('*').eq('proyecto_id', id).order('id', { ascending: true }),
      supabase.from('seguimiento_proyecto').select('*').eq('proyecto_id', id).order('fecha_corte', { ascending: false }),
      proyecto.profesional_responsable 
        ? supabase.from('colaboradores_06').select('colaborador').eq('identificacion', proyecto.profesional_responsable).maybeSingle()
        : Promise.resolve({ data: null, error: null })
    ]);

    const presupuestos: PresupuestoProyecto[] = resPresupuestos.data || [];
    const presupuestoVigente = presupuestos.find(p => p.es_vigente) || presupuestos[0] || null;

    return {
      ...proyecto,
      nombre_responsable: resColab.data?.colaborador || proyecto.profesional_responsable || 'No asignado',
      presupuesto_vigente: presupuestoVigente,
      contrato: resContrato.data || null,
      fases: resFases.data || [],
      seguimientos: resSeguimientos.data || []
    };
  } catch (err) {
    console.error('Error cargando detalle del proyecto:', err);
    return null;
  }
}

/**
 * Insertar nueva entrada de seguimiento (APPEND-ONLY)
 */
export async function registrarSeguimiento(seguimiento: Omit<SeguimientoProyecto, 'id' | 'creado_en'>) {
  try {
    const { data, error } = await supabase
      .from('seguimiento_proyecto')
      .insert([seguimiento])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error registrando seguimiento:', err);
    throw err;
  }
}

/**
 * Obtener métricas para el Dashboard
 */
export async function getDashboardStats() {
  try {
    const [resProyectos, resPresupuestos, resUltimosSeguimientos] = await Promise.all([
      supabase.from('proyecto_obra').select('id, semaforo, dependencia, avance_poa'),
      supabase.from('presupuesto_proyecto').select('presupuesto_asignado, presupuesto_ejecutado, es_vigente'),
      supabase.from('seguimiento_proyecto').select('*, proyecto_obra(nombre_proyecto)').order('fecha_corte', { ascending: false }).limit(5)
    ]);

    const proyectos = resProyectos.data || [];
    const presupuestos = resPresupuestos.data || [];
    const ultimosSeguimientos = resUltimosSeguimientos.data || [];

    // Conteo por semáforo
    const conteoSemaforo: Record<string, number> = { Verde: 0, Rojo: 0, Amarillo: 0, Morado: 0, Azul: 0 };
    const porDependencia: Record<string, number> = {};

    proyectos.forEach(p => {
      if (p.semaforo && conteoSemaforo[p.semaforo] !== undefined) {
        conteoSemaforo[p.semaforo]++;
      }
      if (p.dependencia) {
        porDependencia[p.dependencia] = (porDependencia[p.dependencia] || 0) + 1;
      }
    });

    // Suma de presupuesto vigente
    let totalAsignado = 0;
    let totalEjecutado = 0;
    presupuestos.forEach(p => {
      if (p.es_vigente) {
        totalAsignado += Number(p.presupuesto_asignado || 0);
        totalEjecutado += Number(p.presupuesto_ejecutado || 0);
      }
    });

    return {
      totalProyectos: proyectos.length,
      conteoSemaforo,
      porDependencia,
      totalAsignado,
      totalEjecutado,
      ultimosSeguimientos
    };
  } catch (err) {
    console.error('Error obteniendo métricas del dashboard:', err);
    throw err;
  }
}
