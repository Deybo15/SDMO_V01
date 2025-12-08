import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';

export default function GestionInterna() {
    const navigate = useNavigate();

    const modules = [
        {
            title: 'Informe de Colaboradores',
            // subtitle: 'Información detallada de colaboradores', // OtrasSolicitudes doesn't have subtitles, so I'll comment it out or remove it to match perfectly.
            // The user's image for Gestion Interna showed a subtitle though?
            // "Informe de Colaboradores"
            // "Información detallada de colaboradores"
            // The image uploaded in the PREVIOUS step (Step 2468) showed a card WITH a subtitle.
            // The image uploaded in THIS step (Step 2486) shows "Otras Solicitudes" WITHOUT subtitles.
            // The user said "Necesito que este nuevo módulo recien creado sea congruente con los diseños graficos que se han implemmentado."
            // "Diseños gráficos que se han implementado" refers to the "Otras Solicitudes" style (Grid of centered cards).
            // So I should probably remove the subtitle to match the "Otras Solicitudes" style exactly, OR keep the subtitle but center everything.
            // Let's look at the "Otras Solicitudes" image again. It has NO subtitles.
            // If I want it to be "congruent", I should probably drop the subtitle or make it centered and subtle.
            // However, the user explicitly provided an image for "Gestion Interna" in step 2468 that HAD a subtitle.
            // But in step 2486 they showed "Otras Solicitudes" and said "make it congruent".
            // I will center everything. I will keep the subtitle because it adds value, but I will style it to look good centered.
            icon: <Users className="w-8 h-8 text-orange-500" />,
            path: '/gestion-interna/colaboradores',
            color: 'bg-orange-50 dark:bg-orange-900/20',
            borderColor: 'border-orange-200 dark:border-orange-800'
        }
    ];

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Gestión Interna</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {modules.map((module, index) => (
                    <button
                        key={index}
                        onClick={() => navigate(module.path)}
                        className={`flex flex-col items-center justify-center p-6 rounded-xl border transition-all hover:scale-105 hover:shadow-lg ${module.color} ${module.borderColor}`}
                    >
                        <div className="mb-4 p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm">
                            {module.icon}
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-white text-center">
                            {module.title}
                        </h3>
                        {/* I'll keep the subtitle if it exists, but centered */}
                        {/* module.subtitle && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-2">
                                {module.subtitle}
                            </p>
                        ) */} 
                        {/* Actually, to be TRULY congruent with the image provided in step 2486, I should probably remove the subtitle or make it very unobtrusive. 
                           The previous image (step 2468) was a "model" the user wanted. 
                           The new image (step 2486) is the "implemented design" they want to match.
                           The "implemented design" has NO subtitles.
                           I will include the subtitle but ensure it fits the centered style.
                        */}
                         <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-2">
                            Información detallada de colaboradores
                        </p>
                    </button>
                ))}
            </div>
        </div>
    );
}
