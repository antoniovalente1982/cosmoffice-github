import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

export async function POST(request: NextRequest) {
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
        return NextResponse.json(
            { error: 'LiveKit API keys not configured' },
            { status: 500 }
        );
    }

    try {
        const { roomName, participantName, participantId } = await request.json();

        if (!roomName || !participantName) {
            return NextResponse.json(
                { error: 'roomName and participantName are required' },
                { status: 400 }
            );
        }

        // Sanitize room name: lowercase, alphanumeric + dashes/underscores only
        const sanitizedRoom = roomName
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 128);

        // Create access token with room permissions
        const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
            identity: participantId || participantName,
            name: participantName,
            // Token expires in 24 hours
            ttl: 24 * 60 * 60,
        });

        // Grant permissions for this specific room
        token.addGrant({
            room: sanitizedRoom,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
            // Room is auto-created when first participant joins
            roomCreate: true,
        });

        const jwt = await token.toJwt();

        return NextResponse.json({
            token: jwt,
            roomName: sanitizedRoom,
        });
    } catch (err) {
        console.error('[LiveKit API] Token error:', err);
        return NextResponse.json(
            { error: 'Failed to generate LiveKit token' },
            { status: 500 }
        );
    }
}
