import OpenAI from "openai";

interface Tile {
    row: number;
    col: number;
    lon: number;
    lat: number;
    biome: string;
}
const client = new OpenAI({
    apiKey: "api key",
    dangerouslyAllowBrowser: true,
});

const FALLBACK_DETOURS: Record<string, string> = {
    ocean: "marinetraffic.com",
    desert: "nationalgeographic.com",
    jungle: "wwf.org",
    mountain: "alltrails.com",
    plains: "wikipedia.org",
};

export async function getIntroMessage(
    fromCity: string,
    toCity: string,
    path: Tile[],
): Promise<string> {
    const biomes = [...new Set(path.map((t) => t.biome))].join(", ");

    const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content:
                    "You narrate journeys in a game that turns instant web navigation into old-fashioned travel. Tone: whimsical, dry humor, absurdist. One short sentence only.",
            },
            {
                role: "user",
                content: `The player is about to travel from ${fromCity} to ${toCity}, crossing terrain including: ${biomes}. Write their departure message.`,
            },
        ],
        max_tokens: 60,
        temperature: 1.1,
    });

    return (
        response.choices[0].message.content ??
        `Setting off from ${fromCity} toward ${toCity}...`
    );
}

export async function getTransitionMessage(
    fromBiome: string,
    toBiome: string,
): Promise<string> {
    const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content:
                    "You narrate journeys in a whimsical travel game. One short sentence, dry humor.",
            },
            {
                role: "user",
                content: `The player just crossed a ${fromBiome} successfully and is now heading into ${toBiome}. Write a brief transition line.`,
            },
        ],
        max_tokens: 50,
        temperature: 1.1,
    });

    return (
        response.choices[0].message.content ?? `Onward, into the ${toBiome}...`
    );
}

interface DetourResult {
    message: string;
    detourDomain: string;
}

export async function getLostMessageAndDetour(
    biome: string,
    region: string,
): Promise<DetourResult> {
    const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
            {
                role: "system",
                content: `You narrate a whimsical travel game. The player just got lost. Respond ONLY with JSON matching: {"message": string, "detourDomain": string}. "message" is one short, funny sentence about getting lost. "detourDomain" must be a real, well-known, safe website domain (e.g. "wikipedia.org") thematically or geographically fitting for someone lost in this location — no explanation, just the bare domain, would prefer a lesser known nicher domain if possible but keep it safe. Also its better if your detour domain and message are related in some way`,
            },
            {
                role: "user",
                content: `Player got lost in a ${biome} near ${region}.`,
            },
        ],
        max_tokens: 100,
        temperature: 1.0,
    });

    const raw = response.choices[0].message.content;
    try {
        const parsed = JSON.parse(raw!);
        return {
            message: parsed.message ?? "You wandered off course...",
            detourDomain:
                parsed.detourDomain ??
                FALLBACK_DETOURS[biome] ??
                "wikipedia.org",
        };
    } catch {
        return {
            message: "You got hopelessly lost...",
            detourDomain: FALLBACK_DETOURS[biome] ?? "wikipedia.org",
        };
    }
}
