import OpenAI from "openai";
import type { Tile } from "../types/world";
import detourDomainsJson from "../data/detourDomains.json";

const client = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true,
});

const MODEL = "gpt-4o-mini";

const { _comment, ...DOMAIN_POOL } = detourDomainsJson as unknown as Record<
    string,
    string[]
>;
void _comment;

export function pickDetourDomain(biome: string): string {
    const pool = DOMAIN_POOL[biome] ?? DOMAIN_POOL.plains;
    return pool[Math.floor(Math.random() * pool.length)];
}

/** Races a promise against a timeout, returns fallback on either failure or timeout. */
async function safeGenerate<T>(
    fn: () => Promise<T>,
    fallback: T,
    timeoutMs = 3500,
): Promise<T> {
    try {
        return await Promise.race([
            fn(),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("timeout")), timeoutMs),
            ),
        ]);
    } catch {
        return fallback;
    }
}

async function _getIntroMessage(
    fromCity: string,
    toCity: string,
    path: Tile[],
): Promise<string> {
    const biomes = [...new Set(path.map((t) => t.biome))].join(", ");

    const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
            {
                role: "system",
                content:
                    "You narrate journeys in a game that turns instant web navigation into old-fashioned travel. Tone: whimsical, dry humor, absurdist. Respond with exactly one complete sentence, no more than 30 words.",
            },
            {
                role: "user",
                content: `The player is about to travel from ${fromCity} to ${toCity}, crossing terrain including: ${biomes}. Write their departure message.`,
            },
        ],
        max_tokens: 120,
        temperature: 1.1,
    });

    return (
        response.choices[0].message.content?.trim() ??
        `Setting off from ${fromCity} toward ${toCity}...`
    );
}

export function getIntroMessage(
    fromCity: string,
    toCity: string,
    path: Tile[],
): Promise<string> {
    return safeGenerate(
        () => _getIntroMessage(fromCity, toCity, path),
        `Setting off from ${fromCity} toward ${toCity}...`,
    );
}

async function _getTransitionMessage(
    fromBiome: string,
    toBiome: string,
): Promise<string> {
    const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
            {
                role: "system",
                content:
                    "You narrate journeys in a whimsical travel game. Respond with exactly one complete sentence, no more than 25 words, dry humor.",
            },
            {
                role: "user",
                content: `The player just crossed a ${fromBiome} successfully and is now heading into ${toBiome}. Write a brief transition line.`,
            },
        ],
        max_tokens: 100,
        temperature: 1.1,
    });

    return (
        response.choices[0].message.content?.trim() ??
        `Onward, into the ${toBiome}...`
    );
}

export function getTransitionMessage(
    fromBiome: string,
    toBiome: string,
): Promise<string> {
    return safeGenerate(
        () => _getTransitionMessage(fromBiome, toBiome),
        `Onward, into the ${toBiome}...`,
    );
}

export interface DetourResult {
    message: string;
    detourDomain: string;
}

async function _getLostMessage(
    biome: string,
    region: string,
    detourDomain: string,
): Promise<string> {
    const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
            {
                role: "system",
                content:
                    "You narrate a whimsical travel game. The player just got lost. Respond with exactly one complete sentence, no more than 25 words. Plain text only, no quotes.",
            },
            {
                role: "user",
                content: `Player got lost in a ${biome} near ${region}, and ended up stumbling toward ${detourDomain}. Write their lost message.`,
            },
        ],
        max_tokens: 100,
        temperature: 1.1,
    });

    return (
        response.choices[0].message.content?.trim() ??
        "You wandered off course..."
    );
}

export async function getLostMessageAndDetour(
    biome: string,
    region: string,
): Promise<DetourResult> {
    const detourDomain = pickDetourDomain(biome);

    const message = await safeGenerate(
        () => _getLostMessage(biome, region, detourDomain),
        "You got hopelessly lost along the way...",
    );

    return { message, detourDomain };
}
