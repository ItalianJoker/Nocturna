# Nocturna — Manuale operativo / Operating manual

**Nocturna** — *Chi dorme non sopravvive*  
Piattaforma originale di deduzione sociale a identità nascoste.

---

## Italiano

### 0. Dispositivi (requisito soft)

Nocturna è **mobile-first estremo**: lobby, QR join, notte stealth, votazioni e dashboard Master devono funzionare su telefoni stretti (~360–430px), tablet e laptop piccoli — target touch grandi, safe-area, senza scroll orizzontale.

### 1. Accesso

1. **Host — avvio server (scegli una via):**
   - Docker: `docker compose up --build` → http://\<LAN-IP\>:3001  
   - Oppure app portatile Nocturna (Windows `.exe` / Linux AppImage / macOS `.app` nello zip)  
   - Oppure `npm run build && npm start` se hai Node sul PC Host  
2. Apri l’URL della partita sul telefono (stessa rete Wi‑Fi).
3. **Host in browser:** tocca *Crea stanza*, inserisci un nome al tavolo. Annota il **PIN a 6 cifre** e mostra il **QR** agli altri.
4. **Giocatori:** tocca *Entra*, inserisci nome + PIN (oppure scansiona il QR). I giocatori **non** installano Node né l’app Host.
5. La sessione è salvata in `localStorage`: se il telefono va in standby, al rientro si riconnette da solo (fino a ~2 minuti di recovery Socket.io, poi rebind con token).

### 2. Impostazioni Host (lobby)

| Impostazione | Significato |
|--------------|-------------|
| **Narratore automatico (`AUTOMATED`)** | Tutti sono giocatori. Il server guida notti e timer. |
| **Master assistito (`ASSISTED`)** | Un Master (escluso dai ruoli) usa la plancia God-View. |
| **Aptica** | Default: *nessuna vibrazione*. Opzione: *Heartbeat universale* (tutti i telefoni vibrano insieme a ogni micro-turno — nessuno può capire chi è sveglio). |
| **Audio ambiente** | In AUTOMATED, loop soft su tutti i device per mascherare i tocchi. |
| **Voti** | Segreti o palesi; pareggi → nessun rogo oppure ballottaggio. |
| **Ordine di chiamata** | Editor priorità / frequenza / tipo azione / copie / durata masking. |
| **Preset JSON** | Esporta / importa mazzi e settings. |

Avvia con **Distribuisci ruoli** quando il tavolo è completo. Il numero di carte (`count`) deve coprire tutti i non-Master.

### 3. Scoperta del ruolo

Schermata *Tieni premuto*: tieni il dito sullo schermo per vedere fazione e abilità; rilascia per nascondere (anti shoulder-surfing).

### 4. Notte stealth

- Sfondo **OLED nero (`#000000`)** per tutti.
- Chi dorme vede solo *Il villaggio dorme* (basso contrasto).
- Chi è sveglio vede prompt e bersagli con la **stessa luminosità complessiva** — niente flash bianchi.
- In AUTOMATED il micro-turno **non finisce** quando premi Conferma: il server aspetta la durata di masking (anti timing-attack).
- Vibrazioni individuali **non esistono**. Solo l’eventuale heartbeat comune.

### 5. Giorno

1. **Risveglio** — vittime (e protezioni) annunciate; l’Oracolo vede il risultato privato.
2. **Discussione** — timer sincronizzato (`phaseEndsAt`).
3. **Tribunale** — voto eliminazione; gestione pareggi secondo le settings.
4. Fine partita — reveal completo; Host può avviare una **rivincita**.

### 6. Master (ASSISTED)

La dashboard mostra ruoli, vivi/morti/protetti, coda notturna, azioni in pending. Controlli: *Forza avanzamento*, *Pausa*, *Annulla azione*, apertura tribunale.

### 7. Fair-play sensoriale

Non alzare la luminosità in notte. Non usare suonerie o vibrazioni di sistema diverse dal heartbeat. Occhi chiusi al tavolo finché il Master / narratore non chiama il risveglio.

---

## English

### 0. Devices (hard UX requirement)

Nocturna is **extreme mobile-first**: lobby, QR join, stealth night, voting, and Master dashboard must work on narrow phones (~360–430px), tablets, and small laptops — large touch targets, safe-area insets, no horizontal scroll.

### 1. Joining

1. **Host — start the server (pick one):**
   - Docker: `docker compose up --build` → http://\<LAN-IP\>:3001  
   - Or the portable Nocturna Host (Windows `.exe` / Linux AppImage / macOS `.app` zip)  
   - Or `npm run build && npm start` if the Host PC already has Node  
2. Open the match URL on phones (same Wi‑Fi).
3. **Host in browser:** *Create room*, enter a table name. Share the **6-digit PIN** / **QR**.
4. **Players:** *Join* with name + PIN (or scan QR). Players **do not** install Node or the Host app.
5. Session tokens live in `localStorage` for reconnect after lock-screen (Socket.io recovery ~2 minutes, then token rebind).

### 2. Host lobby settings

| Setting | Meaning |
|---------|---------|
| **`AUTOMATED`** | Everyone is a player; server runs nights/timers. |
| **`ASSISTED`** | One Master (no role card) gets God-View controls. |
| **Haptics** | Default: *no vibration*. Optional: *universal heartbeat* on every device when a night micro-turn changes. |
| **Ambient audio** | Soft loop in AUTOMATED to mask taps. |
| **Votes** | Secret or public; ties → no elimination or runoff. |
| **Call order** | Edit priority / frequency / action type / copies / masking duration. |
| **JSON presets** | Export / import decks and settings. |

Tap **Deal roles** when ready. Deck `count` totals must cover all non-Master players.

### 3. Role reveal

Press-and-hold to peek at your identity; release to hide it from neighbours.

### 4. Stealth night

- Pure **OLED black** on every phone.
- Sleepers see *Il villaggio dorme*; actors see low-contrast prompts with **matched luminance**.
- In AUTOMATED, confirming an action does **not** end the micro-turn early (timing-attack defence).
- No per-player vibration — only the optional shared heartbeat.

### 5. Day phases

Dawn announcement → Discussion (synced timer) → Tribunal vote → End reveal / rematch.

### 6. Master (ASSISTED)

Full roster, night stepper, pending actions, force-advance / pause / cancel / open tribunal.

### 7. Sensory fair play

Keep brightness low at night. Do not add custom ringtones or private haptics. Eyes closed at the table until dawn is called.
