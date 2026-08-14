import React from 'react';
import { Link } from 'react-router-dom';
import { ProyectoObraConDetalles } from '../../types/proyectosObra';

import { PoaProgressBar } from './PoaProgressBar';
import { formatMonedaCRC, formatProgressPercent } from '../../lib/proyectosObraService';
import { Building2, UserCheck, Calendar, ArrowRight, Circle, CheckCircle2 } from 'lucide-react';

interface ProyectoCardProps {
  proyecto: ProyectoObraConDetalles;
}

const abbreviateProfessional = (name?: string) => {
  if (!name) return 'Sin responsable';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 4) return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3].charAt(0)}.`;
  return name;
};

export const ProyectoCard: React.FC<ProyectoCardProps> = ({ proyecto }) => {

  const presupuestoAsignado = proyecto.presupuesto_vigente?.presupuesto_asignado ?? 0;
  const progress = formatProgressPercent(proyecto.avance_poa ?? 0);
  const normalizedStatus = (proyecto.estado || '').toLowerCase();
  const isFinished = progress >= 100 || normalizedStatus.includes('finaliz');
  const isInProgress = !isFinished && (progress > 0 || normalizedStatus.includes('ejecu') || normalizedStatus.includes('activ'));
  const statusLabel = isFinished ? 'Finalizado' : isInProgress ? 'En ejecución' : 'Sin iniciar';
  const StatusIcon = isFinished ? CheckCircle2 : Circle;

  return (
    <Link
      to={`/proyectos-obra/${proyecto.id}`}
      className="group relative flex min-h-[300px] flex-col justify-between bg-[#111112] rounded-xl border border-[#3f3f46] p-5 transition-colors duration-200 hover:border-[#71717a] overflow-hidden"
    >


      <div>
        {/* Encabezado: Código meta, Estado y Semáforo */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <span className="max-w-[65%] truncate text-[10px] font-mono font-bold px-2.5 py-1 rounded bg-[#18181b] border border-[#3f3f46] text-[#a1a1aa] tracking-wider uppercase">
            {proyecto.codigo_meta || `ID: ${proyecto.id}`}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded border border-[#52525b] bg-[#18181b] px-2.5 py-1 text-[10px] font-semibold text-[#d4d4d8]">
            <StatusIcon className="h-3 w-3" />
            {statusLabel}
          </span>
        </div>

        {/* Nombre del Proyecto */}
        <h3 className="text-lg font-semibold text-white group-hover:text-[#d4d4d8] transition-colors line-clamp-3 leading-snug mb-5">
          {proyecto.nombre_proyecto}
        </h3>

        {/* Detalles principales: Dependencia y Responsable */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2 mb-5 text-xs text-[#a1a1aa]">
          <div className="flex items-center gap-2 sm:col-span-2">
            <Building2 className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
            <span className="truncate">{proyecto.dependencia || 'Sin dependencia'}</span>
          </div>
          <div className="flex items-center gap-2">
            <UserCheck className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
            <span className="truncate">{abbreviateProfessional(proyecto.nombre_responsable)}</span>
          </div>
          {proyecto.anio && (
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
              <span>Año {proyecto.anio}</span>
            </div>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-[#3f3f46] mt-auto space-y-3">
        {/* Presupuesto Asignado */}
        <div className="grid grid-cols-[1fr_auto_auto] items-end gap-5">
          <div>
            <p className="text-[11px] text-[#71717a] uppercase font-semibold tracking-wider">Presupuesto Asignado</p>
            <p className="text-lg font-bold text-white font-mono tracking-tight tabular-nums">
              {formatMonedaCRC(presupuestoAsignado)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-[#71717a] font-semibold">Avance POA</p>
            <p className="text-lg font-bold text-white font-mono tabular-nums">{progress}%</p>
          </div>
          <div className="w-10 h-10 rounded-md border border-[#71717a] bg-[#18181b] group-hover:bg-[#e4e4e7] group-hover:text-[#111112] text-[#d4d4d8] flex items-center justify-center transition-colors duration-200">
            <ArrowRight className="w-5 h-5" />
          </div>
        </div>

        {/* Barra de Avance POA */}
        <PoaProgressBar percentage={proyecto.avance_poa ?? 0} showLabel={false} monochrome />
      </div>
    </Link>
  );
};
