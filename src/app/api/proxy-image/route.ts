import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const imageUrl = searchParams.get('url');

        if (!imageUrl) {
            return new NextResponse('URL parameter is required', { status: 400 });
        }

        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            console.error(`Failed to fetch image from ${imageUrl}: ${response.statusText}`);
            return new NextResponse('Image not found', { status: 404 });
        }

        const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
        const imageBuffer = await response.arrayBuffer();

        return new NextResponse(imageBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400',
                'Access-Control-Allow-Origin': '*' // Allow cross-origin if needed
            }
        });

    } catch (error: any) {
        console.error('Proxy Image Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
