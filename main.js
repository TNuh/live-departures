// main.js – Echtzeit-Abfahrten International v2.0 b1

// ----------------- Konstanten & Elemente -----------------
const MAX_FAVORITES = 7;

const tbody     = document.querySelector("#departures tbody");

// Zentrale Anzeige (optional im DOM)
const chipWrap  = document.getElementById("currentStationWrap") || null;
const chipLabel = document.getElementById("currentStationLabel") || null;

const tramIcon = `
<svg viewBox="0 0 24 24" width="20" height="20"
     fill="none" stroke="currentColor" stroke-width="1.6"
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
    near: "In der Nähe",
    searchTitle: "Suche",
    close: "Schliessen",
    landLabel: "Land",
    nahverkehr: "Nahverkehr",
    colLine: "Linie",
    colStation: "Ziel",
    colTime: "Abfahrt",
    absolute: "Uhrzeit",
    colTrack: "Gleis",
    colBay: "Kante",
    colPier: "Anleger",
    noDepartures: "Keine weiteren Abfahrten heute.",
    aboutLink: "Über die App",
    accentLabel: "Akzentfarbe",

    nearSearching: "Suche Stationen in der Nähe…",
    nearNone: "Keine Stationen in der Nähe gefunden.",

    welcomeTitle: "Willkommen",
    welcomeDesc: "Echtzeit-Abfahrten für Züge, Trams, Busse und Fähren in der Schweiz und Deutschland — ohne Konto, ohne Tracking.",
    welcomeFeatureCountries: "Zwei Länder, wählbar im Menü",
    welcomeFeatureSearch: "Haltestellen-Suche mit Autocomplete",
    welcomeFeatureBoard: "Abfahrtstafel in Echtzeit",
    welcomeSearchBtn: "Haltestelle",
    welcomeHelpHint: "Hilfe & Erklärungen findest du im Menü oben links."
  },

  en: {
    title: "Live Departures",
    subtitle: "Next Departure nearby",
    fav: "Favorites",
    near: "Nearby",
    searchTitle: "Search",
    close: "Close",
    landLabel: "Country",
    nahverkehr: "Local transit",
    colLine: "Line",
    colStation: "Station",
    colTime: "Departure",
    absolute: "Time",
    colTrack: "Track",
    colBay: "Bay",
    colPier: "Pier",
    noDepartures: "No more departures today.",
    aboutLink: "About",
    accentLabel: "Accent Color",

    nearSearching: "Searching nearby stations…",
    nearNone: "No nearby stations found.",

    welcomeTitle: "Welcome",
    welcomeDesc: "Real-time departures for trains, trams, buses and ferries in Switzerland and Germany — no account, no tracking.",
    welcomeFeatureCountries: "Two countries, in the menu",
    welcomeFeatureSearch: "Stop search with autocomplete",
    welcomeFeatureBoard: "Real-time departure board",
    welcomeSearchBtn: "Stations",
    welcomeHelpHint: "Find help & explanations in the menu top left."
  }
};

function applyTranslations() {
  const T = i18n[currentLang];

  const title = document.getElementById("title-text");
  if (title) title.textContent = T.title;

  const subtitle = document.getElementById("subtitle-text");
  if (subtitle) subtitle.textContent = T.subtitle;

  const sheetLangValue = document.getElementById("sheet-lang-value");
  if (sheetLangValue) {
    sheetLangValue.innerHTML = currentLang === "de" ? "<b>DE</b> / EN" : "DE / <b>EN</b>";
  }

  const thLine = document.getElementById("th-line");
  if (thLine) thLine.textContent = T.colLine;

  const thStationLabel = document.getElementById("th-station-label");
  if (thStationLabel) thStationLabel.textContent = T.colStation;

  const toggle = document.getElementById("toggle-time");
  if (toggle) {
    toggle.textContent = displayAbsolute ? T.absolute : T.colTime;
    toggle.classList.toggle("active", displayAbsolute);
  }

  const aboutLink = document.getElementById("about-link");
  if (aboutLink) aboutLink.textContent = T.aboutLink;

  const backLabel = document.getElementById("back-label");
  if (backLabel) backLabel.textContent = T.fav;

  const nearbyTitleLabel = document.getElementById("nearby-title-label");
  if (nearbyTitleLabel) nearbyTitleLabel.textContent = T.near;
  const searchTitleLabel = document.getElementById("search-title-label");
  if (searchTitleLabel) searchTitleLabel.textContent = T.searchTitle;
  const nearbyCloseBtn = document.getElementById("nearby-close-btn");
  if (nearbyCloseBtn) nearbyCloseBtn.textContent = T.close;
  const searchCloseBtn = document.getElementById("search-close-btn");
  if (searchCloseBtn) searchCloseBtn.textContent = T.close;

  const searchInputEl = document.getElementById("stationSearch");
  if (searchInputEl) searchInputEl.placeholder = getCountryAwarePlaceholder(currentLang, getPreferredCountry());

  const accentLabel = document.getElementById("sheet-accent-label");
  if (accentLabel) accentLabel.textContent = T.accentLabel;
  const landLabel = document.getElementById("sheet-land-label");
  if (landLabel) landLabel.textContent = T.landLabel;

  const wTitle = document.getElementById("welcome-title");
  if (wTitle) wTitle.textContent = T.welcomeTitle;
  const wDesc = document.getElementById("welcome-desc");
  if (wDesc) wDesc.textContent = T.welcomeDesc;
  const wCountries = document.getElementById("welcome-feature-countries");
  if (wCountries) wCountries.textContent = T.welcomeFeatureCountries;
  const wSearch = document.getElementById("welcome-feature-search");
  if (wSearch) wSearch.textContent = T.welcomeFeatureSearch;
  const wBoard = document.getElementById("welcome-feature-board");
  if (wBoard) wBoard.textContent = T.welcomeFeatureBoard;
  const wSearchBtn = document.getElementById("welcome-search-btn");
  if (wSearchBtn) wSearchBtn.textContent = T.welcomeSearchBtn;
  const wNearbyBtn = document.getElementById("welcome-nearby-btn");
  if (wNearbyBtn) wNearbyBtn.textContent = T.near;
  const wHint = document.getElementById("welcome-hint");
  if (wHint) wHint.textContent = T.welcomeHelpHint;
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
      ? "Keine Daten verfügbar."
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

// Add or bump a favourite. transportFilter: null | "rail" | "nahverkehr" (DE-only —
// unterscheidet den ungefilterten Halt von den zwei Varianten nach dem Split, siehe splitDeFavourite()).
function saveFavourite(name, id = null, provider = "CH", transportFilter = null) {
  if (!name) return;

  // provider fallback
  if (!provider || (provider !== "CH" && provider !== "DE")) {
    provider = "CH";
  }
  transportFilter = transportFilter || null;

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

  // find existing entry (gleicher Name + Land + transportFilter)
  const entry = list.find(f =>
    f.name.toLowerCase() === normName.toLowerCase() &&
    (f.provider || "CH") === provider &&
    (f.transportFilter || null) === transportFilter
  );

  const now = Date.now();
  if (entry) {
    entry.count = (entry.count || 0) + 1;
    entry.lastUsed = now;
  } else {
    list.push({ name: normName, id, provider, count: 1, lastUsed: now, transportFilter });
  }

  // 7 pro Land — CH und DE konkurrieren nicht um dieselben Plätze
  const sameProvider = rankFavourites(list.filter(f => (f.provider || "CH") === provider))
    .slice(0, MAX_FAVORITES);
  const otherProvider = list.filter(f => (f.provider || "CH") !== provider);
  saveFavourites(sameProvider.concat(otherProvider));
}

// MRU-Sortierung: zuletzt genutzt zuerst, bei Gleichstand nach Häufigkeit
function rankFavourites(list) {
  return list.slice().sort((a, b) => {
    const byLastUsed = (b.lastUsed || 0) - (a.lastUsed || 0);
    return byLastUsed !== 0 ? byLastUsed : (b.count || 0) - (a.count || 0);
  });
}

// Return favourites, most recently used first
function getTopFavourites(limit = 7) {
  return rankFavourites(loadFavourites()).slice(0, limit);
}

// Gibt Favoriten als Gruppen zurück: Rail-Variante zuerst, Nahverkehr direkt darunter
// (Web-Port von FavouritesStore.grouped() aus der iOS-App).
function groupFavourites(country, limit = 7) {
  const all = loadFavourites().filter(f => (f.provider || "CH") === country);
  const byKey = new Map();
  all.forEach(fav => {
    const key = `${fav.name.toLowerCase()}-${fav.id || ""}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(fav);
  });

  const groups = [];
  byKey.forEach(entries => {
    const rail  = entries.find(f => f.transportFilter === "rail");
    const nahv  = entries.find(f => f.transportFilter === "nahverkehr");
    const plain = entries.find(f => !f.transportFilter);
    if (rail)       groups.push({ primary: rail, secondary: nahv || null });
    else if (plain) groups.push({ primary: plain, secondary: null });
    else if (nahv)  groups.push({ primary: nahv, secondary: null });
  });

  groups.sort((a, b) => (b.primary.lastUsed || 0) - (a.primary.lastUsed || 0));
  return groups.slice(0, limit);
}

