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

    const themeColor = 'blue';

    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                const s = scannerRef.current;
                scannerRef.current = null;
                try {
                    s.stop().catch(() => { }).finally(() => {
                        try { s.clear(); } catch (e) { }
                    });
                } catch (e) { }
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
                        () => { }
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
                try { instance.clear(); } catch (e) { }
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
        <div className="min-h-screen bg-[#000000] text-[#F5F5F7] font-sans selection:bg-[#0071E3]/30 overflow-x-hidden">
            <div className="animate-fade-in-up">
                <PageHeader
                    title="Escáner QR"
                    icon={QrCode}
                    themeColor={themeColor}
                />

                <div className="max-w-xl mx-auto px-6 pt-16 pb-32 space-y-8">
                    {/* Scanner Viewport */}
                    <div className="relative aspect-square bg-[#121212] rounded-[8px] border border-[#333333] shadow-2xl overflow-hidden group">
                        <div id="qr-reader" key={scannerKey} className="w-full h-full" />

                        {/* Visual Overlays */}
                        {!scanning && !loading && !result && !error && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
                                <div className="w-24 h-24 rounded-[8px] bg-[#1D1D1F] flex items-center justify-center mb-8 border border-[#333333] animate-pulse">
                                    <Camera size={44} className="text-[#86868B]" />
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#86868B]">Visor en Reposo</p>
                                    <p className="text-[9px] font-medium text-[#86868B]/50 uppercase tracking-widest">Listo para iniciar captura</p>
                                </div>
                            </div>
                        )}

                        {scanning && (
                            <div className="absolute inset-0 pointer-events-none">
                                {/* Scanning Corners */}
                                <div className="absolute inset-0 border-[40px] border-black/20" />
                                <div className="absolute top-12 left-12 w-16 h-16 border-t-[3px] border-l-[3px] border-[#0071E3] rounded-tl-[8px] shadow-[0_0_30px_rgba(0,113,227,0.3)] transition-all" />
                                <div className="absolute top-12 right-12 w-16 h-16 border-t-[3px] border-r-[3px] border-[#0071E3] rounded-tr-[8px] shadow-[0_0_30px_rgba(0,113,227,0.3)]" />
                                <div className="absolute bottom-12 left-12 w-16 h-16 border-b-[3px] border-l-[3px] border-[#0071E3] rounded-bl-[8px] shadow-[0_0_30px_rgba(0,113,227,0.3)]" />
                                <div className="absolute bottom-12 right-12 w-16 h-16 border-b-[3px] border-r-[3px] border-[#0071E3] rounded-br-[8px] shadow-[0_0_30px_rgba(0,113,227,0.3)]" />

                                {/* Interactive Scanning Line */}
                                <div className="absolute top-0 left-12 right-12 h-[2px] bg-[#0071E3]/80 blur-sm animate-scan-line shadow-[0_0_20px_rgba(0,113,227,0.5)]" />

                                {/* Status Pill */}
                                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-3 bg-[#121212] border border-[#333333] rounded-[8px] shadow-2xl">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#0071E3] animate-pulse shadow-[0_0_10px_rgba(0,113,227,0.8)]" />
                                    <span className="text-[10px] font-black text-[#0071E3] uppercase tracking-widest">{status}</span>
                                </div>
                            </div>
                        )}

                        {loading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
                                <Loader2 className="w-14 h-14 text-[#0071E3] animate-spin relative z-10" />
                                <p className="mt-6 text-[11px] font-black text-[#86868B] uppercase tracking-[0.3em]">{status}</p>
                            </div>
                        )}
                    </div>

                    {/* Action Controls */}
                    <div className="bg-[#121212] border border-[#333333] p-8 rounded-[8px] space-y-8">
                        {!scanning ? (
                            <button
                                onClick={startScanning}
                                className="w-full h-16 bg-[#0071E3] text-[#FFFFFF] font-black text-xs uppercase tracking-[0.2em] rounded-[8px] shadow-2xl shadow-[#0071E3]/20 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-4"
                            >
                                <Scan className="w-5 h-5" />
                                {result || error ? 'REINTENTAR ESCANEO' : 'INICIAR VISOR QR'}
                            </button>
                        ) : (
                            <button
                                onClick={stopScanning}
                                className="w-full h-16 bg-transparent border border-[#F5F5F7] text-[#F5F5F7] font-black text-xs uppercase tracking-[0.2em] rounded-[8px] hover:bg-[#F5F5F7]/10 transition-all flex items-center justify-center gap-4 group"
                            >
                                <XCircle className="w-5 h-5 group-hover:text-red-500 transition-colors" />
                                DETENER ESCÁNER
                            </button>
                        )}

                        {/* Result Display */}
                        {result && (
                            <div className="animate-in slide-in-from-bottom-8 duration-500">
                                <div className="bg-[#1D1D1F] rounded-[8px] p-8 border border-[#333333]">
                                    <div className="flex gap-8 items-center">
                                        <div className="w-32 h-32 bg-[#121212] rounded-[8px] overflow-hidden shrink-0 border border-[#333333] shadow-inner">
                                            <SmartImage
                                                src={result.imagen_url}
                                                alt={result.nombre_articulo}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black bg-[#0071E3]/10 text-[#0071E3] px-3 py-1 rounded-[4px] border border-[#0071E3]/20 uppercase tracking-widest">
                                                    {result.codigo_articulo}
                                                </span>
                                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                            </div>
                                            <h3 className="text-[#F5F5F7] font-bold text-xl leading-tight uppercase tracking-tight line-clamp-2">
                                                {result.nombre_articulo}
                                            </h3>

                                            <div className="flex justify-between items-end pt-4">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-[#86868B] font-bold uppercase tracking-widest mb-1">Stock Actual</span>
                                                    <span className="text-3xl font-black text-[#F5F5F7] italic tracking-tighter shadow-sm">
                                                        {result.cantidad_disponible} <span className="text-[12px] text-[#86868B] not-italic uppercase ml-1 tracking-widest">{result.unidad}</span>
                                                    </span>
                                                </div>

                                                <button
                                                    onClick={() => navigate(`/articulos/consultar-inventario`)}
                                                    className="w-14 h-14 bg-[#121212] hover:bg-[#0071E3] text-[#86868B] hover:text-[#FFFFFF] rounded-[8px] flex items-center justify-center transition-all border border-[#333333] hover:border-transparent active:scale-90"
                                                    title="Ver en inventario"
                                                >
                                                    <ArrowRight className="w-7 h-7" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Error Handling UI */}
                        {error && (
                            <div className="animate-in shake duration-500 bg-red-500/10 border border-red-500/20 p-8 rounded-[8px] flex items-center gap-8">
                                <div className="w-16 h-16 rounded-[8px] bg-red-500/20 flex items-center justify-center shrink-0 border border-red-500/10">
                                    <AlertTriangle className="text-red-500 w-8 h-8" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Error de Escaneo</p>
                                    <p className="text-sm font-bold text-[#F5F5F7]/70 leading-relaxed">{error}</p>
                                </div>
                            </div>
                        )}

                        {/* Interactive Hint */}
                        {!result && !error && !scanning && (
                            <div className="flex items-center justify-center gap-3 py-4 opacity-50 group cursor-default">
                                <RefreshCw className="w-4 h-4 text-[#86868B] transition-transform group-hover:rotate-180 duration-700" />
                                <span className="text-[10px] font-black text-[#86868B] uppercase tracking-[0.4em]">Apunta al código para registrar</span>
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
