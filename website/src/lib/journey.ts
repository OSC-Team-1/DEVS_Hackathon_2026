import createGraph from "ngraph.graph";
import { aStar } from "ngraph.path";
import type { City, GridInfo, Journey, Tile, WorldGrid } from "../types/world";

export function coordsToRowCol(lat: number, lng: number, gridInfo: GridInfo) {
    const col = Math.floor((lng + 180) / gridInfo.tileSizeDeg);
    const row = Math.floor((90 - lat) / gridInfo.tileSizeDeg);
    return {
        row: Math.min(Math.max(row, 0), gridInfo.rows - 1),
        col: Math.min(Math.max(col, 0), gridInfo.cols - 1),
    };
}

function getViewportTiles(
    tileA: { row: number; col: number },
    tileB: { row: number; col: number },
    worldGrid: WorldGrid,
    paddingTiles = 3,
): Tile[][] {
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

    const tiles: Tile[][] = [];
    for (let r = rowStart; r <= rowEnd; r++) {
        const rowTiles: Tile[] = [];
        for (let c = colStart; c <= colEnd; c++) {
            rowTiles.push(worldGrid.grid[r][c]);
        }
        tiles.push(rowTiles);
    }
    return tiles;
}

function buildGraph(tiles: Tile[][]) {
    const graph = createGraph<Tile>();

    for (const row of tiles) {
        for (const tile of row) {
            graph.addNode(`${tile.row},${tile.col}`, tile);
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
                if (
                    graph.getNode(neighborId) &&
                    !graph.hasLink(id, neighborId)
                ) {
                    graph.addLink(id, neighborId);
                }
            }
        }
    }

    return graph;
}

function determineMinigameCount(colSpan: number): number {
    if (colSpan <= 3) return 1;
    if (colSpan <= 15) return 2;
    if (colSpan <= 30) return 3;
    return 4;
}

function pickMinigameTiles(path: Tile[], count: number): Tile[] {
    if (path.length === 0) return [];

    const middle = path.slice(1, -1);
    if (middle.length === 0) return [path[Math.floor(path.length / 2)]];
    if (count >= middle.length) return middle;

    const chosen: Tile[] = [];
    const usedBiomes = new Set<string>();
    const segmentSize = middle.length / count;

    for (let i = 0; i < count; i++) {
        const segStart = Math.floor(i * segmentSize);
        const segEnd = Math.floor((i + 1) * segmentSize);
        const segment = middle.slice(segStart, segEnd);

        const candidates = segment.filter((t) => !usedBiomes.has(t.biome));
        const pool = candidates.length > 0 ? candidates : segment;
        const pick = pool[Math.floor(Math.random() * pool.length)];

        chosen.push(pick);
        usedBiomes.add(pick.biome);
    }

    return chosen;
}

export function planJourney(
    startCity: City,
    endCity: City,
    worldGrid: WorldGrid,
): Journey {
    const startRowCol = coordsToRowCol(
        startCity.lat,
        startCity.lng,
        worldGrid.info,
    );
    const endRowCol = coordsToRowCol(endCity.lat, endCity.lng, worldGrid.info);
    const startTile = worldGrid.grid[startRowCol.row][startRowCol.col];
    const endTile = worldGrid.grid[endRowCol.row][endRowCol.col];

    const viewportTiles = getViewportTiles(startTile, endTile, worldGrid, 3);
    const graph = buildGraph(viewportTiles);

    const pathFinder = aStar(graph, {
        distance(_fromNode, toNode) {
            const tile = toNode.data as Tile;
            return tile.biome === "ocean" ? 8 : 1;
        },
    });

    const rawPath = pathFinder.find(
        `${startTile.row},${startTile.col}`,
        `${endTile.row},${endTile.col}`,
    );
    if (rawPath.length === 0) {
        throw new Error("No path found between the two points.");
    }

    const path: Tile[] = rawPath.map((node) => node.data as Tile).reverse();

    const colSpan = Math.abs(startTile.col - endTile.col);
    const minigameCount = determineMinigameCount(colSpan);
    const minigameTiles = pickMinigameTiles(path, minigameCount);

    return { startTile, endTile, path, minigameTiles, viewportTiles };
}