// Löscht alle Varianten eines Ortes (Rail + Nahverkehr zusammen, oder den einzelnen Eintrag)
function removeFavouritePair(name, provider) {
  const norm = name.trim().toLowerCase();
  saveFavourites(loadFavourites().filter(f =>
    !(f.name.toLowerCase() === norm && (f.provider || "CH") === provider)
  ));
}

// Ersetzt einen ungefilterten DE-Favoriten durch zwei gefilterte Varianten (Zug + Nahverkehr) —
// idempotent: wirkt nur, wenn genau der ungefilterte Eintrag existiert (Web-Port von
// FavouritesStore.split() aus der iOS-App).
function splitDeFavourite(name, stopId) {
  const list = loadFavourites();
  const normName = name.trim().toLowerCase();
  const idx = list.findIndex(f =>
    f.name.toLowerCase() === normName && (f.provider || "CH") === "DE" && !f.transportFilter
  );
  if (idx === -1) return;
  list.splice(idx, 1);

  const now = Date.now();
  list.push({ name: name.trim(), id: stopId, provider: "DE", count: 1, lastUsed: now, transportFilter: "rail" });
  list.push({ name: name.trim(), id: stopId, provider: "DE", count: 1, lastUsed: now - 1, transportFilter: "nahverkehr" });

  const de = rankFavourites(list.filter(f => (f.provider || "CH") === "DE")).slice(0, MAX_FAVORITES);
  const ch = list.filter(f => (f.provider || "CH") !== "DE");
  saveFavourites(de.concat(ch));
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

const landFlagButtons = document.querySelectorAll(".land-flag-btn");

function updateCountryUI() {
  const country = getPreferredCountry();
  const flagEl = document.getElementById("title-flag");
  if (flagEl) flagEl.textContent = country === "DE" ? "🇩🇪" : "🇨🇭";
  landFlagButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.country === country));
}

