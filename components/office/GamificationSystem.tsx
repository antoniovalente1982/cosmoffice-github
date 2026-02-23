'use client';

import React from 'react';
import { Trophy, Star, ShieldCheck, Zap, Coffee } from 'lucide-react';
import { Card } from '../ui/card';
import { motion } from 'framer-motion';

export function GamificationSystem() {
    const badges = [
        { id: 1, name: 'Early Bird', detail: 'Started 5 sessions before 9 AM', icon: Zap, color: 'text-yellow-400' },
        { id: 2, name: 'Collaborator', detail: 'Spent 10h in meeting rooms', icon: Star, color: 'text-primary-400' },
        { id: 3, name: 'Safe Hands', detail: 'No security incidents for 30 days', icon: ShieldCheck, color: 'text-emerald-400' },
        { id: 4, name: 'Social Butterfly', detail: 'Interacted with 20+ peers', icon: Coffee, color: 'text-orange-400' },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-yellow-500" />
                    Achievements
                </h2>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Current Level</span>
                    <span className="text-lg font-black text-primary-400">LVL 14</span>
                </div>
            </div>

            <div className="bg-slate-800/30 rounded-2xl p-4 border border-slate-700/50">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-400">Progress to Level 15</span>
                    <span className="text-xs font-mono text-primary-400">850 / 1000 XP</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: '85%' }}
                        className="h-full bg-gradient-to-r from-primary-600 to-purple-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {badges.map((badge, i) => (
                    <Card key={badge.id} className="p-4 bg-slate-800/20 border-slate-700/50 hover:border-primary-500/30 transition-all group">
                        <div className="flex gap-4 items-center">
                            <div className={`p-3 rounded-xl bg-slate-800 ring-1 ring-white/5 group-hover:ring-primary-500/20 transition-all ${badge.color}`}>
                                <badge.icon className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-100 text-sm">{badge.name}</h4>
                                <p className="text-[10px] text-slate-500 leading-tight mt-1">{badge.detail}</p>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
