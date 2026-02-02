import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// Debug mode: Log configuration (without exposing full key)
console.log('Supabase Initialization:', {
    url: supabaseUrl,
    keyExists: !!supabaseAnonKey,
    keyLength: supabaseAnonKey?.length,
    timestamp: new Date().toISOString()
});

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase environment variables missing! Check your .env file.', {
        url: supabaseUrl,
        hasKey: !!supabaseAnonKey
    });
    throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    }
});
