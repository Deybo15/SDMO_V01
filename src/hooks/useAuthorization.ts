import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type AuthorizationStatus = 'loading' | 'authorized' | 'unauthorized' | 'no-session';

export function useAuthorization() {
  const [status, setStatus] = useState<AuthorizationStatus>('loading');

  useEffect(() => {
    let active = true;

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!active) return;

        if (!session) {
          setStatus('no-session');
          return;
        }

        const { data: colabs, error } = await supabase
          .from('colaboradores_06')
          .select('autorizado')
          .eq('correo_colaborador', session.user.email)
          .eq('autorizado', true);

        if (!active) return;

        if (error || !colabs || colabs.length === 0) {
          setStatus('unauthorized');
        } else {
          setStatus('authorized');
        }
      } catch (error) {
        console.error('Error checking authorization:', error);
        if (active) setStatus('unauthorized');
      }
    };

    checkAuth();

    return () => {
      active = false;
    };
  }, []);

  return {
    status,
    authorized: status === 'authorized',
    loading: status === 'loading'
  };
}
