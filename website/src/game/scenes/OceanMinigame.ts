import { Scene } from "phaser";
import * as Phaser from "phaser";
import { EventBus } from "../EventBus";
import type { Journey } from "../../types/world";

export interface MinigameSceneData {
    biome: string;
    difficulty: number;
    journey: Journey;
    fromCity: string;
    toCity: string;
    destinationUrl: string;
    minigameIndex: number;
}

const LANES = 5;
const LANE_WIDTH = 800 / LANES;
const SHIP_Y = 430;
const SURVIVE_MS = 10000;
const BASE_FALL_SPEED = 200;
const BASE_SPAWN_INTERVAL = 500;

export class OceanMinigame extends Scene {
    private gameData!: MinigameSceneData;
    private ship!: Phaser.GameObjects.Container;
    private lane = 2; // start in the middle lane
    private obstacles!: Phaser.GameObjects.Group;
    private resolved = false;
    private elapsedMs = 0;
    private spawnTimer = 0;
    private fallSpeed = BASE_FALL_SPEED;
    private spawnInterval = BASE_SPAWN_INTERVAL;
    private survivalBarFill!: Phaser.GameObjects.Rectangle;

    constructor() {
        super("OceanMinigame");
    }

    init(data: MinigameSceneData) {
        this.gameData = data;
        this.lane = 2;
        this.resolved = false;
        this.elapsedMs = 0;
        this.spawnTimer = 0;
        const storm = data.difficulty > 1;
        this.fallSpeed = BASE_FALL_SPEED * (storm ? 1.6 : 1);
        this.spawnInterval = BASE_SPAWN_INTERVAL / (storm ? 1.4 : 1);
    }

