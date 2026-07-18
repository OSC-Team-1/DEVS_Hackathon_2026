import worldGrid from "./output/worldGrid.json";
import cities from "./output/cities.json";

import createGraph from "ngraph.graph";
import { aStar } from "ngraph.path";

function coordsToRowCol(
    lat: number,
    lng: number,
    gridData: {
        cols: number;
        rows: number;
        tileSizeDeg: number;
    },
) {
    const col = Math.floor((lng + 180) / gridData.tileSizeDeg);
    const row = Math.floor((90 - lat) / gridData.tileSizeDeg);
    return {
        row: Math.min(Math.max(row, 0), gridData.rows - 1),
        col: Math.min(Math.max(col, 0), gridData.cols - 1),
    };
}

function getViewportTiles(
    coordA: { lat: number; lng: number },
    coordB: { lat: number; lng: number },
    worldGrid: any,
    paddingTiles = 3,
) {
    const tileA = coordsToRowCol(coordA.lat, coordA.lng, worldGrid.info);
    const tileB = coordsToRowCol(coordB.lat, coordB.lng, worldGrid.info);

    const rowStart = Math.max(0, Math.min(tileA.row, tileB.row) - paddingTiles);
    const rowEnd = Math.min(
        worldGrid.info.rows - 1,
        Math.max(tileA.row, tileB.row) + paddingTiles,
    );
    const colStart = Math.max(0, Math.min(tileA.col, tileB.col) - paddingTiles);
    const colEnd = Math.min(
        worldGrid.info.cols - 1,
        Math.max(tileA.col, tileB.col) + paddingTiles,
    );

    const tiles = [];
    for (let r = rowStart; r <= rowEnd; r++) {
        const rowTiles = [];
        for (let c = colStart; c <= colEnd; c++) {
            rowTiles.push(worldGrid.grid[r][c]);
        }
        tiles.push(rowTiles);
    }

    return tiles;
}

function buildGraph(tiles: any) {
    const graph = createGraph();

    for (const row of tiles) {
        for (const tile of row) {
            const id = `${tile.row},${tile.col}`;
            graph.addNode(id, tile);
        }
    }

    for (const row of tiles) {
        for (const tile of row) {
            const id = `${tile.row},${tile.col}`;
            const neighbors = [
                [tile.row - 1, tile.col],
                [tile.row + 1, tile.col],
                [tile.row, tile.col - 1],
                [tile.row, tile.col + 1],
                [tile.row - 1, tile.col - 1],
                [tile.row - 1, tile.col + 1],
                [tile.row + 1, tile.col - 1],
                [tile.row + 1, tile.col + 1],
            ];
            for (const [nr, nc] of neighbors) {
                const neighborId = `${nr},${nc}`;
                if (graph.getNode(neighborId)) {
                    graph.addLink(id, neighborId);
                }
            }
        }
    }

    return graph;
}

const viewportTiles = getViewportTiles(
    cities["United States"][1],
    cities["New Zealand"][0],
    worldGrid,
);

const graph = buildGraph(viewportTiles);

const pathFinder = aStar(graph, {
    distance(fromNode, toNode) {
        const tile = toNode.data;
        return tile.biome === "ocean" ? 8 : 1;
    },
});

const tileA = coordsToRowCol(
    cities["United States"][1].lat,
    cities["United States"][1].lng,
    worldGrid.info,
);
const tileB = coordsToRowCol(
    cities["New Zealand"][0].lat,
    cities["New Zealand"][0].lng,
    worldGrid.info,
);
const path = pathFinder
    .find(`${tileA.row},${tileA.col}`, `${tileB.row},${tileB.col}`)
    .reverse();

function biomeChar(b: string) {
    const chars = {
        ocean: ".",
        desert: "/",
        jungle: "#",
        plains: "#",
        mountain: "^",
    };
    // @ts-ignore
    return chars[b] ?? "?";
}

const emptySet = new Set();
for (const p of path) {
    emptySet.add(p.id);
}

for (const row of viewportTiles) {
    for (const col of row) {
        if (emptySet.has(`${col.row},${col.col}`)) {
            process.stdout.write("A");
            continue;
        }
        process.stdout.write(biomeChar(col.biome));
        // process.stdout.write(col.biome === "ocean" ? "." : "#");
    }
    process.stdout.write("\n");
}

