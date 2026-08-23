# Live Departures Web — Funktions-Parität zu iOS v2.0

**Status: abgeschlossen — Web-App als v2.0 b1 auf live-departures.app deployt (2026-08-16).** Ordner umbenannt/verschoben nach `/Volumes/StoragePlus/Projects/LiveDepartureWeb/v2`. Beta-Builds werden bis zum finalen v2.0 hochgezählt (b2, b3, …). Dieses Dokument bleibt als Referenz für die getroffenen Entscheidungen stehen, ist aber keine offene Aufgabenliste mehr — siehe stattdessen `README.md` → Changelog → „v2.0 b1".

Arbeitskopie von `v1.5`, angelegt am 2026-08-13 als eigenständiger Entwicklungsort.
**Ziel:** Die Web-App (Android-Zielgruppe, PWA) auf den Funktionsstand der nativen iOS-App v2.0 bringen. Kein Rewrite, kein neuer Techstack — bestehende JS/HTML/CSS-Codebasis (`main.js`, `index.html`, `about.html`, `style.css`) wird erweitert.

**Abgrenzung:** Die iOS-App (`/Volumes/StoragePlus/Projects/LiveDepartureApple/`) ist das führende Produkt und bereits live im App Store. Dieses Projekt zieht nach, ersetzt sie nicht. Änderungen hier fliessen nicht automatisch zurück in die iOS-App — beide Codebasen sind unabhängig (Swift vs. JS), Angleichungen passieren jeweils durch bewusstes Nachbauen der Logik, nicht durch Code-Teilen.

---

## Bekannte Lücken gegenüber iOS v2.0 (Stand 2026-08-13, verifiziert gegen `main.js`)

### Tier 1 — echte Funktionslücken

| # | Thema | Web-App-Stand (`v1.5`) | iOS-Stand (Referenz) | Aufwand |
|---|---|---|---|---|
| 1 | **CH-Echtzeit-Genauigkeit (Tram-Icon)** | `main.js:651` nutzt `dep.stop.departure` — den **geplanten** Fahrplanwert | `prognosis.departure ?? stop.departure` — der **erwartete** Wert (`CHTransportService.normalize()`, Build 7) | Klein, chirurgischer Fix |
| 2 | **Zwischenstationen-Sheet + Gleis pro Zwischenhalt** | Existiert nicht | Tap auf Zug/S-Bahn → Sheet mit Folgehalten + Gleis pro Halt (`StopSequenceView`, Build 5/6) | Grösster Brocken — neue UI (Modal/Sheet), neue Fetch-Logik pro Tap (CH) bzw. Trip-Endpoint (DE) |
| 3 | **Live-Tracking-Punkt** (grüner Punkt) | Nicht vorhanden | Bei Zug/S-Bahn, CH implizit über `delay`+`prognosis`, DE über `realTime`-Feld (Build 6) | Mittel — **Nebenbefund:** DE liefert doppelte Trips (`"S14"` echtzeit + `"14"` Fahrplankopie), aktuelle Web-App-Dedup greift dabei nicht — unabhängig vom Live-Punkt behebenswert |
| 4 | **Favoriten-Algorithmus** | Meistgenutzt + 14-Tage-Verfall (`count`/`lastUsed`) | MRU, max. 7 pro Land, unabhängige Pools | **Design-Entscheidung, kein Bug** — vor Umsetzung explizit mit Martin klären, ob angleichen gewünscht ist |
| 5 | **Länderwechsel: Toggle → explizite Auswahl** | `switchCountry()` ist noch der alte binäre Toggle | Einzeln tappbare Flaggen im Menü (Build 7, behebt Fehlbedienung aus Beta-Feedback) | Klein |
| 6 | **Akzentfarbe Orange/Weiss** | Nicht vorhanden | Wählbar im Menü (Build 8) | Mittel — CSS-Durchgang durch die ganze App |

### Tier 2 — Compliance (unabhängig vom Feature-Wunsch fällig)

- **Datenquellen-Attribution fehlt:** `about.html` nennt Transitous ohne den zwingend vorgeschriebenen Link auf `transitous.org/sources` und die OSM/ODbL-Nennung.
- **User-Agent nicht 1:1 übertragbar:** Browser-`fetch()` kann keinen eigenen User-Agent-Header setzen (Browser-Sicherheitsbeschränkung) — anders als in der nativen App (`APIClient.swift`). Nur der sichtbare Attributions-Link ist hier die praktikable Lösung.

### Tier 3 — kosmetisch, niedrige Priorität

- Menü-Reorganisation der iOS-App („Über die App" zuoberst etc.) — strukturell, im Web-Kontext ohnehin anders gelöst, kein Funktionsverlust.

---

## Nächste Schritte

1. ~~Konzept verfeinern (dieses Dokument) — insbesondere Punkt 4 (Favoriten-Algorithmus) entscheiden.~~ Entschieden: iOS-Logik übernommen (reines MRU, 7 pro Land unabhängig).
2. ~~Entwicklungsumgebung hier in `v1.5.1` aufsetzen.~~
3. ~~Umsetzung, priorisiert nach der Tier-Liste oben.~~ Alle Tier-1/2-Punkte umgesetzt, plus Home-Screen-Redesign (siehe README-Changelog).
4. ~~Bei Fertigstellung: Umbenennung/Release als Web-App v2.0.~~ Erledigt — v2.0 b1, Ordner jetzt `LiveDepartureWeb/v2`.
