import { useEffect, useRef, useState } from "react";
import { IRefPhaserGame, PhaserGame } from "./PhaserGame";
import { EventBus } from "./game/EventBus";
import { planJourney } from "./lib/journey";
import { getIntroMessage, getLostMessageAndDetour } from "./lib/ai";
import worldGrid from "./data/worldGrid.json";
import citiesJson from "./data/cities.json";
import tldConfig from "./data/tldCountries.json";
import type { WorldGrid, City, Journey } from "./types/world";

const cities = citiesJson as unknown as Record<string, City[]>;
import type { JourneyPayload } from "./game/scenes/Boot";

function getParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        fromDomain: params.get("origin") ?? "example.co.nz",
        toUrl: params.get("dest") ?? "https://example.com.au",
    };
}

const TLD_COUNTRY: Array<[string, string]> = tldConfig.tlds as Array<
    [string, string]
>;
const KNOWN_DOMAIN_OVERRIDES: Record<string, string> =
    tldConfig.knownDomainOverrides;
const DEFAULT_COUNTRY = tldConfig.defaultCountry;

function extractTld(hostname: string): { full: string; short: string } {
    const parts = hostname.split(".").filter(Boolean);
    const short = parts[parts.length - 1] ?? "";
    const full =
        parts.length >= 2 ? `${parts[parts.length - 2]}.${short}` : short;
    return { full, short };
}

function resolveCityForDomain(hostname: string): City {
    const clean = hostname.replace(/^www\./, "");

    if (KNOWN_DOMAIN_OVERRIDES[clean]) {
        const list = (cities as Record<string, City[]>)[
            KNOWN_DOMAIN_OVERRIDES[clean]
        ];
        if (list?.length) return list[Math.floor(Math.random() * list.length)];
    }

    const { full, short } = extractTld(clean);

    // Check the two-label suffix first (e.g. "co.nz"), then the single TLD
    const match =
        TLD_COUNTRY.find(([tld]) => tld === full) ??
        TLD_COUNTRY.find(([tld]) => tld === short);
    const countryName = match?.[1] ?? DEFAULT_COUNTRY; // generic .com/.org/.net etc fall back here

    const list =
        (cities as Record<string, City[]>)[countryName] ??
        (cities as Record<string, City[]>)[DEFAULT_COUNTRY];
    return list[Math.floor(Math.random() * list.length)];
}

type Phase = "loading" | "playing" | "lost" | "arrived";

/** Simple typewriter hook -- reveals text character by character for that
 * old-adventure-game narration feel. Resets whenever the source text changes. */
function useTypewriter(text: string, speedMs = 22) {
    const [shown, setShown] = useState("");
    const [done, setDone] = useState(false);

    useEffect(() => {
        setShown("");
        setDone(false);
        if (!text) return;

        let i = 0;
        const id = setInterval(() => {
            i++;
            setShown(text.slice(0, i));
            if (i >= text.length) {
                setDone(true);
                clearInterval(id);
            }
        }, speedMs);

        return () => clearInterval(id);
    }, [text, speedMs]);

    return { shown, done };
}

