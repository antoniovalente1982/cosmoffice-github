import { useEffect, useRef } from 'react';
import { useOfficeStore } from '../stores/useOfficeStore';

export function useSpatialAudio() {
    const { myPosition, myRoomId, peers, isRemoteAudioEnabled } = useOfficeStore();
    const lastPosRef = useRef({ x: 0, y: 0 });
    const lastVolumesRef = useRef<Map<string, number>>(new Map());

    useEffect(() => {
        const calculateVolume = () => {
            // Skip if position hasn't changed significantly (> 3px)
            const dx = Math.abs(myPosition.x - lastPosRef.current.x);
            const dy = Math.abs(myPosition.y - lastPosRef.current.y);
            if (dx < 3 && dy < 3) return;
            lastPosRef.current = { x: myPosition.x, y: myPosition.y };

            Object.values(peers).forEach(peer => {
                // If remote audio is disabled (focus mode), mute all peers
                if (!isRemoteAudioEnabled) {
                    const audioElement = document.getElementById(`audio-${peer.id}`) as HTMLAudioElement;
                    if (audioElement) {
                        audioElement.volume = 0;
                    }
                    return;
                }

                const distance = Math.sqrt(
                    Math.pow(myPosition.x - peer.position.x, 2) +
                    Math.pow(myPosition.y - peer.position.y, 2)
                );

                // Max distance for hearing is 500 units
                const maxDistance = 500;
                let volume = Math.max(0, 1 - distance / maxDistance);

                // Room-based dampening
                // If in different rooms, reduce volume by 70%
                if (myRoomId !== peer.roomId) {
                    volume *= 0.3;
                }

                // Only update DOM if volume actually changed
                const prevVol = lastVolumesRef.current.get(peer.id) ?? -1;
                if (Math.abs(volume - prevVol) > 0.01) {
                    lastVolumesRef.current.set(peer.id, volume);
                    const audioElement = document.getElementById(`audio-${peer.id}`) as HTMLAudioElement;
                    if (audioElement) {
                        audioElement.volume = volume;
                    }
                }
            });
        };

        const interval = setInterval(calculateVolume, 500);
        return () => clearInterval(interval);
    }, [myPosition, myRoomId, peers, isRemoteAudioEnabled]);
}

