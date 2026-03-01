import React, { useState } from 'react';
import { supabase } from './supabase';
import { motion } from 'motion/react';
import { TrendingUp, LogIn, UserPlus } from 'lucide-react';

export default function Auth() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Mapeamento para usuário/senha admin conforme pedido
        const loginEmail = email === 'admin' ? 'admin@admin.com' : email;
        const loginPassword = password;

        if (email === 'admin' && !isRegistering) {
            // Tenta logar com admin@admin.com se o usuário digitar 'admin'
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: 'admin@admin.com',
                password: loginPassword
            });

            if (signInError) {
                // Se falhar (usuário não existe), tenta criar o admin silenciosamente
                if (signInError.message.includes("Invalid login credentials") || signInError.message.includes("Email not confirmed")) {
                    const { error: signUpError } = await supabase.auth.signUp({
                        email: 'admin@admin.com',
                        password: loginPassword
                    });

                    if (signUpError) {
                        setError(signUpError.message);
                        setLoading(false);
                        return;
                    }
                    // Informa ao usuário para confirmar o e-mail ou que o admin foi criado
                    setError("Usuário administrador criado. Se o Supabase exigir confirmação de e-mail, verifique sua caixa ou use um e-mail real.");
                } else {
                    setError(signInError.message);
                }
            }
        } else {
            const { error } = isRegistering
                ? await supabase.auth.signUp({ email, password })
                : await supabase.auth.signInWithPassword({ email, password });

            if (error) {
                setError(error.message);
            }
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-100"
            >
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-brand-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20 mb-4">
                        <TrendingUp className="w-10 h-10" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">BrownieManager</h1>
                    <p className="text-slate-500 text-center mt-2">
                        {isRegistering ? 'Crie sua conta para gerenciar seus brownies' : 'Acesse seu painel administrativo'}
                    </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="exemplo@email.com"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                        />
                    </div>

                    {error && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-sm text-red-500 font-medium bg-red-50 p-3 rounded-xl border border-red-100"
                        >
                            {error}
                        </motion.p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-brand-500 text-white rounded-2xl font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                {isRegistering ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                                {isRegistering ? 'Criar Conta' : 'Entrar'}
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                    <p className="text-sm text-slate-500">
                        {isRegistering ? 'Já tem uma conta?' : 'Ainda não tem conta?'}
                        <button
                            onClick={() => setIsRegistering(!isRegistering)}
                            className="ml-2 font-bold text-brand-600 hover:text-brand-700 underline"
                        >
                            {isRegistering ? 'Entrar agora' : 'Criar uma agora'}
                        </button>
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
