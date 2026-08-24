# Live Departures

A lightweight, PWA-ready real-time departure board for public transport in Switzerland and Germany. No app store, no registration, no tracking — runs entirely in the browser.

**Live:** [live-departures.app](https://live-departures.app) — running **v2.0 b1** since 2026-08-16 · **Source:** [github.com/TNuh/live-departures](https://github.com/TNuh/live-departures)

---

## Features

- **Real-time departures** for Swiss stops (SBB, ZVV, BLS, and all other operators) and German stops (via Transitous / DELFI GTFS)
- **Favorites home screen** — the app opens directly into a list of your favorite stations (no dropdown); tap to open the departure board, tap `✕` to delete an entry, "‹ Favorites" returns to the list. Shows a Welcome empty state with feature highlights when there are no favorites yet
- **Country selection** — chosen from the hamburger menu under "Land"/"Country"; the active country is shown as a flag next to the title. Favorites, search, and nearby all respond to it
- **Favorites storage** — up to 7 stations per country (independent pools), ranked purely by most-recently-used; mixed German stations (rail + local transit at the same stop) are auto-detected and split into a primary row plus an indented "↳ Nahverkehr"/"Local transit" sub-row, each with its own filtered fetch
- **Nearby** — paper-plane icon in the toolbar opens a sheet with geolocation-based station discovery (CH: transport.opendata.ch; DE: Transitous map/stops); Nominatim reverse geocoding confirms the detected location matches the active country first
- **Search** — magnifying-glass icon in the toolbar opens a sheet with autocomplete search for any station in the active country; DE results filtered to `country === "DE"`
- **Intermediate stops** — tapping a train/S-Bahn row opens a sheet with all subsequent stops and times; tapping a stop reveals its platform where available (CH: lazy per-stop lookup against the stationboard/arrival board; DE: already included in the trip response, just hidden until tapped)
- **Live-tracking indicator** — a pulsing green dot marks train/S-Bahn rows with real-time data (CH: presence of a delay + prognosis; DE: the `realTime` field)
- **Accent color** — orange or white, chosen in the menu, applied app-wide via CSS custom properties (`--accent-rgb` / `--accent-dim-rgb`)
- **Language toggle** — DE / EN in hamburger menu, persisted across sessions
- **Time display toggle** — relative (`3'` / `1:05`) or absolute clock time; tram icon shown when departure is under 60 seconds in both modes
- **PWA** — installable on iOS and Android home screen, works standalone
- **Smart status** — slow/retry/fail feedback during API delays on the departure board
- **Delay indicator** — `!` in red before departure time when delayed
- **Cancellation indicator** — red `✕` before departure time, row struck through and dimmed when trip is cancelled
- **Platform / track display** — toggleable via "Gleis"/"Track" button in header; shows "Gleis" for trains, "Kante"/"Bay" for trams/buses, "Anleger"/"Pier" for ferries
- **Platform change indicator** — when the actual platform differs from the scheduled one, the original is shown struck through and the new platform is shown in red
- **Auto-refresh** — silently reloads departures every 60 seconds while the board view is open; pauses when app is in background, resumes on return; tap the station name chip to refresh immediately
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
├── version.json        # { "v": "…" } — polled by main.js's self-update check, see Changelog
├── htaccess            # Apache cache/header rules — rename to .htaccess on upload (dot prefix hides the file in Finder). Get the spelling exactly right: h-t-a-c-c-e-s-s (double c) — a near-miss like ".htacess" is silently ignored by Apache with no error, and every response comes back without the intended Cache-Control headers.
└── install/
    ├── index.html      # Install guide (iOS/Android detection)
    └── install.css
```

**Bumping the version string touches more places than it looks like** — grep for the current version string before assuming you've caught them all: `index.html` (top comment, footer, menu, the `VERSION` const for the feedback-mailto subject, and the `?v=` query string on the `main.js`/`style.css` tags), `main.js` (top comment and the `APP_VERSION` const), `style.css` (top comment), `about.html` (both copyright lines and its own `style.css?v=` query string), and `version.json`. **`version.json` and `main.js`'s `APP_VERSION` must match exactly after every deploy** — see the self-update mechanism in the Changelog for why a mismatch there isn't just cosmetic.

---

## APIs

| Country | API | Endpoints used |
|---------|-----|----------------|
| 🇨🇭 CH | [transport.opendata.ch](https://transport.opendata.ch) | `/v1/stationboard` (departures, and re-queried with `datetime`/`type=arrival` for per-stop platform lookups in the intermediate-stops sheet), `/v1/locations` |
| 🇩🇪 DE | [Transitous](https://transitous.org) (MOTIS) | `/api/v1/geocode`, `/api/v1/map/stops`, `/api/v5/stoptimes`, `/api/v5/trip` (intermediate stops + platform for the stops sheet) |

Both countries also call [Nominatim](https://nominatim.openstreetmap.org) (`/reverse`) once per nearby-search to confirm the detected location matches the active country.

No API key required for either source.

---

## How It Works

### Screens

The app is a single page that swaps two top-level views (`#favourites-view` / `#board-view`) plus three bottom sheets, no router:

- **Favorites (home)** — `renderFavouritesView()` groups stored favorites for the active country via `groupFavourites()` and renders them as tappable rows (`buildListRow()`). Empty state (`#welcome-view`) shows when there are no favorites for the active country.
- **Board** (`#board-view`) — the departure table for the currently selected station. Entered via `selectStation()`, which is the single entry point used by favorite rows, nearby results, search results, and the welcome-view buttons. `showFavouritesView()` tears it back down (stops auto-refresh, clears `currentStation`, re-renders the list).
- **Nearby sheet** (`#nearby-sheet`) — opened by the paper-plane icon; `fetchNearby()` uses `navigator.geolocation`, CH queries transport.opendata.ch, DE queries Transitous with a ~1 km bounding box. Nominatim reverse geocoding confirms the detected location matches the active country before fetching stops.
- **Search sheet** (`#search-sheet`) — opened by the magnifying-glass icon; debounced (250 ms) autocomplete. CH uses `/v1/locations`, DE uses `/api/v1/geocode` filtered to `type === "STOP" && country === "DE"`.
- **Intermediate-stops sheet** (`#stops-sheet`) — opened by tapping a train/S-Bahn row with `hasStopsData`. CH stops come from the stationboard's `passList` (already present in the departures response); platform per stop is fetched lazily on tap via `fetchChPlatform()`, matched by category+number within a 6-minute window (arrival board for the last stop). DE stops come from `fetchDeTripStops()` (`/api/v5/trip`), which already includes platform — tapping just reveals it, no extra fetch.

Country switching itself only lives in the hamburger menu (`selectCountry()`, wired to the two flag buttons under "Land"/"Country"); there's no toggle on the home screen. Switching resets `currentStation` and re-renders the favorites list for the new country.

### Favorites Storage

Favorites are stored in `localStorage` under key `favourites_v2` as a JSON array:

```json
[{ "name": "Zürich HB", "id": null, "provider": "CH", "count": 5, "lastUsed": 1744123456789, "transportFilter": null }]
```

- `provider`: `"CH"` or `"DE"` — favorites are two fully independent pools, capped at 7 each; CH and DE never compete for the same slots
- `id`: `null` for CH (name-based lookup), GTFS stop ID string for DE (e.g. `"de-DELFI_de:01003:57819"`)
- `transportFilter`: `null` | `"rail"` | `"nahverkehr"` — DE only. Ranked purely by `lastUsed` descending (ties broken by `count`); no time-based decay.

**DE rail/nahverkehr split** — when an unfiltered DE favorite's departures turn out to contain both track-type (rail) and non-track (tram/bus) entries, `splitDeFavourite()` replaces the single favorite with two filtered ones sharing the same `stopId`. `groupFavourites()` then renders them as one row (primary = rail, or the plain entry if never split) with an indented "↳ Nahverkehr" sub-row when a `nahverkehr` counterpart exists. A filtered fetch requests more results from Transitous (`n=80` vs. `n=20`) so enough of the wanted transport type survives the client-side filter in `isTrackTypeDep()`.

### CH Data Flow

CH stationboard entries are rendered close to raw, but the displayed time prefers the real-time prognosis over the scheduled time: `dep.stop.prognosis.departure ?? dep.stop.departure`. Using the scheduled time alone (the previous behavior) made the imminent-departure tram icon and a delayed row's remaining lifetime track the timetable instead of the actual expected departure.

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
- Deduplication happens in two passes:
  1. `dedupeTripDuplicates()` runs on the raw `stopTimes` before normalization — some trips are delivered twice, once with real-time tracking (e.g. line `"S14"`) and once as a pure schedule copy of the same trip (e.g. `"14"`, `realTime: false`). Matched by numeric `tripShortName` (leading zeros stripped) + identical departure timestamp; the real-time variant is kept.
  2. After normalization, entries sharing an identical departure timestamp are collapsed if one lacks a line number — the entry with a line number is kept, the numberless one dropped (handles duplicates from multiple GTFS feeds).
- Mode mapping: `TRAM → "T"`, `BUS/COACH → "B"`, `FERRY → "F"`, all rail/suburban/subway/aerial → `""` (falls back to line name)
- Delay computed from diff between `departure` and `scheduledDeparture` in seconds
- `tripId` is preserved on track-type departures for the intermediate-stops sheet (`/api/v5/trip` lookup)
- `isRealtime` is taken from the `realTime` field (default `true`) and drives the live-tracking dot
- Note: `mode` values are inconsistent across feeds — the same ICE train may appear as `HIGHSPEED_RAIL` in one feed and `REGIONAL_RAIL` in another; do not rely on mode to infer train type

### Retry Logic

The departure board fetch has three timers: slow warning (2 s), retry hint (4 s), fail message (8 s). On network error, the app retries once automatically before showing a permanent fail state. The nearby sheet retries once on error too, but without the staged status messages; the search sheet has no retry (a failed lookup just returns no results, matching the debounced-typing UX).

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

### v2.0 b1 — iOS v2.0 parity batch + home screen redesign (current — 2026-08-16)

First beta released for testing; version bumped from v1.5. Deployed to live-departures.app (Infomaniak shared hosting) on 2026-08-16. Beta builds increment (b2, b3, …) until v2.0 final.

Feature-parity work (see `CONCEPT.md` for the original gap analysis against the native iOS app):
- **CH real-time fix** — displayed time now prefers `prognosis.departure` over the scheduled time (see CH Data Flow above)
- **Favorites: MRU algorithm** — replaced "most-used + 14-day decay" with pure most-recently-used ranking, and the per-country cap is now fully independent (was a single shared pool of 7)
- **DE duplicate-trip fix** — `dedupeTripDuplicates()` collapses real-time/schedule-copy duplicates (see Transitous Data Flow above)
- **Accent color picker** — orange/white, menu-driven, implemented via `--accent-rgb`/`--accent-dim-rgb` CSS custom properties threaded through the whole stylesheet; now also synced on `about.html`, which doesn't load `main.js` and previously always rendered orange regardless of the chosen theme
- **Live-tracking indicator** — pulsing green dot on train/S-Bahn rows with real-time data; icon now uses `currentColor` instead of a hardcoded hex so it follows the accent theme too
- **Intermediate-stops sheet** — tap a train/S-Bahn row for a sheet of subsequent stops with lazy per-stop platform lookup
- **Compliance** — added the required Transitous source-list link and OSM/ODbL attribution to `about.html`

Home screen redesign (matches the native app's `FavouritesListView`):
- Replaced the Favoriten/Umgebung/Andere button row + favorites dropdown with a favorites list as the default screen, an icon toolbar (nearby/search), and a separate board view with a back link (moved into the same row as the toolbar icons)
- Country switching moved from a header toggle into the hamburger menu only ("Land"/"Country" row), matching the native app; the header now just shows the active country as a flag
- Added automatic DE rail/nahverkehr favorite splitting (`splitDeFavourite()`) with an indented sub-row
- **Swipe-to-delete** (iOS-style) replaces the old inline ✕ button on favorite rows — swipe left to reveal a "Löschen"/"Delete" action, tap to confirm. Built on Pointer Events with a tuned dead-zone/axis-lock so plain taps on real touchscreens don't trigger it
- Platform/track info is now always shown below each departure (removed the separate "Gleis"/"Track" toggle button, matching the native app)
- Added a Welcome empty-state view (icon, description, feature highlights, nearby/search buttons)
- Departure table switched to `table-layout: fixed` with explicit column widths — fixes a bug where a long destination name could grow the table past its own width and push the departure-time column off-screen on narrow viewports
- `about.html` copy updated throughout to match the new UI

Post-release fixes (still v2.0 b1, found testing live on iPhone after the initial deploy):
- Delay/cancel marker (`!`/`✕`) had a literal trailing space instead of a controlled CSS margin, and the Abfahrt column's `table-layout:fixed` width (4.6rem) was too narrow to fit it — long delayed times were ellipsis-truncated (`! 10:...`). Tightened the marker spacing and widened the column to 5.3rem.
- **Self-update mechanism** — `index.html` is `no-cache` (always fresh) but `main.js`/`style.css` are deliberately cached 7 days (`htaccess`); a browser that already cached the old JS/CSS before a deploy just kept serving it silently, sometimes indefinitely for an already-open tab. `main.js` now fetches `version.json` (`cache: "no-store"`) on load and reloads if its `APP_VERSION` doesn't match; `index.html`/`about.html` reference `main.js`/`style.css` with a `?v=` cache-busting query string so the reload actually gets fresh assets rather than the same stale cached ones. A `sessionStorage` one-shot guard prevents an infinite reload loop if `version.json` and `APP_VERSION` ever end up out of sync from an incomplete deploy. **`version.json`'s `v` and `main.js`'s `APP_VERSION` must be bumped together on every release** — see the version-string list under File Structure.
- Diagnosed (not a code issue): a report of the site not loading at all traced to the user's home network security appliance (Plume) flagging the domain as dangerous, unrelated to the app.

### v1.5 (2026-04-19)
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

---

## Deploy

Manual: upload the changed files to Infomaniak via FTP, then rename `htaccess` → `.htaccess` on the server by hand (see File Structure above for why the exact spelling matters). Before uploading, confirm `version.json`'s `v` and `main.js`'s `APP_VERSION` match (see the version-string checklist under File Structure) — a mismatch triggers the self-update reload logic unnecessarily.
