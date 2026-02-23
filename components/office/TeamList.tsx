'use client';

import { useOfficeStore } from '../../stores/useOfficeStore';
import { motion, AnimatePresence } from 'framer-motion';

export function TeamList() {
    const { peers } = useOfficeStore();
    const peerList = Object.values(peers);

    return (
        <div className="mt-4 space-y-1 px-2">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase px-2 mb-2 tracking-widest">Online Members ({peerList.length + 1})</h4>

            {/* Me */}
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/30 transition-colors group">
                <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-[10px] font-bold text-white uppercase ring-2 ring-primary-500/20">
                        YA
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 bg-emerald-500"></div>
                </div>
                <div className="flex-1 overflow-hidden">
                    <p className="text-xs font-medium truncate">You (Antonio)</p>
                    <p className="text-[10px] text-emerald-500 italic">Exploring the office</p>
                </div>
            </div>

            <AnimatePresence>
                {peerList.map((peer) => (
                    <motion.div
                        key={peer.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/30 transition-colors group overflow-hidden"
                    >
                        <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 uppercase">
                                {peer.full_name?.[0] || peer.email?.[0] || '?'}
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${peer.status === 'online' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-xs font-medium truncate text-slate-300 group-hover:text-slate-100 transition-colors">
                                {peer.full_name || peer.email}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">{peer.status}</p>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
