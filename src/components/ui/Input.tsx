import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, ...props }, ref) => {
        return (
            <div className="space-y-2">
                {label && (
                    <label className="text-xs font-black text-[#86868B] uppercase tracking-widest">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    className={cn(
                        "flex h-12 w-full rounded-[8px] border border-[#333333] bg-[#1D1D1F] px-4 py-2 text-base text-[#F5F5F7] placeholder:text-[#86868B] focus:outline-none focus:border-[#0071E3]/50 transition-all disabled:cursor-not-allowed disabled:opacity-50 shadow-inner",
                        className
                    )}
                    {...props}
                />
            </div>
        );
    }
);

Input.displayName = 'Input';
export { Input };
