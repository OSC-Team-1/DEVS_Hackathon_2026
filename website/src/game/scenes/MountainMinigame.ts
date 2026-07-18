import { Scene } from "phaser";
import * as Phaser from "phaser";
import { EventBus } from "../EventBus";
import type { Journey } from "../../types/world";
import type { MinigameSceneData } from "./OceanMinigame";

const GROUND_Y = 420;
const SURVIVE_MS = 10000;
const BASE_SCROLL_SPEED = 260;
const GRAVITY = 2200;
const JUMP_VELOCITY = -820;
const PLAYER_X = 160;

interface Ravine {
    obj: Phaser.GameObjects.Rectangle;
    startX: number;
    width: number;
}

export class MountainMinigame extends Scene {
    private gameData!: MinigameSceneData;
    private player!: Phaser.GameObjects.Container;
    private velocityY = 0;
    private isGrounded = true;
    private ravines: Ravine[] = [];
    private resolved = false;
    private elapsedMs = 0;
    private spawnTimer = 0;
    private spawnInterval = 1400;
    private scrollSpeed = BASE_SCROLL_SPEED;
    private survivalBarFill!: Phaser.GameObjects.Rectangle;
    private jumpsUsed = 0;

    constructor() {
        super("MountainMinigame");
    }

    init(data: MinigameSceneData) {
        this.gameData = data;
        this.velocityY = 0;
        this.isGrounded = true;
        this.ravines = [];
        this.resolved = false;
        this.elapsedMs = 0;
        this.spawnTimer = 0;
        const storm = data.difficulty > 1;
        this.scrollSpeed = BASE_SCROLL_SPEED * (storm ? 1.45 : 1);
        this.spawnInterval = storm ? 950 : 1400;
    }

    create() {
        if (this.textures.exists("bg-mountain")) {
            this.add.image(400, 250, "bg-mountain").setDisplaySize(800, 500);
        } else {
            // simple mountain-sky gradient fallback via layered rects
            this.add.rectangle(400, 250, 800, 500, 0x2b2f4a);
            this.add.rectangle(400, 380, 800, 240, 0x3a3f63);
        }

        this.add
            .text(
                400,
                34,
                this.gameData.difficulty > 1
                    ? "STORM! Jump the ravines!"
                    : "Jump over the ravines!",
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
            .text(400, 64, "SPACE / \u2191 or tap to jump", {
                fontFamily: "Baloo 2, Arial",
                fontSize: 14,
                color: "#e6e9ff",
            })
            .setOrigin(0.5);

        this.add
            .rectangle(400, 96, 300, 12, 0x000000, 0.4)
            .setStrokeStyle(1, 0xffffff);
        this.survivalBarFill = this.add
            .rectangle(400 - 150, 96, 0, 12, 0xffb347)
            .setOrigin(0, 0.5);

        // ground strip (visual only, ravines are gaps drawn as holes)
        this.add.rectangle(400, GROUND_Y + 24, 900, 48, 0x8a6a45);

        this.player = this.buildPlayer();
        this.player.setPosition(PLAYER_X, GROUND_Y);

        const jump = () => this.tryJump();
        this.input.keyboard?.on("keydown-SPACE", jump);
        this.input.keyboard?.on("keydown-UP", jump);
        this.input.on("pointerdown", jump);

        EventBus.emit("current-scene-ready", this);
    }

    private buildPlayer(): Phaser.GameObjects.Container {
        const parts: Phaser.GameObjects.GameObject[] = [];
        if (this.textures.exists("vehicle-train")) {
            parts.push(this.add.image(0, 0, "vehicle-train").setDisplaySize(44, 44));
        } else {
            // simple hiker/traveler blob fallback
            const body = this.add.rectangle(0, 0, 26, 34, 0xffb347);
            const head = this.add.circle(0, -24, 12, 0xffe0b3);
            parts.push(body, head);
        }
        return this.add.container(PLAYER_X, GROUND_Y, parts);
    }

    private tryJump() {
        if (this.resolved) return;
        if (!this.isGrounded) return;
        this.velocityY = JUMP_VELOCITY;
        this.isGrounded = false;
        this.jumpsUsed++;
    }

    private spawnRavine() {
        const width = Phaser.Math.Between(70, 130) * (this.gameData.difficulty > 1 ? 1.15 : 1);
        const startX = 900;
        const rect = this.add.rectangle(
            startX,
            GROUND_Y + 24,
            width,
            48,
            0x0b1026,
        );
        this.ravines.push({ obj: rect, startX, width });
    }

    update(_time: number, delta: number) {
        if (this.resolved) return;

        this.elapsedMs += delta;
        const pct = Phaser.Math.Clamp(this.elapsedMs / SURVIVE_MS, 0, 1);
        this.survivalBarFill.width = 300 * pct;

        if (this.elapsedMs >= SURVIVE_MS) {
            this.resolve(true);
            return;
        }

        // spawn ravines
        this.spawnTimer += delta;
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            this.spawnRavine();
        }

        // physics: gravity + jump arc
        this.velocityY += (GRAVITY * delta) / 1000;
        let playerY = this.player.y + (this.velocityY * delta) / 1000;

        // determine if player is currently over a ravine gap
        const overRavine = this.ravines.some((r) => {
            const left = r.obj.x - r.width / 2;
            const right = r.obj.x + r.width / 2;
            return PLAYER_X > left && PLAYER_X < right;
        });

        if (playerY >= GROUND_Y) {
            if (overRavine) {
                // no ground here -- keep falling, it's a loss
                this.player.y = playerY;
                if (playerY > GROUND_Y + 140) {
                    this.resolve(false);
                }
            } else {
                playerY = GROUND_Y;
                this.velocityY = 0;
                this.isGrounded = true;
                this.player.y = playerY;
            }
        } else {
            this.player.y = playerY;
        }

        // slight tilt while airborne for polish
        this.player.rotation = this.isGrounded
            ? 0
            : Phaser.Math.Clamp(this.velocityY / 3000, -0.3, 0.5);

        // scroll ravines toward player
        for (let i = this.ravines.length - 1; i >= 0; i--) {
            const r = this.ravines[i];
            r.obj.x -= (this.scrollSpeed * delta) / 1000;
            if (r.obj.x < -200) {
                r.obj.destroy();
                this.ravines.splice(i, 1);
            }
        }
    }

    private resolve(won: boolean) {
        if (this.resolved) return;
        this.resolved = true;

        this.time.delayedCall(won ? 250 : 350, () => {
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

export type { Journey };
