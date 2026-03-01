import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('ERRO: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não foram configurados na Vercel!');
    if (typeof window !== 'undefined') {
        alert('Erro de Configuração: As chaves do Supabase não foram encontradas na Vercel. Por favor, adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas configurações do projeto.');
    }
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');