function stationCountry(station) {
  if (!station) return null;
  return station.country || station.provider || (station.id ? "DE" : "CH");
}

// Explizite Länderauswahl — nur im Menü (wie iOS), zeigt danach wieder die Favoritenliste,
// da eine gerade offene Abfahrtstafel zum falschen Land gehören könnte.
function selectCountry(code) {
  if (getPreferredCountry() === code) return;
  setPreferredCountry(code);
  updateCountryUI();
  showFavouritesView();
}

landFlagButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    selectCountry(btn.dataset.country);
    if (typeof window.closeMenu === "function") window.closeMenu();
  });
});

// --- Accent Theme (Orange / Weiss) ---
const ACCENT_KEY = "accentTheme";
const accentSwatches = document.querySelectorAll(".accent-swatch");

function getAccentTheme() {
  try {
    const v = localStorage.getItem(ACCENT_KEY);
    return v === "white" ? "white" : "orange";
  } catch {
    return "orange";
  }
}

function applyAccentTheme(theme) {
  document.documentElement.dataset.accent = theme;
  accentSwatches.forEach(sw => sw.classList.toggle("active", sw.dataset.accent === theme));
}

function setAccentTheme(theme) {
  try { localStorage.setItem(ACCENT_KEY, theme); } catch {}
  applyAccentTheme(theme);
}

accentSwatches.forEach(sw => {
  sw.addEventListener("click", () => setAccentTheme(sw.dataset.accent));
});

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

// ----------------- Favoriten-/Ergebnislisten (geteiltes Zeilen-Markup) -----------------

// Linkswisch zum Löschen (wie iOS): der Wisch legt den roten Löschen-Button hinter der
// Zeile frei, ein zweiter Tap darauf löscht. Zwei bewusste Schritte statt eines
// dauerhaft sichtbaren ✕ — verhindert Fehllöschungen. Nur eine Zeile ist je offen.
const SWIPE_ACTION_WIDTH = 84; // px — muss zu .fav-row-delete-action in style.css passen
let openSwipeRow = null;

function closeOpenSwipe() {
  if (openSwipeRow) {
    openSwipeRow.classList.remove("swiped");
    openSwipeRow.style.transform = "";
    openSwipeRow = null;
  }
}

document.addEventListener("pointerdown", e => {
  if (openSwipeRow && !openSwipeRow.contains(e.target)) closeOpenSwipe();
});

// Hängt Pointer-basiertes Wisch-zum-Löschen an eine Zeile — funktioniert per Touch
// (iOS/Android) und per Maus-Drag (Desktop), da Pointer Events beides vereinen.
//
// Die Auswahl-Entscheidung (auswählen / Wisch öffnen / Wisch schliessen) fällt
// synchron in pointerup — nicht im nachfolgenden, separaten click-Event. Ein Tap auf
// echten Touchscreens erzeugt fast immer ein paar Pixel Zittern; wenn dieses Zittern
// knapp den Wisch-Modus antriggert (kurzes Aufblitzen des Löschen-Buttons) und man sich
// erst beim späteren click auf ein "moved"-Flag verlässt, kann die Auswahl trotzdem
// durchgehen (Race zwischen den beiden Events). Hier gibt es nur eine Entscheidung,
// click wird danach nur noch als Duplikat unterdrückt.
function makeRowSwipeable(row, onSelect, onDelete) {
  let startX = 0, startY = 0, baseX = 0, dragging = false, horizontal = false, suppressClick = false;

  row.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startX = e.clientX;
    startY = e.clientY;
    baseX = row.classList.contains("swiped") ? -SWIPE_ACTION_WIDTH : 0;
    dragging = true;
    horizontal = false;
  });

  row.addEventListener("pointermove", e => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!horizontal) {
      const adx = Math.abs(dx), ady = Math.abs(dy);
      // Grosszügiger toter Bereich (Zittern beim blossen Antippen ignorieren) + klare
      // Horizontal-Dominanz nötig, bevor überhaupt auf Wisch-Modus committed wird.
      if (adx < 20 && ady < 20) return;
      if (adx < ady * 1.6) { dragging = false; return; } // eindeutig vertikal → Scrollen gewinnt
      horizontal = true;
      row.classList.add("dragging");
      if (openSwipeRow && openSwipeRow !== row) closeOpenSwipe();
    }
    const next = Math.min(0, Math.max(-SWIPE_ACTION_WIDTH, baseX + dx));
    row.style.transform = `translateX(${next}px)`;
    e.preventDefault();
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    row.classList.remove("dragging");
    suppressClick = true;

    if (!horizontal) {
      // Reiner Tap ohne relevante Bewegung — sofort entscheiden, nicht auf das
      // nachfolgende synthetische click-Event warten.
      if (row.classList.contains("swiped")) closeOpenSwipe();
      else onSelect(e);
      return;
    }

    const dx = e.clientX - startX;
    const finalX = Math.min(0, Math.max(-SWIPE_ACTION_WIDTH, baseX + dx));
    if (finalX <= -SWIPE_ACTION_WIDTH / 2) {
      row.classList.add("swiped");
      row.style.transform = `translateX(-${SWIPE_ACTION_WIDTH}px)`;
      openSwipeRow = row;
    } else {
      row.classList.remove("swiped");
      row.style.transform = "";
      if (openSwipeRow === row) openSwipeRow = null;
    }
  }
  row.addEventListener("pointerup", endDrag);
  row.addEventListener("pointercancel", endDrag);

  // Nur noch ein Sicherheitsnetz, falls aus irgendeinem Grund kein pointerup ankam
  // (z. B. fehlende Pointer-Events-Unterstützung) — sonst reines Duplikat-Unterdrücken.
  row.addEventListener("click", e => {
    if (suppressClick) { suppressClick = false; return; }
    if (row.classList.contains("swiped")) { closeOpenSwipe(); return; }
    onSelect(e);
  });

  const del = document.createElement("button");
  del.className = "fav-row-delete-action";
  del.type = "button";
  del.textContent = currentLang === "de" ? "Löschen" : "Delete";
  del.addEventListener("click", e => {
    e.stopPropagation();
    onDelete();
  });
  return del;
}

