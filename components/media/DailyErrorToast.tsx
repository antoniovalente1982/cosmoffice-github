'use client';

import { useEffect, useState } from 'react';
import { useOfficeStore } from '../../stores/useOfficeStore';

/**
 * DailyErrorToast — Shows a prominent error notification
 * when Daily.co connection fails.
 * Renders as a fixed overlay at the top of the screen.
 */
export default function DailyErrorToast() {
    const dailyError = useOfficeStore((s) => s.dailyError);
    const clearDailyError = useOfficeStore((s) => s.clearDailyError);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (dailyError) {
            setVisible(true);
        }
    }, [dailyError]);

    const handleDismiss = () => {
        setVisible(false);
        setTimeout(() => clearDailyError(), 300); // Wait for fade-out
    };

    if (!dailyError) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 20,
                left: '50%',
                transform: `translateX(-50%) translateY(${visible ? '0' : '-120%'})`,
                zIndex: 99999,
                maxWidth: 600,
                width: '90vw',
                padding: '16px 24px',
                borderRadius: 14,
                background: 'linear-gradient(135deg, #1a0a0a 0%, #2d0f0f 100%)',
                border: '2px solid #ff4444',
                boxShadow: '0 0 30px rgba(255, 68, 68, 0.4), 0 8px 32px rgba(0, 0, 0, 0.6)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                fontFamily: "'Inter', 'Segoe UI', sans-serif",
            }}
        >
            {/* Error icon */}
            <div
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'rgba(255, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 22,
                }}
            >
                ⚠️
            </div>

            {/* Text content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#ff6b6b',
                        marginBottom: 4,
                        letterSpacing: '0.02em',
                    }}
                >
                    Errore Connessione Daily.co
                </div>
                <div
                    style={{
                        fontSize: 13,
                        color: 'rgba(255, 255, 255, 0.85)',
                        lineHeight: 1.5,
                        wordBreak: 'break-word',
                    }}
                >
                    {dailyError}
                </div>
            </div>

            {/* Dismiss button */}
            <button
                onClick={handleDismiss}
                style={{
                    background: 'rgba(255, 68, 68, 0.15)',
                    border: '1px solid rgba(255, 68, 68, 0.3)',
                    borderRadius: 8,
                    color: '#ff8888',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '6px 14px',
                    flexShrink: 0,
                    transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 68, 68, 0.3)';
                    e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 68, 68, 0.15)';
                    e.currentTarget.style.color = '#ff8888';
                }}
            >
                Chiudi
            </button>
        </div>
    );
}
