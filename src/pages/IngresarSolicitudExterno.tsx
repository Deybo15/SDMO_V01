import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import SearchModal from '../components/SearchModal';
import {
    Save,
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
    Crosshair,
    Briefcase,
    Shield,
    Users,
    Calendar
} from 'lucide-react';
import FormSelect from '../components/FormSelect';
import { PageHeader } from '../components/ui/PageHeader';

// Declare Google Maps types for TypeScript
declare global {
    interface Window {
        google: any;
        initMap: () => void;
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
    const [saving, setSaving] = useState(false);

    // Map State
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const markerInstanceRef = useRef<any>(null);

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

    // Ref to access current catalogs inside stale closures (Map Listeners)
    const catalogsRef = useRef(catalogs);

    // Keep ref updated
    useEffect(() => {
        catalogsRef.current = catalogs;
    }, [catalogs]);

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

                // Auto-fill Profesional Responsable based on logged-in user
                const { data: { user } } = await supabase.auth.getUser();
                const userEmail = user?.email;

                if (userEmail) {
                    const matched = profesionales.data?.find((c: any) =>
                        c.correo_colaborador?.toLowerCase() === userEmail.toLowerCase()
                    );
                    if (matched) {
                        setFormData(prev => ({ ...prev, profesional: matched.identificacion.toString() }));
                    }
                }
            } catch (error) {
                console.error("Unexpected error loading catalogs:", error);
                showNotification("Error al cargar algunos datos de los catálogos", "error");
            } finally {
                // Done
            }
        };

        loadCatalogs();
    }, []);

    // Initialize Google Maps
    useEffect(() => {
        const loadGoogleMaps = () => {
            if (window.google && window.google.maps) {
                initMap();
                return;
            }

            if (document.getElementById('google-maps-script')) {
                return;
            }

            const script = document.createElement('script');
            script.id = 'google-maps-script';
            script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyAJCP3haDL2PFfD7-opPCVINqFbFxsirlc`;
            script.async = true;
            script.defer = true;
            script.onload = () => {
                initMap();
            };
            script.onerror = () => {
                showNotification("Error al cargar Google Maps. Verifique su conexión o la API Key.", "error");
            };
            document.head.appendChild(script);
        };

        const initMap = () => {
            if (!mapRef.current) return;

            // @ts-ignore
            const google = window.google;

            // Initial center (San José, Costa Rica)
            const map = new google.maps.Map(mapRef.current, {
                center: { lat: 9.9333, lng: -84.077 },
                zoom: 13,
                mapTypeId: google.maps.MapTypeId.ROADMAP,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false
            });

            mapInstanceRef.current = map;

            map.addListener('click', (e: any) => {
                const lat = e.latLng.lat();
                const lng = e.latLng.lng();
                handleMapClick(lat, lng);
            });
        };

        loadGoogleMaps();

        return () => {
            // Cleanup if needed? Usually Google Maps sticks around on the window
        };
    }, []);

    const handleMapClick = async (lat: number, lng: number) => {
        // @ts-ignore
        const google = window.google;
        const map = mapInstanceRef.current;

        if (!map || !google) return;

        setFormData(prev => ({ ...prev, latitud: lat, longitud: lng }));

        // Update Marker
        if (markerInstanceRef.current) {
            markerInstanceRef.current.setMap(null);
        }

        const newMarker = new google.maps.Marker({
            position: { lat, lng },
            map: map,
            animation: google.maps.Animation.DROP
        });
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

                if (mapInstanceRef.current && window.google) {
                    // @ts-ignore
                    const google = window.google;
                    const latLng = new google.maps.LatLng(latitude, longitude);
                    mapInstanceRef.current.setCenter(latLng);
                    mapInstanceRef.current.setZoom(16);
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
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearchQuery + ' San Jose Costa Rica')}&limit=1`);
            const data = await response.json();

            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                const latitude = parseFloat(lat);
                const longitude = parseFloat(lon);

                if (mapInstanceRef.current && window.google) {
                    // @ts-ignore
                    const google = window.google;
                    const latLng = new google.maps.LatLng(latitude, longitude);
                    mapInstanceRef.current.setCenter(latLng);
                    mapInstanceRef.current.setZoom(16);
                    // Do NOT auto click, just move there
                    // handleMapClick(latitude, longitude); 
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

    // Detect Barrio Logic (ULTRA ROBUST with Debug)
    const detectBarrio = async (lat: number, lng: number) => {
        setBarrioMessage({ text: 'Detectando barrio...', type: 'loading' });

        try {
            const url = `https://mapas.msj.go.cr/server/rest/services/SIG_BASE/SIG_SER_Barrios_SJ/MapServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=NOMBRE&returnGeometry=false&f=json`;

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();

            if (data.features && data.features.length > 0) {
                const nombreBarrioMapa = data.features[0].attributes.NOMBRE; // e.g., "GONZÁLEZ LAHMANN"

                // 1. Normalization Level 1 (Standard): "GONZÁLEZ LAHMANN" -> "GONZALEZ LAHMANN"
                const normalize = (str: string) =>
                    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                        .toUpperCase()
                        .replace(/\(.*\)/g, "") // Remove identifiers like (UNR)
                        .replace(/[^A-Z0-9 ]/g, " ")
                        .trim();

                // 2. Normalization Level 2 (Slug): "GONZALEZ LAHMANN" -> "GONZALEZLAHMANN"
                const toSlug = (str: string) => normalize(str).replace(/\s+/g, "");

                const normalizedMapa = normalize(nombreBarrioMapa);
                const slugMapa = toSlug(nombreBarrioMapa);
                const tokensMapa = normalizedMapa.split(/\s+/).filter(t => t.length > 2);

                let mejorCoincidencia: CatalogItem | null = null;
                let maxPuntaje = 0;

                // USE REF TO AVOID STALE CLOSURE
                const currentBarrios = catalogsRef.current.barrios;

                if (currentBarrios.length === 0) {
                    console.warn("Catalogs.barrios is empty in detectBarrio!");
                }

                for (const barrio of currentBarrios) {
                    const normalizedCatalogo = normalize(barrio.label);
                    const slugCatalogo = toSlug(barrio.label);

                    let puntajeLocal = 0;

                    // Match Level 1: Exact Slug Match (Ignore spaces/dashes)
                    if (slugCatalogo === slugMapa || slugCatalogo.includes(slugMapa) || slugMapa.includes(slugCatalogo)) {
                        puntajeLocal = 100;
                        // Boost for exact length equality
                        if (slugCatalogo === slugMapa) puntajeLocal += 10;
                    }
                    // Match Level 2: Token Overlap
                    else {
                        const tokensCatalogo = normalizedCatalogo.split(/\s+/).filter(t => t.length > 2);
                        const matches = tokensMapa.filter(tm => tokensCatalogo.includes(tm)).length;
                        if (matches > 0) {
                            puntajeLocal = (matches / tokensMapa.length) * 60;
                        }
                    }

                    if (puntajeLocal > maxPuntaje) {
                        maxPuntaje = puntajeLocal;
                        mejorCoincidencia = barrio;
                    }
                }

                if (mejorCoincidencia && maxPuntaje > 50) { // Threshold
                    setFormData(prev => ({ ...prev, barrio: mejorCoincidencia!.id.toString() }));
                    setBarrioMessage({ text: `Barrio detectado: ${mejorCoincidencia.label}`, type: 'success' });
                    showNotification(`Barrio detectado automáticamente: ${mejorCoincidencia.label}`, 'success');
                } else {
                    // DEBUG INFO IN WARNING
                    console.log('No match found. Map:', nombreBarrioMapa, 'Best:', mejorCoincidencia?.label, 'Score:', maxPuntaje);
                    setBarrioMessage({ text: `Barrio detectado (${nombreBarrioMapa}) no coincide. Seleccione manualmente.`, type: 'warning' });
                    // Show debug info only if score > 0 to imply we tried
                    const debugText = mejorCoincidencia ? ` (Sugerido: ${mejorCoincidencia.label})` : '';
                    showNotification(`Barrio detectado: ${nombreBarrioMapa}${debugText} - No coincide con la lista`, 'warning');
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
                    fecha_solicitud: new Date().toLocaleDateString('en-CA'),
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

            // Automatically create tracking record so it's visible in the dashboard
            await supabase.from('seguimiento_solicitud').insert({
                numero_solicitud: data.numero_solicitud,
                estado_actual: 'ACTIVA'
            });

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

            // Remove marker from Google Map
            if (markerInstanceRef.current) {
                markerInstanceRef.current.setMap(null);
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
        <div className="min-h-screen bg-[#000000] text-[#F5F5F7] font-sans relative flex flex-col selection:bg-[#0071E3]/30 pb-20">
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #333333; border-radius: 3px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #424245; }
            `}</style>

            {/* Notification Toast */}
            {notification && (
                <div className={`fixed top-24 right-8 z-[1100] flex items-center gap-4 px-6 py-4 rounded-[8px] shadow-2xl border backdrop-blur-[20px] animate-in slide-in-from-right duration-300 ${notification.type === 'success' ? 'bg-[#1D1D1F] border-[#0071E3]/50 text-[#0071E3]' :
                    notification.type === 'error' ? 'bg-[#1D1D1F] border-rose-500/30 text-rose-400' :
                        notification.type === 'warning' ? 'bg-[#1D1D1F] border-yellow-500/30 text-yellow-400' :
                            'bg-[#1D1D1F] border-[#333333] text-[#F5F5F7]'
                    }`}>
                    {notification.type === 'success' && <CheckCircle className="w-5 h-5" />}
                    {notification.type === 'error' && <AlertTriangle className="w-5 h-5" />}
                    {notification.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
                    {notification.type === 'info' && <Info className="w-5 h-5" />}
                    <span className="text-[11px] font-black uppercase tracking-widest">{notification.message}</span>
                    <button onClick={() => setNotification(null)} className="ml-2 bg-transparent text-[#86868B] hover:text-[#F5F5F7] transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Header Content */}
            <div className="max-w-7xl mx-auto px-6 pt-6 flex flex-col gap-6 relative z-10">
                <PageHeader
                    title="REGISTRO DE SOLICITUDES EXTERNAS"
                    icon={FileText}
                    backRoute="/cliente-externo"
                />

                {/* Date Display */}
                <div className="flex items-center gap-3 text-[#0071E3] font-black text-[10px] uppercase tracking-[0.2em] bg-[#0071E3]/10 w-fit px-6 py-3 rounded-[8px] border border-[#0071E3]/20 shadow-xl italic">
                    <Calendar className="w-4 h-4" />
                    {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
            </div>

            <div className="max-w-6xl mx-auto relative z-10 px-6 pb-8">
                {/* Content Card */}
                <div className="bg-[#121212] border border-[#333333] rounded-[8px] overflow-hidden shadow-2xl mt-8">

                    <div className="p-12 relative">
                        {/* Section Title */}
                        <div className="relative flex items-center gap-4 mb-12">
                            <div className="w-12 h-12 rounded-[8px] bg-[#0071E3]/10 border border-[#0071E3]/20 flex items-center justify-center text-[#0071E3]">
                                <Edit className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-[#F5F5F7] uppercase italic tracking-tighter">Información de la Solicitud</h3>
                                <p className="text-[10px] font-black text-[#86868B] uppercase tracking-widest mt-1">Complete todos los campos requeridos</p>
                            </div>
                        </div>

                        <div className="space-y-8">
                            {/* Description */}
                            <div className="space-y-4">
                                <label className="block text-[11px] font-black text-[#86868B] uppercase tracking-wider ml-1">
                                    Descripción de la solicitud <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    value={formData.descripcion}
                                    onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                                    className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] py-6 px-6 text-[#F5F5F7] placeholder-[#424245] focus:border-[#0071E3]/50 outline-none min-h-[160px] transition-all duration-300 font-medium text-sm italic"
                                    placeholder="Describa detalladamente la solicitud..."
                                />
                            </div>

                            {/* Row 1 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <FormSelect
                                    label="Tipología de Trabajo"
                                    value={formData.tipologia}
                                    displayValue={getSelectedLabel('tipologias', formData.tipologia)}
                                    onOpenSearch={() => handleOpenSearch('tipologias', 'Buscar Tipología de Trabajo')}
                                    onClear={() => setFormData(prev => ({ ...prev, tipologia: '' }))}
                                    required
                                    icon={Briefcase}
                                />

                                <div className="space-y-2">
                                    <FormSelect
                                        label="Barrio"
                                        value={formData.barrio}
                                        displayValue={getSelectedLabel('barrios', formData.barrio)}
                                        onOpenSearch={() => handleOpenSearch('barrios', 'Buscar Barrio')}
                                        onClear={() => setFormData(prev => ({ ...prev, barrio: '' }))}
                                        required
                                        icon={MapPin}
                                    />
                                    <div className={`text-[10px] font-bold px-4 py-2 rounded-[8px] flex items-center gap-2 transition-all duration-300 ${barrioMessage.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                        barrioMessage.type === 'warning' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                                            barrioMessage.type === 'loading' ? 'bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20' :
                                                'bg-black/20 text-[#86868B] border border-[#333333]'
                                        }`}>
                                        {barrioMessage.type === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                                            barrioMessage.type === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> :
                                                barrioMessage.type === 'warning' ? <AlertTriangle className="w-3.5 h-3.5" /> :
                                                    <Info className="w-3.5 h-3.5" />}
                                        <span className="uppercase tracking-widest">{barrioMessage.text}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Dirección Exacta */}
                            <div className="space-y-4">
                                <label className="block text-[11px] font-black text-[#86868B] uppercase tracking-wider ml-1">
                                    Dirección Exacta <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    value={formData.direccion}
                                    onChange={(e) => setFormData(prev => ({ ...prev, direccion: e.target.value }))}
                                    className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] py-6 px-6 text-[#F5F5F7] placeholder-[#424245] focus:border-[#0071E3]/50 outline-none min-h-[120px] transition-all duration-300 font-medium text-sm italic"
                                    placeholder="Indique la dirección lo más detallada posible..."
                                />
                            </div>

                            {/* Row 2 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <FormSelect
                                    label="Supervisor Asignado"
                                    value={formData.supervisor}
                                    displayValue={getSelectedLabel('supervisores', formData.supervisor)}
                                    onOpenSearch={() => handleOpenSearch('supervisores', 'Buscar Supervisor')}
                                    onClear={() => setFormData(prev => ({ ...prev, supervisor: '' }))}
                                    required
                                    icon={Shield}
                                />

                                <FormSelect
                                    label="Profesional Responsable"
                                    value={formData.profesional}
                                    displayValue={getSelectedLabel('profesionales', formData.profesional)}
                                    onOpenSearch={formData.profesional ? undefined : () => handleOpenSearch('profesionales', 'Buscar Profesional')}
                                    onClear={formData.profesional ? undefined : () => setFormData(prev => ({ ...prev, profesional: '' }))}
                                    required
                                    icon={Users}
                                    locked={!!formData.profesional}
                                />
                            </div>

                            {/* Row 3 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <FormSelect
                                    label="Cliente Externo"
                                    value={formData.clienteExterno}
                                    displayValue={getSelectedLabel('clientesExternos', formData.clienteExterno)}
                                    onOpenSearch={() => handleOpenSearch('clientesExternos', 'Buscar Cliente Externo')}
                                    onClear={() => setFormData(prev => ({ ...prev, clienteExterno: '' }))}
                                    required
                                    icon={Users}
                                />

                                <FormSelect
                                    label="Cliente Interno"
                                    value={formData.clienteInterno}
                                    displayValue={getSelectedLabel('clientesInternos', formData.clienteInterno)}
                                    onOpenSearch={() => handleOpenSearch('clientesInternos', 'Buscar Cliente Interno')}
                                    onClear={() => setFormData(prev => ({ ...prev, clienteInterno: '' }))}
                                    icon={Users}
                                />
                            </div>

                            {/* Map */}
                            <div className="space-y-6">
                                <label className="block text-[11px] font-black text-[#86868B] uppercase tracking-wider ml-1">
                                    Ubicación en el Mapa <span className="text-[#86868B]/40 font-bold text-[9px] ml-2 tracking-normal lowercase">(Haga clic para seleccionar)</span> <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative w-full h-[500px] rounded-[8px] border border-[#333333] shadow-3xl overflow-hidden bg-black group/map">
                                    {/* Map Container */}
                                    <div ref={mapRef} id="map" className="w-full h-full z-0 group-hover:scale-[1.01] transition-transform duration-700" />

                                    {/* Map Controls Overlay */}
                                    <div className="absolute top-8 left-8 right-8 z-[1000] flex gap-4">
                                        <form onSubmit={handleMapSearch} className="flex-1 relative">
                                            <input
                                                type="text"
                                                value={mapSearchQuery}
                                                onChange={(e) => setMapSearchQuery(e.target.value)}
                                                placeholder="Buscar lugar (ej: Parque Central)..."
                                                className="w-full bg-black/80 backdrop-blur-[20px] border border-[#333333] text-[#F5F5F7] rounded-[8px] pl-14 pr-6 py-4 shadow-2xl focus:outline-none focus:border-[#0071E3]/50 transition-all text-sm font-medium italic"
                                            />
                                            <Search className="absolute left-5 top-5 w-5 h-5 text-[#0071E3]" />
                                            {isSearchingMap && (
                                                <div className="absolute right-5 top-5">
                                                    <Loader2 className="w-5 h-5 animate-spin text-[#0071E3]" />
                                                </div>
                                            )}
                                        </form>
                                        <button
                                            type="button"
                                            onClick={handleLocateMe}
                                            className="bg-black/80 backdrop-blur-[20px] border border-[#333333] text-[#0071E3] p-4 rounded-[8px] shadow-2xl hover:bg-[#0071E3]/10 hover:border-[#0071E3]/30 transition-all duration-300 active:scale-95"
                                            title="Mi Ubicación"
                                        >
                                            <Crosshair className="w-7 h-7" />
                                        </button>
                                    </div>

                                    {/* Subtle Overlay */}
                                    <div className="absolute inset-0 bg-black/10 pointer-events-none" />
                                </div>
                                <div className={`text-[10px] font-bold px-4 py-2 rounded-[8px] w-fit flex items-center gap-2 transition-all duration-300 ${locationMessage.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-black/20 text-[#86868B] border border-[#333333]'}`}>
                                    {locationMessage.type === 'success' ? <MapPin className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                                    <span className="uppercase tracking-widest">{locationMessage.text}</span>
                                </div>
                            </div>

                            {/* Footer Buttons */}
                            <div className="flex flex-col md:flex-row justify-end items-center gap-6 mt-16 pt-8 border-t border-[#333333]">
                                <button
                                    onClick={() => navigate('/cliente-externo/seguimiento')}
                                    className="w-full md:w-auto px-10 py-4 bg-transparent border border-[#F5F5F7] text-[#F5F5F7] font-black text-[10px] rounded-[8px] hover:bg-white/5 transition-all duration-300 flex items-center justify-center gap-3 group active:scale-95 uppercase tracking-widest"
                                >
                                    <Table className="w-5 h-5 group-hover:rotate-6 transition-transform" />
                                    Ver Solicitudes
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="w-full md:w-auto px-12 py-4 bg-[#0071E3] text-white font-black text-[10px] rounded-[8px] hover:brightness-110 shadow-2xl shadow-[#0071E3]/20 transition-all duration-300 flex items-center justify-center gap-4 disabled:opacity-20 disabled:cursor-not-allowed group active:scale-95 uppercase tracking-widest"
                                >
                                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />}
                                    Guardar Solicitud
                                </button>
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
        </div>
    );
}