    create() {
        // --- background ---
        if (this.textures.exists("bg-ocean")) {
            this.add.image(400, 250, "bg-ocean").setDisplaySize(800, 500);
        } else {
            this.add.rectangle(400, 250, 800, 500, 0x123a63);
            // simple animated wave stripes as a fallback
            for (let i = 0; i < 6; i++) {
                this.add
                    .rectangle(400, i * 90 + 20, 900, 4, 0x2f6fae, 0.4)
                    .setName(`wave-${i}`);
            }
        }

        // lane divider lines
        const g = this.add.graphics();
        g.lineStyle(2, 0xffffff, 0.25);
        for (let i = 1; i < LANES; i++) {
            const x = i * LANE_WIDTH;
            g.lineBetween(x, 0, x, 500);
        }

        this.add
            .text(
                400,
                34,
                this.gameData.difficulty > 1
                    ? "STORM! Dodge the rocks and icebergs!"
                    : "Dodge the rocks and icebergs!",
                {
                    fontFamily: "Baloo 2, Arial",
                    fontSize: 24,
                    fontStyle: "bold",
                    color: "#ffffff",
                    stroke: "#0b1026",
                    strokeThickness: 5,
                },
            )
            .setOrigin(0.5);

        this.add
            .text(400, 64, "\u2190 / \u2192 or A / D to change lanes", {
                fontFamily: "Baloo 2, Arial",
                fontSize: 14,
                color: "#cfe8ff",
            })
            .setOrigin(0.5);

        // --- survival bar ---
        this.add
            .rectangle(400, 96, 300, 12, 0x000000, 0.4)
            .setStrokeStyle(1, 0xffffff);
        this.survivalBarFill = this.add
            .rectangle(400 - 150, 96, 0, 12, 0x4ee7ff)
            .setOrigin(0, 0.5);

        // --- ship ---
        this.ship = this.buildShip();
        this.positionShipToLane(true);

        // --- obstacles group ---
        this.obstacles = this.add.group();

        // --- input ---
        const cursors = this.input.keyboard?.createCursorKeys();
        this.input.keyboard?.on("keydown-LEFT", () => this.moveLane(-1));
        this.input.keyboard?.on("keydown-A", () => this.moveLane(-1));
        this.input.keyboard?.on("keydown-RIGHT", () => this.moveLane(1));
        this.input.keyboard?.on("keydown-D", () => this.moveLane(1));
        void cursors;

        // touch/click support: tap left half or right half of screen
        this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
            this.moveLane(p.x < 400 ? -1 : 1);
        });

        EventBus.emit("current-scene-ready", this);
    }

    private buildShip(): Phaser.GameObjects.Container {
        const parts: Phaser.GameObjects.GameObject[] = [];
        if (this.textures.exists("vehicle-boat")) {
            parts.push(this.add.image(0, 0, "vehicle-boat").setDisplaySize(46, 46));
        } else {
            // simple boat shape fallback: hull + sail
            const hull = this.add.triangle(0, 10, -22, 0, 22, 0, 0, 22, 0xd9a25e);
            const mast = this.add.rectangle(0, -8, 3, 26, 0x6b4226);
            const sail = this.add.triangle(3, -8, 0, -18, 0, 6, 22, -4, 0xf5f2e8);
            parts.push(hull, mast, sail);
        }
        const container = this.add.container(0, SHIP_Y, parts);
        container.setSize(46, 46);
        return container;
    }

    private laneX(lane: number) {
        return lane * LANE_WIDTH + LANE_WIDTH / 2;
    }

    private moveLane(dir: -1 | 1) {
        if (this.resolved) return;
        const next = Phaser.Math.Clamp(this.lane + dir, 0, LANES - 1);
        if (next === this.lane) return;
        this.lane = next;
        this.positionShipToLane(false);
    }

    private positionShipToLane(instant: boolean) {
        const x = this.laneX(this.lane);
        if (instant) {
            this.ship.setPosition(x, SHIP_Y);
        } else {
            this.tweens.add({
                targets: this.ship,
                x,
                duration: 140,
                ease: "Sine.easeOut",
            });
        }
    }

    private spawnObstacle() {
        const lane = Phaser.Math.Between(0, LANES - 1);
        const isIceberg = Math.random() < 0.5;
        const key = isIceberg ? "obstacle-iceberg" : "obstacle-rock";
        let sprite: Phaser.GameObjects.GameObject & {
            x: number;
            y: number;
        };

        if (this.textures.exists(key)) {
            sprite = this.add.image(this.laneX(lane), -30, key).setDisplaySize(44, 44);
        } else {
            sprite = this.add.circle(
                this.laneX(lane),
                -30,
                20,
                isIceberg ? 0xdff4ff : 0x6b5b4b,
            );
            (sprite as Phaser.GameObjects.Arc).setStrokeStyle(
                2,
                isIceberg ? 0x9fd4ec : 0x352a20,
            );
        }
        (sprite as any).setData("lane", lane);
        this.obstacles.add(sprite as unknown as Phaser.GameObjects.GameObject);
    }

    update(_time: number, delta: number) {
        if (this.resolved) return;

        this.elapsedMs += delta;

        // survival bar fill
        const pct = Phaser.Math.Clamp(this.elapsedMs / SURVIVE_MS, 0, 1);
        this.survivalBarFill.width = 300 * pct;

        if (this.elapsedMs >= SURVIVE_MS) {
            this.resolve(true);
            return;
        }

        // spawn obstacles
        this.spawnTimer += delta;
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            this.spawnObstacle();
        }

        // move + collide
        const shipLane = this.lane;
        this.obstacles.getChildren().forEach((obj) => {
            const go = obj as unknown as Phaser.GameObjects.Components.Transform &
                Phaser.GameObjects.GameObject & { y: number };
            (go as any).y += (this.fallSpeed * delta) / 1000;

            if ((go as any).y > 520) {
                (obj as any).destroy();
                return;
            }

            const lane = (obj as any).getData("lane");
            if (
                lane === shipLane &&
                (go as any).y > SHIP_Y - 30 &&
                (go as any).y < SHIP_Y + 30
            ) {
                this.cameras.main.shake(180, 0.01);
                this.resolve(false);
            }
        });
    }

    private resolve(won: boolean) {
        if (this.resolved) return;
        this.resolved = true;

        this.time.delayedCall(won ? 250 : 400, () => {
            EventBus.emit("minigame-result", {
                won,
                biome: this.gameData.biome,
                minigameIndex: this.gameData.minigameIndex,
                journey: this.gameData.journey,
                fromCity: this.gameData.fromCity,
                toCity: this.gameData.toCity,
                destinationUrl: this.gameData.destinationUrl,
            });
        });
    }
}
