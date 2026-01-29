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
                    "inline-flex items-center justify-center rounded-xl font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:pointer-events-none disabled:opacity-50 active:scale-95 shadow-lg",
                    {
                        'bg-gradient-to-r from-blue-600 to-blue-400 text-white hover:brightness-110 shadow-blue-500/20': variant === 'primary',
                        'bg-white/10 text-white hover:bg-white/20 border border-white/10': variant === 'secondary',
                        'border border-white/20 bg-transparent text-white hover:bg-white/5': variant === 'outline',
                        'text-gray-400 hover:text-white hover:bg-white/5': variant === 'ghost',
                        'bg-gradient-to-r from-red-600 to-red-400 text-white hover:brightness-110 shadow-red-500/20': variant === 'danger',
                        'h-9 px-4 text-xs': size === 'sm',
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
