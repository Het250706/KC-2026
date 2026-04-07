'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
    role: string | null;
    loading: boolean;
    refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    role: null,
    loading: true,
    refresh: async () => { },
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchUser = async (retryCount = 0) => {
        try {
            const { data, error } = await supabase.auth.getUser();

            if (error) {
                // Handle the "Lock broken" / AbortError gracefully
                if (error.name === 'AbortError' || error.message?.includes('Lock broken')) {
                    if (retryCount < 3) {
                        setTimeout(() => fetchUser(retryCount + 1), 500);
                        return;
                    }
                }
                setUser(null);
                setRole(null);
            } else {
                const currentUser = data?.user || null;
                setUser(currentUser);

                if (currentUser) {
                    const { data: roleData } = await supabase
                        .from('user_roles')
                        .select('role')
                        .eq('user_id', currentUser.id)
                        .single();
                    setRole(roleData?.role || null);
                } else {
                    setRole(null);
                }
            }
        } catch (err) {
            console.error('Auth Context Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUser();

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                setLoading(true);
                fetchUser();
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                setRole(null);
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, role, loading, refresh: fetchUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