// Baut eine tappbare Zeile mit Chevron — für Favoriten, Nahverkehr-Unterzeile, Umgebung- und Sucheergebnisse.
// deletable Zeilen kommen in einem .fav-row-wrap zurück (Linkswisch legt den Löschen-Button dahinter frei).
function buildListRow({ label, secondary = false, deletable = false, onDelete = null, onSelect }) {
  const row = document.createElement("div");
  row.className = secondary ? "fav-row fav-subrow" : "fav-row";

  const labelEl = document.createElement("span");
  labelEl.className = "fav-row-label";
  labelEl.textContent = label;
  row.appendChild(labelEl);

  const chevron = document.createElement("span");
  chevron.className = "fav-chevron";
  chevron.textContent = "›";
  row.appendChild(chevron);

  if (deletable) {
    const deleteBtn = makeRowSwipeable(row, onSelect, onDelete);
    const wrap = document.createElement("div");
    wrap.className = "fav-row-wrap";
    wrap.appendChild(deleteBtn);
    wrap.appendChild(row);
    return wrap;
  }

  row.addEventListener("click", onSelect);
  return row;
}

function renderFavouritesView() {
  const country = getPreferredCountry();
  const groups = groupFavourites(country);
  const listEl = document.getElementById("fav-list");
  const welcomeEl = document.getElementById("welcome-view");
  if (!listEl || !welcomeEl) return;
  openSwipeRow = null; // DOM wird neu gebaut, alte Referenz wäre stale
  listEl.innerHTML = "";

  if (!groups.length) {
    welcomeEl.hidden = false;
    listEl.hidden = true;
    return;
  }
  welcomeEl.hidden = true;
  listEl.hidden = false;

  const T = i18n[currentLang];
  groups.forEach(group => {
    const wrap = document.createElement("div");
    wrap.className = "fav-group";

    wrap.appendChild(buildListRow({
      label: prettyStationLabel(group.primary.name),
      deletable: true,
      onDelete: () => {
        removeFavouritePair(group.primary.name, group.primary.provider || "CH");
        renderFavouritesView();
      },
      onSelect: () => selectStation({
        id: group.primary.id, name: group.primary.name,
        country: group.primary.provider || "CH",
        transportFilter: group.primary.transportFilter || null
      })
    }));

    if (group.secondary) {
      wrap.appendChild(buildListRow({
        label: `↳ ${T.nahverkehr}`,
        secondary: true,
        onSelect: () => selectStation({
          id: group.secondary.id, name: group.secondary.name,
          country: group.secondary.provider || "CH",
          transportFilter: group.secondary.transportFilter || null
        })
      }));
    }

    listEl.appendChild(wrap);
  });
}

// ----------------- Bildschirme: Favoriten vs. Abfahrtstafel -----------------

function showBoardView() {
  const favView = document.getElementById("favourites-view");
  const boardView = document.getElementById("board-view");
  const backLink = document.getElementById("back-to-favs");
  if (favView) favView.hidden = true;
  if (boardView) boardView.hidden = false;
  if (backLink) backLink.classList.remove("is-hidden");
}

function showFavouritesView() {
  stopAutoRefresh();
  currentStation = null;
  const favView = document.getElementById("favourites-view");
  const boardView = document.getElementById("board-view");
  const backLink = document.getElementById("back-to-favs");
  if (boardView) boardView.hidden = true;
  if (favView) favView.hidden = false;
  if (backLink) backLink.classList.add("is-hidden");
  const noteEl = document.getElementById("datasource-note");
  if (noteEl) noteEl.style.display = "none";
  renderFavouritesView();
}

function selectStation(station) {
  closeNearbySheet();
  closeSearchSheet();
  showBoardView();
  fetchDepartures(station, {});
}

const backToFavsBtn = document.getElementById("back-to-favs");
if (backToFavsBtn) backToFavsBtn.addEventListener("click", showFavouritesView);

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

// Klassifiziert eine Abfahrt: Fähre / Tram-Bus / Zug-S-Bahn ("track" = Gleis-Typ).
// Gemeinsam genutzt von der Zeilen-Darstellung, der Zwischenstationen-Berechtigung und
// der DE-Rail/Nahverkehr-Filterung.
function classifyDepartureKind(dep, line) {
  const isFerry = dep.category === "F";
  const isBusOrTram = !isFerry && (dep.category === "T" || dep.category === "B" || /^\d{1,3}$/.test(line));
  return { isFerry, isBusOrTram, isTrack: !isFerry && !isBusOrTram };
}

