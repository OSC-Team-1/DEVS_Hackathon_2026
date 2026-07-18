import { planJourney } from "./journey"; // wherever that lives
import {
    getIntroMessage,
    getTransitionMessage,
    getLostMessageAndDetour,
} from "./ai";
import cities from "./output/cities.json";
import worldGrid from "./output/worldGrid.json";

async function main() {
    const journey = planJourney(
        cities["New Zealand"][0],
        cities["United States"][0],
        worldGrid,
    );

    const pathSet = new Set(journey.path.map((t) => `${t.row},${t.col}`));
    const minigameSet = new Set(
        journey.minigameTiles.map((t) => `${t.row},${t.col}`),
    );
    const startId = `${journey.startTile.row},${journey.startTile.col}`;
    const endId = `${journey.endTile.row},${journey.endTile.col}`;
    const biomeChar: Record<string, string> = {
        ocean: ".",
        desert: "/",
        jungle: "#",
        plains: "#",
        mountain: "^",
    };

    for (const row of journey.viewportTiles) {
        let line = "";
        for (const tile of row) {
            const id = `${tile.row},${tile.col}`;
            if (id === startId) line += "S";
            else if (id === endId) line += "E";
            else if (minigameSet.has(id)) line += "M";
            else if (pathSet.has(id)) line += "A";
            else line += biomeChar[tile.biome] ?? "?";
        }
        console.log(line);
    }

    const intro = await getIntroMessage(
        "United States",
        "New Zealand",
        journey.path,
    );
    console.log("\nIntro:", intro);

    if (journey.minigameTiles.length >= 2) {
        const transition = await getTransitionMessage(
            journey.minigameTiles[0].biome,
            journey.minigameTiles[1].biome,
        );
        console.log("Transition:", transition);
    }

    const lastTile = journey.minigameTiles[journey.minigameTiles.length - 1];
    const detour = await getLostMessageAndDetour(
        lastTile.biome,
        "the Tasman Sea",
    );
    console.log("Detour:", detour);
}

main();
