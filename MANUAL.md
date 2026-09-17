# Nocturna — Manuale operativo / Operating manual

**Nocturna** — *Chi dorme non sopravvive* / *Who sleeps does not survive*  
Piattaforma originale di deduzione sociale a identità nascoste.

UI: **Italiano / English** (selettore in app).

---

## Italiano

### 0. Dispositivi e rete (requisiti hard)

- **Mobile-first estremo**: telefoni ~360–430px, tablet, laptop piccoli.
- **Mai localhost nel QR**: il link di join usa un **IP LAN** + **porta configurata**. Se vedi solo `127.0.0.1` / `localhost`, il QR non viene emesso (errore esplicito) finché il Host non è in Wi‑Fi o non imposta un override.
- **Porta modificabile**: default `3001`; cambia da Host portatile, `PORT` / `NOCTURNA_PORT`, o `node server/dist/index.js --port …`.

### 1. Accesso

1. **Host — avvio server:**
   - Docker: `docker compose up --build` (opz. `NOCTURNA_PORT=8080`)
   - App portatile Nocturna (imposta porta / override IP se serve)
   - Oppure `npm run build && npm start` / `--port` / `--advertise-host`
2. Sul **telefono** apri l’URL **LAN** dal QR (stessa Wi‑Fi) — non usare l’indirizzo loopback del PC Host.
3. Host: *Crea stanza* → PIN 6 cifre + QR.
4. Giocatori: *Entra* + PIN (o QR). Nessun Node sui telefoni.
5. Sessione in `localStorage` + recovery Socket.io ~2 min.

### 2. Impostazioni Host (lobby)

| Impostazione | Significato |
|--------------|-------------|
| Modalità AUTOMATED / ASSISTED | Narratore server vs Master God-View |
| Aptica | Default nessuna vibrazione; oppure heartbeat universale |
| Audio ambiente | Loop soft in AUTOMATED |
| Visibilità voti / Pareggi | Segreta/palese; nessun rogo o ballottaggio |
| Timer (secondi) | Discussione, tribunale, micro-turno notte, risveglio, spoglio |
| Moltiplicatore ASSISTED | Soft-timer Master = durata × moltiplicatore |
| Ingressi tardivi | Consenti join dopo inizio |
| Ordine di chiamata | Priorità / frequenza / azione / copie / masking |
| Preset JSON | Esporta / importa |
| Lingua | IT / EN |

### 3–7. Gioco

Come prima: hold-to-reveal, notte OLED stealth, risveglio / discussione / tribunale, Master stepper in ASSISTED.

---

## English

### 0. Devices & network (hard requirements)

- **Extreme mobile-first** on ~360–430px phones and up.
- **Never localhost in the QR**: join links use a **LAN IP** + **configured port**. If only loopback exists, QR is withheld with a clear error until Wi‑Fi or an advertise override is set.
- **Configurable port**: default `3001`; change via portable Host UI, `PORT` / `NOCTURNA_PORT`, or `--port`.

### 1. Joining

1. Start Host (Docker / portable app / `npm start` with optional `--advertise-host`).
2. Phones open the **LAN** URL from the QR on the same Wi‑Fi — not the Host PC loopback URL.
3. Host creates room → PIN + QR; players join. No Node on phones.

### 2. Host lobby settings

Mode, haptics, ambient audio, vote visibility, ties, all phase timers (seconds), ASSISTED multiplier, late join, call-order editor, JSON presets, language IT/EN.

### 3–7. Play

Press-and-hold reveal, OLED stealth night, dawn / discussion / tribunal, Master stepper in ASSISTED.
