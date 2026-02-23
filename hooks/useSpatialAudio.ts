import { useEffect } from 'react';
import { useOfficeStore } from '@/stores/useOfficeStore';

export function useSpatialAudio() {
    const { myPosition, myRoomId, peers } = useOfficeStore();

    useEffect(() => {
        const calculateVolume = () => {
            Object.values(peers).forEach(peer => {
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

                // Apply volume to the peer's audio element
                const audioElement = document.getElementById(`audio-${peer.id}`) as HTMLAudioElement;
                if (audioElement) {
                    audioElement.volume = volume;
                }
            });
        };

        const interval = setInterval(calculateVolume, 100);
        return () => clearInterval(interval);
    }, [myPosition, myRoomId, peers]);
}
