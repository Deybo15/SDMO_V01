import { useState, useEffect } from 'react';
import { Image as ImageIcon, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface SmartImageProps {
    src: string | null;
    alt: string;
    className?: string;
    containerClassName?: string;
}

export default function SmartImage({ src, alt, className, containerClassName }: SmartImageProps) {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!src) {
            setError(true);
            return;
        }
        const img = new Image();
        img.src = src;
        img.onload = () => setLoaded(true);
        img.onerror = () => setError(true);
    }, [src]);

    return (
        <div className={cn(
            "relative overflow-hidden bg-slate-100 dark:bg-slate-900 flex items-center justify-center",
            containerClassName
        )}>
            {/* Loading Skeleton / Placeholder */}
            {!loaded && !error && (
                <div className="absolute inset-0 animate-pulse bg-slate-200 dark:bg-slate-800" />
            )}

            {/* Error state */}
            {error ? (
                <div className="flex flex-col items-center gap-1 text-slate-400">
                    <AlertCircle className="w-5 h-5 opacity-50" />
                </div>
            ) : (
                <img
                    src={src || ''}
                    alt={alt}
                    loading="lazy"
                    className={cn(
                        "w-full h-full object-cover transition-opacity duration-700",
                        loaded ? "opacity-100" : "opacity-0",
                        className
                    )}
                />
            )}
        </div>
    );
}
