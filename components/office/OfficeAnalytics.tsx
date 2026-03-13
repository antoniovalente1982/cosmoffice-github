'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Users, Clock, ArrowUpRight } from 'lucide-react';
import { Card } from '../ui/card';

export function OfficeAnalytics() {
    const stats = [
        { label: 'Network Health', value: '98%', icon: TrendingUp, color: 'text-emerald-400' },
        { label: 'Active Peers', value: '12', icon: Users, color: 'text-primary-400' },
        { label: 'Avg Session', value: '4.5h', icon: Clock, color: 'text-purple-400' },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                    <BarChart3 className="w-6 h-6 text-primary-400" />
                    Office Insights
                </h2>
                <div className="px-3 py-1 bg-primary-500/10 border border-primary-500/20 rounded-full text-[10px] font-bold text-primary-400 uppercase tracking-widest">
                    Alpha Preview
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stats.map((stat, i) => (
                    <Card key={i} className="p-4 bg-slate-800/20 border-slate-700/50 hover:bg-slate-800/40 transition-colors">
                        <div className="flex items-start justify-between">
                            <div className={`p-2 rounded-lg bg-slate-800 ${stat.color}`}>
                                <stat.icon className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                                +12% <ArrowUpRight className="w-3 h-3" />
                            </span>
                        </div>
                        <div className="mt-3">
                            <p className="text-2xl font-bold text-slate-100">{stat.value}</p>
                            <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
                        </div>
                    </Card>
                ))}
            </div>

            <Card className="p-6 bg-slate-800/30 border-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-400 mb-6 uppercase tracking-wider">Presence Heatmap (Mock)</h3>
                <div className="h-40 flex items-end gap-2 px-2">
                    {[40, 70, 45, 90, 65, 80, 50, 60, 85, 40, 55, 75].map((h, i) => (
                        <motion.div
                            key={i}
                            initial={{ height: 0 }}
                            animate={{ height: `${h}%` }}
                            transition={{ delay: i * 0.05, duration: 0.8 }}
                            className="flex-1 bg-gradient-to-t from-primary-600/20 to-primary-500/60 rounded-t-sm"
                        />
                    ))}
                </div>
                <div className="mt-4 flex justify-between text-[10px] text-slate-600 font-bold uppercase tracking-widest px-1">
                    <span>9 AM</span>
                    <span>12 PM</span>
                    <span>3 PM</span>
                    <span>6 PM</span>
                </div>
            </Card>
        </div>
    );
}