function isTrackTypeDep(dep) {
  const line = dep.category ? formatLine(dep.category, dep.number) : (dep.line?.name || "");
  return classifyDepartureKind(dep, line).isTrack;
}

// Manche Trips werden von Transitous doppelt geliefert — einmal mit Echtzeit-Tracking
// (z. B. Linie "S14"), einmal als reine Fahrplan-Kopie derselben Fahrt (z. B. "14", realTime:false).
// Erkennbar an identischem tripShortName (bis auf führende Nullen) + identischer Abfahrtszeit.
// Bei einem Duplikat wird die realtime-Variante behalten.
function dedupeTripDuplicates(stopTimes) {
  const indexForKey = new Map();
  const out = [];
  for (const dep of stopTimes) {
    const raw = dep.tripShortName;
    const departureKey = dep.place?.departure || dep.place?.scheduledDeparture;
    if (!raw || !/^\d+$/.test(raw) || !departureKey) {
      out.push(dep);
      continue;
    }
    const key = `${parseInt(raw, 10)}|${departureKey}`;
    if (indexForKey.has(key)) {
      const idx = indexForKey.get(key);
      if (dep.realTime && !out[idx].realTime) out[idx] = dep;
    } else {
      indexForKey.set(key, out.length);
      out.push(dep);
    }
  }
  return out;
}

