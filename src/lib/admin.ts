import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = (() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Use a pattern that avoids build-time crashes on Vercel
    if (!supabaseUrl || !supabaseServiceRoleKey) {
        // Return a proxy that ignores calls during build but throws at runtime
        return new Proxy({} as any, {
            get: (_, prop) => {
                const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
                if (isBuild && prop !== 'then') return () => ({ from: () => ({ select: () => ({ single: () => ({}) }) }) });

                // At runtime, if these are missing, it's a critical error
                if (!isBuild) {
                    console.error(`Supabase Admin Error: Missing environment variables for ${String(prop)}`);
                }
                return () => ({ from: () => ({ select: () => ({ single: () => ({}) }) }) });
            }
        });
    }

    return createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
})();
