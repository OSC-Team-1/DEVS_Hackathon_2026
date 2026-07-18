import { Scene } from "phaser";
import * as Phaser from "phaser";
import { EventBus } from "../EventBus";
import type { MinigameSceneData } from "./OceanMinigame";

const GROUND_Y = 420;
const TIME_LIMIT_MS = 10000; // race the clock -- reach zero while still standing = win
const BASE_SCROLL_SPEED = 300;
const GRAVITY = 2400;
const JUMP_VELOCITY = -780;
const PLAYER_X = 160;
const OBSTACLE_SIZE = 40;

interface Obstacle {
    obj: Phaser.GameObjects.GameObject & { x: number; y: number };
    passed: boolean;
}

export class DesertMinigame extends Scene {
    private gameData!: MinigameSceneData;
    private player!: Phaser.GameObjects.Container;
    private velocityY = 0;
    private isGrounded = true;
    private obstacles: Obstacle[] = [];
    private resolved = false;
    private timeRemainingMs = TIME_LIMIT_MS;
    private spawnTimer = 0;
    private spawnInterval = 1100;
    private scrollSpeed = BASE_SCROLL_SPEED;
    private timerBarFill!: Phaser.GameObjects.Rectangle;
    private timerText!: Phaser.GameObjects.Text;
    private duneGraphics!: Phaser.GameObjects.Graphics;
    private duneOffset = 0;

    constructor() {
        super("DesertMinigame");
    }

    init(data: MinigameSceneData) {
        this.gameData = data;
        this.velocityY = 0;
        this.isGrounded = true;
        this.obstacles = [];
        this.resolved = false;
        this.timeRemainingMs = TIME_LIMIT_MS;
        this.spawnTimer = 0;
        this.scrollSpeed = BASE_SCROLL_SPEED;
        this.spawnInterval = 1100;
    }

    create() {
        if (this.textures.exists("bg-desert")) {
            this.add.image(400, 250, "bg-desert").setDisplaySize(800, 500);
        } else {
            // warm gradient-ish fallback: sky band + sand band
            this.add.rectangle(400, 180, 800, 360, 0xf2c879);
            this.add.rectangle(400, 440, 800, 160, 0xe0a94f);
        }

        // rolling dune silhouette in the background for a bit of depth
        this.duneGraphics = this.add.graphics();
        this.drawDunes();

        this.add
            .text(400, 34, "Race the clock across the dunes!", {
                fontFamily: "Baloo 2, Arial",
                fontSize: 22,
                fontStyle: "bold",
                color: "#3a2410",
                stroke: "#fff3d6",
                strokeThickness: 5,
            })
            .setOrigin(0.5);

        this.add
            .text(400, 64, "SPACE / \u2191 or tap to jump", {
                fontFamily: "Baloo 2, Arial",
                fontSize: 14,
                color: "#4a2f14",
            })
            .setOrigin(0.5);

        this.add
            .rectangle(400, 96, 300, 14, 0x3a2410, 0.25)
            .setStrokeStyle(1, 0x3a2410);
        this.timerBarFill = this.add
            .rectangle(400 - 150, 96, 300, 14, 0xff8c3a)
            .setOrigin(0, 0.5);

        this.timerText = this.add
            .text(400, 118, this.formatTime(this.timeRemainingMs), {
                fontFamily: "Baloo 2, Arial",
                fontSize: 14,
                fontStyle: "bold",
                color: "#3a2410",
            })
            .setOrigin(0.5);

        this.add.rectangle(400, GROUND_Y + 26, 900, 52, 0xd6a34f);

        this.player = this.buildPlayer();

        const jump = () => this.tryJump();
        this.input.keyboard?.on("keydown-SPACE", jump);
        this.input.keyboard?.on("keydown-UP", jump);
        this.input.on("pointerdown", jump);

        EventBus.emit("current-scene-ready", this);
    }

    private buildPlayer(): Phaser.GameObjects.Container {
        const parts: Phaser.GameObjects.GameObject[] = [];
        if (this.textures.exists("vehicle-camel")) {
            parts.push(this.add.image(0, 0, "vehicle-camel").setDisplaySize(50, 50));
        } else {
            // simple camel-ish silhouette fallback: body + hump + legs
            const body = this.add.rectangle(0, 4, 34, 20, 0xc79b5e);
            const hump = this.add.circle(-4, -10, 12, 0xc79b5e);
            const head = this.add.circle(16, -2, 8, 0xd4ab70);
            parts.push(body, hump, head);
        }
        return this.add.container(PLAYER_X, GROUND_Y, parts);
    }

