import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get('id');
    if (!paymentId) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { data: payment, error } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

    if (error || !payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

    const rd = payment.receipt_data || {};
    const amt = Math.abs(payment.amount_cents || 0);
    const amtFmt = (amt / 100).toFixed(2);
    const isRefund = payment.type === 'refund';
    const receiptNum = payment.receipt_number || 'N/A';
    const date = new Date(payment.payment_date || payment.created_at).toLocaleDateString('it-IT');

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <title>Ricevuta ${receiptNum}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: #fff; color: #1a1a2e; padding: 40px; }
        .receipt { max-width: 700px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #0ea5e9; }
        .logo { font-size: 28px; font-weight: 800; background: linear-gradient(135deg, #0ea5e9, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .logo-sub { font-size: 11px; color: #64748b; margin-top: 4px; }
        .receipt-info { text-align: right; }
        .receipt-num { font-size: 22px; font-weight: 700; color: ${isRefund ? '#ef4444' : '#0ea5e9'}; }
        .receipt-type { display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 4px; background: ${isRefund ? '#fef2f2' : '#f0f9ff'}; color: ${isRefund ? '#ef4444' : '#0ea5e9'}; }
        .receipt-date { font-size: 13px; color: #64748b; margin-top: 6px; }
        .section { margin-bottom: 30px; }
        .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; margin-bottom: 10px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .info-box { padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
        .info-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 4px; }
        .info-value { font-size: 14px; font-weight: 600; color: #1e293b; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { text-align: left; padding: 10px 12px; background: #f1f5f9; border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; }
        td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .total-row { background: ${isRefund ? '#fef2f2' : '#f0f9ff'}; }
        .total-row td { font-weight: 700; font-size: 16px; color: ${isRefund ? '#ef4444' : '#0ea5e9'}; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; }
        .footer p { font-size: 11px; color: #94a3b8; margin-bottom: 4px; }
        @media print { body { padding: 20px; } .receipt { max-width: 100%; } }
    </style>
</head>
<body>
    <div class="receipt">
        <div class="header">
            <div>
                <div class="logo">COSMOFFICE</div>
                <div class="logo-sub">Virtual Office Platform</div>
            </div>
            <div class="receipt-info">
                <div class="receipt-num">${receiptNum}</div>
                <div class="receipt-type">${isRefund ? 'Nota di Credito' : 'Ricevuta di Pagamento'}</div>
                <div class="receipt-date">${date}</div>
            </div>
        </div>

        <div class="info-grid section">
            <div class="info-box">
                <div class="info-label">Da</div>
                <div class="info-value">Cosmoffice S.r.l.</div>
            </div>
            <div class="info-box">
                <div class="info-label">A</div>
                <div class="info-value">${rd.company_name || rd.owner_name || payment.owner_name || '—'}</div>
                ${rd.vat_number ? `<div style="font-size:12px;color:#64748b;margin-top:4px">P.IVA: ${rd.vat_number}</div>` : ''}
                ${rd.fiscal_code ? `<div style="font-size:12px;color:#64748b">CF: ${rd.fiscal_code}</div>` : ''}
                ${rd.billing_address ? `<div style="font-size:12px;color:#64748b">${rd.billing_address}, ${rd.billing_zip || ''} ${rd.billing_city || ''}</div>` : ''}
                ${rd.pec ? `<div style="font-size:12px;color:#64748b">PEC: ${rd.pec}</div>` : ''}
                ${rd.sdi_code ? `<div style="font-size:12px;color:#64748b">SDI: ${rd.sdi_code}</div>` : ''}
            </div>
        </div>

        <div class="section">
            <div class="section-title">Dettaglio</div>
            <table>
                <thead>
                    <tr>
                        <th>Descrizione</th>
                        <th>Workspace</th>
                        <th style="text-align:right">Importo</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${payment.description || (isRefund ? 'Rimborso' : 'Pagamento abbonamento')}</td>
                        <td>${payment.workspace_name || '—'}</td>
                        <td style="text-align:right">€${amtFmt}</td>
                    </tr>
                    <tr class="total-row">
                        <td colspan="2"><strong>${isRefund ? 'Totale Rimborso' : 'Totale'}</strong></td>
                        <td style="text-align:right"><strong>${isRefund ? '-' : ''}€${amtFmt}</strong></td>
                    </tr>
                </tbody>
            </table>
        </div>

        ${payment.reference ? `
        <div class="section">
            <div class="section-title">Riferimento Pagamento</div>
            <div class="info-box">
                <div class="info-label">CRO / Riferimento</div>
                <div class="info-value">${payment.reference}</div>
            </div>
        </div>
        ` : ''}

        ${payment.notes ? `
        <div class="section">
            <div class="info-box">
                <div class="info-label">Note</div>
                <div class="info-value" style="font-size:13px;font-weight:400">${payment.notes}</div>
            </div>
        </div>
        ` : ''}

        <div class="footer">
            <p>Documento generato automaticamente da Cosmoffice</p>
            <p>Questo documento non ha valore fiscale</p>
        </div>
    </div>
</body>
</html>`;

    return new NextResponse(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
        },
    });
}
