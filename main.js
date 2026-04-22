// main.js – Echtzeit-Abfahrten International v1.5

// ----------------- Konstanten & Elemente -----------------
const MAX_FAVORITES = 7;

const btnFav   = document.getElementById("btn-fav");
const btnNear  = document.getElementById("btn-near");
const btnOther = document.getElementById("btn-other");
const countryToggle = document.getElementById("country-toggle");

const selectWrap    = document.getElementById("fav-select");
const stationSelect = document.getElementById("stationSelect");

const acInput  = document.getElementById("stationSearch");
const acList   = document.getElementById("ac-suggestions");
const acWrap   = document.getElementById("ac-wrap");

const tbody    = document.querySelector("#departures tbody");
const toggleBtn= document.getElementById("toggle-time");

// Zentrale Anzeige (optional im DOM)
const chipWrap = document.getElementById("currentStationWrap") || null;
const chipLabel= document.getElementById("currentStationLabel") || null;

const tramIcon = `
<svg viewBox="0 0 24 24" width="20" height="20"
     fill="none" stroke="#FFB43C" stroke-width="1.6"
     stroke-linecap="round" stroke-linejoin="round"
     style="opacity:0.9; vertical-align:middle;">
  <rect x="6" y="4" width="12" height="12" rx="2" ry="2"></rect>
  <line x1="6" y1="4" x2="18" y2="4"></line>
  <line x1="10" y1="2" x2="14" y2="2"></line>
  <line x1="10" y1="20" x2="8" y2="22"></line>
  <line x1="14" y1="20" x2="16" y2="22"></line>
  <circle cx="9" cy="14" r="1"></circle>
  <circle cx="15" cy="14" r="1"></circle>
</svg>`;

// --- reload current station when chip is clicked ---
const chip = document.getElementById("currentStation");
if (chip) {
  chip.style.cursor = "pointer";
  chip.addEventListener("click", () => {
    if (currentStation) {
      fetchDepartures(currentStation, {});
    }
  });
}

let displayAbsolute = false; // Start: Minuten
let currentStation = null;
let showTracks = false;

// --- Smart status system (slow API → user info) ---
let slowTimer = null;
let failTimer = null;
let retryTimer = null;

// --- Auto-refresh ---
let refreshInterval = null;
const REFRESH_MS = 60000;

function startAutoRefresh() {
  stopAutoRefresh();
  refreshInterval = setInterval(() => {
    if (currentStation && !document.hidden) {
      fetchDepartures(currentStation, {});
    }
  }, REFRESH_MS);
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

// Pause when tab/app goes to background, resume when visible again
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopAutoRefresh();
  } else if (currentStation) {
    fetchDepartures(currentStation, {});
    startAutoRefresh();
  }
});

// ------------------------------
// LANGUAGE SUPPORT
// ------------------------------
let currentLang = localStorage.getItem("lang") || "de";

const i18n = {
  de: {
    title: "Live Departures",
    subtitle: "Next Departure nearby",
    fav: "Favoriten",
    near: "Umgebung",
    other: "Andere",
    colLine: "Linie",
    colStation: "Ziel",
    colTime: "Abfahrt",
    absolute: "Uhrzeit",
    colTrack: "Gleis",
    colBay: "Kante",
    colPier: "Anleger",
    noDepartures: "Keine weiteren Abfahrten heute.",
    aboutLink: "Über die App",

    favPlaceholder: "– Favorit wählen –",
    nearPlaceholder: "– In der Nähe wählen –",
    nearSearching: "Suche Stationen in der Nähe…",
    nearNone: "Keine Stationen in der Nähe gefunden.",
    acLabel: "Andere Haltestelle oder Bahnhof:",
    acPlaceholder: "Tippen, z. B. Zürich oder Berlin Hbf"
  },

  en: {
    title: "Live Departures",
    subtitle: "Next Departure nearby",
    fav: "Favorites",
    near: "Nearby",
    other: "Other",
    colLine: "Line",
    colStation: "Station",
    colTime: "Departure",
    absolute: "Time",
    colTrack: "Track",
    colBay: "Bay",
    colPier: "Pier",
    noDepartures: "No more departures today.",
    aboutLink: "About",

    favPlaceholder: "– Select favorite –",
    nearPlaceholder: "– Select nearby –",
    nearSearching: "Searching nearby stations…",
    nearNone: "No nearby stations found.",
    acLabel: "Other station:",
    acPlaceholder: "Type e.g. Zurich or Berlin Hbf"
  }
};

