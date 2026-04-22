# Live Departures – Projektbriefing für Claude Code

## Projektübersicht

**Live Departures** ist eine öffentliche Web-App, die Abfahrtszeiten des öffentlichen Verkehrs anzeigt.

- **URL:** live-departures.app
- **Hosting:** Infomaniak (Shared Hosting, Apache)
- **Stack v1.x:** Reines Frontend – HTML, CSS, JavaScript (kein Backend, keine API-Keys im Code)
- **Versionierung:** v1.5 aktuell in Entwicklung, v2 in Planung

---

## Datenquellen – Entscheidungsprotokoll

### Deutschland

- `v6.db.transport.rest` ist instabil (DB HAFAS API dauerhaft abgeschaltet, sehr niedriges Rate-Limit)
- **Entscheid:** Transitous (`transitous.org`) als Datenquelle für Deutschland
  - Community-betriebener, provider-neutraler Routing-Dienst
  - Basiert auf GTFS/GTFS-RT-Feeds (u.a. DELFI e.V. für Deutschland)
  - Kein API-Key nötig → passt zur aktuellen v1.x-Architektur
  - Kein SLA – Community-Projekt, im UI mit "Daten: Transitous" gekennzeichnet

### Schweiz

- **Primärquelle:** transport.opendata.ch (öffentliche API, kein Key nötig)
  - Stationssuche: `/v1/locations`
  - Abfahrten: `/v1/stationboard`
- **Zukünftig (v2):** opentransportdata.swiss (betrieben von SBB/BAV)
  - Benötigt API-Key (Bearer-Token) → erst in v2
  - API-Key ist bereits vorhanden

---

## Versionsstrategie

### v1.5 (abgeschlossen — 2026-04-19)
- **Deutsche Verkehrsmittel via Transitous** – vollständig implementiert
- Länder-Toggle (🇨🇭/🇩🇪) im Header
- Trinkgeld-Buttons: CHF 1/2/5 für CH, EUR 1/2/5 für DE
- Datenquellenangabe im Footer für DE
- Nominatim-Ländererkennung für Nearby-Modus
- Deduplizierung internationaler Züge aus mehreren GTFS-Feeds
- Liniennamen-Auflösung via `tripShortName` mit Fallback auf `displayName`
- TGV-Formatierung (CH): `"TGV"` in `formatLine` long-list → `"TGV 9215"` statt `"TGV009215"`

### v1.4 (eingefroren)
- Hamburger-Menü / Bottom Sheet
- Stripe-Integration
- Refresh-Balken

### v2 (geplant)
- Direkter Zugriff auf opentransportdata.swiss für CH-Echtzeit
- API-Key serverseitig schützen → Proxy nötig (Cloudflare Workers, PHP-Proxy auf Infomaniak, o.ä. – noch nicht entschieden)
- Eventuell auch DE über DELFI GTFS-RT direkt (statt Transitous)
- Architekturentscheid Proxy-Lösung steht noch offen

---

## Transitous – technische Details (implementiert in v1.5)

### Endpunkte

| Funktion | Endpunkt |
|----------|----------|
| Stationssuche (Autocomplete) | `GET https://api.transitous.org/api/v1/geocode?text={q}&lang=de` |
| Stationen in der Nähe | `GET https://api.transitous.org/api/v1/map/stops?min={lat-d},{lon-d}&max={lat+d},{lon+d}` |
| Abfahrten | `GET https://api.transitous.org/api/v5/stoptimes?stopId={id}&n=20&language=de` |

### Geocode-Response (Stationssuche)
- Gibt ein Array von Objekten zurück
- Felder: `type`, `id`, `name`, `lat`, `lon`, `country`, `modes`
- Filtern auf `type === "STOP" && country === "DE"`
- `id` direkt als `stopId` für `stoptimes` verwendbar

### Map/Stops-Response (Nähe)
- Gibt ein Array von Haltestellen zurück
- Felder: `stopId`, `name`, `lat`, `lon`, `parentId`, `importance`, `modes`
- Nur Top-Level-Haltestellen: Filter auf `!s.parentId`
- Nach `importance` absteigend sortieren, max. 10 nehmen