    private tryJump() {
        if (this.resolved) return;
        if (!this.isGrounded) return;
        this.velocityY = JUMP_VELOCITY;
        this.isGrounded = false;
    }

    private spawnObstacle() {
        const isCactus = Math.random() < 0.6;
        const key = isCactus ? "obstacle-cactus" : "obstacle-dunerock";
        let sprite: Phaser.GameObjects.GameObject & { x: number; y: number };

        if (this.textures.exists(key)) {
            sprite = this.add
                .image(900, GROUND_Y - OBSTACLE_SIZE / 2 + 6, key)
                .setDisplaySize(OBSTACLE_SIZE, OBSTACLE_SIZE);
        } else if (isCactus) {
            // simple cactus fallback: a green rounded column with two arms
            const container = this.add.container(900, GROUND_Y - 14);
            const trunk = this.add.rectangle(0, 0, 12, 40, 0x3f7d3a);
            const armL = this.add.rectangle(-9, -6, 8, 18, 0x3f7d3a);
            const armR = this.add.rectangle(9, -10, 8, 18, 0x3f7d3a);
            container.add([trunk, armL, armR]);
            sprite = container as unknown as typeof sprite;
        } else {
            sprite = this.add.circle(900, GROUND_Y + 4, 16, 0x8a6a45) as unknown as typeof sprite;
        }

        this.obstacles.push({ obj: sprite, passed: false });
    }

    private drawDunes() {
        const g = this.duneGraphics;
        g.clear();
        g.fillStyle(0xdba85c, 0.5);
        for (let i = 0; i < 3; i++) {
            const baseX = -100 + ((i * 300 + this.duneOffset) % 1000);
            g.fillEllipse(baseX, 370, 260, 60);
        }
    }

    private formatTime(ms: number) {
        return `${(Math.max(ms, 0) / 1000).toFixed(1)}s`;
    }

    update(_time: number, delta: number) {
        if (this.resolved) return;

        this.timeRemainingMs -= delta;
        const pct = Phaser.Math.Clamp(this.timeRemainingMs / TIME_LIMIT_MS, 0, 1);
        this.timerBarFill.width = 300 * pct;
        this.timerText.setText(this.formatTime(this.timeRemainingMs));
        if (pct < 0.25) this.timerBarFill.setFillStyle(0xff3b3b);

        if (this.timeRemainingMs <= 0) {
            this.resolve(true);
            return;
        }

        // ramp difficulty slightly the longer you survive, keeps it lively
        this.spawnInterval = Math.max(650, 1100 - (TIME_LIMIT_MS - this.timeRemainingMs) / 30);
        this.scrollSpeed = BASE_SCROLL_SPEED + (TIME_LIMIT_MS - this.timeRemainingMs) / 40;

        // background dune parallax
        this.duneOffset += (this.scrollSpeed * delta) / 1000 / 2;
        this.drawDunes();

        // spawn
        this.spawnTimer += delta;
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            this.spawnObstacle();
        }

        // physics
        this.velocityY += (GRAVITY * delta) / 1000;
        let playerY = this.player.y + (this.velocityY * delta) / 1000;
        if (playerY >= GROUND_Y) {
            playerY = GROUND_Y;
            this.velocityY = 0;
            this.isGrounded = true;
        }
        this.player.y = playerY;
        this.player.rotation = this.isGrounded
            ? 0
            : Phaser.Math.Clamp(this.velocityY / 3200, -0.25, 0.4);

        // move obstacles + collide
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const o = this.obstacles[i];
            o.obj.x -= (this.scrollSpeed * delta) / 1000;

            if (o.obj.x < -60) {
                (o.obj as any).destroy();
                this.obstacles.splice(i, 1);
                continue;
            }

            const dx = Math.abs(o.obj.x - PLAYER_X);
            const playerAirborne = this.player.y < GROUND_Y - 18;
            if (dx < 26 && !playerAirborne) {
                this.cameras.main.shake(150, 0.01);
                this.resolve(false);
            }
        }
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