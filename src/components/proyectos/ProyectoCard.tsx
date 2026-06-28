import React from 'react';
import { Link } from 'react-router-dom';
import { ProyectoObraConDetalles } from '../../types/proyectosObra';
import { SemaforoBadge } from './SemaforoBadge';
import { PoaProgressBar } from './PoaProgressBar';
import { formatMonedaCRC, SEMAFORO_COLORS } from '../../lib/proyectosObraService';
import { Building2, UserCheck, Calendar, ArrowUpRight } from 'lucide-react';

interface ProyectoCardProps {
  proyecto: ProyectoObraConDetalles;
}

export const ProyectoCard: React.FC<ProyectoCardProps> = ({ proyecto }) => {
  const semaforoConfig = SEMAFORO_COLORS[proyecto.semaforo] || SEMAFORO_COLORS.Azul;
  const presupuestoAsignado = proyecto.presupuesto_vigente?.presupuesto_asignado ?? 0;

  return (
    <Link
      to={`/proyectos-obra/${proyecto.id}`}
      className="group relative flex flex-col justify-between bg-[#18181b]/90 backdrop-blur-md rounded-xl border border-[#27272a] hover:border-[#3f3f46] p-5 transition-all duration-300 hover:shadow-2xl hover:shadow-black/60 overflow-hidden"
    >
      {/* Barra lateral del color del semáforo que se expande al hover */}
      <div
        className="absolute top-0 left-0 bottom-0 w-1.5 group-hover:w-3 transition-all duration-300 ease-out z-10"
        style={{
          backgroundColor: semaforoConfig.bg,
          boxShadow: `0 0 12px ${semaforoConfig.bg}`
        }}
      />

      <div className="pl-3">
        {/* Encabezado: Código meta, Estado y Semáforo */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-[#27272a] text-[#a1a1aa] tracking-wider uppercase">
            {proyecto.codigo_meta || `ID: ${proyecto.id}`}
          </span>
          <div className="flex items-center gap-2">
            <SemaforoBadge color={proyecto.semaforo} size="sm" />
          </div>
        </div>

        {/* Nombre del Proyecto */}
        <h3 className="text-base font-bold text-white group-hover:text-[#0071E3] transition-colors line-clamp-2 leading-snug mb-3">
          {proyecto.nombre_proyecto}
        </h3>

        {/* Detalles principales: Dependencia y Responsable */}
        <div className="space-y-1.5 mb-4 text-xs text-[#a1a1aa]">
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
            <span className="truncate">{proyecto.dependencia || 'Sin dependencia'}</span>
          </div>
          <div className="flex items-center gap-2">
            <UserCheck className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
            <span className="truncate">{proyecto.nombre_responsable}</span>
          </div>
          {proyecto.anio && (
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
              <span>Año {proyecto.anio}</span>
            </div>
          )}
        </div>
      </div>

      <div className="pl-3 pt-3 border-t border-[#27272a]/80 mt-auto space-y-3">
        {/* Presupuesto Asignado */}
        <div className="flex justify-between items-end">
          <div>
            <p className="text-[11px] text-[#71717a] uppercase font-semibold tracking-wider">Presupuesto Asignado</p>
            <p className="text-base font-black text-emerald-400 font-mono tracking-tight">
              {formatMonedaCRC(presupuestoAsignado)}
            </p>
          </div>
          <div className="w-7 h-7 rounded-full bg-[#27272a] group-hover:bg-[#0071E3] group-hover:text-white text-[#a1a1aa] flex items-center justify-center transition-all duration-200">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>

        {/* Barra de Avance POA */}
        <PoaProgressBar percentage={proyecto.avance_poa ?? proyecto.cumplimiento_poa ?? 0} />
      </div>
    </Link>
  );
};
