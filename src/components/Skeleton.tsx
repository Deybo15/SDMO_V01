import { cn } from '../lib/utils';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'rect' | 'circle';
}

export const Skeleton = ({ className, variant = 'rect' }: SkeletonProps) => {
    return (
        <div
            className={cn(
                "animate-pulse bg-white/5",
                variant === 'text' && "h-4 w-full rounded-md",
                variant === 'rect' && "rounded-2xl",
                variant === 'circle' && "rounded-full",
                className
            )}
        />
    );
};

export const DashboardSkeleton = () => {
    return (
        <div className="min-h-screen bg-[#070b14] p-8 relative">
            {/* Header Skeleton */}
            <div className="flex justify-between items-center mb-10">
                <div className="space-y-2">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-4 w-48" variant="text" />
                </div>
                <div className="flex gap-4">
                    <Skeleton className="h-12 w-32" />
                    <Skeleton className="h-12 w-32" />
                </div>
            </div>

            {/* KPI Cards Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="glass-card p-6 h-[180px] flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <Skeleton className="w-12 h-12 rounded-2xl" />
                            <Skeleton className="w-20 h-6 rounded-full" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-24" variant="text" />
                            <Skeleton className="h-12 w-16" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="glass-card p-8 lg:col-span-2 h-[500px]">
                    <Skeleton className="h-8 w-64 mb-10" />
                    <Skeleton className="w-full h-[350px]" />
                </div>
                <div className="glass-card p-8 h-[500px]">
                    <Skeleton className="h-8 w-64 mb-10" />
                    <Skeleton className="w-full h-[350px]" />
                </div>
                <div className="glass-card p-8 h-[500px]">
                    <Skeleton className="h-8 w-64 mb-10" />
                    <Skeleton className="w-full h-[350px]" />
                </div>
            </div>
        </div>
    );
};
