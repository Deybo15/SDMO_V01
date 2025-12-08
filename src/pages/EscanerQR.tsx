import { useState, useEffect, useRef } from 'react';
// import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'; // Removed to use CDN
import { supabase } from '../lib/supabase';

declare const Html5Qrcode: any;
declare const Html5QrcodeSupportedFormats: any;
import { useNavigate } from 'react-router-dom';
import {
    QrCode,
    Scan,
    Play,
    Square,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    ChevronLeft,
    Loader2,
    RefreshCw
} from 'lucide-react';

interface InventoryItem {
    codigo_articulo: string;
    nombre_articulo: string;
    cantidad_disponible: number;
    unidad: string;
    imagen_url: string | null;
}

export default function EscanerQR() {
    const navigate = useNavigate();
    const [scanning, setScanning] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<InventoryItem | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState('Listo para iniciar...');

    const scannerRef = useRef<any | null>(null);
    const readerId = "qr-reader";

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            if (scannerRef.current && scanning) {
                scannerRef.current.stop().catch(console.error);
            }
        };
    }, [scanning]);

    const startScanning = async () => {
        if (scanning) return;

        try {
            const html5QrCode = new Html5Qrcode(readerId);
            scannerRef.current = html5QrCode;

            setStatus('Solicitando permiso de cámara...');

            await html5QrCode.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0
                },
                (decodedText: string) => {
                    handleScanSuccess(decodedText);
                },
                (_errorMessage: any) => {
                    // ignore errors for better UX
                }
            );

            setScanning(true);
            setStatus('Escaneando...');
            setResult(null);
            setError(null);
        } catch (err) {
            console.error("Error starting scanner:", err);
            setStatus('No se pudo iniciar la cámara.');
            setError('No se pudo acceder a la cámara. Asegúrate de dar permisos.');
        }
    };

    const stopScanning = async () => {
        if (scannerRef.current && scanning) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
                setScanning(false);
                setStatus('Detenido');
            } catch (err) {
                console.error("Error stopping scanner:", err);
            }
        }
    };

    const handleScanSuccess = async (decodedText: string) => {
        await stopScanning();
        setLoading(true);
        setStatus(`Consultando: ${decodedText}`);

        try {
            const { data, error } = await supabase
                .from("inventario_con_datos") // Using the known working view
                .select("codigo_articulo, nombre_articulo, cantidad_disponible, unidad, imagen_url")
                .eq("codigo_articulo", decodedText)
                .single();

            if (error) throw error;

            if (!data) {
                setError(`No se encontró el artículo con código: ${decodedText}`);
                setResult(null);
            } else {
                setResult(data);
                setError(null);
            }
        } catch (err) {
            console.error(err);
            setError(`No se encontró el artículo con código: ${decodedText}`);
            setResult(null);
        } finally {
            setLoading(false);
            setStatus('Consulta finalizada');
        }
    };

    const resetScanner = () => {
        setResult(null);
        setError(null);
        startScanning();
    };

    return (
        <div className="min-h-screen bg-[#0f1419] text-slate-200 font-sans relative p-4 md:p-8">
            {/* Background Effects */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[15%] left-[15%] w-[60rem] h-[60rem] bg-orange-500/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-[20%] right-[15%] w-[60rem] h-[60rem] bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            {/* Header */}
            <div className="sticky top-0 z-50 flex items-center justify-between py-6 mb-8 bg-[#0f1419]/90 backdrop-blur-xl -mx-4 px-4 md:-mx-8 md:px-8 border-b border-white/5 shadow-lg shadow-black/20 transition-all">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center shadow-lg shadow-orange-500/30">
                        <QrCode className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-400">
                            Escáner de Artículos
                        </h1>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/articulos')}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-white/10 rounded-xl transition-all backdrop-blur-sm"
                >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden md:inline">Regresar</span>
                </button>
            </div>

            {/* Main Content */}
            <div className="relative z-10 max-w-5xl mx-auto">
                <div className="bg-slate-800/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                    {/* Card Header */}
                    <div className="p-6 border-b border-white/10 bg-[#0f1419]/50">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-500 text-sm font-medium mb-4">
                            <Scan className="w-4 h-4" />
                            Lector QR/Barcodes
                        </div>
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-400">
                            Escanea código de artículo
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 p-6">
                        {/* Scanner Area */}
                        <div className="lg:col-span-3 space-y-4">
                            <div className={`relative rounded-2xl overflow-hidden bg-black aspect-video border-2 ${scanning ? 'border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.3)]' : 'border-white/10'}`}>
                                <div id={readerId} className="w-full h-full" />
                                {!scanning && !loading && !result && !error && (
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                                        <p>Cámara inactiva</p>
                                    </div>
                                )}
                                <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/80 backdrop-blur border border-white/10 rounded-lg text-xs text-slate-400">
                                    {status}
                                </div>
                            </div>
                        </div>

                        {/* Controls & Results */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Controls */}
                            <div className="p-4 rounded-xl bg-[#0f1419]/30 border border-white/10 flex flex-wrap gap-3">
                                {!scanning ? (
                                    <button
                                        onClick={startScanning}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-500 rounded-xl transition-all font-medium"
                                    >
                                        <Play className="w-4 h-4" />
                                        Iniciar escáner
                                    </button>
                                ) : (
                                    <button
                                        onClick={stopScanning}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 rounded-xl transition-all font-medium"
                                    >
                                        <Square className="w-4 h-4" />
                                        Detener
                                    </button>
                                )}
                            </div>

                            {/* Loading State */}
                            {loading && (
                                <div className="p-6 rounded-xl bg-[#0f1419]/50 border border-white/10 text-center space-y-3 animate-in fade-in zoom-in duration-300">
                                    <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
                                    <h3 className="text-lg font-medium text-white">Consultando inventario...</h3>
                                </div>
                            )}

                            {/* Error State */}
                            {error && (
                                <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/20 text-center space-y-4 animate-in fade-in zoom-in duration-300">
                                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                                        <AlertTriangle className="w-6 h-6 text-red-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-medium text-red-200">Artículo no encontrado</h3>
                                        <p className="text-red-300/70 text-sm mt-1">{error}</p>
                                    </div>
                                    <button
                                        onClick={resetScanner}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 border border-white/10 rounded-lg transition-all text-sm"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Escanear otro código
                                    </button>
                                </div>
                            )}

                            {/* Result State */}
                            {result && (
                                <div className="p-6 rounded-xl bg-green-500/10 border border-green-500/20 space-y-4 animate-in fade-in zoom-in duration-300">
                                    <div className="aspect-square w-full max-w-[200px] mx-auto bg-black/20 rounded-lg overflow-hidden border border-white/10">
                                        <img
                                            src={result.imagen_url || 'https://via.placeholder.com/240x240?text=Sin+Imagen'}
                                            alt={result.nombre_articulo}
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/240x240?text=Sin+Imagen';
                                            }}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="text-xl font-bold text-white leading-tight">
                                            {result.nombre_articulo}
                                        </h3>
                                        <p className="text-slate-400 text-sm font-mono">
                                            Código: {result.codigo_articulo}
                                        </p>
                                    </div>

                                    <div className={`flex items-center gap-3 p-3 rounded-lg border ${result.cantidad_disponible > 0 ? 'bg-green-500/20 border-green-500/30' : 'bg-red-500/20 border-red-500/30'}`}>
                                        {result.cantidad_disponible > 0 ? (
                                            <CheckCircle2 className="w-5 h-5 text-green-400" />
                                        ) : (
                                            <XCircle className="w-5 h-5 text-red-400" />
                                        )}
                                        <div>
                                            <span className="block text-xs text-slate-300 uppercase tracking-wider font-semibold">
                                                Disponible
                                            </span>
                                            <span className="text-lg font-bold text-white">
                                                {result.cantidad_disponible} {result.unidad}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={resetScanner}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 border border-white/10 rounded-lg transition-all text-sm mt-2"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Escanear otro código
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
