/**
 * Dependency-free stand-in for the real generateGrid.ts pipeline.
 * Uses a hand-rolled approximate land mask (rough continent boxes) instead
 * of world-atlas/turf, since this sandbox has no network access to install
 * those packages. Good enough to produce realistic-shaped test data so the
 * rest of the app (journey planning, map rendering, minigames) can be
 * built and tested against real-looking data tonight.
 *
 * Swap this out for the real generateGrid.ts (using world-atlas + turf,
 * covered earlier in this conversation) once you have network access --
 * it's a drop-in replacement, same output shape.
 */

const fs = require("fs");
const path = require("path");

const TILE_SIZE_DEG = 3;
const COLS = Math.round(360 / TILE_SIZE_DEG); // 120
const ROWS = Math.round(180 / TILE_SIZE_DEG); // 60

// Very rough continent bounding boxes [lonMin, lonMax, latMin, latMax].
// Not accurate coastlines -- just enough shape for testing pathfinding,
// zoom, and biome variety without a real geo dataset.
const LAND_BOXES = [
  [-170, -50, 5, 75],     // North America
  [-85, -35, -55, 10],    // South America
  [-20, 50, -35, 37],     // Africa
  [-10, 45, 35, 72],      // Europe
  [45, 145, 5, 75],       // Asia
  [110, 155, -45, -10],   // Australia
  [165, 180, -47, -34],   // New Zealand (roughly)
  [-179, -165, -47, -34], // NZ wraps near antimeridian in this crude model
];

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(1337);

// Cheap 2D value-noise substitute for simplex-noise (no dependency needed).
function noise2D(x, y) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + rng() * 0) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1; // -1..1
}

function isLandPoint(lon, lat) {
  return LAND_BOXES.some(([lonMin, lonMax, latMin, latMax]) => lon >= lonMin && lon <= lonMax && lat >= latMin && lat <= latMax);
}

function isLandTile(lon, lat, tileSizeDeg) {
  const offsets = [-0.3, 0, 0.3];
  let hits = 0, total = 0;
  for (const dLon of offsets) for (const dLat of offsets) {
    total++;
    if (isLandPoint(lon + dLon * tileSizeDeg, lat + dLat * tileSizeDeg)) hits++;
  }
  return hits >= total / 3;
}

function getBiome(lon, lat) {
  const n = noise2D(lon / 20, lat / 20);
  const absLat = Math.abs(lat);
  if (absLat > 55) return "mountain";
  if (absLat < 12) return n > -0.2 ? "jungle" : "plains";
  if (absLat < 35) return n > 0.15 ? "desert" : "plains";
  return n > 0.3 ? "mountain" : "plains";
}

console.log(`Generating ${COLS}x${ROWS} grid (approximate land mask -- replace with real generateGrid.ts when you have network access)...`);
const grid = [];
for (let row = 0; row < ROWS; row++) {
  const rowTiles = [];
  for (let col = 0; col < COLS; col++) {
    const lon = (col / COLS) * 360 - 180;
    const lat = 90 - (row / ROWS) * 180;
    const land = isLandTile(lon, lat, TILE_SIZE_DEG);
    rowTiles.push({ row, col, lon: +lon.toFixed(2), lat: +lat.toFixed(2), biome: land ? getBiome(lon, lat) : "ocean" });
  }
  grid.push(rowTiles);
}

const worldGrid = { info: { cols: COLS, rows: ROWS, tileSizeDeg: TILE_SIZE_DEG }, grid };

const cities = {
  "New Zealand": [{ city: "Auckland", lat: -36.85, lng: 174.76, p: 1657000 }],
  "Australia": [{ city: "Sydney", lat: -33.87, lng: 151.21, p: 5312000 }],
  "United States": [{ city: "New York", lat: 40.69, lng: -73.92, p: 19268388 }],
  "United Kingdom": [{ city: "London", lat: 51.5, lng: -0.1, p: 9541000 }],
};

const outDir = path.join(__dirname, "..", "src", "data");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "worldGrid.json"), JSON.stringify(worldGrid));
fs.writeFileSync(path.join(outDir, "cities.json"), JSON.stringify(cities, null, 2));
console.log("Wrote src/data/worldGrid.json and src/data/cities.json");

// quick sanity print around NZ
const biomeChar = { ocean: "~", desert: ".", jungle: "#", plains: "-", mountain: "^" };
function snap(lon, lat) {
  return {
    row: Math.min(Math.max(Math.floor((90 - lat) / TILE_SIZE_DEG), 0), ROWS - 1),
    col: Math.min(Math.max(Math.floor((lon + 180) / TILE_SIZE_DEG), 0), COLS - 1),
  };
}
const c = snap(174.8, -41.3);
console.log("\nASCII preview around NZ:");
for (let r = c.row - 6; r <= c.row + 6; r++) {
  if (r < 0 || r >= ROWS) continue;
  let line = "";
  for (let col = c.col - 6; col <= c.col + 6; col++) {
    if (col < 0 || col >= COLS) { line += " "; continue; }
    line += biomeChar[grid[r][col].biome] ?? "?";
  }
  console.log(line);
}
