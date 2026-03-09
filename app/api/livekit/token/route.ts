import { NextRequest, NextResponse } from 'next/server';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { createAdminClient } from '@/utils/supabase/admin';

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
        const { roomName, participantName, participantId, spaceId } = await request.json();

        if (!roomName || !participantName || !participantId) {
            return NextResponse.json(
                { error: 'roomName, participantName, and participantId are required' },
                { status: 400 }
            );
        }

        let metadata = '';

        if (spaceId) {
            const adminClient = createAdminClient();
            const { data: space } = await adminClient.from('spaces').select('workspace_id').eq('id', spaceId).single();
            if (space && process.env.NEXT_PUBLIC_LIVEKIT_URL) {
                const { data: membership } = await adminClient
                    .from('workspace_members')
                    .select('role, invitation_id')
                    .eq('workspace_id', space.workspace_id)
                    .eq('user_id', participantId)
                    .is('removed_at', null)
                    .single();

                if (membership?.role === 'guest' && membership.invitation_id) {
                    const invId = membership.invitation_id;
                    metadata = JSON.stringify({ invitation_id: invId });

                    const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL;
                    const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

                    try {
                        const rooms = await roomService.listRooms();
                        const spacePrefix = `co-${spaceId.substring(0, 8)}`;
                        const spaceRooms = rooms.filter(r => r.name.startsWith(spacePrefix));

                        for (const r of spaceRooms) {
                            const participants = await roomService.listParticipants(r.name);
                            for (const p of participants) {
                                if (p.identity !== participantId && p.metadata) {
                                    try {
                                        const pMeta = JSON.parse(p.metadata);
                                        if (pMeta.invitation_id === invId) {
                                            return NextResponse.json(
                                                { error: 'Posto occupato: un altro dispositivo sta già usando questo invito.' },
                                                { status: 403 }
                                            );
                                        }
                                    } catch (e) { } // Ignore malformed JSON in metadata
                                }
                            }
                        }
                    } catch (lkErr) {
                        console.error('[LiveKit API] Error checking active participants:', lkErr);
                        // Non blocchiamo l'entrata se ci sono problemi di connessione a LiveKit admin API
                    }
                }
            }
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
            metadata: metadata,
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
