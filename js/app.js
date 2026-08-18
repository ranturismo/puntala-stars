// UI logic — Punta Ala Stars
(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────
     Bortle configuration
  ────────────────────────────────────────────────────────── */
  const BORTLE_CONFIG = [
    { class: 1, label: 'Cielo perfetto',    limitingMag: 5.0, skyGlow: 0.00,
      desc: 'Sito remoto lontano da qualsiasi città. Migliaia di stelle, Via Lattea abbagliante.' },
    { class: 2, label: 'Buio profondo',     limitingMag: 5.0, skyGlow: 0.00,
      desc: 'Cielo rurale lontano dalle città. Via Lattea complessa, visibile ad occhio nudo.' },
    { class: 3, label: 'Rurale',            limitingMag: 5.0, skyGlow: 0.00,
      desc: 'Leggero chiarore verso gli orizzonti urbani. Eccellente per l\'osservazione.' },
    { class: 4, label: 'Rurale–suburbano',  limitingMag: 4.5, skyGlow: 0.10,
      desc: 'Cielo tipico di Punta Ala in una notte tranquilla. Via Lattea visibile, stelle deboli riconoscibili.' },
    { class: 5, label: 'Suburbano',         limitingMag: 3.8, skyGlow: 0.28,
      desc: 'Chiarore diffuso. Via Lattea pallida. Comune nelle periferie urbane.' },
    { class: 6, label: 'Periferia urbana',  limitingMag: 3.0, skyGlow: 0.48,
      desc: 'Solo stelle luminose e costellazioni principali. Sfondo del cielo grigio-arancio.' },
    { class: 7, label: 'Urbano',            limitingMag: 2.3, skyGlow: 0.65,
      desc: 'Poche decine di stelle visibili. Costellazioni solo parzialmente riconoscibili.' },
    { class: 8, label: 'Città',             limitingMag: 1.8, skyGlow: 0.80,
      desc: 'Solo le stelle più brillanti. Cielo arancione-grigio pervasivo.' },
    { class: 9, label: 'Centro città',      limitingMag: 1.3, skyGlow: 1.00,
      desc: 'Pochissime stelle. Solo Sirio, Vega, le stelle più luminose appena visibili.' },
  ];

  // Approximate star counts per magnitude threshold (for card display)
  const BORTLE_STAR_COUNTS = { 5.0: 1627, 4.5: 1100, 3.8: 600, 3.0: 177, 2.3: 55, 1.8: 28, 1.3: 12 };

  /* ──────────────────────────────────────────────────────────
     Constants
  ────────────────────────────────────────────────────────── */
  const MIN_TIME    = 18 * 60;           // 18:00 evening
  const MAX_TIME    = 31 * 60 + 59;      // ~07:59 next morning
  const DAY_MINUTES = 24 * 60;
  const TIME_STEP   = 1;                 // 1 simulated minute per slider tick
  const ANIM_SPEED  = 100;               // ms per play step (~10 min/s)
  const ECLIPSE_DAY = new Date(2026, 7, 12); // 12 agosto 2026
  const DEFAULT_LAT = 42.8402632;        // Punta Ala
  const DEFAULT_LON = 10.7780025;
  /** Città di esempio (coordinate circa centro città — ok per la proiezione del cielo). */
  const PLACE_PRESETS = [
    { id: 'punta-ala', name: 'Punta Ala', lat: DEFAULT_LAT, lon: DEFAULT_LON },
    { id: 'brescia',   name: 'Brescia',   lat: 45.5416, lon: 10.2118 },
    { id: 'milano',    name: 'Milano',    lat: 45.4642, lon:  9.1900 },
    { id: 'torino',    name: 'Torino',    lat: 45.0703, lon:  7.6869 },
    { id: 'venezia',   name: 'Venezia',   lat: 45.4408, lon: 12.3155 },
    { id: 'firenze',   name: 'Firenze',   lat: 43.7696, lon: 11.2558 },
    { id: 'roma',      name: 'Roma',      lat: 41.9028, lon: 12.4964 },
    { id: 'napoli',    name: 'Napoli',    lat: 40.8518, lon: 14.2681 },
    { id: 'bari',      name: 'Bari',      lat: 41.1171, lon: 16.8719 },
    { id: 'messina',   name: 'Messina',   lat: 38.1938, lon: 15.5540 },
    { id: 'palermo',   name: 'Palermo',   lat: 38.1157, lon: 13.3615 },
    { id: 'cagliari',  name: 'Cagliari',  lat: 39.2238, lon:  9.1217 },
  ];
  const PLACE_MATCH_EPS = 0.0005;

  /** Orientamento fisso della mappa (direzione in alto) quando la bussola è spenta. */
  const ORIENTATION_PRESETS = [
    { id: 'n', label: 'Nord',  headAz: 0 },
    { id: 'e', label: 'Est',   headAz: 90 },
    { id: 's', label: 'Sud',   headAz: 180 },
    { id: 'o', label: 'Ovest', headAz: 270 },
  ];
  const DEFAULT_HEAD_AZ = 90; // est in alto → piedi verso ovest (il mare)

  const PLANET_SYMBOLS = {
    'Mercurio': '☿', 'Venere': '♀', 'Marte': '♂', 'Giove': '♃', 'Saturno': '♄',
  };

  /* ──────────────────────────────────────────────────────────
     DOM refs
  ────────────────────────────────────────────────────────── */
  const canvas       = document.getElementById('sky');
  const sky          = new SkyRenderer(canvas);
  const timeSlider   = document.getElementById('time-slider');
  const hourLabel    = document.getElementById('hour-label');
  const endLabel     = document.getElementById('end-label');
  const eclipseMarkers = document.getElementById('eclipse-markers');
  const btnPlay      = document.getElementById('btn-play');
  const btnNow       = document.getElementById('btn-now');
  const btnEclipse   = document.getElementById('btn-eclipse');
  const speedLabel   = document.getElementById('speed-label');
  const btnExplore   = document.getElementById('btn-explore');
  const btnSettings  = document.getElementById('btn-settings');
  const btnCompass   = document.getElementById('btn-compass');
  const orientationNote = document.getElementById('orientation-note');
  const calibratePrompt = document.getElementById('calibrate-prompt');
  const calibrateText   = document.getElementById('calibrate-text');
  const pitchBolla      = document.getElementById('pitch-bolla');
  const pitchBollaDot   = document.getElementById('pitch-bolla-dot');

  // Info bar
  const infoSunChip     = document.getElementById('info-sun-chip');
  const infoSunText     = document.getElementById('info-sun-text');
  const infoMoonIcon    = document.getElementById('info-moon-icon');
  const infoMoonText    = document.getElementById('info-moon-text');
  const infoPlanetsChip = document.getElementById('info-planets-chip');
  const infoPlanetsText = document.getElementById('info-planets-text');
  const infoEvent       = document.getElementById('info-event');

  // Explore sheet
  const exploreOverlay  = document.getElementById('explore-overlay');
  const explorePanel    = document.getElementById('explore-panel');
  const btnExploreClose = document.getElementById('btn-explore-close');
  const exploreSearch   = document.getElementById('explore-search');
  const exploreTablist  = document.getElementById('explore-tablist');
  const exploreConsts   = document.getElementById('explore-constellations');
  const exploreStars    = document.getElementById('explore-stars');
  const exploreResults  = document.getElementById('explore-search-results');

  // Settings sheet
  const settingsOverlay  = document.getElementById('settings-overlay');
  const btnSettingsClose = document.getElementById('btn-settings-close');
  const bortleSlider     = document.getElementById('bortle-slider');
  const bortleCard       = document.getElementById('bortle-card');
  const bortleLabels     = document.getElementById('bortle-track-labels');
  const maskEast         = document.getElementById('mask-east');
  const maskWest         = document.getElementById('mask-west');
  const maskEastVal      = document.getElementById('mask-east-val');
  const maskWestVal      = document.getElementById('mask-west-val');
  const locLat           = document.getElementById('loc-lat');
  const locLon           = document.getElementById('loc-lon');
  const placePresetsEl   = document.getElementById('place-presets');
  const orientationPresetsEl = document.getElementById('orientation-presets');
  const fabNight = document.getElementById('fab-night');
  const fabConst = document.getElementById('fab-const');
  const fabNames = document.getElementById('fab-names');
  const fabArt   = document.getElementById('fab-art');
  const fabAz    = document.getElementById('fab-az');

  // Hint
  const hintOverlay  = document.getElementById('hint-overlay');
  const hintDismiss  = document.getElementById('hint-dismiss');

  /* ──────────────────────────────────────────────────────────
     State
  ────────────────────────────────────────────────────────── */
  // Calendar day of the evening that starts this night (local midnight)
  let nightAnchor     = startOfLocalDay(new Date());
  let selectedMinutes = 22 * 60 + 30;
  let isPlaying       = false;
  let playTimer       = null;
  let exploreOpen     = false;
  let settingsOpen    = false;
  let activeExploreTab = 'constellations';
  let lastFocusExplore  = null;
  let lastFocusSettings = null;
  let fixedHeadAz = DEFAULT_HEAD_AZ;

  function startOfLocalDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  }

  /* ──────────────────────────────────────────────────────────
     Storage helpers
  ────────────────────────────────────────────────────────── */
  function storageGet(key, fallback) {
    try { const v = localStorage.getItem(key); return v !== null ? v : fallback; }
    catch (e) { return fallback; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (e) {}
  }

  function fabOn(btn) {
    return btn.getAttribute('aria-pressed') === 'true';
  }

  function setFab(btn, on) {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function parseCoord(raw, min, max, fallback) {
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function syncLocationInputs(lat, lon) {
    locLat.value = String(lat);
    locLon.value = String(lon);
  }

  function matchPlacePreset(lat, lon) {
    return PLACE_PRESETS.find(p =>
      Math.abs(p.lat - lat) < PLACE_MATCH_EPS &&
      Math.abs(p.lon - lon) < PLACE_MATCH_EPS
    ) || null;
  }

  function syncPlacePresetUI(lat, lon) {
    const match = matchPlacePreset(lat, lon);
    placePresetsEl.querySelectorAll('.place-chip').forEach(btn => {
      const on = match && btn.dataset.placeId === match.id;
      btn.classList.toggle('active', !!on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function buildPlacePresets() {
    placePresetsEl.innerHTML = '';
    PLACE_PRESETS.forEach(place => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'place-chip';
      btn.dataset.placeId = place.id;
      btn.setAttribute('aria-pressed', 'false');
      btn.textContent = place.name;
      btn.addEventListener('click', () => applyLocation(place.lat, place.lon, true));
      placePresetsEl.appendChild(btn);
    });
  }

  function buildOrientationPresets() {
    orientationPresetsEl.innerHTML = '';
    ORIENTATION_PRESETS.forEach(o => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'place-chip';
      btn.dataset.orientId = o.id;
      btn.setAttribute('aria-pressed', 'false');
      btn.textContent = o.label;
      btn.addEventListener('click', () => applyFixedOrientation(o.headAz, true));
      orientationPresetsEl.appendChild(btn);
    });
  }

  function syncOrientationUI() {
    orientationPresetsEl.querySelectorAll('.place-chip').forEach(btn => {
      const o = ORIENTATION_PRESETS.find(p => p.id === btn.dataset.orientId);
      const on = !!o && o.headAz === fixedHeadAz;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function fixedFeetNote(headAz) {
    if (headAz === 90) return 'mare (ovest)';
    return cardinalIt((headAz + 180) % 360);
  }

  function applyFixedOrientation(headAz, persist) {
    fixedHeadAz = normalizeAz(headAz);
    syncOrientationUI();
    if (compassMode === 'off') {
      sky.setOrientation(fixedHeadAz);
      orientationNote.textContent = '↓ ' + fixedFeetNote(fixedHeadAz);
    }
    if (persist) storageSet('pala_orient', fixedHeadAz);
  }

  // Rotazione manuale (due dita): esce dalla bussola e gira liberamente la mappa.
  sky.onRotate = (headAz) => {
    if (compassMode !== 'off') stopCompass();
    applyFixedOrientation(headAz, false);
  };
  sky.onRotateEnd = (headAz) => {
    storageSet('pala_orient', fixedHeadAz);
  };

  function applyLocation(lat, lon, persist) {
    sky.setLocation(lat, lon);
    syncLocationInputs(lat, lon);
    syncPlacePresetUI(lat, lon);
    if (persist) {
      storageSet('pala_lat', lat);
      storageSet('pala_lon', lon);
    }
    updateTime();
  }

  function loadPrefs() {
    const b = parseInt(storageGet('pala_bortle', '4'), 10);
    bortleSlider.value = Math.max(1, Math.min(9, b));
    maskEast.value = parseInt(storageGet('pala_east', '0'), 10);
    maskWest.value = parseInt(storageGet('pala_west', '0'), 10);
    const lat = parseCoord(storageGet('pala_lat', ''), -90, 90, DEFAULT_LAT);
    const lon = parseCoord(storageGet('pala_lon', ''), -180, 180, DEFAULT_LON);
    syncLocationInputs(lat, lon);
    if (lat !== sky.lat || lon !== sky.lon) sky.setLocation(lat, lon);
    syncPlacePresetUI(lat, lon);
    const headAz = parseInt(storageGet('pala_orient', String(DEFAULT_HEAD_AZ)), 10);
    applyFixedOrientation(
      ORIENTATION_PRESETS.some(p => p.headAz === headAz) ? headAz : DEFAULT_HEAD_AZ,
      false
    );
    setFab(fabNight, storageGet('pala_night', '0') === '1');
    setFab(fabConst, storageGet('pala_const', '1') !== '0');
    setFab(fabNames, storageGet('pala_names', '1') !== '0');
    setFab(fabArt, storageGet('pala_art', '0') === '1');
    setFab(fabAz, storageGet('pala_az', '0') === '1');
    updateMaskValues();
    applyBortle();
    applyDisplayPrefs();
  }

  function savePrefs() {
    storageSet('pala_bortle', bortleSlider.value);
    storageSet('pala_east',   maskEast.value);
    storageSet('pala_west',   maskWest.value);
    storageSet('pala_lat',    sky.lat);
    storageSet('pala_lon',    sky.lon);
    storageSet('pala_orient', fixedHeadAz);
    storageSet('pala_night',  fabOn(fabNight) ? '1' : '0');
    storageSet('pala_const',  fabOn(fabConst) ? '1' : '0');
    storageSet('pala_names',  fabOn(fabNames) ? '1' : '0');
    storageSet('pala_art',    fabOn(fabArt) ? '1' : '0');
    storageSet('pala_az',     fabOn(fabAz) ? '1' : '0');
  }

  function applyDisplayPrefs() {
    const nightOn = fabOn(fabNight);
    if (nightOn) document.documentElement.dataset.night = '1';
    else delete document.documentElement.dataset.night;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', nightOn ? '#0a0200' : '#080c18');
    sky.setNightMode(nightOn);
    sky.setShowConstellations(fabOn(fabConst));
    sky.setShowStarNames(fabOn(fabNames));
    sky.setShowConstellationArt(fabOn(fabArt));
    sky.setShowAzimuthRays(fabOn(fabAz));
  }

  function onFabClick(btn) {
    setFab(btn, !fabOn(btn));
    applyDisplayPrefs();
    savePrefs();
  }

  fabNight.addEventListener('click', () => onFabClick(fabNight));
  fabConst.addEventListener('click', () => onFabClick(fabConst));
  fabNames.addEventListener('click', () => onFabClick(fabNames));
  fabArt.addEventListener('click', () => onFabClick(fabArt));
  fabAz.addEventListener('click', () => onFabClick(fabAz));

  /* ──────────────────────────────────────────────────────────
     Sheet management
  ────────────────────────────────────────────────────────── */
  function openExplore() {
    exploreOpen = true;
    lastFocusExplore = document.activeElement;
    exploreOverlay.classList.add('open');
    exploreOverlay.setAttribute('aria-hidden', 'false');
    setTimeout(() => exploreSearch.focus(), 50);
  }

  function closeExplore() {
    exploreOpen = false;
    exploreOverlay.classList.remove('open');
    exploreOverlay.setAttribute('aria-hidden', 'true');
    exploreSearch.value = '';
    showTabView();
    if (lastFocusExplore) { lastFocusExplore.focus(); lastFocusExplore = null; }
  }

  function openSettings() {
    settingsOpen = true;
    lastFocusSettings = document.activeElement;
    settingsOverlay.classList.add('open');
    settingsOverlay.setAttribute('aria-hidden', 'false');
    setTimeout(() => bortleSlider.focus(), 50);
  }

  function closeSettings() {
    settingsOpen = false;
    settingsOverlay.classList.remove('open');
    settingsOverlay.setAttribute('aria-hidden', 'true');
    if (lastFocusSettings) { lastFocusSettings.focus(); lastFocusSettings = null; }
  }

  btnExplore.addEventListener('click', () => exploreOpen ? closeExplore() : openExplore());
  btnSettings.addEventListener('click', () => settingsOpen ? closeSettings() : openSettings());
  btnExploreClose.addEventListener('click', closeExplore);
  btnSettingsClose.addEventListener('click', closeSettings);

  // Backdrop click closes the sheet (but not the panel itself)
  exploreOverlay.addEventListener('click', (e) => {
    if (e.target === exploreOverlay) closeExplore();
  });
  settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) closeSettings();
  });

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (exploreOpen) closeExplore();
    else if (settingsOpen) closeSettings();
  });

  /* ──────────────────────────────────────────────────────────
     Explore tabs
  ────────────────────────────────────────────────────────── */
  exploreTablist.querySelectorAll('.sheet-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      exploreTablist.querySelectorAll('.sheet-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      activeExploreTab = tab.dataset.tab;
      showTabView();
    });
  });

  function showTabView() {
    exploreConsts.classList.toggle('active', activeExploreTab === 'constellations');
    exploreStars.classList.toggle('active', activeExploreTab === 'stars');
    exploreResults.classList.remove('active');
    // update tab button state
    exploreTablist.querySelectorAll('.sheet-tab').forEach(t => {
      const isActive = t.dataset.tab === activeExploreTab;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    // show tabs bar, hide if search active
    exploreTablist.style.display = '';
  }

  /* ──────────────────────────────────────────────────────────
     Search / filter
  ────────────────────────────────────────────────────────── */
  exploreSearch.addEventListener('input', () => {
    const q = exploreSearch.value.trim().toLowerCase();
    if (!q) { showTabView(); return; }
    filterExplore(q);
  });

  function filterExplore(q) {
    const cMatches = CONSTELLATION_MYTHS.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.desc && m.desc.toLowerCase().includes(q))
    );
    const sMatches = STAR_MYTHS.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.desc && m.desc.toLowerCase().includes(q))
    );

    // Hide tab bar, show combined results
    exploreTablist.style.display = 'none';
    exploreConsts.classList.remove('active');
    exploreStars.classList.remove('active');
    exploreResults.innerHTML = '';
    exploreResults.classList.add('active');

    if (!cMatches.length && !sMatches.length) {
      exploreResults.innerHTML = `<div class="explore-empty">Nessun risultato per "<em>${q}</em>"</div>`;
      return;
    }

    if (cMatches.length) {
      exploreResults.appendChild(makeSectionHeader('Costellazioni'));
      cMatches.forEach(myth => exploreResults.appendChild(makeConstItem(myth)));
    }
    if (sMatches.length) {
      exploreResults.appendChild(makeSectionHeader('Stelle'));
      sMatches.forEach(smyth => exploreResults.appendChild(makeStarItem(smyth)));
    }
  }

  function makeSectionHeader(text) {
    const h = document.createElement('div');
    h.className = 'explore-section-header';
    h.textContent = text;
    return h;
  }

  /* ──────────────────────────────────────────────────────────
     Build explore lists
  ────────────────────────────────────────────────────────── */
  function buildExploreLists() {
    // Constellations
    exploreConsts.innerHTML = '';
    const clearBtn = makeClearBtn();
    exploreConsts.appendChild(clearBtn);
    CONSTELLATION_MYTHS.forEach(myth => exploreConsts.appendChild(makeConstItem(myth)));

    // Stars
    exploreStars.innerHTML = '';
    STAR_MYTHS.forEach(smyth => exploreStars.appendChild(makeStarItem(smyth)));
  }

  function makeClearBtn() {
    const btn = document.createElement('button');
    btn.className = 'explore-item explore-clear';
    btn.setAttribute('aria-label', 'Deseleziona tutto');
    btn.innerHTML = `<span class="explore-item-name"><span class="item-icon" aria-hidden="true">✕</span> Nessuna selezione</span>`;
    btn.addEventListener('click', clearHighlight);
    return btn;
  }

  function makeConstItem(myth) {
    const btn = document.createElement('button');
    btn.className = 'explore-item';
    btn.dataset.constId = myth.id;
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', myth.name);
    btn.innerHTML = `
      <div class="explore-item-name">${myth.name}</div>
      <div class="explore-item-sub">${myth.id}</div>
      <div class="explore-item-desc">${myth.desc}</div>`;

    btn.addEventListener('click', () => {
      const wasHL = btn.classList.contains('highlighted');
      clearAllHighlightClasses();
      if (wasHL) {
        clearHighlight();
      } else {
        btn.classList.add('highlighted', 'expanded');
        btn.setAttribute('aria-expanded', 'true');
        sky.setHighlighted({ type: 'constellation', id: myth.id });
      }
    });

    syncItemClass(btn, 'constellation', myth.id, null);
    return btn;
  }

  function makeStarItem(smyth) {
    const idx = STAR_NAMES.indexOf(smyth.name);
    const btn = document.createElement('button');
    btn.className = 'explore-item';
    btn.dataset.nameIdx = idx;
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', smyth.name);
    btn.innerHTML = `
      <div class="explore-item-name"><span class="item-icon" aria-hidden="true">★</span>${smyth.name}</div>
      <div class="explore-item-sub">${smyth.constellation || ''}</div>
      <div class="explore-item-desc">${smyth.desc}</div>`;

    btn.addEventListener('click', () => {
      if (idx < 0) return;
      const wasHL = btn.classList.contains('highlighted');
      clearAllHighlightClasses();
      if (wasHL) {
        clearHighlight();
      } else {
        btn.classList.add('highlighted', 'expanded');
        btn.setAttribute('aria-expanded', 'true');
        sky.setHighlighted({ type: 'star', nameIdx: idx });
      }
    });

    syncItemClass(btn, 'star', null, idx);
    return btn;
  }

  function syncItemClass(btn, type, constId, nameIdx) {
    btn.classList.remove('highlighted', 'expanded');
    btn.setAttribute('aria-expanded', 'false');
    if (!sky.highlighted) return;
    let match = false;
    if (type === 'constellation' && sky.highlighted.type === 'constellation' && sky.highlighted.id === constId) match = true;
    if (type === 'star' && sky.highlighted.type === 'star' && sky.highlighted.nameIdx === nameIdx) match = true;
    if (match) {
      btn.classList.add('highlighted', 'expanded');
      btn.setAttribute('aria-expanded', 'true');
    }
  }

  function clearAllHighlightClasses() {
    document.querySelectorAll('.explore-item.highlighted').forEach(el => {
      el.classList.remove('highlighted', 'expanded');
      el.setAttribute('aria-expanded', 'false');
    });
  }

  function clearHighlight() {
    sky.setHighlighted(null);
    clearAllHighlightClasses();
  }

  /* ──────────────────────────────────────────────────────────
     Bortle / sky conditions
  ────────────────────────────────────────────────────────── */
  function buildBortleLabels() {
    bortleLabels.innerHTML = '';
    for (let i = 1; i <= 9; i++) {
      const s = document.createElement('span');
      s.textContent = i;
      bortleLabels.appendChild(s);
    }
  }

  function applyBortle() {
    const cls = parseInt(bortleSlider.value, 10);
    const cfg = BORTLE_CONFIG[cls - 1];
    sky.setSkyConditions(cfg.limitingMag, cfg.skyGlow);
    renderBortleCard(cls, cfg);
  }

  function renderBortleCard(cls, cfg) {
    const stars = BORTLE_STAR_COUNTS[cfg.limitingMag] || '—';
    const atCeiling = cfg.limitingMag >= 5.0;
    bortleCard.innerHTML = `
      <div class="bortle-card-header">
        <span class="bortle-badge">Bortle ${cls}</span>
        <span class="bortle-class-name">${cfg.label}</span>
      </div>
      <div class="bortle-mag">Stelle visibili ad occhio nudo: fino a mag.&nbsp;${cfg.limitingMag.toFixed(1)}</div>
      <div class="bortle-desc">${cfg.desc}</div>
      ${atCeiling ? '<div class="bortle-catalog-note">ℹ Il catalogo contiene stelle fino a mag. 5.0 — Bortle 1–3 mostrano le stesse stelle.</div>' : `<div class="bortle-catalog-note">~${stars} stelle visibili su 1.627 nel catalogo</div>`}
    `;
  }

  bortleSlider.addEventListener('input', () => { applyBortle(); savePrefs(); });

  /* ──────────────────────────────────────────────────────────
     Mask sliders
  ────────────────────────────────────────────────────────── */
  function updateMaskValues() {
    maskEastVal.textContent = maskEast.value + '°';
    maskWestVal.textContent = maskWest.value + '°';
  }

  function applyMasks() {
    sky.setMask(parseInt(maskEast.value, 10), parseInt(maskWest.value, 10));
    updateMaskValues();
    savePrefs();
  }

  maskEast.addEventListener('input', applyMasks);
  maskWest.addEventListener('input', applyMasks);

  /* ──────────────────────────────────────────────────────────
     Location
  ────────────────────────────────────────────────────────── */
  function commitLocationFromInputs() {
    const lat = parseCoord(locLat.value, -90, 90, NaN);
    const lon = parseCoord(locLon.value, -180, 180, NaN);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      syncLocationInputs(sky.lat, sky.lon);
      return;
    }
    if (lat === sky.lat && lon === sky.lon) {
      syncLocationInputs(lat, lon); // normalize clamped display
      return;
    }
    applyLocation(lat, lon, true);
  }

  locLat.addEventListener('change', commitLocationFromInputs);
  locLon.addEventListener('change', commitLocationFromInputs);

  /* ──────────────────────────────────────────────────────────
     Time slider + current night
  ────────────────────────────────────────────────────────── */
  function initSlider() {
    const totalSteps = Math.floor((MAX_TIME - MIN_TIME) / TIME_STEP);
    timeSlider.max = totalSteps;
    syncSliderFromMinutes();
    timeSlider.addEventListener('input', () => {
      selectedMinutes = MIN_TIME + parseInt(timeSlider.value, 10) * TIME_STEP;
      updateLabels();
      updateTime();
    });
    updateLabels();
  }

  function syncSliderFromMinutes() {
    const clamped = Math.max(MIN_TIME, Math.min(MAX_TIME, selectedMinutes));
    selectedMinutes = clamped;
    timeSlider.value = Math.round((selectedMinutes - MIN_TIME) / TIME_STEP);
  }

  function updateLabels() {
    let h = Math.floor(selectedMinutes / 60);
    let m = selectedMinutes % 60;
    if (h >= 24) h -= 24;
    hourLabel.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  function makeDate(anchor, minutes) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 0, 0, 0);
    let h = Math.floor(minutes / 60);
    let m = minutes % 60;
    if (h >= 24) { h -= 24; d.setDate(d.getDate() + 1); }
    d.setHours(h, m, 0, 0);
    return d;
  }

  /** Minuti da mezzanotte dell'anchor (stesso schema di selectedMinutes). */
  function dateToNightMinutes(anchor, date) {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 0, 0, 0, 0);
    let mins = Math.round((date.getTime() - start.getTime()) / 60000);
    if (mins < 0) mins += DAY_MINUTES;
    return mins;
  }

  function updateTime() {
    sky.setTime(makeDate(nightAnchor, selectedMinutes));
    updateEclipseMarkers();
    updateInfo();
  }

  function stopPlay() {
    if (!isPlaying) return;
    isPlaying = false;
    btnPlay.textContent = '▶';
    btnPlay.setAttribute('aria-label', 'Riproduci animazione');
    speedLabel.style.display = 'none';
    clearTimeout(playTimer);
    playTimer = null;
  }

  function isEclipseNight() {
    return (
      nightAnchor.getFullYear() === ECLIPSE_DAY.getFullYear() &&
      nightAnchor.getMonth() === ECLIPSE_DAY.getMonth() &&
      nightAnchor.getDate() === ECLIPSE_DAY.getDate()
    );
  }

  function updateEclipseMarkers() {
    if (!eclipseMarkers) return;
    eclipseMarkers.innerHTML = '';
    if (!isEclipseNight()) {
      btnEclipse.setAttribute('aria-pressed', 'false');
      return;
    }
    btnEclipse.setAttribute('aria-pressed', 'true');
    const ecl = sky.getLocalSolarEclipse(nightAnchor);
    if (!ecl) return;

    const span = MAX_TIME - MIN_TIME;
    const addMark = (date, cls, title) => {
      const mins = dateToNightMinutes(nightAnchor, date);
      if (mins < MIN_TIME || mins > MAX_TIME) return;
      const pct = ((mins - MIN_TIME) / span) * 100;
      const el = document.createElement('span');
      el.className = 'ecl-mark' + (cls ? ' ' + cls : '');
      el.style.left = pct + '%';
      el.title = title;
      eclipseMarkers.appendChild(el);
    };

    addMark(ecl.partialBegin.time, '', `Inizio ${fmt(ecl.partialBegin.time)}`);
    addMark(ecl.peak.time, 'ecl-mark--peak', `Massimo ${fmt(ecl.peak.time)}`);
    addMark(
      ecl.partialEnd.time,
      ecl.partialEnd.altitude < 0 ? 'ecl-mark--ended' : '',
      ecl.partialEnd.altitude < 0
        ? `Fine astronomica ${fmt(ecl.partialEnd.time)} (dopo il tramonto)`
        : `Fine ${fmt(ecl.partialEnd.time)}`
    );
  }

  function jumpToEclipse() {
    stopPlay();
    nightAnchor = startOfLocalDay(ECLIPSE_DAY);
    const ecl = sky.getLocalSolarEclipse(nightAnchor);
    if (ecl) {
      selectedMinutes = dateToNightMinutes(nightAnchor, ecl.partialBegin.time);
    } else {
      selectedMinutes = 19 * 60 + 30;
    }
    syncSliderFromMinutes();
    updateLabels();
    updateTime();
  }

  /** Snap UI to the real clock, clamping to the night window. */
  function applyNow() {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();

    if (mins >= MIN_TIME) {
      // Evening of today
      nightAnchor = startOfLocalDay(now);
      selectedMinutes = Math.min(mins, MAX_TIME);
    } else if (mins <= MAX_TIME - DAY_MINUTES) {
      // Early morning — still the previous evening's night
      nightAnchor = startOfLocalDay(now);
      nightAnchor.setDate(nightAnchor.getDate() - 1);
      selectedMinutes = mins + DAY_MINUTES;
    } else {
      // Daytime — start tonight at 18:00
      nightAnchor = startOfLocalDay(now);
      selectedMinutes = MIN_TIME;
    }

    syncSliderFromMinutes();
    updateLabels();
    updateTime();
  }

  /* ──────────────────────────────────────────────────────────
     Info bar
  ────────────────────────────────────────────────────────── */
  function fmt(d) {
    if (!d) return '';
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  function moonEmoji(frac, waxing) {
    if (frac < 0.03) return '🌑';
    if (frac > 0.97) return '🌕';
    if (frac < 0.40) return waxing ? '🌒' : '🌘';
    if (frac < 0.60) return waxing ? '🌓' : '🌗';
    return waxing ? '🌔' : '🌖';
  }

  function moonPhaseName(frac, waxing) {
    if (frac < 0.03) return 'Luna nuova';
    if (frac > 0.97) return 'Luna piena';
    if (frac < 0.40) return waxing ? 'Falce crescente' : 'Falce calante';
    if (frac < 0.60) return waxing ? 'Primo quarto' : 'Ultimo quarto';
    return waxing ? 'Gibbosa crescente' : 'Gibbosa calante';
  }

  function updateInfo() {
    const info = sky.getInfo();
    const waxing = info.moonWaxing !== false;

    const eclStatus = isEclipseNight()
      ? sky.getEclipseStatus(makeDate(nightAnchor, selectedMinutes))
      : null;

    // Sun chip — on eclipse night prefer contact times
    if (eclStatus) {
      const endNote = eclStatus.partialEnd.altitude < 0
        ? '· fine dopo ↓'
        : `· fine ${fmt(eclStatus.partialEnd.time)}`;
      infoSunText.textContent =
        `ecl ${fmt(eclStatus.partialBegin.time)} · max ${fmt(eclStatus.peak.time)} ${endNote}`;
      infoSunChip.title =
        `Eclissi: inizio ${fmt(eclStatus.partialBegin.time)}, ` +
        `massimo ${fmt(eclStatus.peak.time)} (${Math.round(eclStatus.obscuration * 100)}%), ` +
        (eclStatus.partialEnd.altitude < 0
          ? `fine astronomica ${fmt(eclStatus.partialEnd.time)} (Sole già tramontato)`
          : `fine ${fmt(eclStatus.partialEnd.time)}`) +
        (info.sunset ? ` · tramonto ${fmt(info.sunset)}` : '');
    } else {
      const sunParts = [];
      if (info.sunset)  sunParts.push(`↓ ${fmt(info.sunset)}`);
      if (info.sunRise) sunParts.push(`↑ ${fmt(info.sunRise)}`);
      infoSunText.textContent = sunParts.length ? sunParts.join(' · ') : '—';
      infoSunChip.title = 'Tramonto e alba';
    }

    // Moon chip
    const fi = info.moonIllum;
    infoMoonIcon.textContent = moonEmoji(fi, waxing);
    const phaseName = moonPhaseName(fi, waxing);
    infoMoonText.textContent = `${phaseName} · ${Math.round(fi * 100)}%`;

    // Planets chip
    const visiblePlanets = (info.planets || []).filter(p => p.alt > 5);
    if (visiblePlanets.length) {
      const symbols = visiblePlanets.map(p => PLANET_SYMBOLS[p.name] || p.name).join(' ');
      infoPlanetsText.textContent = symbols;
      const names = visiblePlanets.map(p => p.name).join(', ');
      infoPlanetsChip.setAttribute('title', `Visibili: ${names}`);
      infoPlanetsChip.setAttribute('aria-label', `Pianeti visibili: ${names}`);
      infoPlanetsChip.style.display = '';
    } else {
      infoPlanetsChip.style.display = 'none';
    }

    // Event / eclipse status banner
    const month = nightAnchor.getMonth();
    const day = nightAnchor.getDate();
    let eventText = '';

    if (eclStatus) {
      const peakPct = Math.round(eclStatus.obscuration * 100);
      const nowPct = Math.round(eclStatus.obscurationNow * 100);
      const begin = fmt(eclStatus.partialBegin.time);
      const peak = fmt(eclStatus.peak.time);
      const end = fmt(eclStatus.partialEnd.time);
      const endAfterSunset = eclStatus.partialEnd.altitude < 0;
      const sunDown = eclStatus.sunAltitude < 0;

      if (eclStatus.phase === 'before') {
        eventText = `☀ Eclissi parziale · inizio ${begin} · max ${peak} (${peakPct}%)`;
      } else if (eclStatus.phase === 'peak') {
        eventText = sunDown
          ? `☀ Massimo eclissi · ${peakPct}% · Sole all'orizzonte / appena tramontato`
          : `☀ Massimo eclissi · ~${nowPct}% oscurato`;
      } else if (eclStatus.phase === 'during') {
        if (sunDown) {
          eventText = endAfterSunset
            ? `☀ Eclissi in corso sotto l'orizzonte · fine astr. ${end}`
            : `☀ Eclissi in corso · Sole tramontato`;
        } else {
          eventText = `☀ Eclissi in corso · ~${nowPct}% · max ${peak} (${peakPct}%)`;
        }
      } else if (eclStatus.phase === 'after') {
        eventText = endAfterSunset
          ? `☀ Eclissi conclusa (fine astr. ${end}, dopo il tramonto) · ☄ Perseidi`
          : `☀ Eclissi conclusa alle ${end} · ☄ Perseidi`;
      } else {
        eventText = `☀ Eclissi parziale 12 ago · ${begin} → ${peak} → ${end}`;
      }
    } else if (month === 7) {
      if (day === 6) eventText = 'Ultimo quarto: la luna sorge dopo mezzanotte — serata buona';
      else if (day === 7 || day === 8) eventText = 'La luna sorge tardi — prime ore buie ottime per la Via Lattea';
      else if (day === 11 || day === 14) eventText = '☄ Perseidi attive — cerca stelle cadenti dopo mezzanotte';
      else if (day === 12) eventText = '☀ Eclissi parziale al tramonto · ☄ Picco Perseidi';
      else if (day === 13) eventText = '☄ Picco Perseidi! Guarda verso nord-est dopo mezzanotte';
      else if (day >= 15 && day <= 18) eventText = 'Falce crescente visibile dopo il tramonto · Via Lattea a tarda notte';
    }

    if (eventText) {
      infoEvent.textContent = eventText;
      infoEvent.style.display = '';
    } else {
      infoEvent.style.display = 'none';
    }
  }

  /* ──────────────────────────────────────────────────────────
     Play button
  ────────────────────────────────────────────────────────── */
  btnPlay.addEventListener('click', () => {
    isPlaying = !isPlaying;
    btnPlay.textContent   = isPlaying ? '⏸' : '▶';
    btnPlay.setAttribute('aria-label', isPlaying ? 'Pausa animazione' : 'Riproduci animazione');
    speedLabel.style.display = isPlaying ? 'inline' : 'none';
    if (isPlaying) {
      playStep();
    } else {
      clearTimeout(playTimer);
      playTimer = null;
    }
  });

  function playStep() {
    if (!isPlaying) return;
    selectedMinutes += TIME_STEP;
    if (selectedMinutes > MAX_TIME) {
      selectedMinutes = MIN_TIME;
    }
    syncSliderFromMinutes();
    updateLabels();
    updateTime();
    playTimer = setTimeout(playStep, ANIM_SPEED);
  }

  /* ──────────────────────────────────────────────────────────
     "Adesso" / "Eclissi" buttons
  ────────────────────────────────────────────────────────── */
  btnNow.addEventListener('click', () => {
    stopPlay();
    applyNow();
  });

  btnEclipse.addEventListener('click', () => {
    jumpToEclipse();
  });

  /* ──────────────────────────────────────────────────────────
     Compass — heading allinea la mappa; tilt = solo bolla/prompt
  ────────────────────────────────────────────────────────── */
  const CARDINAL_IT = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const COMPASS_SMOOTH = 0.12;
  const COMPASS_DEADBAND_AZ = 1.2;
  const FRAMING_MAX_ANG = 32;

  /** off | following */
  let compassMode = 'off';
  let compassRawHeading = null;
  let compassRawLookAlt = null;
  let compassSmoothAz = null;
  let compassLastAz = null;
  let compassGotAbsolute = false;
  let compassAbsoluteHandler = null;
  let compassRelativeHandler = null;

  function normalizeAz(az) {
    return ((az % 360) + 360) % 360;
  }

  function azDelta(a, b) {
    return Math.abs(((a - b + 540) % 360) - 180);
  }

  function cardinalIt(az) {
    return CARDINAL_IT[Math.round(normalizeAz(az) / 45) % 8];
  }

  function screenOrientationOffset() {
    if (screen.orientation && typeof screen.orientation.angle === 'number') {
      return screen.orientation.angle;
    }
    if (typeof window.orientation === 'number') return window.orientation;
    return 0;
  }

  function headingFromEvent(e) {
    if (e == null) return null;
    // iOS: clockwise from north, relative to top of screen
    if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
      return e.webkitCompassHeading;
    }
    if (typeof e.alpha !== 'number' || Number.isNaN(e.alpha)) return null;
    // Absolute alpha: 0 = north, increases counterclockwise → compass heading
    let heading = (360 - e.alpha) % 360;
    heading = normalizeAz(heading + screenOrientationOffset());
    return heading;
  }

  /**
   * Inclinazione telefono → altitudine stimata (solo bolla / prompt, non la camera):
   *   telefono piatto (tilt ~0) → zenit (90°)
   *   telefono dritto (tilt ~90) → orizzonte (0°)
   *   oltre quelle soglie → -1 (stile bolla “verso il suolo”, mappa resta attiva)
   * Ritorna null se il sensore manca.
   */
  function lookAltFromEvent(e) {
    if (e == null || typeof e.beta !== 'number' || Number.isNaN(e.beta)) return null;
    const angle = screenOrientationOffset();
    let tilt;
    if (angle === 90 || angle === -90 || angle === 270) {
      if (typeof e.gamma !== 'number' || Number.isNaN(e.gamma)) return null;
      // Landscape: |gamma| ~0 piatto (zenit), ~90 dritto (orizzonte)
      tilt = Math.abs(e.gamma);
    } else {
      tilt = e.beta;
    }

    // Solo feedback bolla: non blocca la mappa
    if (tilt < -5 || tilt > 95) return -1;

    const clamped = Math.max(0, Math.min(90, tilt));
    return 90 - clamped;
  }

  /** Costellazione più vicina alla direzione di sguardo (az + alt). */
  function framingConstellationName(headAz, lookAlt, date, obs) {
    let bestName = null;
    let bestAng = FRAMING_MAX_ANG;
    for (const info of Object.values(CONST_NAMES_IT)) {
      try {
        const hor = Astronomy.Horizon(date, obs, info.ra / 15, info.dec, 'normal');
        if (hor.altitude < 0) continue;
        const dAz = azDelta(hor.azimuth, headAz);
        const dAlt = hor.altitude - lookAlt;
        const ang = Math.hypot(dAz, dAlt);
        if (ang < bestAng) {
          bestAng = ang;
          bestName = info.n;
        }
      } catch (err) { /* skip */ }
    }
    return bestName;
  }

  function showPointPrompt() {
    calibratePrompt.hidden = false;
    calibratePrompt.setAttribute('aria-hidden', 'false');
    calibratePrompt.classList.add('is-following');
  }

  function hidePointPrompt() {
    calibratePrompt.hidden = true;
    calibratePrompt.setAttribute('aria-hidden', 'true');
    calibratePrompt.classList.remove('is-following');
    if (pitchBolla) pitchBolla.classList.remove('is-below');
  }

  function updatePitchBolla(lookAlt) {
    if (!pitchBollaDot || !pitchBolla) return;
    const below = lookAlt < 0;
    pitchBolla.classList.toggle('is-below', below);
    const t = below ? 0 : Math.max(0, Math.min(1, lookAlt / 90));
    // track verticale: zenit in alto, orizzonte in basso (margine per il raggio del dot)
    pitchBollaDot.style.top = (12 + (1 - t) * 76) + '%';
  }

  function updateFramingLabel(headAz, lookAlt) {
    if (headAz != null) {
      const feetAz = normalizeAz(headAz + 180);
      orientationNote.textContent = '↓ ' + cardinalIt(feetAz);
    }
    updatePitchBolla(lookAlt);
    if (headAz == null) {
      calibrateText.textContent = 'Muovi il telefono';
      return;
    }
    // Tilt sotto-orizzonte: stima all’orizzonte, senza bloccare la vista
    const altForFrame = lookAlt == null || lookAlt < 0 ? 0 : lookAlt;
    const name = framingConstellationName(headAz, altForFrame, sky.date, sky.observer);
    calibrateText.textContent = name ? ('Verso: ' + name) : 'Muovi il telefono';
  }

  function applyDevicePose() {
    if (compassMode !== 'following') return;

    // Solo tilt: aggiorna bolla/prompt, non tocca zoom/pan
    if (compassRawHeading == null) {
      if (compassRawLookAlt != null) updateFramingLabel(null, compassRawLookAlt);
      return;
    }

    const targetAz = normalizeAz(compassRawHeading);
    if (compassSmoothAz == null) {
      compassSmoothAz = targetAz;
    } else {
      const diffAz = ((targetAz - compassSmoothAz + 540) % 360) - 180;
      compassSmoothAz = normalizeAz(compassSmoothAz + diffAz * COMPASS_SMOOTH);
    }

    const movedAz = compassLastAz == null || azDelta(compassSmoothAz, compassLastAz) >= COMPASS_DEADBAND_AZ;
    if (movedAz) {
      compassLastAz = compassSmoothAz;
      sky.setOrientation(compassSmoothAz);
    }

    const lookAlt = compassRawLookAlt == null ? 70 : compassRawLookAlt;
    updateFramingLabel(compassSmoothAz, lookAlt);
  }

  function ingestOrientation(e, { fromAbsolute }) {
    const alt = lookAltFromEvent(e);
    if (alt != null) compassRawLookAlt = alt;

    if (fromAbsolute) {
      const h = headingFromEvent(e);
      if (h != null) {
        compassGotAbsolute = true;
        compassRawHeading = h;
      }
      applyDevicePose();
      return;
    }

    // Relative: aggiorna sempre il tilt; heading solo finché absolute non arriva
    if (!compassGotAbsolute) {
      if (e && typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
        compassRawHeading = e.webkitCompassHeading;
      } else {
        const h = headingFromEvent(e);
        if (h != null) compassRawHeading = h;
      }
    }
    applyDevicePose();
  }

  function onAbsoluteOrientation(e) {
    ingestOrientation(e, { fromAbsolute: true });
  }

  function onRelativeOrientation(e) {
    ingestOrientation(e, { fromAbsolute: false });
  }

  function stopCompass() {
    compassMode = 'off';
    compassRawHeading = null;
    compassRawLookAlt = null;
    compassSmoothAz = null;
    compassLastAz = null;
    compassGotAbsolute = false;
    if (compassAbsoluteHandler) {
      window.removeEventListener('deviceorientationabsolute', compassAbsoluteHandler);
      compassAbsoluteHandler = null;
    }
    if (compassRelativeHandler) {
      window.removeEventListener('deviceorientation', compassRelativeHandler);
      compassRelativeHandler = null;
    }
    btnCompass.setAttribute('aria-pressed', 'false');
    btnCompass.setAttribute('aria-label', 'Punta il cielo');
    btnCompass.title = 'Punta il cielo';
    hidePointPrompt();
    sky.setOrientation(fixedHeadAz);
    orientationNote.style.display = '';
    orientationNote.textContent = '↓ ' + fixedFeetNote(fixedHeadAz);
  }

  function startCompassFollow() {
    compassMode = 'following';
    compassRawHeading = null;
    compassRawLookAlt = null;
    compassSmoothAz = null;
    compassLastAz = null;
    compassGotAbsolute = false;
    compassAbsoluteHandler = onAbsoluteOrientation;
    compassRelativeHandler = onRelativeOrientation;
    window.addEventListener('deviceorientationabsolute', compassAbsoluteHandler);
    window.addEventListener('deviceorientation', compassRelativeHandler);
    btnCompass.setAttribute('aria-pressed', 'true');
    btnCompass.setAttribute('aria-label', 'Disattiva puntamento');
    btnCompass.title = 'Disattiva puntamento';
    orientationNote.style.display = '';
    showPointPrompt();
    calibrateText.textContent = 'Pizzica per zoomare · gira il telefono';
    updatePitchBolla(70);
  }

  async function requestCompassPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      const state = await DeviceOrientationEvent.requestPermission();
      return state === 'granted';
    }
    return true;
  }

  btnCompass.addEventListener('click', async () => {
    if (compassMode !== 'off') {
      stopCompass();
      return;
    }
    if (typeof window.DeviceOrientationEvent === 'undefined') {
      orientationNote.textContent = 'bussola non disponibile';
      return;
    }
    try {
      const ok = await requestCompassPermission();
      if (!ok) {
        orientationNote.textContent = 'permesso bussola negato';
        return;
      }
    } catch (err) {
      orientationNote.textContent = 'permesso bussola negato';
      return;
    }
    startCompassFollow();
  });

  /* ──────────────────────────────────────────────────────────
     Canvas click — clear highlight
  ────────────────────────────────────────────────────────── */
  canvas.addEventListener('click', () => {
    if (exploreOpen || settingsOpen) return;
    if (compassMode !== 'off') return;
    if (sky.highlighted) clearHighlight();
  });

  /* ──────────────────────────────────────────────────────────
     Hint overlay
  ────────────────────────────────────────────────────────── */
  function initHint() {
    if (storageGet('pala_hint', '') === 'dismissed') {
      hintOverlay.classList.add('hidden');
      return;
    }
    hintOverlay.setAttribute('aria-hidden', 'false');
    hintDismiss.focus();
  }

  hintDismiss.addEventListener('click', () => {
    storageSet('pala_hint', 'dismissed');
    hintOverlay.classList.add('dismissed');
    setTimeout(() => hintOverlay.classList.add('hidden'), 450);
  });

  /* ──────────────────────────────────────────────────────────
     Init
  ────────────────────────────────────────────────────────── */
  buildBortleLabels();
  buildPlacePresets();
  buildOrientationPresets();
  buildExploreLists();
  applyNow();
  initSlider();
  loadPrefs();
  updateTime();
  initHint();

})();
