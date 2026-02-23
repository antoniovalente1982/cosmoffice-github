'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useOfficeStore } from '@/stores/useOfficeStore';
import { usePresence } from '@/hooks/usePresence';
import { UserAvatar } from './UserAvatar';

export function SpatialOffice() {
    const { myPosition, setMyPosition, peers, zoom } = useOfficeStore();
    const containerRef = useRef<HTMLDivElement>(null);
    const officeSize = { width: 2000, height: 2000 };

    // Initialize presence
    usePresence();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const step = 20;
            const newPos = { ...myPosition };

            switch (e.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    newPos.y = Math.max(0, newPos.y - step);
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    newPos.y = Math.min(officeSize.height, newPos.y + step);
                    break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    newPos.x = Math.max(0, newPos.x - step);
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    newPos.x = Math.min(officeSize.width, newPos.x + step);
                    break;
            }

            if (newPos.x !== myPosition.x || newPos.y !== myPosition.y) {
                setMyPosition(newPos);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [myPosition, setMyPosition, officeSize.height, officeSize.width]);

    // Center view on me
    useEffect(() => {
        if (containerRef.current) {
            const { clientWidth, clientHeight } = containerRef.current;
            containerRef.current.scrollTo({
                left: myPosition.x - clientWidth / 2,
                top: myPosition.y - clientHeight / 2,
                behavior: 'smooth'
            });
        }
    }, [myPosition]);

    return (
        <div
            ref={containerRef}
            className="w-full h-full overflow-hidden bg-dark-bg relative cursor-crosshair select-none"
        >
            <motion.div
                animate={{ scale: zoom }}
                transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                className="relative"
                style={{
                    width: officeSize.width,
                    height: officeSize.height,
                }}
            >
                {/* Background Grid */}
                <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />

                {/* Static Elements (Office furniture would go here) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-64 border border-slate-700/50 rounded-2xl flex items-center justify-center bg-slate-800/20 backdrop-blur-sm">
                    <span className="text-slate-600 font-medium">Conference Room A</span>
                </div>

                {/* My Avatar */}
                <UserAvatar
                    id="me"
                    fullName="You"
                    position={myPosition}
                    status="online"
                    isMe={true}
                />

                {/* Peers Avatars */}
                {Object.values(peers).map((peer) => (
                    <UserAvatar
                        key={peer.id}
                        id={peer.id}
                        fullName={peer.full_name || peer.email}
                        position={peer.position}
                        status={peer.status}
                    />
                ))}
            </motion.div>

            {/* HUD Info */}
            <div className="absolute bottom-6 left-6 z-40 bg-slate-900/60 backdrop-blur text-xs px-3 py-2 rounded-lg border border-slate-700/50 text-slate-400">
                Use WASD or Arrows to move • Position: {Math.round(myPosition.x)}, {Math.round(myPosition.y)}
            </div>

            {/* Zoom Controls */}
            <div className="absolute top-6 left-6 z-40 flex flex-col gap-2">
                <button
                    onClick={() => useOfficeStore.getState().setZoom(Math.min(2, zoom + 0.1))}
                    className="w-10 h-10 bg-slate-900/60 backdrop-blur rounded-lg border border-slate-700/50 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                >
                    +
                </button>
                <button
                    onClick={() => useOfficeStore.getState().setZoom(Math.max(0.5, zoom - 0.1))}
                    className="w-10 h-10 bg-slate-900/60 backdrop-blur rounded-lg border border-slate-700/50 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                >
                    -
                </button>
            </div>
        </div>
    );
}
