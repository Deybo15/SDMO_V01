import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-[8px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]/50 disabled:pointer-events-none disabled:opacity-50 active:scale-95 shadow-lg",
                    {
                        'bg-[#0071E3] text-white hover:brightness-110 shadow-[#0071E3]/20': variant === 'primary',
                        'border border-[#F5F5F7] bg-transparent text-[#F5F5F7] hover:bg-[#F5F5F7]/10': variant === 'secondary',
                        'border border-[#333333] bg-[#121212] text-[#F5F5F7] hover:bg-white/5': variant === 'outline',
                        'text-[#86868B] hover:text-[#F5F5F7] hover:bg-white/5': variant === 'ghost',
                        'bg-red-600 text-white hover:bg-red-700 shadow-red-500/20': variant === 'danger',
                        'h-8 px-4 text-xs': size === 'sm',
                        'h-12 px-6 text-base': size === 'md',
                        'h-14 px-8 text-lg': size === 'lg',
                    },
                    className
                )}
                {...props}
            />
        );
    }
);

Button.displayName = 'Button';
export { Button };
