---
description: Circuito Chiuso Autonomo (Sviluppo, GitHub, Supabase, Validazione Vercel)
---

# Workflow di Sviluppo Autonomo Inarrestabile (Antigravity)

Questo workflow definisce le regole d'ingaggio per l'agente Antigravity nel progetto Cosmoffice. L'obiettivo è minimizzare l'intervento umano: l'utente comunica l'obiettivo, l'agente scrive il codice, aggiorna il database, esegue i push e testa in produzione.

## Fase 1: Comprensione del Task (Pianificazione)
Prima di scrivere codice, l'agente deve:
1. Comprendere l'obiettivo fornito vocalmente o testualmente dall'utente.
2. Identificare i file del frontend/backend da toccare.
3. Stabilire le query SQL, RPC o Policy necessarie su Supabase.

## Fase 2: Sviluppo (Esecuzione)
1. Usa gli strumenti per modificare i file direttamente sul filesystem locale.
2. Se c'è da testare qualcosa nel DB, esegui i comandi per allineare il database remoto tramite `supabase CLI` o l'esecuzione diretta degli script (se autorizzata).

## Fase 3: Deploy Continuo (GitHub -> Vercel)
Per ogni step logico completato, fai il commit e pusha le modifiche per innescare Vercel.

// turbo-all
1. Esegui il commmit di tutte le modifiche:
```bash
git add .
git commit -m "Auto-deploy: Aggiornamento funzionalità Cosmoffice"
git push
```
*(L'annotazione `turbo-all` autorizza l'agente a fare questi comandi senza chiedere continue conferme all'utente, per garantire velocità)*

## Fase 4: Validazione in Produzione (Browser Subagent)
Dopo il push, l'agente DEVE testare sul campo ciò che ha fatto.
1. Utilizza il tool **`browser_subagent`**.
2. Fornisci al subagent il seguente Task: *"Naviga su `https://www.cosmoffice.io`, crea un utente di test o fai login se hai credenziali disponibili. Vai sulla nuova funzionalità e testa che il [nome della feature appena aggiunta] funzioni senza errori. Se qualcosa non va, descrivi esattamente il problema visivo o gli errori nella console."*
3. Gestisci i log di ritorno dal Subagent. Se fallisce, correggi il codice, rifai push (Fase 3) e ritesta (Fase 4).

## Fase 5: Report Visivo
Quando la funzionalità è conclusa e validata dal Subagent in produzione, genera un breve report per l'utente, spiegando i passaggi eseguiti sui 4 fronti (Codice, Supabase, GitHub, Live Validation).
