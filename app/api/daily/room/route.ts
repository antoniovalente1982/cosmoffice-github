import { NextRequest, NextResponse } from 'next/server';

const DAILY_API_KEY = process.env.DAILY_API_KEY || '';
const DAILY_API_URL = 'https://api.daily.co/v1';

export async function POST(request: NextRequest) {
    if (!DAILY_API_KEY) {
        return NextResponse.json(
            { error: 'Daily.co API key not configured' },
            { status: 500 }
        );
    }

    try {
        const { roomName } = await request.json();

        if (!roomName || typeof roomName !== 'string') {
            return NextResponse.json(
                { error: 'roomName is required' },
                { status: 400 }
            );
        }

        // Sanitize room name for Daily.co (lowercase, alphanumeric + hyphens, max 41 chars)
        const sanitized = roomName
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 41);

        // Try to get existing room first
        const getRes = await fetch(`${DAILY_API_URL}/rooms/${sanitized}`, {
            headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
        });

        if (getRes.ok) {
            const existingRoom = await getRes.json();
            return NextResponse.json({
                url: existingRoom.url,
                name: existingRoom.name,
                created: false,
            });
        }

        // Room doesn't exist — create it
        const createRes = await fetch(`${DAILY_API_URL}/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${DAILY_API_KEY}`,
            },
            body: JSON.stringify({
                name: sanitized,
                properties: {
                    exp: Math.floor(Date.now() / 1000) + 86400,
                    start_audio_off: true,
                    start_video_off: true,
                },
            }),
        });

        if (createRes.ok) {
            const newRoom = await createRes.json();
            console.log('[Daily API] Room created:', newRoom.name);
            return NextResponse.json({
                url: newRoom.url,
                name: newRoom.name,
                created: true,
            });
        }

        // If creation failed because room already exists (race condition), try GET again
        const retryGet = await fetch(`${DAILY_API_URL}/rooms/${sanitized}`, {
            headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
        });

        if (retryGet.ok) {
            const existingRoom = await retryGet.json();
            return NextResponse.json({
                url: existingRoom.url,
                name: existingRoom.name,
                created: false,
            });
        }

        const errorData = await createRes.json().catch(() => ({}));
        console.error('[Daily API] Room creation failed:', errorData);
        return NextResponse.json(
            { error: 'Failed to create Daily.co room', details: errorData },
            { status: createRes.status }
        );
    } catch (err) {
        console.error('[Daily API] Error:', err);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
