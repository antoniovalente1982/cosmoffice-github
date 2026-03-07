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
                setResult(`✅ Completato! Ruoli corretti: ${data.fixed ?? 'N/A'}\n\nRisposta completa: ${JSON.stringify(data, null, 2)}`);
            })
            .catch(err => {
                setResult(`❌ Errore: ${err.message}`);
            });
    }, []);

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-lg w-full">
                <h1 className="text-xl font-bold text-white mb-4">Fix Member Roles</h1>
                <pre className="text-sm text-emerald-300 whitespace-pre-wrap bg-black/30 p-4 rounded-xl border border-white/5">
                    {result}
                </pre>
                <p className="text-xs text-slate-500 mt-4">
                    Questa pagina corregge i ruoli: solo il creatore del workspace rimane Owner.
                    Puoi eliminarla dopo l&apos;uso.
                </p>
            </div>
        </div>
    );
}
