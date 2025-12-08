import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import SearchModal from '../components/SearchModal';
import {
    Save,
    ArrowLeft,
    FileText,
    Edit,
    CheckCircle,
    AlertTriangle,
    Info,
    X,
    Loader2,
    Search,
    MapPin,
    Table,
    Crosshair
} from 'lucide-react';

// Declare Google Maps types for TypeScript (keeping for legacy/fallback types if needed)
declare global {
    interface Window {
        google: any;
        initMap: () => void;
        gm_authFailure: () => void;
        L: any; // Leaflet
    }
}

// Interfaces
interface CatalogItem {
    id: string | number;
    label: string;
    original?: any;
}

interface Catalogs {
    tipologias: CatalogItem[];
    barrios: CatalogItem[];
    supervisores: CatalogItem[];
    profesionales: CatalogItem[];
    clientesExternos: CatalogItem[];
    clientesInternos: CatalogItem[];
}

interface SearchModalState {
    isOpen: boolean;
    type: keyof Catalogs | null;
    title: string;
}

export default function IngresarSolicitudExterno() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Map State
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const markerInstanceRef = useRef<any>(null);
    const leafletRef = useRef<any>(null);
    const customIconRef = useRef<any>(null);

    // Map Search State
    const [mapSearchQuery, setMapSearchQuery] = useState('');
    const [isSearchingMap, setIsSearchingMap] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        descripcion: '',
        tipologia: '',
        barrio: '',
        direccion: '',
        supervisor: '',
        profesional: '',
        clienteExterno: '',
        clienteInterno: '',
        latitud: null as number | null,
        longitud: null as number | null
    });

    // Catalogs State
    const [catalogs, setCatalogs] = useState<Catalogs>({
        tipologias: [],
        barrios: [],
        supervisores: [],
        profesionales: [],
        clientesExternos: [],
        clientesInternos: []
    });

    // Search Modal State
    const [searchModal, setSearchModal] = useState<SearchModalState>({
        isOpen: false,
        type: null,
        title: ''
    });

    // Notification State
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
    const [locationMessage, setLocationMessage] = useState<{ text: string; type: 'default' | 'success' | 'warning' }>({
        text: 'Ninguna ubicación seleccionada',
        type: 'default'
    });
    const [barrioMessage, setBarrioMessage] = useState<{ text: string; type: 'default' | 'success' | 'warning' | 'loading' }>({
        text: 'El barrio se detectará automáticamente al seleccionar ubicación en el mapa',
        type: 'default'
    });

    // Load Data
    useEffect(() => {
        const loadCatalogs = async () => {
            setLoading(true);
            try {
                const [tipologias, barrios, supervisores, profesionales, clientesExt, clientesInt] = await Promise.all([
                    supabase.from("tipologia_obra").select("id_tipologia_obra, descripcion_tipologia_obra"),
                    supabase.from("barrios_distritos").select("id_barrio, barrio"),
                    supabase.from("colaboradores_06").select("identificacion, alias").eq("supervisor", true).eq("condicion_laboral", false),
                    supabase.from("colaboradores_06").select("identificacion, alias").eq("profesional_responsable", true).eq("condicion_laboral", false),
                    supabase.from("cliente_externo_24").select("id_cliente_externo, nombre_ce"),
                    supabase.from("cliente_interno_15").select("id_cliente, nombre")
                ]);

                const mapData = (data: any[], idKey: string, labelKey: string) =>
                    (data || []).map(item => ({ id: item[idKey], label: item[labelKey], original: item }))
                        .sort((a, b) => a.label.localeCompare(b.label));

                setCatalogs({
                    tipologias: mapData(tipologias.data || [], 'id_tipologia_obra', 'descripcion_tipologia_obra'),
                    barrios: mapData(barrios.data || [], 'id_barrio', 'barrio'),
                    supervisores: mapData(supervisores.data || [], 'identificacion', 'alias'),
                    profesionales: mapData(profesionales.data || [], 'identificacion', 'alias'),
                    clientesExternos: mapData(clientesExt.data || [], 'id_cliente_externo', 'nombre_ce'),
                    clientesInternos: mapData(clientesInt.data || [], 'id_cliente', 'nombre')
                });
            } catch (error) {
                console.error("Unexpected error loading catalogs:", error);
                showNotification("Error al cargar algunos datos de los catálogos", "error");
            } finally {
                setLoading(false);
            }
        };

        loadCatalogs();
    }, []);

    // Initialize Leaflet Map
    useEffect(() => {
        const loadLeaflet = () => {
            if (document.getElementById('leaflet-css')) {
                initLeafletMap();
                return;
            }

            // Load CSS
            const link = document.createElement('link');
            link.id = 'leaflet-css';
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);

            // Load JS
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.async = true;
            script.onload = initLeafletMap;
            document.head.appendChild(script);
        };

        const initLeafletMap = () => {
            if (!mapRef.current || mapInstanceRef.current) return;

            // @ts-ignore
            if (!window.L) return;

            // @ts-ignore
            const L = window.L;
            leafletRef.current = L;

            const map = L.map(mapRef.current).setView([9.9333, -84.077], 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);

            // Custom Icon
            const icon = L.icon({
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });
            customIconRef.current = icon;

            map.on('click', (e: any) => {
                const { lat, lng } = e.latlng;
                handleMapClick(lat, lng);
            });

            mapInstanceRef.current = map;
        };

        loadLeaflet();

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    const handleMapClick = async (lat: number, lng: number) => {
        const L = leafletRef.current;
        const map = mapInstanceRef.current;
        const icon = customIconRef.current;

        if (!L || !map || !icon) return;

        setFormData(prev => ({ ...prev, latitud: lat, longitud: lng }));

        // Update Marker
        if (markerInstanceRef.current) {
            markerInstanceRef.current.remove();
        }

        const newMarker = L.marker([lat, lng], { icon }).addTo(map);
        markerInstanceRef.current = newMarker;

        // Update Messages
        setLocationMessage({
            text: `Ubicación seleccionada: Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`,
            type: 'success'
        });

        // Detect Barrio
        await detectBarrio(lat, lng);
    };

    const handleLocateMe = () => {
        if (!navigator.geolocation) {
            showNotification("Geolocalización no soportada por su navegador", "error");
            return;
        }

        setIsSearchingMap(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;

                if (mapInstanceRef.current) {
                    mapInstanceRef.current.setView([latitude, longitude], 16);
                    handleMapClick(latitude, longitude);
                }
                setIsSearchingMap(false);
            },
            (error) => {
                console.error("Error obtaining location:", error);
                showNotification("No se pudo obtener su ubicación. Verifique los permisos.", "warning");
                setIsSearchingMap(false);
            }
        );
    };

    const handleMapSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mapSearchQuery.trim()) return;

        setIsSearchingMap(true);
        try {
            // Use Nominatim for geocoding, bounded roughly to Costa Rica/San Jose
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearchQuery + ' San Jose Costa Rica')}&limit=1`);
            const data = await response.json();

            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                const latitude = parseFloat(lat);
                const longitude = parseFloat(lon);

                if (mapInstanceRef.current) {
                    mapInstanceRef.current.setView([latitude, longitude], 16);
                    handleMapClick(latitude, longitude);
                }
            } else {
                showNotification("No se encontraron resultados para la búsqueda", "warning");
            }
        } catch (error) {
            console.error("Error searching map:", error);
            showNotification("Error al buscar en el mapa", "error");
        } finally {
            setIsSearchingMap(false);
        }
    };

    // Detect Barrio Logic
    const detectBarrio = async (lat: number, lng: number) => {
        setBarrioMessage({ text: 'Detectando barrio...', type: 'loading' });

        try {
            const url = `https://mapas.msj.go.cr/server/rest/services/SIG_BASE/SIG_SER_Barrios_SJ/MapServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=NOMBRE&returnGeometry=false&f=json`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.features && data.features.length > 0) {
                const nombreBarrio = data.features[0].attributes.NOMBRE;

                // Find in catalog
                const barrioEncontrado = catalogs.barrios.find(b =>
                    b.label.toLowerCase().includes(nombreBarrio.toLowerCase()) ||
                    nombreBarrio.toLowerCase().includes(b.label.toLowerCase())
                );

                if (barrioEncontrado) {
                    setFormData(prev => ({ ...prev, barrio: barrioEncontrado.id.toString() }));
                    setBarrioMessage({ text: `Barrio detectado: ${nombreBarrio}`, type: 'success' });
                    showNotification(`Barrio detectado automáticamente: ${nombreBarrio}`, 'success');
                } else {
                    setBarrioMessage({ text: `Barrio detectado (${nombreBarrio}) no está en la lista. Seleccione manualmente.`, type: 'warning' });
                    showNotification(`Barrio detectado: ${nombreBarrio}, pero no está en la lista.`, 'warning');
                }
            } else {
                setBarrioMessage({ text: 'No se pudo detectar el barrio. Seleccione manualmente.', type: 'warning' });
                showNotification('La ubicación seleccionada no está dentro de los barrios de San José', 'warning');
            }
        } catch (error) {
            console.error('Error detecting barrio:', error);
            setBarrioMessage({ text: 'Error detectando barrio. Seleccione manualmente.', type: 'warning' });
        }
    };

    // Helper Functions
    const showNotification = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    const handleOpenSearch = (type: keyof Catalogs, title: string) => {
        setSearchModal({ isOpen: true, type, title });
    };

    const handleSelectOption = (item: CatalogItem) => {
        if (searchModal.type) {
            const fieldMap: Record<keyof Catalogs, string> = {
                tipologias: 'tipologia',
                barrios: 'barrio',
                supervisores: 'supervisor',
                profesionales: 'profesional',
                clientesExternos: 'clienteExterno',
                clientesInternos: 'clienteInterno'
            };

            setFormData(prev => ({ ...prev, [fieldMap[searchModal.type!]]: item.id }));
            setSearchModal({ isOpen: false, type: null, title: '' });
        }
    };

    const getSelectedLabel = (catalogKey: keyof Catalogs, value: string | number) => {
        const item = catalogs[catalogKey].find(i => i.id == value);
        return item ? item.label : '';
    };

    const getStaticMapUrl = (lat: number, lng: number) => {
        const base = "https://maps.googleapis.com/maps/api/staticmap";
        const params = new URLSearchParams({
            center: `${lat},${lng}`,
            zoom: "17",
            size: "600x400",
            maptype: "roadmap",
            markers: `color:red|${lat},${lng}`,
            key: "AIzaSyAJCP3haDL2PFfD7-opPCVINqFbFxsirlc"
        });
        return `${base}?${params.toString()}`;
    };

    const handleSave = async () => {
        // Validation
        if (!formData.descripcion.trim()) {
            showNotification("La descripción es requerida", "error");
            return;
        }
        if (!formData.tipologia || !formData.barrio || !formData.direccion.trim() || !formData.supervisor || !formData.profesional || !formData.clienteExterno) {
            showNotification("Todos los campos obligatorios deben ser completados", "error");
            return;
        }
        if (!formData.latitud || !formData.longitud) {
            showNotification("Debe seleccionar una ubicación en el mapa", "error");
            return;
        }

        setSaving(true);
        try {
            const staticMapUrl = getStaticMapUrl(formData.latitud, formData.longitud);

            const { data, error } = await supabase
                .from('solicitud_17')
                .insert([{
                    tipo_solicitud: "STE",
                    fecha_solicitud: new Date().toISOString(),
                    descripcion_solicitud: formData.descripcion.trim(),
                    tipologia_trabajo: formData.tipologia,
                    barrio_solicitud: formData.barrio,
                    direccion_exacta: formData.direccion.trim(),
                    latitud: formData.latitud,
                    longitud: formData.longitud,
                    link_ubicacion: `https://www.google.com/maps?q=${formData.latitud},${formData.longitud}`,
                    supervisor_asignado: formData.supervisor,
                    profesional_responsable: formData.profesional,
                    cliente_externo: formData.clienteExterno,
                    cliente_interno: formData.clienteInterno || null,
                    coordenadas: `SRID=4326;POINT(${formData.longitud} ${formData.latitud})`,
                    static_map_url: staticMapUrl,
                    // Nulls for other fields
                    area_mantenimiento: null,
                    instalacion_municipal: null,
                    id_solicitud_sa: null,
                    numero_activo: null,
                    dependencia_municipal: null
                }])
                .select('numero_solicitud')
                .single();

            if (error) throw error;

            showNotification(`Solicitud #${data.numero_solicitud} guardada exitosamente`, 'success');

            // Reset form
            setFormData({
                descripcion: '',
                tipologia: '',
                barrio: '',
                direccion: '',
                supervisor: '',
                profesional: '',
                clienteExterno: '',
                clienteInterno: '',
                latitud: null,
                longitud: null
            });

            // Remove marker from Leaflet map
            if (markerInstanceRef.current) {
                markerInstanceRef.current.remove();
                markerInstanceRef.current = null;
            }

            setLocationMessage({ text: 'Ninguna ubicación seleccionada', type: 'default' });
            setBarrioMessage({ text: 'El barrio se detectará automáticamente al seleccionar ubicación en el mapa', type: 'default' });

        } catch (error: any) {
            console.error("Error saving request:", error);
            showNotification("Error al guardar la solicitud: " + error.message, "error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans p-4 md:p-8 relative overflow-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[20%] left-[20%] w-96 h-96 bg-[#00d4ff]/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-[#00fff0]/10 rounded-full blur-[100px]" />
            </div>

            {/* Notification Toast */}
            {notification && (
                <div className={`fixed top-24 right-6 z-[1100] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-xl animate-in slide-in-from-right duration-300 ${notification.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                    notification.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                        notification.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
                            'bg-blue-500/10 border-blue-500/30 text-blue-400'
                    }`}>
                    {notification.type === 'success' && <CheckCircle className="w-5 h-5" />}
                    {notification.type === 'error' && <AlertTriangle className="w-5 h-5" />}
                    {notification.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
                    {notification.type === 'info' && <Info className="w-5 h-5" />}
                    <span className="font-medium">{notification.message}</span>
                    <button onClick={() => setNotification(null)} className="ml-2 opacity-70 hover:opacity-100">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className="max-w-6xl mx-auto relative z-10">
                {/* Header Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden mb-8 shadow-2xl">
                    <div className="p-6 border-b border-white/10 bg-gradient-to-r from-[#00d4ff]/10 to-[#00fff0]/10 flex items-center justify-center relative">
                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#00d4ff] to-[#00fff0]" />
                        <h2 className="text-2xl font-bold flex items-center gap-3 text-white">
                            <FileText className="w-6 h-6 text-[#00d4ff]" />
                            REGISTRO DE SOLICITUDES EXTERNAS
                        </h2>
                        <button
                            onClick={() => navigate('/cliente-externo')}
                            className="absolute right-6 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
                            title="Regresar"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="p-6 md:p-8">
                        {/* Form Section */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
                            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 border-b border-white/10 pb-3">
                                <Edit className="w-5 h-5 text-[#00d4ff]" />
                                Información de la Solicitud
                            </h3>

                            <div className="space-y-6">
                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Descripción de la solicitud <span className="text-red-400">*</span>
                                    </label>
                                    <textarea
                                        value={formData.descripcion}
                                        onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white focus:border-[#00d4ff] focus:outline-none min-h-[120px]"
                                        placeholder="Describa detalladamente la solicitud..."
                                    />
                                </div>

                                {/* Row 1 */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Tipología */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Tipología de Trabajo <span className="text-red-400">*</span>
                                        </label>
                                        <div className="relative">
                                            <div
                                                onClick={() => handleOpenSearch('tipologias', 'Buscar Tipología de Trabajo')}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white cursor-pointer flex items-center justify-between hover:bg-white/10 transition-all"
                                            >
                                                <span className={formData.tipologia ? 'text-white' : 'text-gray-400'}>
                                                    {getSelectedLabel('tipologias', formData.tipologia) || '-- Seleccione una opción --'}
                                                </span>
                                                <div className="absolute right-0 top-0 bottom-0 px-4 bg-[#00d4ff]/20 hover:bg-[#00d4ff]/30 text-[#00d4ff] rounded-r-lg border-l border-white/10 flex items-center justify-center transition-colors">
                                                    <Search className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Barrio */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Barrio <span className="text-red-400">*</span>
                                        </label>
                                        <div className="relative">
                                            <div
                                                onClick={() => handleOpenSearch('barrios', 'Buscar Barrio')}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white cursor-pointer flex items-center justify-between hover:bg-white/10 transition-all"
                                            >
                                                <span className={formData.barrio ? 'text-white' : 'text-gray-400'}>
                                                    {getSelectedLabel('barrios', formData.barrio) || '-- Seleccione una opción --'}
                                                </span>
                                                <div className="absolute right-0 top-0 bottom-0 px-4 bg-[#00d4ff]/20 hover:bg-[#00d4ff]/30 text-[#00d4ff] rounded-r-lg border-l border-white/10 flex items-center justify-center transition-colors">
                                                    <Search className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`text-xs mt-2 flex items-center gap-1.5 ${barrioMessage.type === 'success' ? 'text-green-400' :
                                            barrioMessage.type === 'warning' ? 'text-yellow-400' :
                                                barrioMessage.type === 'loading' ? 'text-blue-400' :
                                                    'text-slate-400'
                                            }`}>
                                            {barrioMessage.type === 'loading' ? <Loader2 className="w-3 h-3 animate-spin" /> :
                                                barrioMessage.type === 'success' ? <CheckCircle className="w-3 h-3" /> :
                                                    barrioMessage.type === 'warning' ? <AlertTriangle className="w-3 h-3" /> :
                                                        <Info className="w-3 h-3" />}
                                            {barrioMessage.text}
                                        </div>
                                    </div>
                                </div>

                                {/* Dirección Exacta */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Dirección Exacta <span className="text-red-400">*</span>
                                    </label>
                                    <textarea
                                        value={formData.direccion}
                                        onChange={(e) => setFormData(prev => ({ ...prev, direccion: e.target.value }))}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white focus:border-[#00d4ff] focus:outline-none min-h-[80px]"
                                        placeholder="Indique la dirección lo más detallada posible..."
                                    />
                                </div>

                                {/* Row 2 */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Supervisor */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Supervisor Asignado <span className="text-red-400">*</span>
                                        </label>
                                        <div className="relative">
                                            <div
                                                onClick={() => handleOpenSearch('supervisores', 'Buscar Supervisor')}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white cursor-pointer flex items-center justify-between hover:bg-white/10 transition-all"
                                            >
                                                <span className={formData.supervisor ? 'text-white' : 'text-gray-400'}>
                                                    {getSelectedLabel('supervisores', formData.supervisor) || '-- Seleccione una opción --'}
                                                </span>
                                                <div className="absolute right-0 top-0 bottom-0 px-4 bg-[#00d4ff]/20 hover:bg-[#00d4ff]/30 text-[#00d4ff] rounded-r-lg border-l border-white/10 flex items-center justify-center transition-colors">
                                                    <Search className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Profesional */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Profesional Responsable <span className="text-red-400">*</span>
                                        </label>
                                        <div className="relative">
                                            <div
                                                onClick={() => handleOpenSearch('profesionales', 'Buscar Profesional')}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white cursor-pointer flex items-center justify-between hover:bg-white/10 transition-all"
                                            >
                                                <span className={formData.profesional ? 'text-white' : 'text-gray-400'}>
                                                    {getSelectedLabel('profesionales', formData.profesional) || '-- Seleccione una opción --'}
                                                </span>
                                                <div className="absolute right-0 top-0 bottom-0 px-4 bg-[#00d4ff]/20 hover:bg-[#00d4ff]/30 text-[#00d4ff] rounded-r-lg border-l border-white/10 flex items-center justify-center transition-colors">
                                                    <Search className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Row 3 */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Cliente Externo */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Cliente Externo <span className="text-red-400">*</span>
                                        </label>
                                        <div className="relative">
                                            <div
                                                onClick={() => handleOpenSearch('clientesExternos', 'Buscar Cliente Externo')}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white cursor-pointer flex items-center justify-between hover:bg-white/10 transition-all"
                                            >
                                                <span className={formData.clienteExterno ? 'text-white' : 'text-gray-400'}>
                                                    {getSelectedLabel('clientesExternos', formData.clienteExterno) || '-- Seleccione una opción --'}
                                                </span>
                                                <div className="absolute right-0 top-0 bottom-0 px-4 bg-[#00d4ff]/20 hover:bg-[#00d4ff]/30 text-[#00d4ff] rounded-r-lg border-l border-white/10 flex items-center justify-center transition-colors">
                                                    <Search className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Cliente Interno */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Cliente Interno
                                        </label>
                                        <div className="relative">
                                            <div
                                                onClick={() => handleOpenSearch('clientesInternos', 'Buscar Cliente Interno')}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white cursor-pointer flex items-center justify-between hover:bg-white/10 transition-all"
                                            >
                                                <span className={formData.clienteInterno ? 'text-white' : 'text-gray-400'}>
                                                    {getSelectedLabel('clientesInternos', formData.clienteInterno) || '-- Seleccione una opción --'}
                                                </span>
                                                <div className="absolute right-0 top-0 bottom-0 px-4 bg-[#00d4ff]/20 hover:bg-[#00d4ff]/30 text-[#00d4ff] rounded-r-lg border-l border-white/10 flex items-center justify-center transition-colors">
                                                    <Search className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Map */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Ubicación en el Mapa <span className="text-gray-500 font-normal text-xs ml-1">(Haga clic para seleccionar)</span> <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative w-full h-[400px] rounded-xl border border-white/10 shadow-2xl overflow-hidden bg-white/5">
                                        {/* Map Container */}
                                        <div ref={mapRef} className="w-full h-full z-0" />

                                        {/* Map Controls Overlay */}
                                        <div className="absolute top-4 left-4 right-4 z-[1000] flex gap-2">
                                            <form onSubmit={handleMapSearch} className="flex-1 relative">
                                                <input
                                                    type="text"
                                                    value={mapSearchQuery}
                                                    onChange={(e) => setMapSearchQuery(e.target.value)}
                                                    placeholder="Buscar lugar (ej: Parque Central)..."
                                                    className="w-full bg-[#0a0a0a]/90 backdrop-blur-md border border-white/20 text-white rounded-lg pl-10 pr-4 py-2.5 shadow-lg focus:outline-none focus:border-[#00d4ff] transition-all text-sm"
                                                />
                                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                                {isSearchingMap && (
                                                    <div className="absolute right-3 top-2.5">
                                                        <Loader2 className="w-4 h-4 animate-spin text-[#00d4ff]" />
                                                    </div>
                                                )}
                                            </form>
                                            <button
                                                type="button"
                                                onClick={handleLocateMe}
                                                className="bg-[#0a0a0a]/90 backdrop-blur-md border border-white/20 text-white p-2.5 rounded-lg shadow-lg hover:bg-white/10 transition-all"
                                                title="Mi Ubicación"
                                            >
                                                <Crosshair className="w-5 h-5 text-[#00d4ff]" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className={`text-xs mt-2 flex items-center gap-1.5 ${locationMessage.type === 'success' ? 'text-green-400' : 'text-slate-400'}`}>
                                        {locationMessage.type === 'success' ? <MapPin className="w-3 h-3" /> : <Info className="w-3 h-3" />}
                                        {locationMessage.text}
                                    </div>
                                </div>

                                {/* Footer Buttons */}
                                <div className="flex justify-end items-center gap-4 mt-8 pt-6 border-t border-white/10">
                                    <button
                                        onClick={() => navigate('/cliente-externo/seguimiento')}
                                        className="px-6 py-3 bg-transparent border border-[#00d4ff] text-[#00d4ff] font-semibold rounded-xl hover:bg-[#00d4ff] hover:text-black transition-all flex items-center gap-2"
                                    >
                                        <Table className="w-4 h-4" />
                                        Ver Solicitudes
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="px-8 py-3 bg-gradient-to-r from-[#00d4ff] to-[#00fff0] text-black font-bold rounded-xl hover:shadow-[0_0_25px_rgba(0,212,255,0.4)] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                        Guardar Solicitud
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search Modal Component */}
            <SearchModal
                isOpen={searchModal.isOpen}
                onClose={() => setSearchModal({ isOpen: false, type: null, title: '' })}
                title={searchModal.title}
                options={searchModal.type ? catalogs[searchModal.type] : []}
                onSelect={handleSelectOption}
            />
        </div>
    );
}
