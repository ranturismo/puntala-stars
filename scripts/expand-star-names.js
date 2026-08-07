#!/usr/bin/env node
/**
 * Expand STAR_NAMES by matching bright catalog stars to common proper names.
 * Preserves the first 25 original names (and their indices) for myths/explore.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'js', 'data-stars.js');

// Restore from git if available, else use current
let src;
try {
  src = require('child_process').execSync('git show HEAD:js/data-stars.js', {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
  });
} catch (e) {
  src = fs.readFileSync(file, 'utf8');
}

const ORIG_NAMES = JSON.parse(src.match(/STAR_NAMES = (\[.*?\]);/)[1]);
const stars = JSON.parse(src.match(/STARS = (\[.*\]);/s)[1]);

// Keep original nameIdx assignments for the first ORIG_NAMES.length names
const newNames = [...ORIG_NAMES];
const nameIndex = {};
ORIG_NAMES.forEach((n, i) => {
  nameIndex[n] = i;
});

function ensureName(n) {
  if (nameIndex[n] !== undefined) return nameIndex[n];
  nameIndex[n] = newNames.length;
  newNames.push(n);
  return nameIndex[n];
}

function normalizeRa(ra) {
  let r = ra;
  if (r < 0) r += 360;
  return r;
}

function angDist(ra1, dec1, ra2, dec2) {
  const dra = Math.min(Math.abs(ra1 - ra2), 360 - Math.abs(ra1 - ra2));
  const ddec = Math.abs(dec1 - dec2);
  const cosd = Math.cos((dec1 * Math.PI) / 180);
  return Math.hypot(dra * cosd, ddec);
}

// Accurate J2000 coords for well-known bright stars not already in ORIG_NAMES
const BRIGHT = [
  ['Achernar', 24.429, -57.237],
  ['Canopo', 95.988, -52.696],
  ['Rigil Kentaurus', 219.902, -60.834],
  ['Hadar', 210.956, -60.373],
  ['Acrux', 186.650, -63.099],
  ['Mimosa', 191.930, -59.689],
  ['Gacrux', 187.791, -57.113],
  ['Shaula', 263.402, -37.104],
  ['Adhara', 104.657, -28.972],
  ['Elnath', 81.573, 28.608],
  ['Alnilam', 84.053, -1.202],
  ['Alnitak', 85.190, -1.943],
  ['Saiph', 86.939, -9.670],
  ['Mirfak', 51.081, 49.861],
  ['Algol', 47.042, 40.956],
  ['Almach', 30.975, 42.330],
  ['Hamal', 31.793, 23.462],
  ['Menkar', 45.570, 4.090],
  ['Schedar', 10.127, 56.537],
  ['Caph', 2.295, 59.150],
  ['Navi', 14.177, 60.717],
  ['Ruchbah', 21.454, 60.235],
  ['Diphda', 10.897, -17.987],
  ['Enif', 326.046, 9.875],
  ['Scheat', 345.944, 28.083],
  ['Markab', 346.190, 15.205],
  ['Alpheratz', 2.097, 29.090],
  ['Alphard', 141.897, -8.659],
  ['Denebola', 177.265, 14.572],
  ['Algieba', 154.993, 19.842],
  ['Zosma', 168.527, 20.524],
  ['Dubhe', 165.932, 61.751],
  ['Phecda', 178.458, 53.695],
  ['Megrez', 183.857, 57.033],
  ['Alioth', 193.507, 55.960],
  ['Kochab', 222.677, 74.156],
  ['Pherkad', 230.182, 71.834],
  ['Eltanin', 269.152, 51.489],
  ['Alderamin', 319.485, 62.586],
  ['Albireo', 292.680, 27.960],
  ['Sadr', 305.557, 40.257],
  ['Aljanah', 311.665, 33.970],
  ['Tarazed', 296.565, 10.613],
  ['Alshain', 298.828, 6.407],
  ['Rasalhague', 263.734, 12.560],
  ['Unukalhai', 236.067, 6.426],
  ['Kaus Australis', 276.043, -34.384],
  ['Nunki', 283.816, -26.297],
  ['Kaus Media', 274.407, -29.880],
  ['Kaus Borealis', 276.993, -25.421],
  ['Avior', 125.629, -59.509],
  ['Aspidiske', 139.273, -59.275],
  ['Suhail', 136.999, -43.433],
  ['Miaplacidus', 138.300, -69.717],
  ['Wezen', 107.098, -26.393],
  ['Aludra', 111.024, -29.303],
  ['Mirzam', 95.675, -17.956],
  ['Naos', 120.896, -40.003],
  ['Tureis', 122.383, -47.337],
  ['Menkent', 220.482, -36.370],
  ['Menkalinan', 89.882, 44.947],
  ['Alhena', 99.428, 16.399],
  ['Tejat', 95.740, 22.507],
  ['Mebsuta', 100.983, 25.131],
  ['Wasat', 110.031, 21.982],
  ['Cor Caroli', 194.007, 38.308],
  ['Izar', 221.247, 27.074],
  ['Muphrid', 211.673, 19.098],
  ['Alphecca', 233.672, 26.715],
  ['Dschubba', 240.083, -22.622],
  ['Acrab', 241.359, -19.805],
  ['Sabik', 257.595, -15.725],
  ['Rasalgethi', 258.662, 14.390],
  ['Cebalrai', 270.892, 4.567],
  ['Alfirk', 322.165, 70.561],
  ['Sadalsuud', 322.890, -5.571],
  ['Sadalmelik', 331.446, -0.320],
  ['Ankaa', 6.571, -42.306],
  ['Acamar', 44.565, -40.305],
  ['Cursa', 76.963, -5.086],
  ['Meissa', 83.182, 9.934],
  ['Phact', 84.912, -34.074],
  ['Alsephina', 131.176, -54.709],
  ['Markeb', 140.528, -55.011],
  ['Peacock', 306.412, -56.735],
  ['Atria', 251.493, -69.028],
  ['Alnair', 332.058, -46.961],
  ['Girtab', 265.622, -39.030],
  ['Lesath', 264.33, -37.296],
  ['Sargas', 264.33, -42.998],
  ['Zubeneschamali', 229.252, -9.383],
  ['Zubenelgenubi', 222.72, -16.042],
  ['Yed Prior', 243.586, -3.694],
  ['Yed Posterior', 249.290, -10.567],
  ['Ascella', 285.653, -29.880],
  ['Albaldah', 287.441, -21.024],
  ['Sheliak', 282.52, 33.363],
  ['Sulafat', 284.736, 32.69],
  ['Gienah', 183.786, -17.542],
  ['Vindemiatrix', 195.544, 10.959],
  ['Porrima', 190.415, -1.449],
  ['Chertan', 168.56, 15.43],
  ['Hassaleh', 74.248, 33.166],
  ['Mahasim', 89.930, 37.213],
  ['Alcyone', 56.871, 24.105],
  ['Sheratan', 28.660, 20.808],
  ['Kornephoros', 247.555, 21.490],
  ['Thuban', 211.098, 64.376],
];

const updates = [];
for (const [name, ra, dec] of BRIGHT) {
  if (nameIndex[name] !== undefined && nameIndex[name] < ORIG_NAMES.length) {
    // Original name — only assign if there is an unnamed star at that position
    // (do not change existing original nameIdx mappings)
  }
  let best = null;
  let bestD = 0.35;
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    if (s[3] > 0) continue; // never overwrite existing nameIdx
    const d = angDist(normalizeRa(s[0] / 1000), s[1] / 1000, ra, dec);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (best === null) continue;
  const s = stars[best];
  if (s[2] / 100 > 3.8) continue;
  const idx = ensureName(name);
  stars[best] = [s[0], s[1], s[2], idx + 1];
  updates.push({ name, mag: s[2] / 100, d: bestD });
}

updates.sort((a, b) => a.mag - b.mag);
console.log('New names assigned:', updates.length);
updates.forEach((u) => console.log(u.mag.toFixed(2), u.name, 'd=' + u.d.toFixed(3)));
console.log('Total STAR_NAMES:', newNames.length);
console.log('Named stars:', stars.filter((s) => s[3] > 0).length);
console.log('Original names preserved:', ORIG_NAMES.every((n, i) => newNames[i] === n));

const out = `// Bright stars (mag <= 5.0), compact format: [ra*1000, dec*1000, mag*100, nameIdx]
// Name index 0 = no name, >0 = index-1 into NAMES array
// RA and Dec in degrees; RA in hours = ra/15
const STAR_NAMES = ${JSON.stringify(newNames)};
const STARS = ${JSON.stringify(stars)};
`;
fs.writeFileSync(file, out);
console.log('Wrote', file);
