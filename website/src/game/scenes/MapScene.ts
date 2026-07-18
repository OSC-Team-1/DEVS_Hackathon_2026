import { Scene } from "phaser";
import { EventBus } from "../EventBus";
import * as Phaser from "phaser";
import type { Journey, Tile } from "../../types/world";
import type { JourneyPayload } from "./Boot";
import { getWeatherForCoords } from "../../lib/weather";

type MapMode = "intro" | "hop" | "arrival";

interface MapSceneData extends JourneyPayload {
    mode: MapMode;
    minigameIndex: number; // which minigame we're heading to / just came from
}

const BIOME_COLOR: Record<string, number> = {
    ocean: 0x2864c8,
    desert: 0xebcd5a,
    jungle: 0x196e28,
    plains: 0xaadc6e,
    mountain: 0x828282,
};

const TILE_PX = 10;
const INTRO_HOLD_MS = 4200; // gives the AI intro message time to be read

// Which Phaser scene key handles each biome's minigame. Biomes not listed
// here fall back to the generic timing-bar MinigameScene.
const MINIGAME_SCENE_FOR_BIOME: Record<string, string> = {
    ocean: "OceanMinigame",
    mountain: "MountainMinigame",
    plains: "PlainsMinigame",
    desert: "DesertMinigame",
};

export class MapScene extends Scene {
    private journey!: Journey;
    private mode!: MapMode;
    private minigameIndex!: number;
    private fromCity!: string;
    private toCity!: string;
    private destinationUrl!: string;
    private token!: Phaser.GameObjects.Ellipse;

    constructor() {
        super("MapScene");
    }

    init(data: MapSceneData) {
        this.journey = data.journey;
        this.mode = data.mode;
        this.minigameIndex = data.minigameIndex;
        this.fromCity = data.fromCity;
        this.toCity = data.toCity;
        this.destinationUrl = data.destinationUrl;
    }

    create() {
        this.drawTiles();
        this.drawRoute();
        this.drawEndpointMarkers();
        this.drawDestinationLabel();

        EventBus.emit("current-scene-ready", this);

        if (this.mode === "intro") {
            this.token = this.add.ellipse(
                this.tileCenter(this.journey.startTile).x,
                this.tileCenter(this.journey.startTile).y,
                12,
                12,
                0xffffff,
            );
            this.time.delayedCall(INTRO_HOLD_MS, () => this.goToNextMinigame());
        } else if (this.mode === "hop") {
            this.token = this.add.ellipse(
                this.tileCenter(this.currentMinigameOriginTile()).x,
                this.tileCenter(this.currentMinigameOriginTile()).y,
                12,
                12,
                0xffffff,
            );
            this.animateTokenTo(this.currentMinigameTargetTile(), () =>
                this.goToNextMinigame(),
            );
        } else {
            // arrival
            const lastPlayed =
                this.journey.minigameTiles[
                    this.journey.minigameTiles.length - 1
                ] ?? this.journey.startTile;
            this.token = this.add.ellipse(
                this.tileCenter(lastPlayed).x,
                this.tileCenter(lastPlayed).y,
                12,
                12,
                0xffffff,
            );
            this.animateTokenTo(this.journey.endTile, () => {
                EventBus.emit("journey-complete");
            });
        }
    }

    private tileCenter(tile: Tile) {
        const bounds = this.viewportBounds();
        return {
            x: (tile.col - bounds.colStart) * TILE_PX + TILE_PX / 2,
            y: (tile.row - bounds.rowStart) * TILE_PX + TILE_PX / 2,
        };
    }

    private viewportBounds() {
        const vt = this.journey.viewportTiles;
        return {
            rowStart: vt[0][0].row,
            colStart: vt[0][0].col,
        };
    }

    private drawTiles() {
        for (const row of this.journey.viewportTiles) {
            for (const tile of row) {
                const { x, y } = this.tileCenter(tile);
                const color = BIOME_COLOR[tile.biome] ?? 0xff00ff;
                this.add.rectangle(x, y, TILE_PX - 1, TILE_PX - 1, color);
            }
        }

        const width = this.journey.viewportTiles[0].length * TILE_PX;
        const height = this.journey.viewportTiles.length * TILE_PX;
        this.cameras.main.setBounds(0, 0, width, height);
        this.fitCameraToRoute(width, height);
    }

