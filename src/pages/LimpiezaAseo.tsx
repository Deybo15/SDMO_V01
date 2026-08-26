import { Sparkles } from 'lucide-react';
import { SolicitudArticulosPage } from '../components/SolicitudArticulosPage';

export default function LimpiezaAseo() {
    return <SolicitudArticulosPage title="Artículos de Limpieza y Aseo" icon={Sparkles} tipoSalidaId="LIM" defaultDescription="Solicitud de Limpieza y Aseo" commentsPlaceholder="Detalles adicionales sobre este pedido de limpieza..." itemsDescription="Seleccione los artículos de limpieza que se entregarán." />;
}
