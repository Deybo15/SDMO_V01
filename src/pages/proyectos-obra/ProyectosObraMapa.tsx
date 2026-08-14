import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { latLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './ProyectosObraMapa.css';
import { formatProgressPercent, getProyectosConGeo } from '../../lib/proyectosObraService';
import {
  ArrowLeft,
  Calendar,
  Crosshair,
  ExternalLink,
  Focus,
  List,
  MapPin,
  Minus,
  Plus,
  UserRound,
  X
} from 'lucide-react';

interface MapProject {
  id: string | number;
  codigo_meta?: string | null;
  nombre_proyecto: string;
  dependencia?: string | null;
  nombre_responsable?: string;
  estado?: string | null;
  anio?: number | null;
  avance_poa?: number | null;
  lat: number;
  lng: number;
}

const SAN_JOSE_CENTER: [number, number] = [9.9281, -84.0907];

const abbreviateProfessional = (name?: string) => {
  if (!name) return 'Sin responsable';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 4) return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3].charAt(0)}.`;
  return name;
};

const getStatusLabel = (project: MapProject) => {
  const progress = formatProgressPercent(project.avance_poa ?? 0);
  const status = (project.estado || '').toLowerCase();
  if (progress >= 100 || status.includes('finaliz')) return 'Finalizado';
  if (progress > 0 || status.includes('ejecu') || status.includes('activ')) return 'En ejecución';
  return 'Sin iniciar';
};

export default function ProyectosObraMapa() {
  const [proyectos, setProyectos] = useState<MapProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<MapProject | null>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    const loadProjects = async () => {
      setLoading(true);
      try {
        const data = await getProyectosConGeo();
        setProyectos(data as MapProject[]);
      } catch (error) {
        console.error('Error cargando mapa de proyectos:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  const fitProjects = () => {
    if (!mapRef.current || proyectos.length === 0) return;
    const bounds = latLngBounds(proyectos.map((project) => [project.lat, project.lng]));
    mapRef.current.fitBounds(bounds, { padding: [55, 55], maxZoom: 15 });
  };

  const resetView = () => mapRef.current?.setView(SAN_JOSE_CENTER, 13);

  const selectedProgress = selectedProject
    ? formatProgressPercent(selectedProject.avance_poa ?? 0)
    : 0;

  return (
    <div className="min-h-screen bg-black text-[#f4f4f5] p-4 md:p-8 space-y-5 selection:bg-white/20">
      <header className="border-b border-[#27272a] pb-5">
        <Link
          to="/proyectos-obra"
          className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[#a1a1aa] transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver a lista de proyectos</span>
        </Link>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-[#71717a] bg-[#111112] p-3 text-[#e4e4e7]">
              <MapPin className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white md:text-3xl">Mapa interactivo de proyectos</h1>
              <p className="text-sm text-[#a1a1aa]">Ubicación geográfica de las obras en San José, Costa Rica</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-lg border border-[#52525b] bg-[#111112] px-4 py-2.5 text-xs text-[#a1a1aa]">
              <strong className="mr-1 font-mono text-white">{proyectos.length}</strong>
              proyectos georreferenciados
            </div>
            <Link
              to="/proyectos-obra"
              className="inline-flex items-center gap-2 rounded-lg border border-[#52525b] bg-[#111112] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#18181b]"
            >
              <List className="h-4 w-4 text-[#d4d4d8]" />
              Ver lista
            </Link>
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-[#3f3f46] bg-[#111112] p-3">
        {loading ? (
          <div className="flex h-[calc(100vh-235px)] min-h-[560px] flex-col items-center justify-center gap-3 text-white">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d4d4d8] border-t-transparent" />
            <p className="text-sm text-[#a1a1aa]">Cargando georreferencias y capas del mapa...</p>
          </div>
        ) : (
          <div className="project-map relative h-[calc(100vh-235px)] min-h-[560px] w-full overflow-hidden rounded-lg border border-[#71717a] bg-[#d4d4d8]">
            <MapContainer
              ref={mapRef}
              center={SAN_JOSE_CENTER}
              zoom={13}
              zoomControl={false}
              scrollWheelZoom
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {proyectos.map((project) => {
                const isSelected = selectedProject?.id === project.id;
                return (
                  <CircleMarker
                    key={project.id}
                    center={[project.lat, project.lng]}
                    radius={isSelected ? 14 : 9}
                    pathOptions={{
                      color: isSelected ? '#ffffff' : '#111112',
                      fillColor: isSelected ? '#111112' : '#f4f4f5',
                      fillOpacity: 1,
                      weight: isSelected ? 5 : 2
                    }}
                    eventHandlers={{ click: () => setSelectedProject(project) }}
                  >
                    <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                      <span className="text-xs font-semibold">{project.nombre_proyecto}</span>
                    </Tooltip>
                  </CircleMarker>
                );
              })}
            </MapContainer>

            <div className="absolute left-4 top-4 z-[500] flex flex-col gap-2" aria-label="Controles del mapa">
              <button type="button" onClick={() => mapRef.current?.zoomIn()} className="map-control" aria-label="Acercar mapa"><Plus /></button>
              <button type="button" onClick={() => mapRef.current?.zoomOut()} className="map-control" aria-label="Alejar mapa"><Minus /></button>
              <button type="button" onClick={resetView} className="map-control mt-1" aria-label="Centrar mapa en San José"><Crosshair /></button>
              <button type="button" onClick={fitProjects} className="map-control" aria-label="Ajustar mapa a todos los proyectos"><Focus /></button>
            </div>

            <div className="absolute bottom-4 left-4 z-[500] hidden rounded-lg border border-[#52525b] bg-[#111112] p-3 text-xs text-[#d4d4d8] shadow-xl sm:block">
              <div className="flex items-center gap-2"><i className="h-4 w-4 rounded-full border-2 border-[#111112] bg-white" />Proyecto</div>
              <div className="mt-2 flex items-center gap-2"><i className="h-4 w-4 rounded-full border-4 border-white bg-[#111112]" />Seleccionado</div>
            </div>

            {selectedProject ? (
              <aside className="absolute inset-x-4 bottom-4 z-[600] max-h-[calc(100%-32px)] overflow-y-auto rounded-xl border border-[#71717a] bg-[#111112] p-5 shadow-2xl md:inset-auto md:right-4 md:top-4 md:w-[350px]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-[#52525b] bg-[#18181b] px-2.5 py-1 font-mono text-xs font-bold text-white">
                      {selectedProject.codigo_meta || selectedProject.id}
                    </span>
                    <span className="rounded border border-[#52525b] bg-[#18181b] px-2.5 py-1 text-[10px] font-semibold text-[#d4d4d8]">
                      {getStatusLabel(selectedProject)}
                    </span>
                  </div>
                  <button type="button" onClick={() => setSelectedProject(null)} className="text-[#a1a1aa] transition-colors hover:text-white" aria-label="Cerrar detalle del proyecto">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <h2 className="mt-5 text-xl font-semibold leading-snug text-white">{selectedProject.nombre_proyecto}</h2>
                <div className="my-5 border-t border-[#3f3f46]" />

                <div className="space-y-3 text-sm text-[#d4d4d8]">
                  <div className="flex items-center gap-3"><UserRound className="h-4 w-4 text-[#a1a1aa]" /><span>{abbreviateProfessional(selectedProject.nombre_responsable)}</span></div>
                  <div className="flex items-center gap-3"><Calendar className="h-4 w-4 text-[#a1a1aa]" /><span>{selectedProject.anio || 'Año no indicado'}</span></div>
                </div>

                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between text-sm"><span className="text-[#d4d4d8]">Avance POA</span><strong className="font-mono text-white">{selectedProgress}%</strong></div>
                  <div className="h-3 overflow-hidden rounded-[3px] border border-[#a1a1aa] bg-[#18181b]">
                    <div
                      className="h-full border-r border-white"
                      style={{
                        width: `${selectedProgress}%`,
                        backgroundColor: '#27272a',
                        backgroundImage: 'repeating-linear-gradient(135deg, transparent 0, transparent 4px, rgba(255,255,255,0.7) 4px, rgba(255,255,255,0.7) 5px)',
                        boxShadow: 'inset 0 0 0 1px #a1a1aa'
                      }}
                    />
                  </div>
                </div>

                <Link
                  to={`/proyectos-obra/${selectedProject.id}`}
                  className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg border border-[#71717a] bg-[#18181b] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#27272a]"
                >
                  Ver proyecto
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </aside>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
