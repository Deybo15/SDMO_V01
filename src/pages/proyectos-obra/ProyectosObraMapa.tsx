import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { getProyectosConGeo } from '../../lib/proyectosObraService';
import { ArrowLeft, MapPin, Layers, ExternalLink } from 'lucide-react';

export default function ProyectosObraMapa() {
  const [proyectos, setProyectos] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    cargarProyectos();
  }, []);

  const cargarProyectos = async () => {
    setLoading(true);
    try {
      const data = await getProyectosConGeo();
      setProyectos(data);
    } catch (err) {
      console.error('Error cargando mapa de proyectos:', err);
    } finally {
      setLoading(false);
    }
  };

  // Coordenadas iniciales: San José, Costa Rica
  const centroSanJose: [number, number] = [9.9281, -84.0907];

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] p-4 md:p-8 space-y-6">
      {/* Volver y Header */}
      <div className="space-y-4">
        <Link
          to="/proyectos-obra"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#a1a1aa] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Lista de Proyectos</span>
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#27272a] pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20">
              <MapPin className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white">Mapa Interactivo de Proyectos</h1>
              <p className="text-sm text-[#a1a1aa]">Ubicación geográfica de las obras en San José, Costa Rica</p>
            </div>
          </div>
          <div className="text-xs text-[#a1a1aa] bg-[#18181b] px-4 py-2 rounded-xl border border-[#27272a]">
            Mostrando <strong className="text-white font-mono">{proyectos.length}</strong> proyectos georeferenciados
          </div>
        </div>
      </div>

      {/* Contenedor del Mapa */}
      <div className="bg-[#18181b] p-4 rounded-2xl border border-[#27272a] shadow-2xl overflow-hidden">
        {loading ? (
          <div className="h-[600px] flex flex-col items-center justify-center gap-3 text-white">
            <div className="w-8 h-8 border-4 border-[#0071E3] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[#a1a1aa]">Cargando georeferencias y capas del mapa...</p>
          </div>
        ) : (
          <div className="h-[650px] w-full rounded-xl overflow-hidden relative z-0 border border-[#27272a]">
            <MapContainer
              center={centroSanJose}
              zoom={13}
              scrollWheelZoom={true}
              style={{ height: '100%', width: '100%', backgroundColor: '#18181b' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {proyectos.map((p) => {

                return (
                  <CircleMarker
                    key={p.id}
                    center={[p.lat, p.lng]}
                    radius={12}
                    pathOptions={{
                      color: '#0071E3',
                      fillColor: '#0071E3',
                      fillOpacity: 0.85,
                      weight: 3
                    }}
                  >
                    <Popup className="custom-popup">
                      <div className="p-3 space-y-3 bg-[#18181b] text-white rounded-lg min-w-[220px]">
                        <div className="flex items-center justify-between gap-2 border-b border-[#27272a] pb-2">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#27272a] text-[#a1a1aa]">
                            ID: {p.id}
                          </span>

                        </div>
                        <h4 className="font-bold text-sm text-white leading-snug">{p.nombre_proyecto}</h4>
                        <p className="text-xs text-[#a1a1aa]">{p.dependencia}</p>
                        <div className="pt-2 border-t border-[#27272a] flex justify-end">
                          <Link
                            to={`/proyectos-obra/${p.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0071E3] hover:bg-[#0071E3]/80 text-white rounded-lg text-xs font-semibold transition-all"
                          >
                            <span>Ver Detalle</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        )}
      </div>
    </div>
  );
}
