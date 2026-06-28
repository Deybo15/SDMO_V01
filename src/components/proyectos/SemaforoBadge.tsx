import React from 'react';
import { SemaforoColor } from '../../types/proyectosObra';
import { SEMAFORO_COLORS } from '../../lib/proyectosObraService';

interface SemaforoBadgeProps {
  color: SemaforoColor;
  size?: 'sm' | 'md' | 'lg';
}

export const SemaforoBadge: React.FC<SemaforoBadgeProps> = ({ color, size = 'md' }) => {
  const config = SEMAFORO_COLORS[color] || SEMAFORO_COLORS.Azul;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs font-semibold',
    md: 'px-2.5 py-1 text-xs font-bold tracking-wide uppercase',
    lg: 'px-3.5 py-1.5 text-sm font-bold tracking-wider uppercase'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${sizeClasses[size]} transition-all duration-200`}
      style={{
        backgroundColor: config.badgeBg,
        borderColor: config.border,
        color: config.bg,
        boxShadow: `0 0 10px ${config.badgeBg}`
      }}
    >
      <span
        className="w-2 h-2 rounded-full animate-pulse"
        style={{ backgroundColor: config.bg }}
      />
      {color}
    </span>
  );
};
