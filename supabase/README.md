# Supabase — Cosmoffice

## Struttura

```
supabase/
├── functions/        # Edge Functions (deployate su Supabase)
│   ├── manage-member/
│   ├── join-workspace/
│   └── cleanup-presence/
└── README.md         # ← Questo file
```

## Migrazioni

Le **45 migrazioni** sono gestite direttamente su **Supabase Dashboard** (SQL Editor).
Non sono tracciate in questo repository.

La source of truth è il database di produzione (`tcbqsmjmhuebfdijiaag`).

Per lo schema completo, vedere: [`docs/DATABASE_SCHEMA.md`](../docs/DATABASE_SCHEMA.md)

## Edge Functions

Deploy via:
```bash
supabase functions deploy manage-member
supabase functions deploy join-workspace
supabase functions deploy cleanup-presence
```

Per dettagli, vedere: [`docs/EDGE_FUNCTIONS.md`](../docs/EDGE_FUNCTIONS.md)
