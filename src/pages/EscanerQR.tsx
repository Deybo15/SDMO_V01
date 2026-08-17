import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    QrCode,
    Scan,
    AlertTriangle,
    Loader2,
    XCircle,
    Camera,
    ArrowRight,
    RefreshCw,
    CheckCircle2
} from 'lucide-react';

// Shared Components
import { PageHeader } from '../components/ui/PageHeader';
import SmartImage from '../components/SmartImage';

declare const Html5Qrcode: any;

interface InventoryItem {
    codigo_articulo: string;
    nombre_articulo: string;
    cantidad_disponible: number;
    unidad: string;
    imagen_url: string | null;
    marca?: string;
}

export default function EscanerQR() {
    const navigate = useNavigate();
    const [scanning, setScanning] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<InventoryItem | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState('Listo para escanear');

    const scannerRef = useRef<any>(null);
    const [scannerKey, setScannerKey] = useState(0);

    const themeColor = 'neutral';

    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                const s = scannerRef.current;
                scannerRef.current = null;
                try {
                    s.stop().catch(() => { /* Scanner may already be stopped. */ }).finally(() => {
                        try { s.clear(); } catch (e) { /* Scanner may already be cleared. */ }
                    });
                } catch (e) { /* Scanner cleanup is best-effort. */ }
            }
        };
    }, []);

    const startScanning = async () => {
        try {
            setResult(null);
            setError(null);
            setLoading(false);

            // Increment key to force-mount a fresh div for the scanner
            setScannerKey(prev => prev + 1);

            // Allow React one tick to render the new div
            setTimeout(async () => {
                try {
                    const html5QrCode = new Html5Qrcode("qr-reader");
                    scannerRef.current = html5QrCode;

                    await html5QrCode.start(
                        { facingMode: "environment" },
                        {
                            fps: 15,
                            qrbox: { width: 250, height: 250 },
                            aspectRatio: 1.0
                        },
                        (text: string) => {
                            handleScanSuccess(text);
                        },
                        () => { /* Ignore individual frames without a QR result. */ }
                    );
                    setScanning(true);
                    setStatus('Escaneando código...');
                } catch (err: any) {
                    console.error(err);
                    let errMsg = 'Acceso a la cámara denegado o no disponible.';
                    if (err.toString().includes('NotAllowedError')) {
                        errMsg = 'Permiso de cámara denegado. Por favor, habilita el acceso en tu navegador.';
                    } else if (err.toString().includes('NotFoundError')) {
                        errMsg = 'No se encontró ninguna cámara disponible.';
                    }
                    setError(errMsg);
                    setScanning(false);
                }
            }, 100);
        } catch (e) {
            console.error(e);
        }
    };

    const stopScanning = async () => {
        const instance = scannerRef.current;
        scannerRef.current = null;
        setScanning(false);
        setStatus('Cerrando visor...');

        if (instance) {
            try {
                await instance.stop().catch((e: any) => console.log("Stop non-fatal:", e));
                try { instance.clear(); } catch (e) { /* Scanner may already be cleared. */ }
            } catch (err) {
                console.log("Stop non-fatal crash");
            }
        }
        setStatus('Cámara apagada');
    };

    const handleScanSuccess = async (text: string) => {
        await stopScanning();
        setLoading(true);
        setStatus('Buscando información...');

        try {
            const { data, error } = await supabase
                .from("inventario_con_datos")
                .select("codigo_articulo, nombre_articulo, cantidad_disponible, unidad, imagen_url")
                .eq("codigo_articulo", text)
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                setError(`El código "${text}" no está registrado en el sistema de inventario.`);
                setStatus('Error de búsqueda');
            } else {
                setResult(data);
                setStatus('Artículo localizado');
            }
        } catch (err: any) {
            console.error('Scan Error:', err);
            setError(err.message || 'Error de conexión al consultar el artículo. Por favor, verifica tu internet.');
            setStatus('Fallo de conexión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black p-4 md:p-8 text-[#f4f4f5] selection:bg-white/20 overflow-x-hidden">
            <div className="max-w-[1536px] mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <PageHeader
                    title="Escáner QR"
                    icon={QrCode}
                    themeColor={themeColor}
                    subtitle="Identificación rápida de artículos mediante su código QR."
                />

                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
                    {/* Scanner Viewport */}
                    <div className="relative aspect-square max-h-[680px] bg-[#09090b] rounded-xl border border-[#3f3f46] shadow-2xl overflow-hidden group">
                        <div id="qr-reader" key={scannerKey} className="w-full h-full" />

                        {/* Visual Overlays */}
                        {!scanning && !loading && !result && !error && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
                                <div className="w-20 h-20 rounded-xl bg-[#18181b] flex items-center justify-center mb-6 border border-[#52525b]">
                                    <Camera size={36} className="text-[#d4d4d8]" />
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="text-sm font-semibold text-white">Visor en reposo</p>
                                    <p className="text-xs text-[#71717a]">Listo para iniciar la captura</p>
                                </div>
                            </div>
                        )}

                        {scanning && (
                            <div className="absolute inset-0 pointer-events-none">
                                {/* Scanning Corners */}
                                <div className="absolute inset-0 border-[40px] border-black/20" />
                                <div className="absolute top-12 left-12 w-16 h-16 border-t-2 border-l-2 border-white rounded-tl-lg" />
                                <div className="absolute top-12 right-12 w-16 h-16 border-t-2 border-r-2 border-white rounded-tr-lg" />
                                <div className="absolute bottom-12 left-12 w-16 h-16 border-b-2 border-l-2 border-white rounded-bl-lg" />
                                <div className="absolute bottom-12 right-12 w-16 h-16 border-b-2 border-r-2 border-white rounded-br-lg" />

                                {/* Interactive Scanning Line */}
                                <div className="absolute top-0 left-12 right-12 h-px bg-white/90 animate-scan-line shadow-[0_0_12px_rgba(255,255,255,0.65)]" />

                                {/* Status Pill */}
                                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3 bg-[#111112] border border-[#52525b] rounded-lg shadow-2xl whitespace-nowrap">
                                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                    <span className="text-xs font-semibold text-white">{status}</span>
                                </div>
                            </div>
                        )}

                        {loading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
                                <Loader2 className="w-12 h-12 text-white animate-spin relative z-10" />
                                <p className="mt-5 text-sm font-semibold text-[#d4d4d8]">{status}</p>
                            </div>
                        )}
                    </div>

                    {/* Action Controls */}
                    <div className="bg-[#0d0d0e] border border-[#3f3f46] p-6 rounded-xl space-y-6 lg:sticky lg:top-6">
                        <div className="space-y-1 pb-5 border-b border-[#27272a]">
                            <h2 className="text-lg font-semibold text-white">Control del visor</h2>
                            <p className="text-sm text-[#a1a1aa]">Active la cámara y enfoque el código dentro del marco.</p>
                        </div>
                        {!scanning ? (
                            <button
                                onClick={startScanning}
                                className="w-full h-12 bg-[#e4e4e7] hover:bg-white text-black rounded-lg font-semibold text-sm active:scale-[0.99] transition-all flex items-center justify-center gap-3"
                            >
                                <Scan className="w-5 h-5" />
                                {result || error ? 'Reintentar escaneo' : 'Iniciar visor QR'}
                            </button>
                        ) : (
                            <button
                                onClick={stopScanning}
                                className="w-full h-12 bg-[#111112] border border-[#71717a] text-white font-semibold text-sm rounded-lg hover:bg-[#18181b] transition-all flex items-center justify-center gap-3 group"
                            >
                                <XCircle className="w-5 h-5 transition-colors" />
                                Detener escáner
                            </button>
                        )}

                        {/* Result Display */}
                        {result && (
                            <div className="animate-in slide-in-from-bottom-8 duration-500">
                                <div className="bg-[#111112] rounded-xl p-5 border border-[#3f3f46]">
                                    <div className="flex flex-col gap-5 items-stretch">
                                        <div className="w-full aspect-[4/3] bg-[#09090b] rounded-lg overflow-hidden border border-[#3f3f46] shadow-inner">
                                            <SmartImage
                                                src={result.imagen_url}
                                                alt={result.nombre_articulo}
                                                className="w-full h-full object-contain"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono bg-[#18181b] text-[#d4d4d8] px-3 py-1.5 rounded-md border border-[#52525b]">
                                                    {result.codigo_articulo}
                                                </span>
                                                <CheckCircle2 className="w-4 h-4 text-white" />
                                            </div>
                                            <h3 className="text-white font-semibold text-lg leading-snug line-clamp-3">
                                                {result.nombre_articulo}
                                            </h3>

                                            <div className="flex justify-between items-end pt-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-[#a1a1aa] mb-1">Stock disponible</span>
                                                    <span className="text-3xl font-semibold text-white tracking-tight">
                                                        {result.cantidad_disponible} <span className="text-xs text-[#a1a1aa] uppercase ml-1 tracking-wider">{result.unidad}</span>
                                                    </span>
                                                </div>

                                                <button
                                                    onClick={() => navigate(`/articulos/consultar-inventario`)}
                                                    className="w-12 h-12 bg-[#18181b] hover:bg-white text-[#d4d4d8] hover:text-black rounded-lg flex items-center justify-center transition-all border border-[#52525b] active:scale-95"
                                                    title="Ver en inventario"
                                                >
                                                    <ArrowRight className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Error Handling UI */}
                        {error && (
                            <div className="animate-in shake duration-500 bg-[#111112] border border-[#71717a] p-5 rounded-xl flex items-start gap-4">
                                <div className="w-12 h-12 rounded-lg bg-[#18181b] flex items-center justify-center shrink-0 border border-[#52525b]">
                                    <AlertTriangle className="text-white w-6 h-6" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-white">No fue posible escanear</p>
                                    <p className="text-sm text-[#a1a1aa] leading-relaxed">{error}</p>
                                </div>
                            </div>
                        )}

                        {/* Interactive Hint */}
                        {!result && !error && !scanning && (
                            <div className="flex items-center justify-center gap-3 pt-2 text-[#71717a] group cursor-default">
                                <RefreshCw className="w-4 h-4 transition-transform group-hover:rotate-180 duration-700" />
                                <span className="text-xs">Apunte al código del artículo para identificarlo</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes scan-line {
                    0% { top: 10%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 90%; opacity: 0; }
                }
                .animate-scan-line {
                    animation: scan-line 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                }
                
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                .shake {
                    animation: shake 0.4s ease-in-out;
                }
            `}</style>
        </div>
    );
}
