import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('players')
            .select('*')
            .eq('status', 'active')
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        return NextResponse.json({ player: data || null });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