function applyTranslations() {
  const T = i18n[currentLang];

  // --- Title + subtitle ---
  const title = document.getElementById("title-text");
  if (title) title.textContent = T.title;

  const subtitle = document.getElementById("subtitle-text");
  if (subtitle) subtitle.textContent = T.subtitle;

  // --- Language toggle in sheet ---
  const sheetLangValue = document.getElementById("sheet-lang-value");
  if (sheetLangValue) {
    sheetLangValue.innerHTML = currentLang === "de" ? "<b>DE</b> / EN" : "DE / <b>EN</b>";
  }

  // --- Mode buttons ---
  const favBtn = document.getElementById("btn-fav");
  if (favBtn) favBtn.textContent = `${T.fav}`;

  const nearBtn = document.getElementById("btn-near");
  if (nearBtn) nearBtn.textContent = `${T.near}`;

  const otherBtn = document.getElementById("btn-other");
  if (otherBtn) otherBtn.textContent = `${T.other}`;

  // --- Table headers ---
  const thLine = document.getElementById("th-line");
  if (thLine) thLine.textContent = T.colLine;

  const thStationLabel = document.getElementById("th-station-label");
  if (thStationLabel) thStationLabel.textContent = T.colStation;
  const toggleTrackLabel = document.getElementById("toggle-track");
  if (toggleTrackLabel) toggleTrackLabel.textContent = T.colTrack;

  // --- Toggle (Abfahrt/Uhrzeit vs Departure/Time) ---
  const toggle = document.getElementById("toggle-time");
  if (toggle) {
    toggle.textContent = displayAbsolute ? T.absolute : T.colTime;
    toggle.classList.toggle("active", displayAbsolute);
  }

  // --- About link ---
  const aboutLink = document.getElementById("about-link");
  if (aboutLink) aboutLink.textContent = T.aboutLink;

  // --- AUTOCOMPLETE LABEL + PLACEHOLDER ---
  const acLabel = document.querySelector(".ac-label");
  if (acLabel) acLabel.textContent = T.acLabel;

  const acInput = document.getElementById("stationSearch");
  if (acInput) acInput.placeholder = T.acPlaceholder;
}


function showStatus(type) {
  const row = document.getElementById("status-row");
  const msg = document.getElementById("status-msg");
  if (!row || !msg) return;

  row.style.display = "table-row";

  if (type === "slow") {
    msg.textContent = currentLang === "de"
      ? "Live-Daten laden ungewöhnlich langsam…"
      : "Live data loading unusually slowly…";
  }

  if (type === "fail") {
    msg.textContent = currentLang === "de"
      ? "Echtzeitdaten momentan gestört."
      : "Realtime data temporarily unavailable.";
  }
if (type === "retry") {
  msg.textContent = currentLang === "de"
    ? "Verbindung fehlgeschlagen – versuche erneut…"
    : "Connection failed – retrying…";
}

  if (type === "nodata") {
    msg.textContent = currentLang === "de"
      ? "Keine Daten verfügbar."
      : "No data available.";
  }
}

function hideStatus() {
  const row = document.getElementById("status-row");
  if (row) row.style.display = "none";
}

// Restarts the 60s drain animation on the thead bar after each successful fetch.
// Removing + re-adding the class forces a reflow so the animation plays from the start.
function restartRefreshBar() {
  const bar = document.getElementById("refresh-bar");
  if (!bar) return;
  bar.classList.remove("draining");
  void bar.offsetWidth; // force reflow so animation restarts
  bar.classList.add("draining");
}

// ----------------- Helpers: Storage / Favoriten -----------------

const FAV_KEY = "favourites_v2";   // new version key

function loadFavourites() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    // migrate: drop any entry without a valid provider
    const clean = list.filter(f => f.provider === "CH" || f.provider === "DE");
    if (clean.length !== list.length) {
      localStorage.setItem(FAV_KEY, JSON.stringify(clean));
    }
    return clean;
  } catch {
    return [];
  }
}

function saveFavourites(list) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(list));
  } catch {}
}