    private fitCameraToRoute(_worldWidth: number, _worldHeight: number) {
        const camera = this.cameras.main;
        const start = this.tileCenter(this.journey.startTile);
        const end = this.tileCenter(this.journey.endTile);

        const minX = Math.min(start.x, end.x) - 60;
        const maxX = Math.max(start.x, end.x) + 60;
        const minY = Math.min(start.y, end.y) - 60;
        const maxY = Math.max(start.y, end.y) + 60;

        const spanX = Math.max(maxX - minX, 200);
        const spanY = Math.max(maxY - minY, 150);

        camera.centerOn((minX + maxX) / 2, (minY + maxY) / 2);
        const zoomX = camera.width / spanX;
        const zoomY = camera.height / spanY;
        camera.setZoom(Phaser.Math.Clamp(Math.min(zoomX, zoomY), 0.5, 3));
    }

    private drawRoute() {
        const points = this.journey.path.map((t) => this.tileCenter(t));
        const line = new Phaser.Curves.Spline(
            points.map((p) => new Phaser.Math.Vector2(p.x, p.y)),
        );
        const graphics = this.add.graphics();
        graphics.lineStyle(2, 0xffffff, 0.8);
        line.draw(graphics, 64);
    }

    private drawEndpointMarkers() {
        const start = this.tileCenter(this.journey.startTile);
        const end = this.tileCenter(this.journey.endTile);
        this.add
            .circle(start.x, start.y, 5, 0x00ff00)
            .setStrokeStyle(1, 0xffffff);
        this.add.circle(end.x, end.y, 5, 0xff3030).setStrokeStyle(1, 0xffffff);
    }

    private drawDestinationLabel() {
        // Requirement from the design doc: destination must ALWAYS be visible
        this.add
            .text(10, 10, `\u2708 ${this.toCity}`, {
                fontFamily: "Baloo 2, Arial",
                fontSize: 16,
                fontStyle: "bold",
                color: "#ffffff",
                backgroundColor: "#0b1026cc",
                padding: { x: 10, y: 6 },
            })
            .setScrollFactor(0)
            .setDepth(100);
    }

    private currentMinigameOriginTile(): Tile {
        return this.minigameIndex === 0
            ? this.journey.startTile
            : this.journey.minigameTiles[this.minigameIndex - 1];
    }

    private currentMinigameTargetTile(): Tile {
        return this.journey.minigameTiles[this.minigameIndex];
    }

    private animateTokenTo(target: Tile, onDone: () => void) {
        const { x, y } = this.tileCenter(target);
        this.tweens.add({
            targets: this.token,
            x,
            y,
            duration: 900,
            ease: "Sine.easeInOut",
            onComplete: onDone,
        });
    }

    /**
     * Decides whether this minigame is a storm (difficulty 2) or calm (1).
     * Priority order:
     *   1. URL overrides (?storm=always / ?storm=never / ?storm=<0-1>) --
     *      always win, so a demo never depends on live weather or RNG.
     *   2. Desert never storms, per the design doc.
     *   3. Real weather for the minigame tile's coordinates via Open-Meteo.
     *      If that fetch fails or times out, falls back to a 35% random
     *      chance so the game never stalls waiting on a live API.
     */
    private async rollDifficulty(tile: Tile): Promise<number> {
        const params = new URLSearchParams(window.location.search);
        const override = params.get("storm");
        if (override === "always") return 2;
        if (override === "never") return 1;

        if (tile.biome === "desert") return 1;

        if (override !== null) {
            const chance = parseFloat(override);
            return Math.random() < chance ? 2 : 1;
        }

        const weather = await getWeatherForCoords(tile.lat, tile.lon);
        if (weather.description !== "Unavailable") {
            return weather.isStorm ? 2 : 1;
        }

        // API unreachable -- fall back to a random roll rather than always calm
        return Math.random() < 0.35 ? 2 : 1;
    }

    private async goToNextMinigame() {
        if (this.minigameIndex >= this.journey.minigameTiles.length) {
            // Shouldn't normally happen (arrival mode handles the last leg),
            // but guards against an off-by-one during testing.
            this.scene.start("MapScene", {
                mode: "arrival",
                journey: this.journey,
                fromCity: this.fromCity,
                toCity: this.toCity,
                destinationUrl: this.destinationUrl,
                minigameIndex: this.minigameIndex,
            });
            return;
        }

        const tile = this.journey.minigameTiles[this.minigameIndex];
        const sceneKey =
            MINIGAME_SCENE_FOR_BIOME[tile.biome] ?? "MinigameScene";
        const difficulty = await this.rollDifficulty(tile);

        // Scene may have been torn down while we were awaiting weather
        // (e.g. player forfeited) -- bail out rather than starting a scene
        // on a dead context.
        if (!this.scene.isActive()) return;

        this.scene.start(sceneKey, {
            biome: tile.biome,
            difficulty,
            journey: this.journey,
            fromCity: this.fromCity,
            toCity: this.toCity,
            destinationUrl: this.destinationUrl,
            minigameIndex: this.minigameIndex,
        });
    }
}
