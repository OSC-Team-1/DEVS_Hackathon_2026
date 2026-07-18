import { Scene } from "phaser";
import { EventBus } from "../EventBus";
import type { Journey } from "../../types/world";

export interface JourneyPayload {
    journey: Journey;
    fromCity: string;
    toCity: string;
    destinationUrl: string;
}

export class Boot extends Scene {
    constructor() {
        super("Boot");
    }

    preload() {
        this.load.setPath("assets");

        this.load.on("loaderror", (file: { key: string }) => {
            console.warn(
                `[Boot] asset missing, using fallback shape: ${file.key}`,
            );
        });

        this.load.image("bg-ocean", "bg-ocean.png");
        this.load.image("bg-desert", "bg-desert.png");
        this.load.image("bg-jungle", "bg-jungle.png");
        this.load.image("bg-mountain", "bg-mountain.png");
        this.load.image("bg-plains", "bg-plains.png");

        this.load.image("vehicle-camel", "vehicle-camel.png");
        this.load.image("vehicle-boat", "vehicle-boat.png");
        this.load.image("vehicle-train", "vehicle-train.png");
        this.load.image("vehicle-vine", "vehicle-vine.png");

        this.load.image("obstacle-rock", "obstacle-rock.png");
        this.load.image("obstacle-iceberg", "obstacle-iceberg.png");

        this.load.image("vehicle-deer", "vehicle-deer.png");

        this.load.image("obstacle-cactus", "obstacle-cactus.png");
        this.load.image("obstacle-dunerock", "obstacle-dunerock.png");

        this.load.image("marker-pin", "marker-pin.png");
    }

    create() {
        EventBus.once("journey-ready", (payload: JourneyPayload) => {
            this.scene.start("MapScene", {
                mode: "intro",
                ...payload,
                minigameIndex: 0,
            });
        });

        EventBus.emit("current-scene-ready", this);
    }
}
