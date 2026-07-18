import { Scene } from "phaser";
import * as Phaser from "phaser";
import { EventBus } from "../EventBus";
import type { MinigameSceneData } from "./OceanMinigame";

const MAX_SHOTS = 8;
const LEVEL_W = 800;
const LEVEL_H = 500;
const HIDE_SPOT_COUNT = 9;

interface HideSpot {
    x: number;
    y: number;
    bush: Phaser.GameObjects.GameObject & { x: number; y: number };
    hasDeer: boolean;
}

export class PlainsMinigame extends Scene {
    private gameData!: MinigameSceneData;
    private hideSpots: HideSpot[] = [];
    private shotsLeft = MAX_SHOTS;
    private shotsText!: Phaser.GameObjects.Text;
    private resolved = false;
    private fogGraphics?: Phaser.GameObjects.Graphics;
    private sightRadius = 999; // effectively unlimited when not stormy

    constructor() {
        super("PlainsMinigame");
    }

    init(data: MinigameSceneData) {
        this.gameData = data;
        this.hideSpots = [];
        this.shotsLeft = MAX_SHOTS;
        this.resolved = false;
        const storm = data.difficulty > 1;
        this.sightRadius = storm ? 170 : 999;
    }

    create() {
        if (this.textures.exists("bg-plains")) {
            this.add.image(400, 250, "bg-plains").setDisplaySize(800, 500);
        } else {
            this.add.rectangle(400, 250, 800, 500, 0x6fa646);
            // simple ground texture stripes
            for (let i = 0; i < 5; i++) {
                this.add.rectangle(400, 120 + i * 70, 900, 3, 0x5d9139, 0.5);
            }
        }

        const storm = this.gameData.difficulty > 1;

        this.add
            .text(
                400,
                34,
                storm
                    ? "STORM! Visibility is poor -- find the deer!"
                    : "A deer is hiding somewhere. Find it!",
                {
                    fontFamily: "Baloo 2, Arial",
                    fontSize: 22,
                    fontStyle: "bold",
                    color: "#ffffff",
                    stroke: "#0b1026",
                    strokeThickness: 5,
                },
            )
            .setOrigin(0.5);

        this.add
            .text(400, 64, "Click / tap a bush to check it", {
                fontFamily: "Baloo 2, Arial",
                fontSize: 14,
                color: "#eafbe0",
            })
            .setOrigin(0.5);

        this.shotsText = this.add
            .text(400, 96, `Shots left: ${this.shotsLeft}`, {
                fontFamily: "Baloo 2, Arial",
                fontSize: 16,
                fontStyle: "bold",
                color: "#ffe08a",
                stroke: "#0b1026",
                strokeThickness: 3,
            })
            .setOrigin(0.5);

        this.spawnHideSpots();

        // fog overlay for storms -- darkens everything except a small circle
        // that follows the pointer, so the player has to hunt more carefully
        if (storm) {
            this.fogGraphics = this.add.graphics().setDepth(90);
            this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
                this.drawFog(p.x, p.y);
            });
            this.drawFog(400, 250);
        }

        EventBus.emit("current-scene-ready", this);
    }

    private spawnHideSpots() {
        const deerIndex = Phaser.Math.Between(0, HIDE_SPOT_COUNT - 1);
        const margin = 90;
        const usedPositions: { x: number; y: number }[] = [];

        for (let i = 0; i < HIDE_SPOT_COUNT; i++) {
            let x = 0;
            let y = 0;
            let attempts = 0;
            do {
                x = Phaser.Math.Between(margin, LEVEL_W - margin);
                y = Phaser.Math.Between(margin + 90, LEVEL_H - margin);
                attempts++;
            } while (
                usedPositions.some(
                    (p) => Phaser.Math.Distance.Between(p.x, p.y, x, y) < 80,
                ) &&
                attempts < 30
            );
            usedPositions.push({ x, y });

            const bush = this.buildBush(x, y);
            const spot: HideSpot = { x, y, bush, hasDeer: i === deerIndex };
            this.hideSpots.push(spot);

            bush.setInteractive({ useHandCursor: true });
            bush.on("pointerdown", () => this.checkSpot(spot));
        }
    }

    private buildBush(x: number, y: number) {
        // simple bush shape: a few overlapping circles, fallback if no sprite
        const container = this.add.container(x, y);
        const c1 = this.add.circle(-10, 0, 16, 0x3f7d33);
        const c2 = this.add.circle(10, 2, 18, 0x4a8f3c);
        const c3 = this.add.circle(0, -10, 15, 0x568f42);
        container.add([c1, c2, c3]);
        container.setSize(44, 40);

        // gentle idle wobble so the level feels alive
        this.tweens.add({
            targets: container,
            scaleX: 1.04,
            scaleY: 0.97,
            duration: 1400 + Math.random() * 600,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        return container as unknown as Phaser.GameObjects.GameObject & {
            x: number;
            y: number;
            setInteractive: any;
            on: any;
        };
    }

    private checkSpot(spot: HideSpot) {
        if (this.resolved) return;

        if (spot.hasDeer) {
            // reveal the deer
            if (this.textures.exists("vehicle-deer")) {
                this.add.image(spot.x, spot.y, "vehicle-deer").setDisplaySize(48, 48);
            } else {
                this.add.circle(spot.x, spot.y, 20, 0xc9975a).setStrokeStyle(2, 0x7a5a34);
            }
            this.cameras.main.flash(200, 255, 224, 138);
            this.resolve(true);
            return;
        }

        this.shotsLeft--;
        this.shotsText.setText(`Shots left: ${this.shotsLeft}`);
        this.cameras.main.shake(80, 0.006);

        // shrink the bush to show it's been checked
        (spot.bush as Phaser.GameObjects.Container).setAlpha(0.35);

        if (this.shotsLeft <= 0) {
            this.resolve(false);
        }
    }

    private drawFog(px: number, py: number) {
        if (!this.fogGraphics) return;
        const g = this.fogGraphics;
        g.clear();
        g.fillStyle(0x0b1026, 0.78);
        g.fillRect(0, 0, LEVEL_W, LEVEL_H);
        // punch a soft "visible" hole around the pointer using a radial mask look:
        // draw a series of shrinking circles to fake a gradient hole.
        const steps = 6;
        for (let i = steps; i >= 1; i--) {
            const r = (this.sightRadius / steps) * i;
            const alpha = 0.78 * (1 - i / steps);
            g.fillStyle(0x0b1026, alpha);
            g.fillCircle(px, py, r);
        }
        // true cutout for the innermost circle
        g.fillStyle(0x0b1026, 0);
    }

    private resolve(won: boolean) {
        if (this.resolved) return;
        this.resolved = true;
        this.fogGraphics?.setVisible(false);

        this.time.delayedCall(won ? 400 : 500, () => {
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