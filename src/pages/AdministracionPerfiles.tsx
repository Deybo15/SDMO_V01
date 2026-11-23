import { useEffect, useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { supabase } from '../lib/supabase';

type Profile = 'general' | 'bodega';

type UserProfile = {
    user_id: string;
    email: string;
    profile: Profile;
    is_admin: boolean;
};

const profileLabels = { general: 'General', bodega: 'Bodega' };

export default function AdministracionPerfiles() {
    const [users, setUsers] = useState<UserProfile[] | null>(null);
    const [search, setSearch] = useState('');
    const [drafts, setDrafts] = useState<Partial<Record<string, Profile>>>({});
    const [saving, setSaving] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    useEffect(() => {
        let active = true;
        async function loadUsers() {
            try {
                const { data, error: loadError } = await supabase.rpc('sdmo_list_user_profiles', undefined, { get: true });
                if (loadError) throw loadError;
                if (active) setUsers(data ?? []);
            } catch (cause) {
                if (active) {
                    setError(cause && typeof cause === 'object' && 'code' in cause && cause.code === '42501'
                        ? 'Se requiere permiso de Administrador.'
                        : 'No se pudo cargar la lista de usuarios. Recargá la página para reintentar.');
                }
            }
        }
        void loadUsers();
        return () => { active = false; };
    }, []);

    async function saveProfile(user: UserProfile, profile: Profile) {
        setSaving(user.user_id);
        setError('');
        setNotice('');
        try {
            const { error: saveError } = await supabase.rpc('sdmo_set_user_profile', {
                target_user_id: user.user_id,
                new_profile: profile,
            });
            if (saveError) {
                setError(saveError.message);
                return;
            }
            setUsers(current => current?.map(item => item.user_id === user.user_id ? { ...item, profile } : item) ?? null);
            setNotice(`${user.email} tiene ahora el perfil ${profileLabels[profile]}.`);
        } catch {
            setError('No se pudo confirmar el cambio. Recargá la página para comprobar el perfil actual.');
        } finally {
            setSaving(null);
        }
    }

    const visibleUsers = users?.filter(user => user.email.toLowerCase().includes(search.trim().toLowerCase()));

    return (
        <div className="pb-12 text-[#F5F5F7]">
            <PageHeader title="Administración de perfiles" icon={ShieldCheck} themeColor="neutral" />
            <section className="mx-auto w-full max-w-[1600px] space-y-5 px-4 md:px-8">
                {error && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p>}
                {notice && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</p>}
                {!users && !error && <p role="status" className="text-sm text-[#a1a1aa]">Cargando usuarios autorizados…</p>}
                {visibleUsers && (
                    <>
                        <div className="rounded-xl border border-[#3f3f46] bg-[#111112] p-5 md:p-6">
                            <label htmlFor="profile-search" className="mb-2 block text-[11px] font-black uppercase tracking-wider text-[#a1a1aa]">Buscar por correo</label>
                            <div className="relative max-w-sm">
                                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a1a1aa]" />
                                <input id="profile-search" type="search" value={search} onChange={event => setSearch(event.target.value)}
                                    className="h-11 w-full rounded-lg border border-[#3f3f46] bg-[#18181b] pl-9 pr-3 text-sm text-white outline-none focus:border-[#a1a1aa] [color-scheme:dark]" />
                            </div>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-[#3f3f46] bg-[#111112]">
                            <table className="w-full min-w-[560px] text-left text-sm">
                                <thead className="bg-[#18181b] text-[11px] font-black uppercase tracking-wider text-[#a1a1aa]">
                                    <tr>
                                        <th scope="col" className="p-3">Correo</th>
                                        <th scope="col" className="p-3">Perfil actual</th>
                                        <th scope="col" className="p-3">Cambiar perfil</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleUsers.map(user => {
                                        const selectedProfile = drafts[user.user_id] ?? user.profile;
                                        return (
                                            <tr key={user.user_id} className="border-t border-[#2a2a2d] transition-colors hover:bg-white/[0.03]">
                                                <td className="p-3">{user.email}</td>
                                                <td className="p-3">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="rounded-md border border-[#3f3f46] bg-[#18181b] px-2 py-1 text-xs">{profileLabels[user.profile]}</span>
                                                        {user.is_admin && <span className="text-xs text-[#a1a1aa]">Administrador</span>}
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    {user.is_admin ? '—' : (
                                                        <div className="flex items-center gap-2">
                                                            <select aria-label={`Nuevo perfil de ${user.email}`} value={selectedProfile}
                                                                disabled={saving !== null}
                                                                onChange={event => setDrafts({ ...drafts, [user.user_id]: event.target.value as Profile })}
                                                                className="h-9 min-w-[7rem] rounded-lg border border-[#3f3f46] bg-[#18181b] px-3 text-sm text-white outline-none focus:border-[#a1a1aa] disabled:opacity-60 [color-scheme:dark]">
                                                                <option value="general">General</option>
                                                                <option value="bodega">Bodega</option>
                                                            </select>
                                                            <button type="button" aria-label={`Guardar perfil de ${user.email}`}
                                                                disabled={saving !== null || selectedProfile === user.profile}
                                                                onClick={() => void saveProfile(user, selectedProfile)}
                                                                className="h-9 rounded-lg border border-transparent bg-[#f4f4f5] px-4 text-[10px] font-black uppercase tracking-widest text-[#09090b] transition-colors enabled:hover:bg-white disabled:cursor-not-allowed disabled:border-[#3f3f46] disabled:bg-[#18181b] disabled:text-[#a1a1aa]">
                                                                {saving === user.user_id ? 'Guardando…' : 'Guardar'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {visibleUsers.length === 0 && (
                                        <tr><td colSpan={3} className="p-6 text-center text-[#a1a1aa]">No se encontraron usuarios autorizados.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}
