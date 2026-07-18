// @ts-ignore
import fs from "fs";
// @ts-ignore
import path from "path";
// @ts-ignore
import { fileURLToPath } from "url";

import { point } from "@turf/helpers";
// @ts-ignore
import { feature } from "topojson-client";
import { createNoise2D } from "simplex-noise";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";

// @ts-expect-error - world-atlas ships JSON without types
import worldData from "world-atlas/land-110m.json" assert { type: "json" };

const TILE_SIZE_DEG = 3;
const COLS = Math.round(360 / TILE_SIZE_DEG);
const ROWS = Math.round(180 / TILE_SIZE_DEG);

const noise2D = createNoise2D(() => 67);
const landFeatures = feature(worldData, worldData.objects.land).features;

function isLandPoint(lon: number, lat: number): boolean {
    const pt = point([lon, lat]);
    for (let i = 0; i < landFeatures.length; i++) {
        if (booleanPointInPolygon(pt, landFeatures[i])) return true;
    }
    return false;
}

function isLandTile(lon: number, lat: number, tileSizeDeg: number): boolean {
    const offsets = [-0.3, 0, 0.3];
    let hits = 0;
    let total = 0;
    for (const dLon of offsets) {
        for (const dLat of offsets) {
            total++;
            if (isLandPoint(lon + dLon * tileSizeDeg, lat + dLat * tileSizeDeg))
                hits++;
        }
    }
    return hits >= total / 3;
}

function getBiome(lon: number, lat: number) {
    const n = noise2D(lon / 20, lat / 20);
    const absLat = Math.abs(lat);

    if (absLat > 55) return n > 0.45 ? "mountain" : "plains";
    if (absLat < 12) return n > -0.2 ? "jungle" : "plains";
    if (absLat < 35) return n > 0 ? "desert" : "plains";

    return n > 0.3 ? "mountain" : "plains";
}

function generateGrid() {
    const grid = [];
    for (let row = 0; row < ROWS; row++) {
        const rowTiles = [];
        for (let col = 0; col < COLS; col++) {
            const lon = (col / COLS) * 360 - 180;
            const lat = 90 - (row / ROWS) * 180;

            const isLand = isLandTile(lon, lat, TILE_SIZE_DEG);
            const biome = isLand ? getBiome(lon, lat) : "ocean";

            rowTiles.push({
                row,
                col,
                lon: parseInt(lon.toFixed(2)),
                lat: parseInt(lat.toFixed(2)),
                biome,
            });
        }
        grid.push(rowTiles);
    }

    fs.writeFileSync(
        path.join(
            // @ts-ignore stfu
            path.dirname(fileURLToPath(import.meta.url)),
            "output/worldGrid.json",
        ),
        JSON.stringify({
            info: {
                cols: COLS,
                rows: ROWS,
                tileSizeDeg: TILE_SIZE_DEG,
            },
            grid,
        }),
    );

    console.log("done");
}

generateGrid();
