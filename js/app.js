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
  const ANIM_SPEED  = 150;  // ms per step (5 simulated minutes)

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
  const btnPlay      = document.getElementById('btn-play');
  const btnNow       = document.getElementById('btn-now');
  const speedLabel   = document.getElementById('speed-label');
  const btnExplore   = document.getElementById('btn-explore');
  const btnSettings  = document.getElementById('btn-settings');

  // Info bar
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
  const toggleNight      = document.getElementById('toggle-night');
  const toggleConst      = document.getElementById('toggle-const');
  const toggleArt        = document.getElementById('toggle-art');

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

  function loadPrefs() {
    const b = parseInt(storageGet('pala_bortle', '4'), 10);
    bortleSlider.value = Math.max(1, Math.min(9, b));
    maskEast.value = parseInt(storageGet('pala_east', '0'), 10);
    maskWest.value = parseInt(storageGet('pala_west', '0'), 10);
    toggleNight.checked = storageGet('pala_night', '0') === '1';
    toggleConst.checked = storageGet('pala_const', '1') !== '0';
    toggleArt.checked = storageGet('pala_art', '0') === '1';
    toggleNight.setAttribute('aria-checked', toggleNight.checked ? 'true' : 'false');
    toggleConst.setAttribute('aria-checked', toggleConst.checked ? 'true' : 'false');
    toggleArt.setAttribute('aria-checked', toggleArt.checked ? 'true' : 'false');
    updateMaskValues();
    applyBortle();
    applyDisplayPrefs();
  }

  function savePrefs() {
    storageSet('pala_bortle', bortleSlider.value);
    storageSet('pala_east',   maskEast.value);
    storageSet('pala_west',   maskWest.value);
    storageSet('pala_night',  toggleNight.checked ? '1' : '0');
    storageSet('pala_const',  toggleConst.checked ? '1' : '0');
    storageSet('pala_art',    toggleArt.checked ? '1' : '0');
  }

  function applyDisplayPrefs() {
    const nightOn = toggleNight.checked;
    if (nightOn) document.documentElement.dataset.night = '1';
    else delete document.documentElement.dataset.night;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', nightOn ? '#0a0200' : '#080c18');
    sky.setNightMode(nightOn);
    sky.setShowConstellations(toggleConst.checked);
    sky.setShowConstellationArt(toggleArt.checked);
  }

  function onDisplayToggle(el) {
    el.setAttribute('aria-checked', el.checked ? 'true' : 'false');
    applyDisplayPrefs();
    savePrefs();
  }

  toggleNight.addEventListener('change', () => onDisplayToggle(toggleNight));
  toggleConst.addEventListener('change', () => onDisplayToggle(toggleConst));
  toggleArt.addEventListener('change', () => onDisplayToggle(toggleArt));

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
    setTimeout(() => toggleNight.focus(), 50);
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
     Time slider + current night
  ────────────────────────────────────────────────────────── */
  function initSlider() {
    const totalSteps = (MAX_TIME - MIN_TIME) / 5;
    timeSlider.max = totalSteps;
    timeSlider.value = Math.round((selectedMinutes - MIN_TIME) / 5);
    timeSlider.addEventListener('input', () => {
      selectedMinutes = MIN_TIME + parseInt(timeSlider.value, 10) * 5;
      updateLabels();
      updateTime();
    });
    updateLabels();
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

  function updateTime() {
    sky.setTime(makeDate(nightAnchor, selectedMinutes));
    updateInfo();
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

    timeSlider.value = Math.round((selectedMinutes - MIN_TIME) / 5);
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

    // Sun chip
    const sunParts = [];
    if (info.sunset)  sunParts.push(`↓ ${fmt(info.sunset)}`);
    if (info.sunRise) sunParts.push(`↑ ${fmt(info.sunRise)}`);
    infoSunText.textContent = sunParts.length ? sunParts.join(' · ') : '—';

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

    // Event banner — based on the evening's real calendar date
    const month = nightAnchor.getMonth();
    const day = nightAnchor.getDate();
    let eventText = '';
    if (month === 7) {
      if (day === 6) eventText = 'Ultimo quarto: la luna sorge dopo mezzanotte — serata buona';
      else if (day === 7 || day === 8) eventText = 'La luna sorge tardi — prime ore buie ottime per la Via Lattea';
      else if (day === 11 || day === 14) eventText = '☄ Perseidi attive — cerca stelle cadenti dopo mezzanotte';
      else if (day === 12) eventText = '🌑 Luna nuova · ☄ Picco Perseidi — notte perfetta!';
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
    selectedMinutes += 5;
    if (selectedMinutes > MAX_TIME) {
      selectedMinutes = MIN_TIME;
    }
    timeSlider.value = Math.round((selectedMinutes - MIN_TIME) / 5);
    updateLabels();
    updateTime();
    playTimer = setTimeout(playStep, ANIM_SPEED);
  }

  /* ──────────────────────────────────────────────────────────
     "Adesso" button
  ────────────────────────────────────────────────────────── */
  btnNow.addEventListener('click', () => {
    applyNow();
    if (isPlaying) {
      isPlaying = false;
      btnPlay.textContent = '▶';
      btnPlay.setAttribute('aria-label', 'Riproduci animazione');
      speedLabel.style.display = 'none';
      clearTimeout(playTimer);
      playTimer = null;
    }
  });

  /* ──────────────────────────────────────────────────────────
     Canvas click — clear highlight
  ────────────────────────────────────────────────────────── */
  canvas.addEventListener('click', () => {
    if (exploreOpen || settingsOpen) return;
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
  buildExploreLists();
  applyNow();
  initSlider();
  loadPrefs();
  updateTime();
  initHint();

})();