// Add or bump a favourite
function saveFavourite(name, id = null, provider = "CH") {
  if (!name) return;

  // provider fallback
  if (!provider || (provider !== "CH" && provider !== "DE")) {
    provider = "CH";
  }

  const list = loadFavourites();
  const normName = name.trim();

 // --- remove bootstrap default "Zürich HB" exactly once ---
if (
  list.length === 1 &&
  list[0].name === "Zürich HB" &&
  list[0].count === 1 &&
  normName !== "Zürich HB"
) {
  list.splice(0, 1);
}

  // find existing entry
  const entry = list.find(f =>
    f.name.toLowerCase() === normName.toLowerCase() &&
    (f.provider || "CH") === provider
  );

  const now = Date.now();
  if (entry) {
    entry.count = (entry.count || 0) + 1;
    entry.lastUsed = now;
  } else {
    list.push({ name: normName, id, provider, count: 1, lastUsed: now });
  }

  // sort: recent entries (used within 14 days) ranked by count first,
  // stale entries (older than 14 days) demoted below all recent ones
  const STALE_MS = 14 * 24 * 60 * 60 * 1000;
  const isRecent = f => (now - (f.lastUsed || 0)) < STALE_MS;
  list.sort((a, b) => {
    const aRecent = isRecent(a);
    const bRecent = isRecent(b);
    if (aRecent !== bRecent) return aRecent ? -1 : 1;
    return (b.count - a.count) || a.name.localeCompare(b.name, "de");
  });

  // limit to 7 by dropping weakest
  if (list.length > 7) list.pop();

  saveFavourites(list);
}

// Return favourites sorted (recent entries first, stale demoted)
function getTopFavourites(limit = 7) {
  const list = loadFavourites();
  const now = Date.now();
  const STALE_MS = 14 * 24 * 60 * 60 * 1000;
  const isRecent = f => (now - (f.lastUsed || 0)) < STALE_MS;
  list.sort((a, b) => {
    const aRecent = isRecent(a);
    const bRecent = isRecent(b);
    if (aRecent !== bRecent) return aRecent ? -1 : 1;
    return (b.count - a.count) || a.name.localeCompare(b.name, "de");
  });
  return list.slice(0, limit);
}

// Most-used favourite
function getMostUsedFavourite() {
  const list = getTopFavourites(1);
  return list.length ? list[0] : null;
}

function loadFavourite(fav) {
  if (!fav) return;

  const { id, name, provider } = fav;
if (provider === "DE" && id) {
    fetchDepartures({ id, name });
  } else {
    fetchDepartures({ id: null, name });
  }
}

// --- Preferred Country Handling ---
function getPreferredCountry() {
  try {
    return localStorage.getItem("preferredCountry") || "CH";
  } catch {
    return "CH";
  }
}

function setPreferredCountry(code) {
  try {
    localStorage.setItem("preferredCountry", code);
  } catch {}
}

function getCountryToggleLabel(code) {
  return code === "DE" ? "🇩🇪" : "🇨🇭";
}

function updateCountryToggle() {
  if (!countryToggle) return;
  const country = getPreferredCountry();
  countryToggle.textContent = getCountryToggleLabel(country);
  countryToggle.title = country === "DE" ? "Deutschland" : "Schweiz";
}

function stationCountry(station) {
  if (!station) return null;
  return station.country || station.provider || (station.id ? "DE" : "CH");
}

function switchCountry() {
  const next = getPreferredCountry() === "CH" ? "DE" : "CH";
  setPreferredCountry(next);
  updateCountryToggle();
  currentStation = null;
  updateStationChip("");
  const noteEl = document.getElementById("datasource-note");
  if (noteEl) noteEl.style.display = "none";
  forceFullUIRedraw();
}

// ----------------- Anzeige-Helfer -----------------
function updateStationChip(name) {
  if (!chipLabel) return;               // HTML hat evtl. keinen Chip
  const label = name ? prettyStationLabel(name) : "";
  chipLabel.textContent = label || "";
  if (chipWrap) chipWrap.style.display = label ? "inline-flex" : "none";
}

// --- Anzeige-Helfer für Stationsnamen ---
function prettyStationLabel(raw) {
  if (!raw) return "";

  // Always keep Zürich HB intact
  if (/^HB$/i.test(raw) || /Zürich HB/i.test(raw)) return "Zürich HB";

  // Remove Zürich prefix for local stops
  if (/^Zürich[ ,]+/i.test(raw)) {
    return raw.replace(/^Zürich[ ,]+/i, "").trim();
  }

  return raw.trim();
}

function getCountryAwarePlaceholder(lang, country) {
  if (lang === "de") {
    return country === "CH"
      ? "Tippen, z. B. Zürich oder Bern"
      : "Tippen, z. B. Berlin oder Hamburg Hbf";
  } else {
    return country === "CH"
      ? "Type e.g. Zurich or Bern"
      : "Type e.g. Berlin or Hamburg Hbf";
  }
}

