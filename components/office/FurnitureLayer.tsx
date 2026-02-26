'use client';

import React, { useCallback } from 'react';
import { Group, Rect, Text } from 'react-konva';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { createClient } from '../../utils/supabase/client';

const GRID_SIZE = 20;

function snapToGrid(value: number): number {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

// Emoji icons for furniture types
function getFurnitureEmoji(type: string): string {
    switch (type) {
        case 'desk': return '🖥️';
        case 'chair': return '🪑';
        case 'sofa': return '🛋️';
        case 'plant': return '🌿';
        case 'whiteboard': return '📋';
        case 'monitor': return '🖥️';
        case 'coffee': return '☕';
        case 'bookshelf': return '📚';
        case 'lamp': return '💡';
        case 'table': return '🪑';
        default: return '📦';
    }
}

// Color for furniture types
function getFurnitureColor(type: string): string {
    switch (type) {
        case 'desk': return '#475569';
        case 'chair': return '#64748b';
        case 'sofa': return '#9333ea';
        case 'plant': return '#16a34a';
        case 'whiteboard': return '#e2e8f0';
        case 'monitor': return '#1e293b';
        case 'coffee': return '#92400e';
        case 'bookshelf': return '#854d0e';
        case 'lamp': return '#eab308';
        case 'table': return '#57534e';
        default: return '#475569';
    }
}

interface FurnitureItemProps {
    item: any;
    room: any;
    isBuilderMode: boolean;
}

function FurnitureItemComponent({ item, room, isBuilderMode }: FurnitureItemProps) {
    const supabase = createClient();
    const { updateFurniture } = useOfficeStore();

    const handleDragEnd = useCallback(async (e: any) => {
        if (!isBuilderMode || !room) return;

        // Constrain within room bounds
        let newX = snapToGrid(e.target.x());
        let newY = snapToGrid(e.target.y());

        // Clamp to room
        newX = Math.max(room.x, Math.min(room.x + room.width - item.width, newX));
        newY = Math.max(room.y, Math.min(room.y + room.height - item.height, newY));

        e.target.position({ x: newX, y: newY });
        updateFurniture(item.id, { x: newX, y: newY });

        // Persist
        await supabase
            .from('furniture')
            .update({ x: newX, y: newY })
            .eq('id', item.id);
    }, [isBuilderMode, room, item, supabase, updateFurniture]);

    const emoji = getFurnitureEmoji(item.type);
    const color = getFurnitureColor(item.type);

    return (
        <Group
            x={item.x}
            y={item.y}
            draggable={isBuilderMode}
            onDragEnd={handleDragEnd}
            rotation={item.rotation || 0}
        >
            {/* Furniture shape */}
            <Rect
                width={item.width}
                height={item.height}
                fill={color}
                opacity={0.6}
                cornerRadius={3}
                stroke={isBuilderMode ? '#6366f1' : '#475569'}
                strokeWidth={isBuilderMode ? 1 : 0.5}
            />
            {/* Emoji label */}
            <Text
                text={emoji}
                fontSize={Math.min(item.width, item.height) * 0.6}
                x={0}
                y={0}
                width={item.width}
                height={item.height}
                align="center"
                verticalAlign="middle"
            />
        </Group>
    );
}

export function FurnitureLayer() {
    const { furnitureItems, rooms, isBuilderMode } = useOfficeStore();

    if (furnitureItems.length === 0) return null;

    return (
        <>
            {furnitureItems.map(item => {
                const room = rooms.find(r => r.id === item.room_id);
                return (
                    <FurnitureItemComponent
                        key={item.id}
                        item={item}
                        room={room}
                        isBuilderMode={isBuilderMode}
                    />
                );
            })}
        </>
    );
}