function App() {
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [phase, setPhase] = useState<Phase>("loading");
    const [message, setMessage] = useState<string>("");
    const [routeLabel, setRouteLabel] = useState<string>("");

    const journeyRef = useRef<Journey | null>(null);
    const toUrlRef = useRef<string>("");
    const fromCityRef = useRef<string>("");
    const toCityRef = useRef<string>("");

    const { shown: typedMessage, done: typingDone } = useTypewriter(message);

    // ---- One-time setup: compute journey, kick off Phaser ----
    useEffect(() => {
        const { fromDomain, toUrl } = getParams();
        const fromHostname = safeHostname(fromDomain); // handles both bare domains and full URLs
        const toDomain = safeHostname(toUrl);

        const fromCity = resolveCityForDomain(fromHostname);
        const toCity = resolveCityForDomain(toDomain);

        const journey = planJourney(fromCity, toCity, worldGrid as WorldGrid);

        journeyRef.current = journey;
        toUrlRef.current = toUrl;
        fromCityRef.current = fromCity.city;
        toCityRef.current = toCity.city;
        setRouteLabel(`${fromCity.city} \u2192 ${toCity.city}`);

        (async () => {
            const intro = await getIntroMessage(
                fromCity.city,
                toCity.city,
                journey.path,
            );
            setMessage(intro);
            setPhase("playing");

            const payload: JourneyPayload = {
                journey,
                fromCity: fromCity.city,
                toCity: toCity.city,
                destinationUrl: toUrl,
            };
            EventBus.emit("journey-ready", payload);
        })();
    }, []);

    // ---- Listen for minigame results and journey completion ----
    useEffect(() => {
        const handleResult = async (result: {
            won: boolean;
            biome: string;
            minigameIndex: number;
            journey: Journey;
            fromCity: string;
            toCity: string;
            destinationUrl: string;
        }) => {
            if (!result.won) {
                setPhase("lost");
                const { message: lostMsg, detourDomain } =
                    await getLostMessageAndDetour(result.biome, result.toCity);
                setMessage(lostMsg);
                setTimeout(() => {
                    window.location.href = `https://${detourDomain}`;
                }, 2500);
                return;
            }

            const nextIndex = result.minigameIndex + 1;
            const isLastMinigame =
                nextIndex >= result.journey.minigameTiles.length;

            const payloadBase: JourneyPayload = {
                journey: result.journey,
                fromCity: result.fromCity,
                toCity: result.toCity,
                destinationUrl: result.destinationUrl,
            };

            if (isLastMinigame) {
                EventBus.emit("start-scene", {
                    mode: "arrival",
                    ...payloadBase,
                    minigameIndex: nextIndex,
                });
            } else {
                EventBus.emit("start-scene", {
                    mode: "hop",
                    ...payloadBase,
                    minigameIndex: nextIndex,
                });
            }
        };

        const handleComplete = () => {
            setPhase("arrived");
            setTimeout(() => {
                window.location.href = toUrlRef.current;
            }, 1200);
        };

        EventBus.on("minigame-result", handleResult);
        EventBus.on("journey-complete", handleComplete);

        return () => {
            EventBus.off("minigame-result", handleResult);
            EventBus.off("journey-complete", handleComplete);
        };
    }, []);

    // 'start-scene' -> tell the currently active MapScene to restart with new data.
    // MapScene itself handles mode: 'intro' | 'hop' | 'arrival'.
    useEffect(() => {
        const handler = (data: any) => {
            if (phaserRef.current?.scene) {
                phaserRef.current.scene.scene.start("MapScene", data);
            }
        };
        EventBus.on("start-scene", handler);
        return () => {
            EventBus.off("start-scene", handler);
        };
    }, []);

    const handleForfeit = () => {
        window.location.href = toUrlRef.current || getParams().toUrl;
    };

    return (
        <div id="app">
            <div className="hud-top">
                {routeLabel && <p className="route-label">{routeLabel}</p>}
                {message && (
                    <p className={`flavor-text ${!typingDone ? "typing" : ""}`}>
                        {typedMessage}
                    </p>
                )}
                {phase === "lost" && (
                    <p className="status lost">You got lost! Redirecting...</p>
                )}
                {phase === "arrived" && (
                    <p className="status arrived">Arrived! Redirecting...</p>
                )}
            </div>

            <div className={`stage ${phase === "loading" ? "loading" : ""}`}>
                <PhaserGame ref={phaserRef} />
            </div>

            <div className="hud-bottom">
                <button className="button forfeit" onClick={handleForfeit}>
                    Forfeit &amp; skip to destination
                </button>
            </div>
        </div>
    );
}

function safeHostname(input: string): string {
    try {
        return new URL(input).hostname;
    } catch {
        // input was likely a bare domain with no protocol (e.g. "example.co.nz")
        try {
            return new URL(`https://${input}`).hostname;
        } catch {
            return input;
        }
    }
}

export default App;