// options: Array<string> ODER Array<{value,label}>
function fillSelect(options, placeholderText) {
  stationSelect.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = placeholderText || "— Station wählen —";
  stationSelect.appendChild(ph);

  if (options && options.length) {
    if (typeof options[0] === "string") {
      options.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = prettyStationLabel(v);
        stationSelect.appendChild(opt);
      });
    } else {
      options.forEach(o => {
        const opt = document.createElement("option");
        opt.value = o.value;
        opt.textContent = o.label ?? prettyStationLabel(o.value);
        stationSelect.appendChild(opt);
      });
    }
  }
  stationSelect.selectedIndex = 0; // auf Platzhalter
}

// Aktiven Modus schalten
function setMode(active) {
  [btnFav, btnNear, btnOther].forEach(b => b.classList.remove("active"));
  if (active === "fav")   btnFav.classList.add("active");
  if (active === "near")  btnNear.classList.add("active");
  if (active === "other") btnOther.classList.add("active");

  document.body.classList.toggle('mode-other', active === 'other');

  if (active === "other") {
    if (selectWrap) selectWrap.style.display = "none";
    if (acWrap) {
      acWrap.style.display = "flex";
      acWrap.style.justifyContent = "center";
      acWrap.classList.add("is-open");
    }
  } else {
    if (acWrap) {
      acWrap.style.display = "none";
      acWrap.classList.remove("is-open");
    }
  }
}

// Robust: Dropdown sofort öffnen (iOS/WebKit freundlich)
function openStationSelect() {
  const tryOpen = () => {
    try {
      if (typeof stationSelect.showPicker === "function") {
        stationSelect.showPicker();
      } else {
        stationSelect.focus();
        stationSelect.click();
        const evt = new MouseEvent("mousedown", {bubbles:true, cancelable:true, view:window});
        stationSelect.dispatchEvent(evt);
      }
    } catch {}
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      [0,70,140].forEach(d => setTimeout(tryOpen, d));
    });
  });
}

// ----------------- Data helpers -----------------
function formatLine(category, number){
  const cat = String(category||"");
  const num = String(number||"");
  if (cat === "T" || cat === "B" || cat === "") return num;    // Tram/Bus: nur Nummer
  if (cat.startsWith("S")) return cat + num;                   // S-Bahn: „S12“
  const long = ["IC","IR","ICE","EC","TER","RJX","RE","ECE","TGV"];  // Fern-/Regio mit Leerzeichen
  if (long.includes(cat)) {
    const clean = num.replace(/^0+/,"") || num;
    return clean ? `${cat} ${clean}` : cat;
  }
  return cat + num;
}

// Entfernt "Zürich"/"Zürich, " nur für Tram/Bus-Ziele; säubert Kommas
function cleanDestinationForDisplay(line, dest) {
  const isNumericLine = /^\d{1,3}$/.test(line);
  if (isNumericLine) {
    dest = dest.replace(/^(?:Zürich(?:,)?\s+)/u, "");
    dest = dest.replace(/^,\s*/u, "");
  }
  return dest;
}


// ----------------- Transitous normalizer -----------------
function normalizeTransitousStopTimes(stopTimes) {
  const modeMap = { TRAM: "T", BUS: "B", COACH: "B", FERRY: "F" };
  return stopTimes.map(dep => {
    const cat = modeMap[dep.mode] || "";
    const place = dep.place || {};
    const scheduled = place.scheduledDeparture;
    const realtime = place.departure;
    const delaySeconds = realtime && scheduled
      ? Math.round((new Date(realtime) - new Date(scheduled)) / 1000)
      : 0;
    const displayName = (dep.displayName || "").replace(/\s*\(\d+\)$/, "");
    const tripShortName = (dep.tripShortName || "").replace(/\s*\(\d+\)$/, "");
    const namedTrip = /[A-Za-z]/.test(tripShortName) ? tripShortName : "";
    const isRouteName = displayName.includes(" – ") || displayName.includes(" - ");
    const rawLineName = isRouteName
      ? (namedTrip || dep.routeShortName || "")
      : (namedTrip || displayName || dep.routeShortName || "");
    const lineName = rawLineName;
    const headsign = dep.headsign || "";
    const destName = /^\d+$/.test(headsign)
      ? (dep.tripTo?.name || dep.direction || headsign)
      : headsign;
    const destination = destName;
    return {
      stop: {
        departure: realtime || scheduled,
        platform: place.scheduledTrack || "",
        prognosis: { platform: place.track || "" },
        cancelled: place.cancelled || dep.cancelled || dep.tripCancelled || false,
        delay: delaySeconds
      },
      category: cat,
      number: lineName,
      line: { name: lineName },
      to: destination,
      cancelled: dep.cancelled || dep.tripCancelled || false
    };
  }).filter((entry, _i, arr) => {
    if (entry.number) return true;
    return !arr.some(other => other.number && other.stop.departure === entry.stop.departure);
  });
}