// ----------------- Transitous normalizer -----------------
function normalizeTransitousStopTimes(rawStopTimes) {
  const modeMap = { TRAM: "T", BUS: "B", COACH: "B", FERRY: "F" };
  const stopTimes = dedupeTripDuplicates(rawStopTimes);
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
      cancelled: dep.cancelled || dep.tripCancelled || false,
      tripId: dep.tripId || null,
      isRealtime: dep.realTime !== false
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
    ? { id: null, name: station, country: "CH", transportFilter: null }
    : {
        id: station.id ?? null,
        name: station.name ?? String(station),
        country: station.country || null,
        transportFilter: station.transportFilter || null
      };

  // Land robust bestimmen
  let country = stationObj.country || (stationObj.id ? "DE" : "CH");

  // Favorit mit Provider passend zum Land sichern
  saveFavourite(stationObj.name, stationObj.id, country, stationObj.transportFilter);

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
      // Gefilterte (Rail/Nahverkehr) Favoriten fragen mehr Ergebnisse ab, damit nach dem
      // clientseitigen Filtern genug übrig bleibt (Web-Port von DepartureBoardViewModel).
      const n = stationObj.transportFilter ? 80 : 20;
      url = `https://api.transitous.org/api/v5/stoptimes?stopId=${encodeURIComponent(id)}&n=${n}&language=de`;
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

let list = country === "DE"
  ? normalizeTransitousStopTimes(data.stopTimes || [])
  : (data.stationboard || data.departures || []);

// Gemischten DE-Halt automatisch aufteilen (einmalig, idempotent) — nur beim ungefilterten
// Fetch prüfen, sonst würde jeder gefilterte Fetch erneut zu splitten versuchen.
if (country === "DE" && !stationObj.transportFilter) {
  const hasTrack = list.some(isTrackTypeDep);
  const hasOther = list.some(dep => !isTrackTypeDep(dep));
  if (hasTrack && hasOther) splitDeFavourite(stationObj.name, stationObj.id);
}

if (country === "DE" && stationObj.transportFilter) {
  list = list.filter(dep => stationObj.transportFilter === "rail" ? isTrackTypeDep(dep) : !isTrackTypeDep(dep));
}

const T = i18n[currentLang];
list.forEach(dep => {
  const now = new Date();
  // Echtzeit-Prognose als Anzeigezeit, Fahrplanzeit nur als Fallback (Tram-Icon/Zeilen-Lebensdauer
  // richten sich sonst nach der geplanten statt der erwarteten Abfahrt bei CH-Verspätungen).
  // Für DE ist stop.departure bereits realtime||scheduled (siehe normalizeTransitousStopTimes) —
  // dort existiert stop.prognosis.departure nicht, der Fallback greift transparent.
  const t = new Date(dep.stop?.prognosis?.departure || dep.stop?.departure || dep.plannedWhen || dep.when);
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
  const { isFerry, isBusOrTram } = classifyDepartureKind(dep, line);
  const trackLabel = isFerry ? T.colPier : (isBusOrTram ? T.colBay : T.colTrack);
  const platformDisplay = platformChanged
    ? `<span class="platform-old">${plannedPlatform}</span> <span class="platform-new">${newPlatform}</span>`
    : plannedPlatform;

  // Live-Tracking: nur bei Zug/S-Bahn — bei Tram/Bus ist die Live-Quote pro Stadt praktisch
  // konstant (ganzes Netz live oder gar nicht), das Badge liefert dort pro Zeile kein Signal.
  // CH: kein explizites realtime-Flag wie bei DE — delay + prognosis.departure sind nur gesetzt,
  // wenn tatsächlich eine Echtzeit-Prognose vorliegt. DE: normalizeTransitousStopTimes liefert
  // bereits dep.isRealtime (aus dem `realTime`-Feld, Default true).
  const isRealtime = dep.isRealtime !== undefined
    ? dep.isRealtime
    : (dep.stop?.delay !== undefined && dep.stop?.delay !== null && dep.stop?.prognosis?.departure != null);
  const showsLiveBadge = !isFerry && !isBusOrTram && isRealtime && !isCancelled;

  const footnoteParts = [];
  if (plannedPlatform) {
    footnoteParts.push(`▸ ${trackLabel} ${platformDisplay}`);
  }
  if (showsLiveBadge) {
    footnoteParts.push('<span class="live-dot" title="Live" aria-label="Live"></span>');
  }
  const footnoteLine = footnoteParts.length
    ? `<div class="track-cell">${footnoteParts.join(" &nbsp; ")}</div>`
    : '';

  // Zwischenstationen-Sheet: nur Zug/S-Bahn, und nur wenn die API überhaupt Folgehalte liefert
  // (CH: passList aus dem Stationboard, erste Position ist die Abfahrtsstation selbst und hat
  // keinen `name` → wird beim Filtern natürlich ausgeschlossen; DE: tripId für den Trip-Endpoint).
  const isTrainType = !isFerry && !isBusOrTram;
  const chStops = (isTrainType && country === "CH")
    ? (dep.passList || []).filter(p => p.station && p.station.name)
    : null;
  const hasStopsData = isTrainType && (country === "CH" ? !!(chStops && chStops.length) : !!dep.tripId);
  const chevron = hasStopsData ? '<span class="row-chevron">›</span>' : '';

  const tr = document.createElement("tr");
  if (isCancelled) tr.classList.add("cancelled");
  tr.innerHTML = `<td>${line}</td><td>${dest}${chevron}${footnoteLine}</td><td class="right">${cancelMark}${delayMark}${when}</td>`;
  if (hasStopsData) {
    tr.classList.add("has-stops");
    tr.addEventListener("click", () => openStopsSheet({
      line, dest, departure: t, country,
      chCategory: dep.category, chNumber: dep.number, chStops,
      tripId: dep.tripId
    }));
  }
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

// --- Nähe-Sheet --------------------------------------------------------
const nearbyBackdrop = document.getElementById("nearby-backdrop");
const nearbySheet    = document.getElementById("nearby-sheet");
const nearbyListEl   = document.getElementById("nearby-list");

function openNearbySheet() {
  if (!nearbySheet || !nearbyBackdrop) return;
  nearbySheet.classList.add("open");
  nearbyBackdrop.classList.add("open");
  fetchNearby();
}

function closeNearbySheet() {
  if (nearbySheet)    nearbySheet.classList.remove("open");
  if (nearbyBackdrop) nearbyBackdrop.classList.remove("open");
}

if (nearbyBackdrop) nearbyBackdrop.addEventListener("click", closeNearbySheet);
const nearbyCloseBtnEl = document.getElementById("nearby-close-btn");
if (nearbyCloseBtnEl) nearbyCloseBtnEl.addEventListener("click", closeNearbySheet);

function renderNearbyMessage(text) {
  if (!nearbyListEl) return;
  nearbyListEl.innerHTML = `<div class="stop-empty">${text}</div>`;
}

function renderNearbyResults(stations) {
  if (!nearbyListEl) return;
  const T = i18n[currentLang];
  if (!stations.length) {
    renderNearbyMessage(T.nearNone);
    return;
  }
  nearbyListEl.innerHTML = "";
  stations.forEach(s => {
    nearbyListEl.appendChild(buildListRow({
      label: prettyStationLabel(s.name),
      onSelect: () => selectStation({ id: s.id, name: s.name, country: s.provider })
    }));
  });
}

async function fetchNearby() {
  const T = i18n[currentLang];
  renderNearbyMessage(T.nearSearching);
  window._nearbyRetried = false;

  if (!navigator.geolocation) {
    renderNearbyMessage(currentLang === "de"
      ? "Geolocation nicht verfügbar."
      : "Geolocation not available.");
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
              const flag = detectedCountry === "CH" ? "🇨🇭" : detectedCountry === "DE" ? "🇩🇪" : "";
              renderNearbyMessage(currentLang === "de"
                ? `Du befindest dich nicht in ${country === "DE" ? "Deutschland" : "der Schweiz"}. Bitte zuerst ${flag} auswählen.`
                : `You are not in ${country === "DE" ? "Germany" : "Switzerland"}. Please switch to ${flag} first.`);
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

        renderNearbyResults(stations);
      } catch {
        // Retry once
        if (!window._nearbyRetried) {
          window._nearbyRetried = true;
          await new Promise(r => setTimeout(r, 500));
          return fetchNearby(); // auto-retry
        }
        window._nearbyRetried = false;
        renderNearbyMessage(currentLang === "de"
          ? "Echtzeitdaten momentan gestört."
          : "Realtime data temporarily unavailable.");
      }
    },
    _err => {
      renderNearbyMessage(currentLang === "de"
        ? "Standort konnte nicht bestimmt werden."
        : "Could not determine location.");
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// ----------------- Zwischenstationen-Sheet -----------------
const stopsBackdrop = document.getElementById("stops-backdrop");
const stopsSheet    = document.getElementById("stops-sheet");
const stopsList     = document.getElementById("stops-list");

function nilIfEmpty(s) { return s ? s : null; }

function closeStopsSheet() {
  if (stopsSheet)    stopsSheet.classList.remove("open");
  if (stopsBackdrop) stopsBackdrop.classList.remove("open");
}

if (stopsBackdrop) stopsBackdrop.addEventListener("click", closeStopsSheet);
const stopsCloseBtn = document.getElementById("stops-close-btn");
if (stopsCloseBtn) stopsCloseBtn.addEventListener("click", closeStopsSheet);

// CH: Gleis eines Zwischenhalts lazy nachladen (nur bei Tap) — Suche im Stationboard
// (bzw. bei der Endstation in der Ankunftstafel) der Zwischenstation, gematcht über
// Kategorie+Nummer innerhalb eines 6-Minuten-Fensters (verhindert Fehltreffer bei
// Linien, die mehrfach täglich verkehren).
async function fetchChPlatform(stationName, category, number, aroundDate, isDestination) {
  const q = new Date(aroundDate.getTime() - 3 * 60000);
  const pad = n => String(n).padStart(2, "0");
  const datetime = `${q.getFullYear()}-${pad(q.getMonth() + 1)}-${pad(q.getDate())} ${pad(q.getHours())}:${pad(q.getMinutes())}`;
  const params = new URLSearchParams({ station: stationName, datetime, limit: "16" });
  if (isDestination) params.set("type", "arrival");
  try {
    const res = await fetch(`https://transport.opendata.ch/v1/stationboard?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const entries = data.stationboard || data.departures || [];
    let best = null, bestDiff = Infinity;
    for (const entry of entries) {
      if (entry.category !== category || entry.number !== number) continue;
      const raw = entry.stop?.departure;
      if (!raw) continue;
      const diff = Math.abs(new Date(raw) - aroundDate);
      if (diff < bestDiff) { bestDiff = diff; best = entry; }
    }
    if (!best || bestDiff > 6 * 60000) return null;
    return nilIfEmpty(best.stop?.prognosis?.platform) || nilIfEmpty(best.stop?.platform);
  } catch {
    return null;
  }
}

// DE: alle Folgehalte inkl. Gleis kommen in einem Rutsch vom Trip-Endpoint — kein
// separater Fetch pro Zwischenhalt nötig, nur ein lokales Reveal bei Tap.
async function fetchDeTripStops(tripId, afterDate) {
  try {
    const res = await fetch(`https://api.transitous.org/api/v5/trip?tripId=${encodeURIComponent(tripId)}&language=de`);
    if (!res.ok) return [];
    const data = await res.json();
    const leg = (data.legs || [])[0];
    if (!leg) return [];
    const result = (leg.intermediateStops || [])
      .filter(s => s.name && s.scheduledDeparture)
      .map(s => ({
        name: s.name,
        departure: new Date(s.scheduledDeparture),
        platform: nilIfEmpty(s.track) || nilIfEmpty(s.scheduledTrack)
      }))
      .filter(s => s.departure > afterDate);
    if (leg.to?.name) {
      result.push({
        name: leg.to.name,
        departure: leg.to.scheduledArrival ? new Date(leg.to.scheduledArrival) : null,
        platform: nilIfEmpty(leg.to.track) || nilIfEmpty(leg.to.scheduledTrack)
      });
    }
    return result;
  } catch {
    return [];
  }
}

function renderStopsList(stops, info) {
  stopsList.innerHTML = "";

  if (!stops.length) {
    const empty = document.createElement("div");
    empty.className = "stop-empty";
    empty.textContent = currentLang === "de"
      ? "Dieser Zug fährt direkt zum Ziel ohne Zwischenstationen."
      : "This train runs directly to its destination with no intermediate stops.";
    stopsList.appendChild(empty);
    return;
  }

  stops.forEach((stop, i) => {
    const row = document.createElement("div");
    row.className = "stop-row";

    const name = document.createElement("span");
    name.className = "stop-name";
    name.textContent = stop.name;

    const meta = document.createElement("span");
    meta.className = "stop-meta";

    const platformEl = document.createElement("span");
    platformEl.className = "stop-platform";

    const timeEl = document.createElement("span");
    timeEl.className = "stop-time";
    timeEl.textContent = stop.departure
      ? stop.departure.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";

    meta.appendChild(platformEl);
    meta.appendChild(timeEl);
    row.appendChild(name);
    row.appendChild(meta);

    if (info.country === "DE") {
      if (stop.platform) {
        row.classList.add("tappable");
        const chev = document.createElement("span");
        chev.className = "stop-chevron";
        chev.textContent = "▾";
        platformEl.appendChild(chev);
        row.addEventListener("click", () => {
          platformEl.textContent = (currentLang === "de" ? "Gleis " : "Platform ") + stop.platform;
        }, { once: true });
      }
    } else if (stop.departure) {
      row.classList.add("tappable");
      const chev = document.createElement("span");
      chev.className = "stop-chevron";
      chev.textContent = "▾";
      platformEl.appendChild(chev);
      const isDestination = i === stops.length - 1;
      row.addEventListener("click", async () => {
        if (row.dataset.done) return;
        row.dataset.done = "1";
        platformEl.textContent = "…";
        const platform = await fetchChPlatform(stop.name, info.chCategory, info.chNumber, stop.departure, isDestination);
        platformEl.textContent = platform ? (currentLang === "de" ? "Gleis " : "Platform ") + platform : "";
      });
    }

    stopsList.appendChild(row);
  });
}

function openStopsSheet(info) {
  if (!stopsSheet || !stopsBackdrop) return;

  document.getElementById("stops-title-label").textContent = currentLang === "de" ? "Halte" : "Stops";
  document.getElementById("stops-close-btn").textContent = currentLang === "de" ? "Schliessen" : "Close";
  document.getElementById("stops-info-line").textContent = info.line;
  document.getElementById("stops-info-time").textContent =
    info.departure.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  document.getElementById("stops-info-dest").textContent = info.dest;
  document.getElementById("stops-info-arrival").textContent = "";

  stopsSheet.classList.add("open");
  stopsBackdrop.classList.add("open");

  const showArrival = stops => {
    const last = stops[stops.length - 1];
    if (last?.departure) {
      document.getElementById("stops-info-arrival").textContent =
        last.departure.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  };

  if (info.country === "CH") {
    const stops = (info.chStops || []).map(p => ({
      name: p.station.name,
      departure: (p.departure || p.arrival) ? new Date(p.departure || p.arrival) : null
    }));
    renderStopsList(stops, info);
    showArrival(stops);
  } else {
    stopsList.innerHTML = "";
    const loading = document.createElement("div");
    loading.className = "stop-empty";
    loading.textContent = currentLang === "de" ? "Lädt…" : "Loading…";
    stopsList.appendChild(loading);
    fetchDeTripStops(info.tripId, info.departure).then(stops => {
      renderStopsList(stops, info);
      showArrival(stops);
    });
  }
}

// ----------------- Such-Sheet -----------------
const searchBackdrop  = document.getElementById("search-backdrop");
const searchSheet     = document.getElementById("search-sheet");
const searchResultsEl = document.getElementById("search-results");
const searchInput     = document.getElementById("stationSearch");

function openSearchSheet() {
  if (!searchSheet || !searchBackdrop) return;
  searchSheet.classList.add("open");
  searchBackdrop.classList.add("open");
  if (searchInput) {
    searchInput.value = "";
    searchInput.placeholder = getCountryAwarePlaceholder(currentLang, getPreferredCountry());
    requestAnimationFrame(() => requestAnimationFrame(() => searchInput.focus()));
  }
  if (searchResultsEl) searchResultsEl.innerHTML = "";
}

function closeSearchSheet() {
  if (searchSheet)    searchSheet.classList.remove("open");
  if (searchBackdrop) searchBackdrop.classList.remove("open");
}

if (searchBackdrop) searchBackdrop.addEventListener("click", closeSearchSheet);
const searchCloseBtnEl = document.getElementById("search-close-btn");
if (searchCloseBtnEl) searchCloseBtnEl.addEventListener("click", closeSearchSheet);

const debounce = (fn, ms = 200) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

async function fetchStationSuggestions(q) {
  if (!q || q.trim().length < 2) return [];
  const country = getPreferredCountry();
  try {
    if (country === "CH") {
      const url = `https://transport.opendata.ch/v1/locations?type=station&query=${encodeURIComponent(q.trim())}`;
      const res = await fetch(url);
      const data = await res.json();
      const stations = (data.stations || data.locations || []).filter(s => s && s.name);
      return stations.map(s => ({ id: null, name: s.name, provider: "CH" }));
    } else {
      const url = `https://api.transitous.org/api/v1/geocode?text=${encodeURIComponent(q.trim())}&lang=de`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const j = await res.json();
      return (Array.isArray(j) ? j : [])
        .filter(s => s && s.type === "STOP" && s.country === "DE" && s.name && s.id)
        .map(s => ({ id: s.id, name: s.name, provider: "DE" }));
    }
  } catch {
    return [];
  }
}

function renderSearchResults(stations) {
  if (!searchResultsEl) return;
  searchResultsEl.innerHTML = "";
  stations.forEach(s => {
    searchResultsEl.appendChild(buildListRow({
      label: s.name,
      onSelect: () => selectStation({ id: s.id, name: s.name, country: s.provider })
    }));
  });
}

if (searchInput) {
  searchInput.addEventListener("input", debounce(async () => {
    const results = await fetchStationSuggestions(searchInput.value);
    renderSearchResults(results);
  }, 250));

  searchInput.addEventListener("keydown", e => {
    if (e.key === "Escape") closeSearchSheet();
    if (e.key === "Enter") {
      e.preventDefault();
      const first = searchResultsEl?.querySelector(".fav-row");
      if (first) first.click();
    }
  });
}

// ----------------- Events -----------------

const toggleTimeBtn = document.getElementById("toggle-time");
if (toggleTimeBtn) {
  toggleTimeBtn.addEventListener("click", () => {
    displayAbsolute = !displayAbsolute;

    const T = i18n[currentLang];
    toggleTimeBtn.textContent = displayAbsolute ? T.absolute : T.colTime;
    toggleTimeBtn.classList.toggle("active", displayAbsolute);

    if (currentStation) fetchDepartures(currentStation);
  });
}

// Icon-Toolbar (Umgebung / Suche) + identische Buttons im Welcome-View
const btnNearEl = document.getElementById("btn-near");
if (btnNearEl) btnNearEl.addEventListener("click", openNearbySheet);
const btnSearchEl = document.getElementById("btn-search");
if (btnSearchEl) btnSearchEl.addEventListener("click", openSearchSheet);
const welcomeSearchBtnEl = document.getElementById("welcome-search-btn");
if (welcomeSearchBtnEl) welcomeSearchBtnEl.addEventListener("click", openSearchSheet);
const welcomeNearbyBtnEl = document.getElementById("welcome-nearby-btn");
if (welcomeNearbyBtnEl) welcomeNearbyBtnEl.addEventListener("click", openNearbySheet);

// ----------------- Initial -----------------

function forceFullUIRedraw() {
  applyTranslations();
  if (currentStation) {
    fetchDepartures(currentStation, {});
  } else {
    renderFavouritesView();
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

(async function init() {
  updateStationChip("");
  applyTranslations();
  updateCountryUI();
  applyAccentTheme(getAccentTheme());
  showFavouritesView();
})();
