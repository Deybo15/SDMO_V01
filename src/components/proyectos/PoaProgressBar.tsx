import React from 'react';
import { formatProgressPercent } from '../../lib/proyectosObraService';

interface PoaProgressBarProps {
  percentage: number | null | undefined;
  showLabel?: boolean;
  monochrome?: boolean;
}

export const PoaProgressBar: React.FC<PoaProgressBarProps> = ({ percentage, showLabel = true, monochrome = false }) => {
  const clampedValue = formatProgressPercent(percentage);

  // Gradiente dinámico según el avance
  const getGradient = (val: number) => {
    if (val < 30) return 'from-red-500 to-orange-500';
    if (val < 70) return 'from-amber-500 to-yellow-400';
    return 'from-emerald-500 to-teal-400';
  };

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-center mb-1.5 text-xs">
          <span className="text-[#86868B] font-medium">Avance POA</span>
          <span className="text-white font-bold font-mono">{clampedValue}%</span>
        </div>
      )}
      <div className={monochrome
        ? "w-full h-3 bg-[#18181b] rounded-[3px] overflow-hidden border border-[#a1a1aa]"
        : "w-full h-2 bg-[#2a2a2c] rounded-full overflow-hidden p-0.5 border border-[#3a3a3c]"
      }>
        <div
          className={monochrome
            ? "h-full border-r border-white transition-all duration-500 ease-out"
            : `h-full rounded-full bg-gradient-to-r ${getGradient(clampedValue)} transition-all duration-500 ease-out shadow-sm`
          }
          style={monochrome ? {
            width: `${clampedValue}%`,
            backgroundColor: '#27272a',
            backgroundImage: 'repeating-linear-gradient(135deg, transparent 0, transparent 4px, rgba(255,255,255,0.7) 4px, rgba(255,255,255,0.7) 5px)',
            boxShadow: 'inset 0 0 0 1px #a1a1aa'
          } : { width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
};