// ----------------- Fetch Abfahrten -----------------
async function fetchDepartures(station, options = {}) {
  if (!station) return;

  const stationObj = typeof station === "string"
    ? { id: null, name: station, country: "CH" }
    : {
        id: station.id ?? null,
        name: station.name ?? String(station),
        country: station.country || null
      };

  // Land robust bestimmen
  let country = stationObj.country || (stationObj.id ? "DE" : "CH");

  // Favorit mit Provider passend zum Land sichern
  saveFavourite(stationObj.name, stationObj.id, country);

  currentStation = stationObj;
  updateStationChip(stationObj.name || stationObj);
  tbody.innerHTML = `<tr><td colspan="3">Lade…</td></tr>`;

  // --- Smart status timers ---

hideStatus();

// Slow after 2 seconds
slowTimer = setTimeout(() => showStatus("slow"), 2000);

// Retry warning after 4 seconds (shown before final fail)
retryTimer = setTimeout(() => showStatus("retry"), 4000);

// Final fail after 8 seconds (only visual, fetch continues in background)
failTimer = setTimeout(() => showStatus("fail"), 8000);

  try {
    let url;

    if (country === "DE") {
      const id = stationObj.id;
      if (!id) {
        tbody.innerHTML = `<tr><td colspan="3">Kein gueltiger DB-Stop-ID gefunden.</td></tr>`;
        return;
      }
      url = `https://api.transitous.org/api/v5/stoptimes?stopId=${encodeURIComponent(id)}&n=20&language=de`;
    } else {
      // CH
      url = `https://transport.opendata.ch/v1/stationboard?station=${encodeURIComponent(stationObj.name)}&limit=20`;
    }

const res = await fetch(url);
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const data = await res.json();
tbody.innerHTML = "";
// --- clear timers and hide status when data arrives ---
clearTimeout(slowTimer);
clearTimeout(retryTimer);
clearTimeout(failTimer);
hideStatus();
restartRefreshBar();

const noteEl = document.getElementById("datasource-note");
if (noteEl) {
  const isDE = country === "DE";
  noteEl.textContent = isDE
    ? (currentLang === "de" ? "Daten: Transitous" : "Data: Transitous")
    : "";
  noteEl.style.display = isDE ? "inline" : "none";
}

const list = country === "DE"
  ? normalizeTransitousStopTimes(data.stopTimes || [])
  : (data.stationboard || data.departures || []);
const T = i18n[currentLang];
list.forEach(dep => {
  const now = new Date();
  const t = new Date(dep.stop?.departure || dep.plannedWhen || dep.when);
  const diffMin = Math.round((t - now) / 60000);

  // Abfahrten, die deutlich in der Vergangenheit liegen, ausblenden
  if (diffMin < -1) return;

  const line = dep.category
    ? formatLine(dep.category, dep.number)
    : (dep.line?.name || "");

  let dest = dep.to || dep.direction || "";
  if (/^HB$/i.test(dest)) {
    dest = "Zürich HB";
  } else if (/^Zürich[ ,]+/i.test(dest) && !/Zürich HB/i.test(dest)) {
    dest = dest.replace(/^Zürich[ ,]+/i, "").trim();
  }

// --- Compute display string ---
let when;

if (displayAbsolute) {
  const secondsRemaining = Math.round((t - now) / 1000);
  if (secondsRemaining < 60) {
    when = tramIcon;
  } else {
    when = t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
} else {
  const secondsRemaining = Math.round((t - now) / 1000);

  // < 1 Minute (<= 59 Sekunden): nur Icon
  if (secondsRemaining < 60) {
    when = tramIcon;
  }
  // >= 1 hour: show h:mm
  else if (diffMin >= 60) {
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    when = `${h}:${String(m).padStart(2, "0")}`;
  }
  // 1–59 minutes: only minutes
  else {
    when = `${diffMin}'`;
  }
}

  const isCancelled = dep.cancelled === true || dep.stop?.cancelled === true;
  const hasDelay = !isCancelled && (dep.stop?.delay ?? dep.delay ?? 0) > 0;
  const plannedPlatform = dep.stop?.platform || dep.platform || dep.plannedPlatform || "";
  const newPlatform = dep.stop?.prognosis?.platform || "";
  const platformChanged = !!(newPlatform && newPlatform !== plannedPlatform);
  const delayMark = (hasDelay && when !== tramIcon) ? '<span class="delay-mark">!</span> ' : '';
  const cancelMark = isCancelled ? '<span class="cancel-mark">✕</span> ' : '';
  const isFerry = dep.category === "F";
  const isBusOrTram = !isFerry && (dep.category === "T" || dep.category === "B" || /^\d{1,3}$/.test(line));
  const trackLabel = isFerry ? T.colPier : (isBusOrTram ? T.colBay : T.colTrack);
  const platformDisplay = platformChanged
    ? `<span class="platform-old">${plannedPlatform}</span> <span class="platform-new">${newPlatform}</span>`
    : plannedPlatform;
  const trackLine = (showTracks && plannedPlatform)
    ? `<div class="track-cell">▸ ${trackLabel} ${platformDisplay}</div>`
    : '';

  const tr = document.createElement("tr");
  if (isCancelled) tr.classList.add("cancelled");
  tr.innerHTML = `<td>${line}</td><td>${dest}${trackLine}</td><td class="right">${cancelMark}${delayMark}${when}</td>`;
  tbody.appendChild(tr);
});

    if (!tbody.querySelector("tr")) {
      tbody.innerHTML = `<tr><td colspan="3">${T.noDepartures}</td></tr>`;
    }

    updateStationChip(stationObj.name || stationObj);
    if (!options._retried) startAutoRefresh();

  } catch (e) {
  clearTimeout(slowTimer);
  clearTimeout(retryTimer);
  clearTimeout(failTimer);

  // Perform automatic retry once
  if (!options._retried) {
    showStatus("retry");
    await new Promise(r => setTimeout(r, 500)); // small pause for UI
    return fetchDepartures(station, Object.assign({}, options, { _retried: true }));
  }

  // After retry also failed → final message
  tbody.innerHTML = "";
  showStatus("fail");
}
}

// --- Nähe ------------------------------------------------------------
async function fetchNearby() {
  setMode("near");
  const T = i18n[currentLang];
  tbody.innerHTML = `<tr><td colspan="3">${T.nearSearching}</td></tr>`;
  window._nearbyRetried = false;

  // --- Smart status timers (Nearby) ---
hideStatus();

// Slow after 2 seconds
slowTimer = setTimeout(() => showStatus("slow"), 2000);

// Retry hint after 4 seconds
retryTimer = setTimeout(() => showStatus("retry"), 4000);

// Total fail after 8 seconds
failTimer = setTimeout(() => showStatus("fail"), 8000);

  if (!navigator.geolocation) {
    tbody.innerHTML = `<tr><td colspan="3">${currentLang === "de" 
    ? "Geolocation nicht verfügbar." 
    : "Geolocation not available."}</td></tr>`;
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async pos => {
      try {
        const { latitude, longitude } = pos.coords;
        const country = getPreferredCountry();

        // Reverse-geocode to get the actual country (Nominatim / OpenStreetMap)
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            const detectedCountry = (geoData.address?.country_code || "").toUpperCase();
            if (detectedCountry && detectedCountry !== country) {
              clearTimeout(slowTimer); clearTimeout(retryTimer); clearTimeout(failTimer);
              hideStatus();
              const flag = detectedCountry === "CH" ? "🇨🇭" : detectedCountry === "DE" ? "🇩🇪" : "";
              tbody.innerHTML = `<tr><td colspan="3" style="white-space:normal">${
                currentLang === "de"
                  ? `Du befindest dich nicht in ${country === "DE" ? "Deutschland" : "der Schweiz"}. Bitte zuerst ${flag} auswählen.`
                  : `You are not in ${country === "DE" ? "Germany" : "Switzerland"}. Please switch to ${flag} first.`
              }</td></tr>`;
              return;
            }
          }
        } catch {
          // If reverse geocode fails, proceed without the country check
        }

        let stations = [];

        if (country === "CH") {
          const res = await fetch(`https://transport.opendata.ch/v1/locations?type=station&x=${longitude}&y=${latitude}&limit=10`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          stations = (data.stations || data.locations || [])
            .filter(s => s && s.name)
            .filter(s => {
              if (s.type && s.type !== "station") return false;
              if (/\d/.test(s.name)) return false;
              if (/Standort/i.test(s.name)) return false;
              return true;
            })
            .map(s => ({ id: null, name: s.name, provider: "CH" }));
        } else {
          const d = 0.009; // ~1 km bounding box half-width
          const min = `${latitude - d},${longitude - d}`;
          const max = `${latitude + d},${longitude + d}`;
          const res = await fetch(`https://api.transitous.org/api/v1/map/stops?min=${min}&max=${max}&language=de`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          stations = (Array.isArray(data) ? data : [])
            .filter(s => s && s.name && s.stopId && !s.parentId)
            .sort((a, b) => (b.importance || 0) - (a.importance || 0))
            .slice(0, 10)
            .map(s => ({ id: s.stopId, name: s.name, provider: "DE" }));
        }

        clearTimeout(slowTimer);
        clearTimeout(retryTimer);
        clearTimeout(failTimer);
        hideStatus();

        const opts = stations.map(s => ({
          value: JSON.stringify({ id: s.id, name: s.name, provider: s.provider }),
          label: s.name.replace(/^Zürich[ ,]+/, "")
        }));

        const T = i18n[currentLang];
        fillSelect(opts, T.nearPlaceholder);
        if (selectWrap) selectWrap.style.display = "flex";
      } catch {
  clearTimeout(slowTimer);
  clearTimeout(retryTimer);
  clearTimeout(failTimer);

  // Retry once
  if (!window._nearbyRetried) {
    window._nearbyRetried = true;
    showStatus("retry");
    await new Promise(r => setTimeout(r, 500));
    return fetchNearby(); // auto-retry
  }

  // Final fail
  window._nearbyRetried = false;
  tbody.innerHTML = "";
  showStatus("fail");
}
    },
    _err => {
      tbody.innerHTML = `<tr><td colspan="3">${currentLang === "de" 
      ? "Standort konnte nicht bestimmt werden."
      : "Could not determine location."}</td></tr>`;
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// === Andere (Other) handlers ===
(() => {
  const btnOther = document.getElementById("btn-other");
  const wrap     = document.getElementById("ac-wrap");
  const inputEl  = document.getElementById("stationSearch");
  const listEl   = document.getElementById("ac-suggestions");

  if (!btnOther || !wrap || !inputEl || !listEl) return;

  // --- helper: debounce ---
  const debounce = (fn, ms = 200) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  // --- fetch station suggestions ---
  async function fetchSuggestions(q) {
    if (!q || q.trim().length < 2) return [];
    const country = getPreferredCountry();
    try {
      if (country === "CH") {
        const url = `https://transport.opendata.ch/v1/locations?type=station&query=${encodeURIComponent(q.trim())}`;
        const res = await fetch(url);
        const data = await res.json();
        const stations = (data.stations || data.locations || []).filter(s => s && s.name);
        return stations.map(s => ({ id: null, name: s.name }));
      } else {
        const url = `https://api.transitous.org/api/v1/geocode?text=${encodeURIComponent(q.trim())}&lang=de`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const j = await res.json();
        return (Array.isArray(j) ? j : [])
          .filter(s => s && s.type === "STOP" && s.country === "DE" && s.name && s.id)
          .map(s => ({ id: s.id, name: s.name }));
      }
    } catch {
      return [];
    }
  }

  // --- render suggestions ---
  function render(list) {
    listEl.innerHTML = "";
    list.forEach(st => {
      const li = document.createElement("li");
      li.textContent = st.name;
      li.className = "ac-item";
      li.dataset.id = st.id || "";
      li.dataset.name = st.name;
      li.addEventListener("click", () => pick(st));
      listEl.appendChild(li);
    });
    listEl.hidden = list.length === 0;
  }

function pick(station) {
  if (!station) return;
  try {
    const country = getPreferredCountry();

    window.fetchDepartures(
      { id: station.id || null, name: station.name, country },
      {}
    );
  } catch {}
  inputEl.value = "";
  listEl.innerHTML = "";
  listEl.hidden = true;
  wrap.style.display = "none";
}

  // --- input typing ---
  inputEl.addEventListener("input", debounce(async () => {
    const list = await fetchSuggestions(inputEl.value);
    render(list);
  }, 250));

  // --- key handling ---
  inputEl.addEventListener("keydown", e => {
    if (e.key === "Escape") listEl.hidden = true;
    if (e.key === "Enter") {
      e.preventDefault();
      const first = listEl.querySelector("li");
      if (first) {
        const st = { id: first.dataset.id || null, name: first.dataset.name };
        pick(st);
      }
    }
  });

  // --- button click (open input) ---
  btnOther.addEventListener("click", () => {
    setMode("other");
    wrap.style.display = "block";
   inputEl.placeholder = getCountryAwarePlaceholder(currentLang, getPreferredCountry());
    requestAnimationFrame(() => requestAnimationFrame(() => inputEl.focus()));
  });
})(); // closes the IIFE


// ----------------- Events -----------------


stationSelect.addEventListener("change", () => {
  const val = stationSelect.value;
  if (!val) return;
  try {
    const fav = JSON.parse(val);
    loadFavourite(fav);
  } catch {
    fetchDepartures(val, {});
  }
  selectWrap.style.display = "none";
});

btnNear.addEventListener("click", () => {
  fetchNearby();
});

btnFav.addEventListener("click", () => {
  setMode("fav");

const country = getPreferredCountry();
const favs = getTopFavourites().filter(f => (f.provider || "CH") === country);
const options = favs.map(f => {
  let name = f.name;
  if (/^HB$/i.test(name)) name = "Zürich HB";
  else if (/^Zürich[, ]/i.test(name) && !/Zürich HB/i.test(name)) {
    name = name.replace(/^Zürich[, ]*/i, "");
  }
  return { value: JSON.stringify(f), label: name };
});
const T = i18n[currentLang];
fillSelect(options, T.favPlaceholder);

  if (selectWrap) selectWrap.style.display = "flex";
});

// Abfahrt/Uhrzeit umschalten
document.getElementById("toggle-time").addEventListener("click", () => {
  displayAbsolute = !displayAbsolute;

  const T = i18n[currentLang]; // get correct language texts
  const timeBtn = document.getElementById("toggle-time");
  timeBtn.textContent = displayAbsolute ? T.absolute : T.colTime;
  timeBtn.classList.toggle("active", displayAbsolute);

  if (currentStation) fetchDepartures(currentStation);
});

// Gleis/Track anzeigen umschalten
const toggleTrackBtn = document.getElementById("toggle-track");
if (toggleTrackBtn) {
  toggleTrackBtn.addEventListener("click", () => {
    showTracks = !showTracks;
    toggleTrackBtn.classList.toggle("active", showTracks);
    if (currentStation) fetchDepartures(currentStation);
  });
}

// ----------------- Initial -----------------

function forceFullUIRedraw() {
  // 1. Apply translations
  applyTranslations();

  // 2. Update placeholder in “Other”
  const inputEl = document.getElementById("stationSearch");
  if (inputEl) {
    inputEl.placeholder = getCountryAwarePlaceholder(
      currentLang,
      getPreferredCountry()
    );
  }

  // 3. Re-render favorites (filtered by active country)
  const country = getPreferredCountry();
  const favs = getTopFavourites().filter(f => (f.provider || "CH") === country);
  const T = i18n[currentLang];
  const opts = favs.map(f => ({ value: JSON.stringify(f), label: prettyStationLabel(f.name) }));
  fillSelect(opts, T.favPlaceholder);

  // 4. Re-fetch departures for the currently shown station if it still matches
  if (currentStation) {
    const currentCountry = stationCountry(currentStation);
    if (currentCountry === country) {
      fetchDepartures(currentStation, {});
    } else {
      currentStation = null;
      updateStationChip("");
    }
  }
}

// --- Language toggle (EN ↔ DE) ---
const btnLang = document.getElementById("sheet-lang");

if (btnLang) {
  btnLang.addEventListener("click", () => {
    currentLang = currentLang === "de" ? "en" : "de";
    localStorage.setItem("lang", currentLang);
    if (typeof window.closeMenu === "function") window.closeMenu();
    forceFullUIRedraw();
  });
}

if (countryToggle) {
  countryToggle.addEventListener("click", switchCountry);
}

(async function init() {
  updateStationChip("");
  setMode("fav");
  applyTranslations();
  updateCountryToggle();
  const inputEl = document.getElementById("stationSearch");
  if (inputEl) inputEl.placeholder = getCountryAwarePlaceholder(currentLang, getPreferredCountry());

  const country = getPreferredCountry();
  const favs = getTopFavourites().filter(f => (f.provider || "CH") === country);
  const T = i18n[currentLang];
  if (favs.length) {
    const best = favs[0];
    await fetchDepartures(best, {});
    const options = favs.map(f => ({
      value: JSON.stringify(f),
      label: prettyStationLabel(f.name)
    }));
    fillSelect(options, T.favPlaceholder);
  } else {
    if (country === "CH") await fetchDepartures("Zürich HB", {});
    fillSelect([], T.favPlaceholder);
  }
})();