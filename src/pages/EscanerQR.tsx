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
    Box,
    Package,
    ArrowRight,
    RefreshCw
} from 'lucide-react';

// Shared Components
import { PageHeader } from '../components/ui/PageHeader';

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

    const themeColor = 'amber';

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
                } catch (err) {
                    console.error(err);
                    setError('Acceso a la cámara denegado o no disponible.');
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
            } else {
                setResult(data);
                setStatus('Artículo localizado');
            }
        } catch (err) {
            setError('Error de conexión al consultar el artículo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0f111a] p-4 md:p-8">
            <PageHeader
                title="Escáner QR"
                icon={QrCode}
                themeColor={themeColor}
            />

            <div className="max-w-xl mx-auto space-y-6">

                {/* Scanner Viewport */}
                <div className="relative aspect-square bg-slate-900 rounded-[2.5rem] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-500">
                    <div id="qr-reader" key={scannerKey} className="w-full h-full" />

                    {/* Decorative Scanner Overlays */}
                    {!scanning && !loading && !result && !error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700 bg-black/40">
                            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 animate-pulse">
                                <Camera size={48} className="opacity-20" />
                            </div>
                            <p className="text-xs font-black uppercase tracking-[0.3em]">Visor en reposo</p>
                        </div>
                    )}

                    {scanning && (
                        <div className="absolute inset-0 pointer-events-none">
                            {/* Scanning Corners */}
                            <div className="absolute top-10 left-10 w-12 h-12 border-t-4 border-l-4 border-amber-500 rounded-tl-2xl shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
                            <div className="absolute top-10 right-10 w-12 h-12 border-t-4 border-r-4 border-amber-500 rounded-tr-2xl" />
                            <div className="absolute bottom-10 left-10 w-12 h-12 border-b-4 border-l-4 border-amber-500 rounded-bl-2xl" />
                            <div className="absolute bottom-10 right-10 w-12 h-12 border-b-4 border-r-4 border-amber-500 rounded-br-2xl" />

                            {/* Scanning Line */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent blur-sm animate-scan-line" />

                            {/* Status Indicator */}
                            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-amber-500/20 backdrop-blur-md border border-amber-500/30 px-6 py-2 rounded-full shadow-2xl">
                                <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                    {status}
                                </span>
                            </div>
                        </div>
                    )}

                    {loading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                            <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-4" />
                            <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">{status}</p>
                        </div>
                    )}
                </div>

                {/* Control Panel */}
                <div className="bg-[#1e2235]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 shadow-2xl space-y-4">
                    {!scanning ? (
                        <button
                            onClick={startScanning}
                            className="w-full py-5 bg-gradient-to-r from-amber-600 to-orange-500 text-white font-black text-lg rounded-2xl shadow-xl shadow-amber-900/30 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                            <Scan className="w-6 h-6" />
                            {result || error ? 'ESCANEAR OTRO CÓDIGO' : 'ENCENDER CÁMARA'}
                        </button>
                    ) : (
                        <button
                            onClick={stopScanning}
                            className="w-full py-5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-black text-lg rounded-2xl border border-white/10 transition-all flex items-center justify-center gap-3"
                        >
                            <XCircle className="w-6 h-6" />
                            DETENER ESCÁNER
                        </button>
                    )}

                    {/* Result Card */}
                    {result && (
                        <div className="animate-in slide-in-from-bottom-4 duration-500 pt-2">
                            <div className="bg-black/40 border border-green-500/20 rounded-3xl p-6 relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-1 h-full bg-green-500/50" />

                                <div className="flex gap-6 items-center">
                                    <div className="w-24 h-24 bg-[#1e2235] rounded-2xl overflow-hidden shrink-0 border border-white/10 shadow-lg group-hover:scale-105 transition-transform duration-500">
                                        <img
                                            src={result.imagen_url || 'https://via.placeholder.com/150'}
                                            alt={result.nombre_articulo}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-lg font-black font-mono border border-green-500/10">
                                                {result.codigo_articulo}
                                            </span>
                                        </div>
                                        <h3 className="text-white font-black text-lg leading-tight uppercase italic mb-4 line-clamp-2">
                                            {result.nombre_articulo}
                                        </h3>

                                        <div className="flex justify-between items-end">
                                            <div className="bg-white/5 border border-white/5 py-2 px-4 rounded-xl">
                                                <span className="text-[10px] text-gray-500 font-bold uppercase block mb-0.5 tracking-tighter">Stock</span>
                                                <span className="text-xl font-black text-white italic tracking-tighter">
                                                    {result.cantidad_disponible} <span className="text-xs text-gray-600 ml-1">{result.unidad}</span>
                                                </span>
                                            </div>

                                            <button
                                                onClick={() => navigate(`/articulos/consultar-inventario?q=${result.codigo_articulo}`)}
                                                className="w-12 h-12 bg-white/10 hover:bg-green-500/20 rounded-2xl flex items-center justify-center text-gray-400 hover:text-green-400 transition-all border border-white/5 hover:border-green-500/30"
                                            >
                                                <ArrowRight className="w-6 h-6" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error Card */}
                    {error && (
                        <div className="animate-in slide-in-from-bottom-2 bg-rose-500/10 border border-rose-500/20 p-5 rounded-3xl flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 flex items-center justify-center shrink-0">
                                <AlertTriangle className="text-rose-500 w-6 h-6" />
                            </div>
                            <p className="text-sm font-bold text-rose-200 leading-tight">{error}</p>
                        </div>
                    )}

                    {/* Quick Hint */}
                    {!result && !error && !scanning && (
                        <div className="flex items-center justify-center gap-2 py-2 opacity-30">
                            <RefreshCw className="w-3 h-3 text-gray-500" />
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Apunta la cámara al código del material</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Custom Animation for Scanner Line */}
            <style>{`
                @keyframes scan-line {
                    0% { top: 0; }
                    100% { top: 100%; }
                }
                .animate-scan-line {
                    animation: scan-line 2s linear infinite;
                }
            `}</style>
        </div>
    );
}
