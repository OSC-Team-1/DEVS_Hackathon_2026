import { Scene } from "phaser";
import * as Phaser from "phaser";
import { EventBus } from "../EventBus";
import type { Journey } from "../../types/world";

interface MinigameSceneData {
    biome: string;
    difficulty: number; // 1 = normal, >1 = harder (storm etc)
    journey: Journey;
    fromCity: string;
    toCity: string;
    destinationUrl: string;
    minigameIndex: number;
}

interface BiomeConfig {
    bgKey: string;
    vehicleKey: string;
    baseSpeed: number;
    label: string;
}

const BIOME_CONFIG: Record<string, BiomeConfig> = {
    ocean: {
        bgKey: "bg-ocean",
        vehicleKey: "vehicle-boat",
        baseSpeed: 260,
        label: "Rough seas ahead!",
    },
    desert: {
        bgKey: "bg-desert",
        vehicleKey: "vehicle-camel",
        baseSpeed: 200,
        label: "The dunes stretch on...",
    },
    jungle: {
        bgKey: "bg-jungle",
        vehicleKey: "vehicle-vine",
        baseSpeed: 240,
        label: "Vines everywhere!",
    },
    mountain: {
        bgKey: "bg-mountain",
        vehicleKey: "vehicle-train",
        baseSpeed: 220,
        label: "Steep climb ahead.",
    },
    plains: {
        bgKey: "bg-plains",
        vehicleKey: "vehicle-camel",
        baseSpeed: 180,
        label: "Smooth going, for now.",
    },
};

const HITS_NEEDED = 3;
const TIME_LIMIT_MS = 10000;

export class MinigameScene extends Scene {
    private gameData!: MinigameSceneData;
    private marker!: Phaser.GameObjects.Rectangle;
    private zone!: Phaser.GameObjects.Rectangle;
    private markerDir = 1;
    private markerSpeed = 0;
    private hits = 0;
    private hitsText!: Phaser.GameObjects.Text;
    private resolved = false;
    // kept as a field (not just local) so future scenes can restyle/hide it
    private timerBarBg!: Phaser.GameObjects.Rectangle;
    private timerBarFill!: Phaser.GameObjects.Rectangle;
    private timeRemainingMs = TIME_LIMIT_MS;

    constructor() {
        super("MinigameScene");
    }

    init(data: MinigameSceneData) {
        this.gameData = data;
        this.hits = 0;
        this.markerDir = 1;
        this.resolved = false;
        this.timeRemainingMs = TIME_LIMIT_MS;
    }

    create() {
        const cfg = BIOME_CONFIG[this.gameData.biome] ?? BIOME_CONFIG.plains;
        this.markerSpeed = cfg.baseSpeed * this.gameData.difficulty;

        // Background -- falls back to a flat color rect if art isn't loaded yet,
        // so the scene never breaks just because an asset is missing.
        if (this.textures.exists(cfg.bgKey)) {
            this.add.image(400, 250, cfg.bgKey).setDisplaySize(800, 500);
        } else {
            this.add.rectangle(400, 250, 800, 500, 0x223355);
        }

        this.add
            .text(400, 40, cfg.label, {
                fontFamily: "Baloo 2, Arial",
                fontSize: 24,
                fontStyle: "bold",
                color: "#ffffff",
                stroke: "#0b1026",
                strokeThickness: 5,
            })
            .setOrigin(0.5);

        this.add
            .text(400, 70, "Press SPACE when the marker is in the zone", {
                fontFamily: "Baloo 2, Arial",
                fontSize: 14,
                color: "#e6e9ff",
            })
            .setOrigin(0.5);

        this.zone = this.add.rectangle(400, 450, 80, 24, 0x00ff00, 0.5);
        this.marker = this.add.rectangle(120, 450, 10, 34, 0xffffff);

        this.hitsText = this.add
            .text(400, 400, `0 / ${HITS_NEEDED}`, {
                fontFamily: "Arial",
                fontSize: 20,
                color: "#ffffff",
            })
            .setOrigin(0.5);

        // Visible countdown bar so the player can see how long they have left
        this.timerBarBg = this.add
            .rectangle(400, 100, 300, 14, 0x000000, 0.5)
            .setStrokeStyle(1, 0xffffff);
        this.timerBarFill = this.add
            .rectangle(400 - 150, 100, 300, 14, 0xffcc00)
            .setOrigin(0, 0.5);

        this.input.keyboard?.on("keydown-SPACE", () => this.checkHit());

        EventBus.emit("current-scene-ready", this);
    }

    update(_time: number, delta: number) {
        if (this.resolved) return;

        this.marker.x += (this.markerDir * this.markerSpeed * delta) / 1000;
        if (this.marker.x > 720) this.markerDir = -1;
        if (this.marker.x < 80) this.markerDir = 1;

        this.timeRemainingMs -= delta;
        const pct = Phaser.Math.Clamp(
            this.timeRemainingMs / TIME_LIMIT_MS,
            0,
            1,
        );
        this.timerBarFill.width = 300 * pct;
        if (pct < 0.25) this.timerBarFill.setFillStyle(0xff3030); // red when nearly out of time

        if (this.timeRemainingMs <= 0) {
            this.resolve(false);
        }
    }

    private checkHit() {
        if (this.resolved) return;
        const inZone =
            Math.abs(this.marker.x - this.zone.x) < this.zone.width / 2;
        if (inZone) {
            this.hits++;
            this.hitsText.setText(`${this.hits} / ${HITS_NEEDED}`);
            this.zone.setFillStyle(0x00ff00, 0.9);
            this.time.delayedCall(100, () =>
                this.zone.setFillStyle(0x00ff00, 0.5),
            );

            // Randomize zone position each hit so it's not just "hold rhythm"
            this.zone.x = Phaser.Math.Between(160, 640);

            if (this.hits >= HITS_NEEDED) this.resolve(true);
        } else {
            this.cameras.main.shake(100, 0.005);
        }
    }

    private resolve(won: boolean) {
        if (this.resolved) return;
        this.resolved = true;
        this.timerBarBg.setVisible(false);

        EventBus.emit("minigame-result", {
            won,
            biome: this.gameData.biome,
            minigameIndex: this.gameData.minigameIndex,
            journey: this.gameData.journey,
            fromCity: this.gameData.fromCity,
            toCity: this.gameData.toCity,
            destinationUrl: this.gameData.destinationUrl,
        });
    }
}
