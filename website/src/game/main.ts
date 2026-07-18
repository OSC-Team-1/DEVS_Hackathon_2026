import { Boot } from "./scenes/Boot";
import { MapScene } from "./scenes/MapScene";
import { MinigameScene } from "./scenes/MinigameScene";
import { OceanMinigame } from "./scenes/OceanMinigame";
import { MountainMinigame } from "./scenes/MountainMinigame";
import { PlainsMinigame } from "./scenes/PlainsMiniGame";
import { DesertMinigame } from "./scenes/DesertMinigame";
import { AUTO, Game, Types, Scale } from "phaser";

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Types.Core.GameConfig = {
    type: AUTO,
    width: 800,
    height: 500,
    parent: "game-container",
    backgroundColor: "#0d1233",
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
    },
    scene: [
        Boot,
        MapScene,
        MinigameScene,
        OceanMinigame,
        MountainMinigame,
        PlainsMinigame,
        DesertMinigame,
    ],
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
};

export default StartGame;
