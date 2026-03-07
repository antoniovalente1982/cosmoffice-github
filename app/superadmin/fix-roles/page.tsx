'use client';

import { useEffect, useState } from 'react';

export default function FixRolesPage() {
    const [result, setResult] = useState<string>('Esecuzione fix_member_roles in corso...');

    useEffect(() => {
        fetch('/api/admin/workspaces', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'fix_member_roles', workspaceId: '', data: {} }),
        })
            .then(r => r.json())
            .then(data => {
                setResult(JSON.stringify(data, null, 2));
            })
            .catch(err => {
                setResult(`❌ Errore: ${err.message}`);
            });
    }, []);

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-2xl w-full">
                <h1 className="text-xl font-bold text-white mb-4">Fix Member Roles — Debug</h1>
                <pre className="text-xs text-emerald-300 whitespace-pre-wrap bg-black/30 p-4 rounded-xl border border-white/5 max-h-[70vh] overflow-auto">
                    {result}
                </pre>
            </div>
        </div>
    );
}
