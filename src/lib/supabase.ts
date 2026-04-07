import { createBrowserClient } from '@supabase/ssr'

const getSupabaseConfig = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    return { url, key }
}

let clientInstance: any = null

export const supabase = (() => {
    // Safely handle build-time execution where environment variables might be missing
    if (typeof window === 'undefined') {
        const { url, key } = getSupabaseConfig()
        if (!url || !key) {
            // Return a safe proxy during build to avoid crashing Next.js static analysis.
            // This allows the build to evaluate the module without throwing an error immediately.
            return new Proxy({} as any, {
                get: (_, prop) => {
                    if (prop === 'then') return undefined;
                    // Only throw at actual runtime, not during build
                    const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
                    if (!isBuild) {
                        console.error(`Supabase Client Error: Missing environment variables for ${String(prop)}`);
                    }
                    return () => ({ from: () => ({ select: () => ({ single: () => ({}) }) }) });
                }
            })
        }
        return createBrowserClient(url, key)
    }

    if (!clientInstance) {
        const { url, key } = getSupabaseConfig()
        if (!url || !key) {
            throw new Error("Missing Supabase environment variables");
        }
        clientInstance = createBrowserClient(url, key, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false,
                flowType: 'pkce',
            }
        })
    }
    return clientInstance
})()