export type Biome = "ocean" | "desert" | "jungle" | "plains" | "mountain";

export interface Tile {
  row: number;
  col: number;
  lon: number;
  lat: number;
  biome: Biome;
}

export interface GridInfo {
  cols: number;
  rows: number;
  tileSizeDeg: number;
}

export interface WorldGrid {
  info: GridInfo;
  grid: Tile[][];
}

export interface City {
  city: string;
  lat: number;
  lng: number;
  p: number;
}

export interface Journey {
  startTile: Tile;
  endTile: Tile;
  path: Tile[];
  minigameTiles: Tile[];
  viewportTiles: Tile[][];
}
