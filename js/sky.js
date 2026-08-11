// Sky rendering engine — astronomy calculations and canvas drawing

/** Costellazioni mostrate nella vista panoramica (zoom basso). */
const OVERVIEW_CONSTS = new Set([
  'UMa', 'UMi', 'Cyg', 'Aql', 'Lyr', 'Cas', 'Sco', 'Sgr',
  'Peg', 'Del', 'Her', 'Boo', 'CrB',
]);
/** Con pinch oltre questa soglia si sbloccano tutte. */
const OVERVIEW_ZOOM_FULL = 3.5;
const MAX_ZOOM = 12;
const SUN_RADIUS_KM = 695700;
const MOON_RADIUS_KM = 1737.4;
/** Separazione angolare entro cui compositare Sole+Luna come eclissi. */
const ECLIPSE_SEP_DEG = 1.5;

window.SkyRenderer = class SkyRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lat = 42.8402632;
    this.lon = 10.7780025;
    this.observer = new Astronomy.Observer(this.lat, this.lon, 0);
    this.date = new Date('2026-08-12T22:00:00+02:00');
    this.feetAz = 270; // feet toward W (mare), north appears on right
    this.headAz = (this.feetAz + 180) % 360;

    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.baseRadius = 0;
    this.viewX = 0;
    this.viewY = 0;

    this.eastMaskAlt = 0;
    this.westMaskAlt = 0;
    this.highlighted = null;
    this.limitingMag = 5.0;
    this.skyGlow = 0;
    this.nightMode = false;
    this.showConstellations = true;
    this.showConstellationArt = false;
    this.showAzimuthRays = false;
    this.showStarNames = true;
    this._eclipseCache = null;

    this.setupResize();
    this.computeStaticStars();
    this.setupZoom();
  }

  /** AstroTime → Date */
  _astroDate(t) {
    if (!t) return null;
    if (t instanceof Date) return new Date(t);
    if (t.date instanceof Date) return new Date(t.date);
    return new Date(t);
  }

  /** Raggio apparente geocentrico in gradi. */
  apparentRadiusDeg(body, date) {
    try {
      const v = Astronomy.GeoVector(body, date, true);
      const distAu = Math.hypot(v.x, v.y, v.z);
      const radiusKm = body === Astronomy.Body.Sun ? SUN_RADIUS_KM : MOON_RADIUS_KM;
      const sinArg = Math.min(1, radiusKm / (distAu * Astronomy.KM_PER_AU));
      return Math.asin(sinArg) * Astronomy.RAD2DEG;
    } catch (e) {
      return body === Astronomy.Body.Sun ? 0.27 : 0.27;
    }
  }

  angularSeparationDeg(alt1, az1, alt2, az2) {
    const toVec = (alt, az) => {
      const a = alt * Astronomy.DEG2RAD;
      const z = az * Astronomy.DEG2RAD;
      return {
        x: Math.cos(a) * Math.sin(z),
        y: Math.cos(a) * Math.cos(z),
        z: Math.sin(a),
      };
    };
    const s = toVec(alt1, az1);
    const m = toVec(alt2, az2);
    const dot = Math.min(1, Math.max(-1, s.x * m.x + s.y * m.y + s.z * m.z));
    return Math.acos(dot) * Astronomy.RAD2DEG;
  }

  /** Area di intersezione di due dischi / area del Sole (oscuramento). */
  diskObscuration(sunR, moonR, sep) {
    if (sep >= sunR + moonR) return 0;
    if (moonR - sunR >= sep) return 1;
    if (sunR - moonR >= sep) return (moonR * moonR) / (sunR * sunR);
    const R = sunR;
    const r = moonR;
    const d = sep;
    const R2 = R * R;
    const r2 = r * r;
    const d2 = d * d;
    const a = Math.acos(Math.min(1, Math.max(-1, (d2 + R2 - r2) / (2 * d * R))));
    const b = Math.acos(Math.min(1, Math.max(-1, (d2 + r2 - R2) / (2 * d * r))));
    const overlap = R2 * a + r2 * b - 0.5 * Math.sqrt(Math.max(0, (-d + R + r) * (d + R - r) * (d - R + r) * (d + R + r)));
    return Math.min(1, Math.max(0, overlap / (Math.PI * R2)));
  }

  /**
   * Prima eclissi solare locale dopo mezzogiorno del giorno di `aroundDate`.
   * Restituisce contatti in Date locali del browser + obscuration al picco.
   */
  getLocalSolarEclipse(aroundDate) {
    const d0 = aroundDate ? new Date(aroundDate) : this.date;
    const dayKey = `${d0.getFullYear()}-${d0.getMonth()}-${d0.getDate()}`;
    if (this._eclipseCache && this._eclipseCache.key === dayKey) {
      return this._eclipseCache.data;
    }

    const searchFrom = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate(), 0, 0, 0, 0);
    searchFrom.setHours(searchFrom.getHours() - 12);

    try {
      const raw = Astronomy.SearchLocalSolarEclipse(searchFrom, this.observer);
      const peakTime = this._astroDate(raw.peak.time);
      // Solo se il picco cade nel giorno civile di aroundDate (fuso locale)
      if (
        peakTime.getFullYear() !== d0.getFullYear() ||
        peakTime.getMonth() !== d0.getMonth() ||
        peakTime.getDate() !== d0.getDate()
      ) {
        this._eclipseCache = { key: dayKey, data: null };
        return null;
      }

      const eventOf = (ev) => ({
        time: this._astroDate(ev.time),
        altitude: ev.altitude,
      });

      const data = {
        kind: raw.kind,
        obscuration: raw.obscuration,
        partialBegin: eventOf(raw.partial_begin),
        peak: eventOf(raw.peak),
        partialEnd: eventOf(raw.partial_end),
        totalBegin: raw.total_begin ? eventOf(raw.total_begin) : null,
        totalEnd: raw.total_end ? eventOf(raw.total_end) : null,
      };
      this._eclipseCache = { key: dayKey, data };
      return data;
    } catch (e) {
      this._eclipseCache = { key: dayKey, data: null };
      return null;
    }
  }

  /** Stato eclissi all'istante `date` (oscuramento geometrico live). */
  getEclipseStatus(date) {
    const ecl = this.getLocalSolarEclipse(date);
    if (!ecl) return null;

    const t = date.getTime();
    const t0 = ecl.partialBegin.time.getTime();
    const tPeak = ecl.peak.time.getTime();
    const t1 = ecl.partialEnd.time.getTime();

    let phase = 'none';
    if (t < t0) phase = 'before';
    else if (t > t1) phase = 'after';
    else if (Math.abs(t - tPeak) <= 60 * 1000) phase = 'peak';
    else phase = 'during';

    const sunEqu = Astronomy.Equator(Astronomy.Body.Sun, date, this.observer, true, true);
    const sunHor = Astronomy.Horizon(date, this.observer, sunEqu.ra, sunEqu.dec, 'normal');
    const moonEqu = Astronomy.Equator(Astronomy.Body.Moon, date, this.observer, true, true);
    const moonHor = Astronomy.Horizon(date, this.observer, moonEqu.ra, moonEqu.dec, 'normal');
    const sunR = this.apparentRadiusDeg(Astronomy.Body.Sun, date);
    const moonR = this.apparentRadiusDeg(Astronomy.Body.Moon, date);
    const sep = this.angularSeparationDeg(
      sunHor.altitude, sunHor.azimuth,
      moonHor.altitude, moonHor.azimuth
    );
    let obscuration = this.diskObscuration(sunR, moonR, sep);
    if (phase === 'peak') obscuration = Math.max(obscuration, ecl.obscuration);
    if (phase === 'before' || phase === 'after') obscuration = 0;

    return {
      ...ecl,
      phase,
      obscurationNow: obscuration,
      sunAltitude: sunHor.altitude,
      separationDeg: sep,
    };
  }

  /** True se la costellazione va disegnata a questo livello di zoom. */
  isConstVisibleInOverview(id) {
    const hl = this.highlighted;
    const isHL = !!(hl && hl.type === 'constellation' && hl.id === id);
    if (this.zoom >= OVERVIEW_ZOOM_FULL) return true;
    if (OVERVIEW_CONSTS.has(id)) return true;
    return isHL;
  }

  setupResize() {
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = this.canvas.clientWidth;
      const h = this.canvas.clientHeight;
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
      this.W = w;
      this.H = h;
      this.DPR = dpr;
      this.centerX = w / 2;
      this.centerY = h / 2;
      this.baseRadius = Math.min(w, h) * 0.42;
      this.radius = this.baseRadius * this.zoom;
      this.clampPan();
      this.render();
    };
    window.addEventListener('resize', resize);
    resize();
  }

  computeStaticStars() {
    // Precompute equatorial to screen projection helper
    // Stars have fixed RA/Dec, positions change only with time of day
  }

  getMaskAlpha(alt, az) {
    if (alt <= 0) return 0.05;
    if (this.eastMaskAlt <= 0 && this.westMaskAlt <= 0) return 1.0;
    let t = 1.0;
    if (az >= 45 && az <= 135) {
      t = Math.min(t, alt / Math.max(this.eastMaskAlt, 0.5));
    }
    if (az >= 225 && az <= 315) {
      t = Math.min(t, alt / Math.max(this.westMaskAlt, 0.5));
    }
    return Math.max(0.05, Math.min(1, t));
  }

  setMask(east, west) {
    this.eastMaskAlt = east;
    this.westMaskAlt = west;
    this.render();
  }

  setHighlighted(val) {
    this.highlighted = val;
    this.render();
  }

  setSkyConditions(limitingMag, skyGlow) {
    this.limitingMag = limitingMag;
    this.skyGlow = Math.max(0, Math.min(1, skyGlow));
    this.render();
  }

  setNightMode(on) {
    this.nightMode = !!on;
    this.render();
  }

  setShowConstellations(on) {
    this.showConstellations = !!on;
    this.render();
  }

  setShowConstellationArt(on) {
    this.showConstellationArt = !!on;
    this.render();
  }

  setShowAzimuthRays(on) {
    this.showAzimuthRays = !!on;
    this.render();
  }

  setShowStarNames(on) {
    this.showStarNames = !!on;
    this.render();
  }

  setTime(date) {
    this.date = new Date(date);
    this.render();
  }

  /** headAz = azimuth at the top of the screen (degrees, 0 = N). Does not touch zoom/pan. */
  setOrientation(headAz) {
    this.headAz = ((headAz % 360) + 360) % 360;
    this.feetAz = (this.headAz + 180) % 360;
    this.render();
  }

  getInfo() {
    const d = this.date;
    const obs = this.observer;

    // Sun
    const sunEqu = Astronomy.Equator(Astronomy.Body.Sun, d, obs, true, true);
    const sunHor = Astronomy.Horizon(d, obs, sunEqu.ra, sunEqu.dec, 'normal');

    // Compute sunset/rise
    let sunset = null, sunRise = null;
    try {
      const midnight = new Date(d);
      midnight.setHours(0, 0, 0, 0);
      const noon = new Date(midnight);
      noon.setHours(12, 0, 0, 0);

      try { const rs = Astronomy.SearchRiseSet(Astronomy.Body.Sun, obs, -1, noon, 2); if (rs) sunset = rs.date; } catch(e) {}
      try { const rs = Astronomy.SearchRiseSet(Astronomy.Body.Sun, obs, 1, midnight, 2); if (rs) sunRise = rs.date; } catch(e) {}
    } catch(e) {}

    // Moon
    const moonEqu = Astronomy.Equator(Astronomy.Body.Moon, d, obs, true, true);
    const moonHor = Astronomy.Horizon(d, obs, moonEqu.ra, moonEqu.dec, 'normal');
    const moonIllum = Astronomy.Illumination(Astronomy.Body.Moon, d);

    let moonRise = null, moonSet = null;
    try {
      const midnight = new Date(d);
      midnight.setHours(0, 0, 0, 0);
      try { const mr = Astronomy.SearchRiseSet(Astronomy.Body.Moon, obs, 1, midnight, 2); if (mr) moonRise = mr.date; } catch(e) {}
      try { const ms = Astronomy.SearchRiseSet(Astronomy.Body.Moon, obs, -1, midnight, 2); if (ms) moonSet = ms.date; } catch(e) {}
    } catch(e) {}

    // Planets
    const planets = [];
    const planetBodies = [
      { b: Astronomy.Body.Mercury, n: 'Mercurio' },
      { b: Astronomy.Body.Venus, n: 'Venere' },
      { b: Astronomy.Body.Mars, n: 'Marte' },
      { b: Astronomy.Body.Jupiter, n: 'Giove' },
      { b: Astronomy.Body.Saturn, n: 'Saturno' },
    ];
    for (const pb of planetBodies) {
      const eq = Astronomy.Equator(pb.b, d, obs, true, true);
      const hor = Astronomy.Horizon(d, obs, eq.ra, eq.dec, 'normal');
      if (hor.altitude > -5) {
        planets.push({ name: pb.n, az: hor.azimuth, alt: hor.altitude });
      }
    }

    // Waxing when Moon is east of Sun (elongation 0–180°)
    let moonWaxing = true;
    try {
      let dRa = (moonEqu.ra - sunEqu.ra + 24) % 24;
      moonWaxing = dRa < 12;
    } catch (e) {}

    return {
      sunAlt: sunHor.altitude,
      sunAz: sunHor.azimuth,
      sunset,
      sunRise,
      moonAlt: moonHor.altitude,
      moonAz: moonHor.azimuth,
      moonIllum: moonIllum.phase_fraction,
      moonPhase: moonIllum.phase_angle,
      moonWaxing,
      moonRise,
      moonSet,
      planets,
      hasRadiant: this.isPerseidsNight(d),
    };
  }

  isPerseidsNight(date) {
    const d = new Date(date);
    const m = d.getMonth(); // 7 = August
    const day = d.getDate();
    // Perseids peak Aug 12-13
    return m === 7 && day >= 11 && day <= 14;
  }

  render() {
    const ctx = this.ctx;
    const dpr = this.DPR;
    const w = this.W;
    const h = this.H;
    this.viewX = this.centerX + this.panX;
    this.viewY = this.centerY + this.panY;
    const cx = this.viewX;
    const cy = this.viewY;
    const R = this.radius;
    const d = this.date;
    const obs = this.observer;
    const headAz = this.headAz;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    this.drawBackground(ctx, w, h);

    // Compute positions
    const sunEqu = Astronomy.Equator(Astronomy.Body.Sun, d, obs, true, true);
    const sunHor = Astronomy.Horizon(d, obs, sunEqu.ra, sunEqu.dec, 'normal');
    const sunAlt = sunHor.altitude;
    const sunScreenAngle = this.azToScreen(sunHor.azimuth);

    const moonEqu = Astronomy.Equator(Astronomy.Body.Moon, d, obs, true, true);
    const moonHor = Astronomy.Horizon(d, obs, moonEqu.ra, moonEqu.dec, 'normal');
    const moonIllum = Astronomy.Illumination(Astronomy.Body.Moon, d);
    const moonAlt = moonHor.altitude;
    const moonAz = moonHor.azimuth;
    const moonFrac = moonIllum.phase_fraction;
    const moonPhaseAngle = moonIllum.phase_angle;

    // Planets position
    const planetData = [];
    const planetBodies = [
      { b: Astronomy.Body.Mercury, n: 'Mercurio' },
      { b: Astronomy.Body.Venus, n: 'Venere' },
      { b: Astronomy.Body.Mars, n: 'Marte' },
      { b: Astronomy.Body.Jupiter, n: 'Giove' },
      { b: Astronomy.Body.Saturn, n: 'Saturno' },
    ];
    for (const pb of planetBodies) {
      const eq = Astronomy.Equator(pb.b, d, obs, true, true);
      const hor = Astronomy.Horizon(d, obs, eq.ra, eq.dec, 'normal');
      if (hor.altitude > -2) {
        const sx = this.altAzToScreen(hor.altitude, hor.azimuth);
        planetData.push({ name: pb.n, sx: sx.x, sy: sx.y, alt: hor.altitude, az: hor.azimuth });
      }
    }

    // Draw horizon ring, azimuth rays and cardinal points
    this.drawHorizon(ctx, cx, cy, R, headAz);
    if (this.showAzimuthRays) {
      this.drawAzimuthRays(ctx, cx, cy, R, headAz);
    }

    // Draw stars
    this.drawStars(ctx, cx, cy, R, headAz, d, obs, sunAlt);

    // Naked-eye galaxies (M31, M33)
    this.drawGalaxies(ctx, cx, cy, R, headAz, d, obs, sunAlt);

    // Mythological figure silhouettes (behind stick lines)
    if (this.showConstellationArt) {
      this.drawConstellationArt(ctx, cx, cy, R, headAz, d, obs, sunAlt);
    }

    if (this.showConstellations) {
      this.drawConstellationLines(ctx, cx, cy, R, headAz, d, obs, sunAlt);
      this.drawConstellationNames(ctx, cx, cy, R, headAz, d, obs, sunAlt);
    }

    // Draw Perseids radiant
    if (this.isPerseidsNight(d)) {
      this.drawRadiant(ctx, cx, cy, R, headAz, d, obs);
    }

    // Sole / Luna: durante un'eclissi composita i dischi; altrimenti separati
    const sunRdeg = this.apparentRadiusDeg(Astronomy.Body.Sun, d);
    const moonRdeg = this.apparentRadiusDeg(Astronomy.Body.Moon, d);
    const bodySep = this.angularSeparationDeg(
      sunAlt, sunHor.azimuth, moonAlt, moonAz
    );
    const inEclipseView =
      sunAlt > -5 && moonAlt > -5 && bodySep < ECLIPSE_SEP_DEG;

    if (inEclipseView) {
      this.drawEclipsedSun(
        ctx, cx, cy, R, sunHor, moonHor, sunRdeg, moonRdeg, bodySep
      );
    } else {
      if (moonAlt > -5) {
        this.drawMoon(ctx, cx, cy, R, moonAlt, moonAz, moonFrac, moonPhaseAngle, sunHor, headAz, d, obs);
      }
      if (sunAlt > -5) {
        this.drawSun(ctx, cx, cy, R, sunAlt, sunHor.azimuth);
      }
    }

    // Draw planets
    for (const p of planetData) {
      this.drawPlanet(ctx, cx, cy, R, p.name, p.alt, p.az, headAz);
    }

    if (this.nightMode) {
      this.applyNightVision(ctx, w, h);
    }

    ctx.restore();
  }

  applyNightVision(ctx, w, h) {
    // Desaturate then tint red so the phone preserves dark adaptation
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = '#ff2a00';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  azToScreen(az) {
    let a = (az - this.headAz + 360) % 360;
    return a * Math.PI / 180;
  }

  altAzToScreen(alt, az) {
    const a = this.azToScreen(az);
    const r = ((90 - Math.max(alt, 0)) / 90) * this.radius;
    return {
      x: this.viewX - r * Math.sin(a),
      y: this.viewY - r * Math.cos(a),
    };
  }

  /** Come altAzToScreen ma senza clamp sull'orizzonte (per offset eclissi). */
  _rawAltAzToScreen(alt, az) {
    const a = this.azToScreen(az);
    const r = ((90 - alt) / 90) * this.radius;
    return {
      x: this.viewX - r * Math.sin(a),
      y: this.viewY - r * Math.cos(a),
    };
  }

  drawBackground(ctx, w, h) {
    const bg = ctx.createRadialGradient(this.viewX, this.viewY, this.radius * 0.3,
      this.viewX, this.viewY, this.radius * 1.2);
    bg.addColorStop(0, '#0a0d1c');
    bg.addColorStop(0.6, '#080c18');
    bg.addColorStop(1, '#050810');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    if (this.skyGlow > 0) {
      const g = this.skyGlow;
      const hGlow = ctx.createRadialGradient(
        this.viewX, this.viewY + this.radius * 0.7, 0,
        this.viewX, this.viewY + this.radius * 0.7, this.radius * 1.6
      );
      hGlow.addColorStop(0, `rgba(90, 55, 10, ${g * 0.55})`);
      hGlow.addColorStop(0.45, `rgba(50, 28, 5, ${g * 0.28})`);
      hGlow.addColorStop(1, 'rgba(15,8,2,0)');
      ctx.fillStyle = hGlow;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = `rgba(32, 24, 10, ${g * 0.32})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  drawHorizon(ctx, cx, cy, R, headAz) {
    // Ground below horizon (outside the sky circle)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12, 15, 28, 0.3)';
    ctx.fill();

    // Horizon ring
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Cardinal points
    const cardinals = [
      { label: 'N', az: 0 },
      { label: 'NE', az: 45 },
      { label: 'E', az: 90 },
      { label: 'SE', az: 135 },
      { label: 'S', az: 180 },
      { label: 'SW', az: 225 },
      { label: 'W', az: 270 },
      { label: 'NW', az: 315 },
    ];
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const c of cardinals) {
      const a = (c.az - headAz + 360) % 360;
      const angle = a * Math.PI / 180;
      const x = cx - (R + 14) * Math.sin(angle);
      const y = cy - (R + 14) * Math.cos(angle);
      ctx.fillText(c.label, x, y);
    }
    ctx.restore();
  }

  /** Radial lines from zenith to horizon for N/E/S/W (+ intercardinals faint). */
  drawAzimuthRays(ctx, cx, cy, R, headAz) {
    const rays = [
      { az: 0, major: true },
      { az: 45, major: false },
      { az: 90, major: true },
      { az: 135, major: false },
      { az: 180, major: true },
      { az: 225, major: false },
      { az: 270, major: true },
      { az: 315, major: false },
    ];
    ctx.save();
    ctx.lineCap = 'round';
    for (const ray of rays) {
      const a = this.azToScreen(ray.az);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - R * Math.sin(a), cy - R * Math.cos(a));
      ctx.strokeStyle = ray.major
        ? 'rgba(126,184,255,0.28)'
        : 'rgba(126,184,255,0.12)';
      ctx.lineWidth = ray.major ? 1.25 : 0.7;
      ctx.stroke();
    }
    // Soft hub at zenith
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(126,184,255,0.35)';
    ctx.fill();
    ctx.restore();
  }

  /** Max magnitude for star name labels — deeper names appear as you zoom in. */
  labelMagLimit() {
    // zoom 1 → 2.5, zoom 12 → ~4.7 (also capped by sky limiting magnitude)
    const byZoom = 2.5 + (this.zoom - 1) * 0.2;
    return Math.min(this.limitingMag, byZoom);
  }

  drawStars(ctx, cx, cy, R, headAz, date, obs, sunAlt) {
    const hl = this.highlighted;
    const labelLimit = this.labelMagLimit();
    const pendingLabels = [];

    for (const star of STARS) {
      const ra = star[0] / 1000;
      const dec = star[1] / 1000;
      const mag = star[2] / 100;
      const nameIdx = star[3];

      // Determine highlight status before the horizon calc for early exit
      let isHighlightedStar = false;
      if (hl && nameIdx > 0) {
        if (hl.type === 'star' && nameIdx - 1 === hl.nameIdx) {
          isHighlightedStar = true;
        } else if (hl.type === 'constellation') {
          const cs = CONSTELLATION_STAR_INDICES[hl.id] || [];
          if (cs.includes(nameIdx - 1)) isHighlightedStar = true;
        }
      }
      // Skip stars beyond the limiting magnitude (light-pollution simulation)
      // Highlighted stars are always shown so the guide remains useful
      if (mag > this.limitingMag && !isHighlightedStar) continue;

      try {
        const hor = Astronomy.Horizon(date, obs, ra / 15, dec, 'normal');
        if (hor.altitude <= -5) continue;

        const pos = this.altAzToScreen(hor.altitude, hor.azimuth);
        const size = Math.max(0.5, (4.5 - mag) * 0.9);

        const horizonDim = Math.min(1, Math.max(0, (hor.altitude + 5) / 15));
        const maskAlpha = this.getMaskAlpha(hor.altitude, hor.azimuth);
        let baseAlpha = sunAlt > -10 ? 0.15 : Math.max(0.35, 0.9 - this.skyGlow * 0.45);
        let alpha = baseAlpha * horizonDim * maskAlpha;

        let highlightGlow = false;
        if (hl) {
          if (hl.type === 'constellation') {
            const constStars = CONSTELLATION_STAR_INDICES[hl.id] || [];
            const snameIdx = nameIdx > 0 ? nameIdx - 1 : -1;
            if (snameIdx >= 0 && constStars.includes(snameIdx)) {
              alpha = Math.max(alpha, 0.95);
              highlightGlow = true;
            } else {
              alpha *= 0.7;
            }
          } else if (hl.type === 'star') {
            if (nameIdx > 0 && nameIdx - 1 === hl.nameIdx) {
              alpha = Math.max(alpha, 1.0);
              highlightGlow = true;
            } else {
              alpha *= 0.2;
            }
          }
        }

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(210,220,255,${alpha.toFixed(2)})`;
        ctx.fill();

        if (highlightGlow) {
          const glow = ctx.createRadialGradient(pos.x, pos.y, size * 0.3, pos.x, pos.y, size * 4);
          glow.addColorStop(0, 'rgba(255,220,140,0.5)');
          glow.addColorStop(1, 'rgba(255,220,140,0)');
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, size * 4, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
        }

        if (this.showStarNames && nameIdx > 0 && hor.altitude > 5 && mag <= labelLimit) {
          const nameAlpha = hl ? (highlightGlow ? 0.9 : alpha * 0.5) : alpha * 0.8;
          if (nameAlpha >= 0.05) {
            pendingLabels.push({
              name: STAR_NAMES[nameIdx - 1],
              x: pos.x + size + 3,
              y: pos.y - 1,
              mag,
              nameAlpha,
              highlightGlow,
            });
          }
        }
      } catch(e) {
        // Skip stars that fail
      }
    }

    // Brightest names first; skip overlaps so zoom can reveal more without clutter
    pendingLabels.sort((a, b) => a.mag - b.mag);
    const placed = [];
    const minLabelDist = this.zoom >= 3 ? 26 : 34;
    for (const lab of pendingLabels) {
      let overlaps = false;
      if (!lab.highlightGlow) {
        for (const p of placed) {
          if (Math.hypot(lab.x - p.x, lab.y - p.y) < minLabelDist) {
            overlaps = true;
            break;
          }
        }
      }
      if (overlaps) continue;
      placed.push(lab);
      ctx.fillStyle = `rgba(255,255,255,${lab.nameAlpha.toFixed(2)})`;
      ctx.font = lab.highlightGlow
        ? 'bold 11px sans-serif'
        : lab.mag > 2.5
          ? '9px sans-serif'
          : '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(lab.name, lab.x, lab.y);
    }
  }

  drawGalaxies(ctx, cx, cy, R, headAz, date, obs, sunAlt) {
    if (typeof GALAXIES === 'undefined' || !GALAXIES.length) return;
    if (sunAlt > -8) return; // washed out in twilight

    // Degrees → screen pixels (horizon radius spans 90°)
    const degToPx = R / 90;

    for (const g of GALAXIES) {
      // M33 (~5.7) is naked-eye only under excellent skies — allow a small margin
      if (g.mag > this.limitingMag + 0.8) continue;

      try {
        const hor = Astronomy.Horizon(date, obs, g.ra / 15, g.dec, 'normal');
        if (hor.altitude <= -3) continue;

        const pos = this.altAzToScreen(hor.altitude, hor.azimuth);
        const horizonDim = Math.min(1, Math.max(0, (hor.altitude + 3) / 12));
        const maskAlpha = this.getMaskAlpha(hor.altitude, hor.azimuth);
        const visibility = Math.max(0, Math.min(1, (this.limitingMag - g.mag + 0.5) / 2));
        let alpha = (0.55 - this.skyGlow * 0.35) * horizonDim * maskAlpha * visibility;
        if (alpha < 0.04) continue;

        const rx = Math.max(4, g.sizeMaj * degToPx * 0.55);
        const ry = Math.max(2.5, g.sizeMin * degToPx * 0.55);

        ctx.save();
        ctx.translate(pos.x, pos.y);
        // Approximate on-sky tilt; PA is from north through east, screen y is altitude
        ctx.rotate(((g.pa || 0) - 90) * Math.PI / 180);
        ctx.scale(1, ry / rx);

        const glow = ctx.createRadialGradient(0, 0, rx * 0.08, 0, 0, rx);
        glow.addColorStop(0, `rgba(200,210,255,${(alpha * 0.85).toFixed(2)})`);
        glow.addColorStop(0.35, `rgba(170,185,240,${(alpha * 0.35).toFixed(2)})`);
        glow.addColorStop(1, 'rgba(150,170,230,0)');
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
        ctx.restore();

        // Core hint
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, Math.max(1.2, rx * 0.08), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220,225,255,${(alpha * 0.7).toFixed(2)})`;
        ctx.fill();

        // Label — always for M31; M33 only when zoomed or very dark
        const showLabel = g.mag <= 4.0 || this.zoom >= 2 || this.limitingMag >= 5.0;
        if (showLabel && hor.altitude > 3) {
          ctx.fillStyle = `rgba(200,210,255,${Math.min(0.85, alpha + 0.25).toFixed(2)})`;
          ctx.font = this.zoom >= 2 ? '10px sans-serif' : '9px sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(g.name, pos.x + rx * 0.35 + 4, pos.y - ry * 0.2);
        }
      } catch (e) {
        // skip
      }
    }
  }

  /** Project a constellation stick segment endpoint; null if well below horizon. */
  projectConstPoint(ra, dec, date, obs) {
    try {
      const hor = Astronomy.Horizon(date, obs, ra / 15, dec, 'normal');
      if (hor.altitude < -6) return null;
      return this.altAzToScreen(Math.max(hor.altitude, 0), hor.azimuth);
    } catch (e) {
      return null;
    }
  }

  /** Convex hull (Andrew) of screen points — follows the real star footprint. */
  convexHull(points) {
    if (points.length < 3) return points.slice();
    const pts = points.slice().sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper = [];
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    lower.pop();
    upper.pop();
    return lower.concat(upper);
  }

  /**
   * Mythological "art": soft fill + thick ribbon along the real constellation
   * geometry (no invented silhouettes — shape matches the stars).
   */
  drawConstellationArt(ctx, cx, cy, R, headAz, date, obs, sunAlt) {
    const hl = this.highlighted;
    const baseFill = sunAlt > -8 ? 0.035 : 0.10;
    const baseStroke = sunAlt > -8 ? 0.06 : 0.18;

    // Prefer myth constellations when available; otherwise all stick figures
    const mythIds = (typeof CONSTELLATION_MYTHS !== 'undefined')
      ? new Set(CONSTELLATION_MYTHS.map(m => m.id))
      : null;

    for (const c of CONST_LINES) {
      if (mythIds && !mythIds.has(c.id)) continue;
      if (!this.isConstVisibleInOverview(c.id)) continue;

      const segs = c.s;
      const pts = [];
      const seen = new Set();
      const screenSegs = [];

      for (let i = 0; i < segs.length; i += 4) {
        const p1 = this.projectConstPoint(segs[i], segs[i + 1], date, obs);
        const p2 = this.projectConstPoint(segs[i + 2], segs[i + 3], date, obs);
        if (!p1 || !p2) continue;
        // Skip segments that are entirely outside the sky disc
        const d1 = Math.hypot(p1.x - cx, p1.y - cy);
        const d2 = Math.hypot(p2.x - cx, p2.y - cy);
        if (d1 > R * 1.05 && d2 > R * 1.05) continue;
        screenSegs.push([p1, p2]);
        for (const p of [p1, p2]) {
          const key = p.x.toFixed(1) + ',' + p.y.toFixed(1);
          if (!seen.has(key)) { seen.add(key); pts.push(p); }
        }
      }
      if (pts.length < 2) continue;

      const isHL = hl && hl.type === 'constellation' && hl.id === c.id;
      let fillA = baseFill;
      let strokeA = baseStroke;
      if (hl) {
        fillA = isHL ? 0.22 : baseFill * 0.2;
        strokeA = isHL ? 0.4 : baseStroke * 0.2;
      }

      // Soft body: convex hull of the real star positions
      const hull = this.convexHull(pts);
      if (hull.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(hull[0].x, hull[0].y);
        for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i].x, hull[i].y);
        ctx.closePath();
        ctx.fillStyle = `rgba(130,160,220,${fillA.toFixed(3)})`;
        ctx.fill();
      }

      // Thick ribbon along the actual stick figure
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = `rgba(150,180,235,${strokeA.toFixed(3)})`;
      ctx.lineWidth = isHL ? 10 : 7;
      for (const [a, b] of screenSegs) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      // Softer outer glow
      ctx.strokeStyle = `rgba(120,150,210,${(strokeA * 0.45).toFixed(3)})`;
      ctx.lineWidth = isHL ? 18 : 14;
      for (const [a, b] of screenSegs) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  drawConstellationLines(ctx, cx, cy, R, headAz, date, obs, sunAlt) {
    const hl = this.highlighted;

    for (const c of CONST_LINES) {
      if (!this.isConstVisibleInOverview(c.id)) continue;
      const isHL = hl && hl.type === 'constellation' && hl.id === c.id;
      const segs = c.s;
      let baseAlpha = sunAlt > -8 ? 0.08 : 0.25;
      if (hl) {
        baseAlpha = isHL ? 0.55 : baseAlpha * 0.3;
      }
      ctx.strokeStyle = `rgba(120,150,200,${baseAlpha.toFixed(2)})`;
      ctx.lineWidth = isHL ? 2.0 : 1.1;

      for (let i = 0; i < segs.length; i += 4) {
        const ra1 = segs[i];
        const dec1 = segs[i + 1];
        const ra2 = segs[i + 2];
        const dec2 = segs[i + 3];

        try {
          const h1 = Astronomy.Horizon(date, obs, ra1 / 15, dec1, 'normal');
          const h2 = Astronomy.Horizon(date, obs, ra2 / 15, dec2, 'normal');

          if (h1.altitude < -8 && h2.altitude < -8) continue;

          let a1 = h1.altitude, a2 = h2.altitude;
          let p1 = this.altAzToScreen(a1, h1.azimuth);
          let p2 = this.altAzToScreen(a2, h2.azimuth);

          if (a1 < -2 || a2 < -2) {
            if (a1 < -2 && a2 < -2) continue;
            if (a1 < 0) {
              const t = (0 - a1) / (a2 - a1);
              const az = h1.azimuth + (h2.azimuth - h1.azimuth) * t;
              p1 = this.altAzToScreen(0, az);
            }
            if (a2 < 0) {
              const t = (0 - a1) / (a2 - a1);
              const az = h1.azimuth + (h2.azimuth - h1.azimuth) * t;
              p2 = this.altAzToScreen(0, az);
            }
          }

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        } catch(e) {
          // Skip
        }
      }
    }
  }

  drawConstellationNames(ctx, cx, cy, R, headAz, date, obs, sunAlt) {
    const hl = this.highlighted;

    for (const [desig, info] of Object.entries(CONST_NAMES_IT)) {
      if (!this.isConstVisibleInOverview(desig)) continue;
      try {
        const hor = Astronomy.Horizon(date, obs, info.ra / 15, info.dec, 'normal');
        if (hor.altitude < 2) continue;

        const pos = this.altAzToScreen(hor.altitude, hor.azimuth);
        const dist = Math.sqrt((pos.x - cx) ** 2 + (pos.y - cy) ** 2);
        if (dist > R * 0.92) continue;

        const isHL = hl && hl.type === 'constellation' && hl.id === desig;
        const maskAlpha = this.getMaskAlpha(hor.altitude, hor.azimuth);
        let alpha = (sunAlt > -8 ? 0.1 : 0.4) * maskAlpha;
        if (hl) {
          alpha = isHL ? 0.8 : alpha * 0.3;
        }
        ctx.fillStyle = `rgba(180,200,240,${alpha.toFixed(2)})`;
        ctx.font = isHL ? 'bold 13px sans-serif' : '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(info.n, pos.x, pos.y);
      } catch(e) {}
    }
  }

  drawMoon(ctx, cx, cy, R, alt, az, frac, phaseAngle, sunHor, headAz, date, obs) {
    const pos = this.altAzToScreen(alt, az);
    const mr = Math.min(14, R * 0.04);

    // Sun direction on screen from moon
    const sunPosSun = this.altAzToScreen(sunHor.altitude, sunHor.azimuth);
    let sunDir = Math.atan2(sunPosSun.y - pos.y, sunPosSun.x - pos.x);
    if (sunHor.altitude < -6) {
      // Sun is well below horizon — estimate direction from azimuth
      const ssa = this.azToScreen(sunHor.azimuth);
      sunDir = Math.PI - ssa;
    }

    // Bright limb faces the sun
    // For the moon on the sky, draw the illuminated portion

    if (frac < 0.005) {
      // New moon: barely visible
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, mr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15,17,35,0.5)';
      ctx.fill();
      return;
    }

    if (frac > 0.995) {
      // Full moon
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, mr, 0, Math.PI * 2);
      ctx.fillStyle = '#F5F0DC';
      ctx.fill();
      // Add a subtle glow
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, mr + 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,245,200,0.12)';
      ctx.fill();
      return;
    }

    // Draw as two halves: lit and dark
    const cosG = 2 * frac - 1;
    const sinG = 2 * Math.sqrt(frac * (1 - frac));
    const rxEll = mr * Math.abs(cosG);
    const ryEll = mr;

    ctx.save();

    if (frac >= 0.5) {
      // Gibbous or full: draw full bright moon, then dark overlay on far side
      // Full bright moon
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, mr, 0, Math.PI * 2);
      ctx.fillStyle = '#F5F0DC';
      ctx.fill();

      // Dark overlay on far side from sun
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, mr, sunDir + Math.PI / 2, sunDir + 3 * Math.PI / 2, true);
      ctx.ellipse(pos.x, pos.y, rxEll, ryEll, sunDir, 3 * Math.PI / 2, Math.PI / 2, false);
      ctx.closePath();
      ctx.fillStyle = 'rgba(15,17,35,0.85)';
      ctx.fill();
    } else {
      // Crescent: draw dark base, then lit crescent on sun-facing side
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, mr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15,17,35,0.75)';
      ctx.fill();

      // Lit portion on sun-facing side
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, mr, sunDir - Math.PI / 2, sunDir + Math.PI / 2, true);
      ctx.ellipse(pos.x, pos.y, rxEll, ryEll, sunDir, Math.PI / 2, -Math.PI / 2, false);
      ctx.closePath();
      ctx.fillStyle = '#F5F0DC';
      ctx.fill();
    }

    ctx.restore();

    // Glow
    if (frac > 0.1) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, mr + 3, 0, Math.PI * 2);
      const glowGrad = ctx.createRadialGradient(pos.x, pos.y, mr * 0.7, pos.x, pos.y, mr + 6);
      glowGrad.addColorStop(0, 'rgba(255,245,200,0.15)');
      glowGrad.addColorStop(1, 'rgba(255,245,200,0)');
      ctx.fillStyle = glowGrad;
      ctx.fill();
      ctx.restore();
    }
  }

  drawPlanet(ctx, cx, cy, R, name, alt, az, headAz) {
    const pos = this.altAzToScreen(alt, az);
    const r = 3.5;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700';
    ctx.fill();

    // Glow
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r + 2, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(pos.x, pos.y, r * 0.5, pos.x, pos.y, r + 3);
    g.addColorStop(0, 'rgba(255,220,80,0.3)');
    g.addColorStop(1, 'rgba(255,220,80,0)');
    ctx.fillStyle = g;
    ctx.fill();

    // Label
    ctx.fillStyle = 'rgba(255,240,200,0.8)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(name, pos.x + r + 3, pos.y - 1);
  }

  drawSun(ctx, cx, cy, R, alt, az) {
    const pos = this.altAzToScreen(alt, az);
    const r = 10;

    // Glow
    const glowR = 25;
    const glow = ctx.createRadialGradient(pos.x, pos.y, r * 0.6, pos.x, pos.y, glowR);
    glow.addColorStop(0, 'rgba(255,210,80,0.35)');
    glow.addColorStop(0.4, 'rgba(255,180,40,0.12)');
    glow.addColorStop(1, 'rgba(255,140,20,0)');
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, glowR, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Outer halo
    const halo = ctx.createRadialGradient(pos.x, pos.y, r * 0.4, pos.x, pos.y, r);
    halo.addColorStop(0, 'rgba(255,240,180,1)');
    halo.addColorStop(0.7, 'rgba(255,200,80,0.9)');
    halo.addColorStop(1, 'rgba(255,140,20,0)');
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fillStyle = halo;
    ctx.fill();

    // Label
    ctx.fillStyle = 'rgba(255,240,180,0.85)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Sole', pos.x + r + 3, pos.y - 1);
  }

  /**
   * Sole parzialmente occultato: scala l'offset Luna→Sole ai raggi apparenti
   * (la proiezione sky-map comprime troppo le separazioni di frazioni di grado).
   */
  drawEclipsedSun(ctx, cx, cy, R, sunHor, moonHor, sunRdeg, moonRdeg, sepDeg) {
    const sunPos = this.altAzToScreen(sunHor.altitude, sunHor.azimuth);
    const sunPx = Math.max(14, Math.min(28, R * 0.045));
    const pxPerDeg = sunPx / Math.max(sunRdeg, 0.01);
    const moonPx = moonRdeg * pxPerDeg;
    const obsc = this.diskObscuration(sunRdeg, moonRdeg, sepDeg);

    const rawSun = this._rawAltAzToScreen(sunHor.altitude, sunHor.azimuth);
    const rawMoon = this._rawAltAzToScreen(moonHor.altitude, moonHor.azimuth);
    let dx = rawMoon.x - rawSun.x;
    let dy = rawMoon.y - rawSun.y;
    const screenSep = Math.hypot(dx, dy);
    if (screenSep > 1e-6 && sepDeg > 1e-6) {
      const scale = (sepDeg * pxPerDeg) / screenSep;
      dx *= scale;
      dy *= scale;
    } else {
      dx = 0;
      dy = 0;
    }
    const moonX = sunPos.x + dx;
    const moonY = sunPos.y + dy;

    const glowAlpha = 0.35 * (1 - obsc * 0.92);
    const glowR = 25 + sunPx;
    const glow = ctx.createRadialGradient(sunPos.x, sunPos.y, sunPx * 0.5, sunPos.x, sunPos.y, glowR);
    glow.addColorStop(0, `rgba(255,210,80,${glowAlpha.toFixed(3)})`);
    glow.addColorStop(0.45, `rgba(255,180,40,${(glowAlpha * 0.35).toFixed(3)})`);
    glow.addColorStop(1, 'rgba(255,140,20,0)');
    ctx.beginPath();
    ctx.arc(sunPos.x, sunPos.y, glowR, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Disco solare (clippato dalla luna)
    ctx.save();
    ctx.beginPath();
    ctx.arc(sunPos.x, sunPos.y, sunPx, 0, Math.PI * 2);
    ctx.clip();

    const halo = ctx.createRadialGradient(sunPos.x, sunPos.y, sunPx * 0.25, sunPos.x, sunPos.y, sunPx);
    halo.addColorStop(0, 'rgba(255,245,200,1)');
    halo.addColorStop(0.65, 'rgba(255,200,80,0.95)');
    halo.addColorStop(1, 'rgba(255,150,30,0.85)');
    ctx.beginPath();
    ctx.arc(sunPos.x, sunPos.y, sunPx, 0, Math.PI * 2);
    ctx.fillStyle = halo;
    ctx.fill();

    // Luna come disco scuro sopra il Sole
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonPx + 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#050810';
    ctx.fill();
    ctx.restore();

    // Contorno tenue del disco solare
    ctx.beginPath();
    ctx.arc(sunPos.x, sunPos.y, sunPx, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,230,160,${(0.35 + 0.4 * (1 - obsc)).toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    const pct = Math.round(obsc * 100);
    ctx.fillStyle = 'rgba(255,240,180,0.9)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    const label = pct > 0 ? `Sole · ${pct}%` : 'Sole';
    ctx.fillText(label, sunPos.x + sunPx + 3, sunPos.y - 1);
  }

  drawRadiant(ctx, cx, cy, R, headAz, date, obs) {
    // Perseids radiant: RA ~3h04m = 46°, Dec +58°
    const ra = 46.0;
    const dec = 58.0;
    const hor = Astronomy.Horizon(date, obs, ra / 15, dec, 'normal');
    if (hor.altitude < -10) return;

    const pos = this.altAzToScreen(hor.altitude, hor.azimuth);

    // Pulsing cross
    ctx.save();
    ctx.strokeStyle = 'rgba(255,160,60,0.7)';
    ctx.lineWidth = 1.5;
    const s = 10;
    ctx.beginPath();
    ctx.moveTo(pos.x - s, pos.y);
    ctx.lineTo(pos.x + s, pos.y);
    ctx.moveTo(pos.x, pos.y - s);
    ctx.lineTo(pos.x, pos.y + s);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,160,60,0.8)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Perseidi ☄', pos.x + 8, pos.y - 4);

    ctx.restore();
  }

  setupZoom() {
    const canvas = this.canvas;
    this._pointers = new Map();
    this._pinchStart = null;
    this._lastDrag = null;

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const fx = e.clientX - rect.left;
      const fy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      this.zoomAt(fx, fy, factor);
    }, { passive: false });

    canvas.addEventListener('pointerdown', (e) => {
      this._pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      canvas.setPointerCapture(e.pointerId);
      if (this._pointers.size === 2) {
        const pts = [...this._pointers.values()];
        this._pinchStart = {
          startDist: this._dist(pts[0], pts[1]),
          startMid: this._mid(pts[0], pts[1]),
          startZoom: this.zoom,
          startPanX: this.panX,
          startPanY: this.panY,
        };
        this._lastDrag = null;
      } else if (this._pointers.size === 1) {
        this._lastDrag = { x: e.offsetX, y: e.offsetY };
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this._pointers.has(e.pointerId)) return;
      this._pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });

      if (this._pointers.size === 2 && this._pinchStart) {
        const pts = [...this._pointers.values()];
        const dist = this._dist(pts[0], pts[1]);
        const mid = this._mid(pts[0], pts[1]);
        const s = this._pinchStart;

        const zoomFactor = dist / s.startDist;
        this.zoom = Math.max(1, Math.min(MAX_ZOOM, s.startZoom * zoomFactor));

        const oldR = this.baseRadius * s.startZoom;
        const newR = this.baseRadius * this.zoom;
        const nx = (s.startMid.x - this.centerX - s.startPanX) / oldR;
        const ny = (s.startMid.y - this.centerY - s.startPanY) / oldR;

        this.panX = mid.x - this.centerX - nx * newR;
        this.panY = mid.y - this.centerY - ny * newR;

        if (this.zoom <= 1) { this.zoom = 1; this.panX = 0; this.panY = 0; }
        this.clampPan();
        this.radius = this.baseRadius * this.zoom;
        this.render();
        this._lastDrag = null;
      } else if (this._pointers.size === 1 && this.zoom > 1 && this._lastDrag) {
        const dx = e.offsetX - this._lastDrag.x;
        const dy = e.offsetY - this._lastDrag.y;
        this.panX += dx;
        this.panY += dy;
        this.clampPan();
        this.render();
        this._lastDrag = { x: e.offsetX, y: e.offsetY };
      }
    });

    const up = (e) => {
      this._pointers.delete(e.pointerId);
      if (this._pointers.size === 0) {
        this._pinchStart = null;
        this._lastDrag = null;
      }
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);

    canvas.addEventListener('dblclick', () => {
      this.resetView();
    });
  }

  _dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  _mid(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  zoomAt(fx, fy, factor) {
    const oldZoom = this.zoom;
    this.zoom = Math.max(1, Math.min(MAX_ZOOM, this.zoom * factor));
    const oldR = this.baseRadius * oldZoom;
    const newR = this.baseRadius * this.zoom;

    const nx = (fx - this.centerX - this.panX) / oldR;
    const ny = (fy - this.centerY - this.panY) / oldR;

    this.panX = fx - this.centerX - nx * newR;
    this.panY = fy - this.centerY - ny * newR;

    if (this.zoom <= 1) { this.zoom = 1; this.panX = 0; this.panY = 0; }
    this.clampPan();
    this.radius = this.baseRadius * this.zoom;
    this.render();
  }

  panBy(dx, dy) {
    this.panX += dx;
    this.panY += dy;
    this.clampPan();
    this.render();
  }

  clampPan() {
    const maxPan = this.radius * 0.7;
    this.panX = Math.max(-maxPan, Math.min(maxPan, this.panX));
    this.panY = Math.max(-maxPan, Math.min(maxPan, this.panY));
  }

  resetView() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.radius = this.baseRadius;
    this.render();
  }
};
