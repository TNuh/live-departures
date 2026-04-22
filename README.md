# Live Departures — v1.5

A lightweight, PWA-ready real-time departure board for public transport in Switzerland and Germany. No app store, no registration, no tracking — runs entirely in the browser.

**Live:** [live-departures.app](https://live-departures.app)

---

## Features

- **Real-time departures** for Swiss stops (SBB, ZVV, BLS, and all other operators) and German stops (via Transitous / DELFI GTFS)
- **Country toggle** — 🇨🇭 / 🇩🇪 flag button in the title bar switches between Switzerland and Germany; favorites, autocomplete, and nearby all respond to the active country
- **Favorites** — up to 7 stations per country, ranked by usage, stored locally; stale entries (>14 days unused) demoted automatically
- **Nearby** — geolocation-based station discovery (CH: transport.opendata.ch; DE: Transitous map/stops)
- **Other** — autocomplete search for any station in the active country; DE results filtered to `country === "DE"`
- **Language toggle** — DE / EN in hamburger menu, persisted across sessions
- **Time display toggle** — relative (`3'` / `1:05`) or absolute clock time; tram icon shown when departure is under 60 seconds in both modes
- **PWA** — installable on iOS and Android home screen, works standalone
- **Smart status** — slow/retry/fail feedback during API delays
- **Delay indicator** — `!` in red before departure time when delayed
- **Cancellation indicator** — red `✕` before departure time, row struck through and dimmed when trip is cancelled
- **Platform / track display** — toggleable via "Gleis"/"Track" button in header; shows "Gleis" for trains, "Kante"/"Bay" for trams/buses, "Anleger"/"Pier" for ferries
- **Platform change indicator** — when the actual platform differs from the scheduled one, the original is shown struck through and the new platform is shown in red
- **Auto-refresh** — silently reloads departures every 60 seconds; pauses when app is in background, resumes on return; tap the station name chip to refresh immediately
- **Data source label** — "Daten: Transitous" / "Data: Transitous" shown in footer for DE departures

---

## File Structure

```
/
├── index.html          # Main app shell
├── main.js             # All app logic (vanilla JS, no dependencies)
├── style.css           # Dark theme, monospace, orange accent
├── manifest.json       # PWA manifest
├── favicon.ico
├── apple-touch-icon.png
├── icon-192.png
├── icon-512.png
├── about.html          # About page / FAQ (DE + EN, language auto-detected)
├── htacess             # Apache cache/header rules — rename to .htaccess on upload (dot prefix hides file on macOS)
└── install/
    ├── index.html      # Install guide (iOS/Android detection)
    └── install.css
```

---

## APIs

| Country | API | Endpoints used |
|---------|-----|----------------|
| 🇨🇭 CH | [transport.opendata.ch](https://transport.opendata.ch) | `/v1/stationboard`, `/v1/locations` |
| 🇩🇪 DE | [Transitous](https://transitous.org) (MOTIS) | `/api/v1/geocode`, `/api/v1/map/stops`, `/api/v5/stoptimes` |

No API key required for either source.

---

## How It Works

### Modes

- **Favorites** (`btn-fav`) — loads the dropdown with stored favorites filtered by active country; auto-loads the most-used on startup
- **Nearby** (`btn-near`) — uses `navigator.geolocation`; CH queries transport.opendata.ch, DE queries Transitous with a ~1 km bounding box
- **Other** (`btn-other`) — shows an autocomplete input; CH uses `/v1/locations`, DE uses `/api/v1/geocode` filtered to `type === "STOP" && country === "DE"`

### Favorites Storage

Favorites are stored in `localStorage` under key `favourites_v2` as a JSON array:

```json
[{ "name": "Zürich HB", "id": null, "provider": "CH", "count": 5, "lastUsed": 1744123456789 }]
```

- `provider`: `"CH"` or `"DE"` — used to filter the list when the country changes
- `id`: `null` for CH (name-based lookup), GTFS stop ID string for DE (e.g. `"de-DELFI_de:01003:57819"`)

Sorted by recency first, then `count` descending, capped at 7 entries. Entries not used within 14 days are demoted below all recent ones.

### Transitous / DE Data Flow

Departures from Transitous (`/api/v5/stoptimes`) are normalised to the internal format via `normalizeTransitousStopTimes()` before the shared rendering loop runs.

Key mapping details:
- Times live at `dep.place.departure` / `dep.place.scheduledDeparture` (nested inside `place`, not top-level)
- Platform at `dep.place.scheduledTrack` / `dep.place.track` — only present for some GTFS feeds
- Line name resolution (in priority order):
  1. `dep.tripShortName` — used when it contains at least one letter (e.g. `"ICE 375"`, `"RB84"`); pure-digit trip numbers (e.g. `"056861"`) are ignored
  2. `dep.displayName` stripped of trailing trip number in parens (e.g. `"RB84 (21066)"` → `"RB84"`)
  3. `dep.routeShortName` as final fallback
  - Exception: when `displayName` contains `" – "` or `" - "` (route description pattern, e.g. `"Paris – Stuttgart"`), `tripShortName` / `routeShortName` is preferred over it
- Destination: if `headsign` is a pure number (train number rather than city name), `dep.tripTo?.name` is used instead
- Deduplication: when multiple GTFS feeds provide the same trip, duplicate entries sharing an identical departure timestamp are collapsed — the entry with a line number is kept, the numberless one dropped
- Mode mapping: `TRAM → "T"`, `BUS/COACH → "B"`, `FERRY → "F"`, all rail/suburban/subway/aerial → `""` (falls back to line name)
- Delay computed from diff between `departure` and `scheduledDeparture` in seconds
- Note: `mode` values are inconsistent across feeds — the same ICE train may appear as `HIGHSPEED_RAIL` in one feed and `REGIONAL_RAIL` in another; do not rely on mode to infer train type

### Retry Logic

Every fetch has three timers: slow warning (2 s), retry hint (4 s), fail message (8 s). On network error, the app retries once automatically before showing a permanent fail state.

---

## Localization

Two languages supported — German (`de`) and English (`en`) — via a simple `i18n` object in `main.js`. The active language is persisted in `localStorage` under key `lang`. All UI strings are translated, including transport-specific labels (Gleis/Track, Kante/Bay, Anleger/Pier).

---

## PWA / Install

`manifest.json` enables standalone display mode. The `/install/` page detects iOS vs Android and shows platform-specific instructions. Analytics use [GoatCounter](https://www.goatcounter.com/) (privacy-friendly, no cookies).

---

## API Data Availability

| Field | CH trains | CH trams/buses | DE trains | DE buses/trams |
|-------|-----------|----------------|-----------|----------------|
| Departure time | ✓ | ✓ | ✓ | ✓ |
| Delay | ✓ | ✓ | ✓ (realtime feed) | ✓ (where available) |
| Platform / track | ✓ | ✓ at multi-bay stops | Feed-dependent (Berlin Hbf ✓, Hamburg/Lübeck ✗) | Rarely |
| Line name | ✓ | ✓ | ✓ | ✓ |
| Destination | ✓ | ✓ | ✓ | ✓ |

Transitous platform data availability depends on the underlying GTFS feed. Major long-distance stations may include it; regional and local stops typically do not.

---

## Changelog

### v1.5 (current — 2026-04-19)
- **Germany via Transitous** — full DE integration: autocomplete, nearby, and departures via `api.transitous.org`; replaces defunct `v6.db.transport.rest` (DB HAFAS shutdown)
- **Country toggle** — 🇨🇭/🇩🇪 flag button in title area; switches all three modes (Favorites, Nearby, Other) and resets current station
- **Transitous normaliser** — `normalizeTransitousStopTimes()` maps MOTIS response format to internal schema; handles all transport modes including ferry (`"F"` → "Anleger"/"Pier")
- **Line name resolution** — `tripShortName` (when it contains letters) takes priority over `displayName`; route-description display names (e.g. `"Paris – Stuttgart"`) detected and bypassed in favour of the trip short name
- **International train deduplication** — when Transitous returns duplicate entries for the same trip from different GTFS feeds, the entry with a line number is kept and the numberless duplicate dropped (matched by departure timestamp)
- **Headsign disambiguation** — when `headsign` is a pure number (train service number rather than destination city), `tripTo.name` is used as the destination instead
- **Nearby country check** — Nominatim reverse geocoding confirms the detected location is in the expected country before fetching stops; mismatch shown as an inline message
- **Data source label** — "Daten: Transitous" shown in page footer when DE is active
- **Bus line numbers** — fixed: DE bus/tram line numbers now display correctly (were blank due to missing `number` field in normaliser)
- **TGV formatting (CH)** — `"TGV"` added to `formatLine` long-distance list; `"TGV009215"` renders as `"TGV 9215"`
- **Trip number stripped** — Transitous `displayName` e.g. `"RB84 (21066)"` cleaned to `"RB84"` via regex
- **Tip amounts revised** — CHF/EUR 1/2/5 (previously CHF 2/5/10)
- **Currency-aware tips** — support buttons show CHF for 🇨🇭, EUR for 🇩🇪; swapped on menu open via `data-chf`/`data-eur` attributes
- **Header rebalanced** — flag button moved out of `.title-left` to become a direct flex sibling; title now truly centred between hamburger and flag regardless of flag size
- **Underline width** — title underline now matches text width via `inline-flex` inner wrapper (`.title-inner`); reduced to 1 px
- **Flag enlarged** — country toggle `font-size` increased from `1.4rem` to `1.8rem`

### v1.4 (frozen)
- Hamburger menu / bottom sheet
- Stripe tip integration
- Refresh bar animation

### v1.3 (frozen — 2026-04-11)
- Code cleanup — removed dead functions and legacy DE stubs
- Global country flag in title area
- Separate favorites per country
- HTTP error handling (`res.ok` checks)
- Cancellation and platform change indicators
- Install guide redesign
- htaccess caching policy

### v1.2
- Hours:minutes format for long waits
- Delay indicator
- Platform / track display
- Auto-refresh
- Favorites decay (14-day recency)

### v1.1.2
- Smart status system (slow / retry / fail timers)
- Automatic single retry on network error
- Tram icon for imminent departures (< 60 s)
- Country preference persisted

---

## Analytics

A single GoatCounter script tag (`gc.zgo.at/count.js`) is included for page view counting. No cookies, no fingerprinting, GDPR-compliant.