### Stoptimes-Response (Abfahrten)
**Wichtig:** Zeitfelder sind im `place`-Objekt verschachtelt, nicht auf Top-Level!

```json
{
  "place": {
    "departure": "2026-04-18T11:28:00Z",
    "scheduledDeparture": "2026-04-18T11:28:00Z",
    "scheduledTrack": "3",
    "track": "3"
  },
  "mode": "REGIONAL_RAIL",
  "headsign": "Kiel Hbf",
  "displayName": "RB84 (21066)",
  "routeShortName": "RB84",
  "cancelled": false,
  "tripCancelled": false
}
```

- Zeiten: ISO 8601 UTC-Strings (`"2026-04-18T11:28:00Z"`)
- Verspätung: Differenz `departure` − `scheduledDeparture` in Sekunden
- Gleis: `place.scheduledTrack` / `place.track` – nur bei manchen GTFS-Feeds vorhanden
- `displayName` enthält Zugnummer in Klammern → per Regex `\s*\(\d+\)$` bereinigen
- `tripShortName` enthält bei vielen Zügen den lesbaren Namen inkl. Typ-Präfix (z.B. `"ICE 375"`); bei Regionalzügen aus manchen Feeds jedoch nur eine rohe Fahrt-Nummer (z.B. `"056861"`) → nur verwenden wenn Buchstaben enthalten (`/[A-Za-z]/`)
- `mode`-Werte sind über Feeds inkonsistent: derselbe ICE kann je nach Feed als `HIGHSPEED_RAIL` oder `REGIONAL_RAIL` erscheinen → nicht zur Erkennung des Zugtyps verwenden
- Internationale Züge (z.B. TGV, ICE international) können als Duplikate aus mehreren GTFS-Feeds erscheinen → Deduplizierung nach identischem Abfahrtszeitstempel, Eintrag mit Liniennummer wird bevorzugt
- SNCF-TGV-Servicenummern (z.B. `"651A"`, `"661A"`) enthalten kein `"TGV"`-Präfix im DELFI-Feed – das ist korrekt und wird so angezeigt

### Verkehrsmittel-Mapping

| MOTIS-Mode | Interne Kategorie | Gleis-Label |
|-----------|-------------------|-------------|
| `TRAM` | `"T"` | Kante / Bay |
| `BUS`, `COACH` | `"B"` | Kante / Bay |
| `FERRY` | `"F"` | Anleger / Pier |
| `HIGHSPEED_RAIL`, `LONG_DISTANCE`, `NIGHT_RAIL`, `REGIONAL_RAIL`, `SUBURBAN`, `SUBWAY`, `AERIAL_LIFT`, `FUNICULAR` | `""` → `line.name` | Gleis / Track |

### Gleisinfos – Verfügbarkeit
Abhängig vom GTFS-Feed des jeweiligen Betreibers:
- Berlin Hbf: ✓ (z.B. Gleis 11)
- Hamburg Hbf, Lübeck Hbf: ✗ (kein Gleis in Feed)

---

## Hosting & Infrastruktur

- **Infomaniak Shared Hosting** (Apache) – kein Node.js, kein serverseitiges Rendering in v1.x
- Alle Dateien sind öffentlich: HTML, CSS, JS
- `htacess` auf Server als `.htaccess` ablegen (Punkt-Präfix auf macOS unsichtbar)
- Cloudflare Workers als Proxy-Option für v2 – noch nicht implementiert

---

## Offene Entscheidungen (für v2)

- Welche Proxy-Lösung für den opentransportdata.swiss API-Key?
  - Cloudflare Workers
  - PHP-Script direkt auf Infomaniak
  - Anderes
- Sollen auch für DE in v2 die DELFI GTFS-RT-Feeds direkt genutzt werden?

---

## Trinkgeld / Stripe

Stripe Payment Links, currency-aware:
- **CHF 1/2/5** angezeigt wenn Land = CH
- **EUR 1/2/5** angezeigt wenn Land = DE
- Links als `data-chf` / `data-eur` Attribute auf `.support-btn` gespeichert
- Wird beim Öffnen des Menüs via `openMenu()` aktualisiert
