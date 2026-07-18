// -----------------------------------------------------------------------
// Real weather via Open-Meteo (https://open-meteo.com) -- free, no API key,
// CORS-friendly, works directly from the browser. Used to decide whether a
// minigame plays out as a "storm" (harder) or calm.
// -----------------------------------------------------------------------

export interface WeatherResult {
    isStorm: boolean;
    weatherCode: number;
    windSpeedKph: number;
    precipitationMm: number;
    description: string;
}

// WMO weather interpretation codes (the standard Open-Meteo uses).
// https://open-meteo.com/en/docs -- see "WMO Weather interpretation codes"
const WMO_DESCRIPTIONS: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
};

// Codes that represent genuinely rough weather -- thunderstorms, heavy
// rain/snow, dense fog. Used as one storm trigger alongside wind speed.
const STORM_WEATHER_CODES = new Set([45, 48, 65, 67, 75, 82, 86, 95, 96, 99]);

const STORM_WIND_THRESHOLD_KPH = 35;
const STORM_PRECIP_THRESHOLD_MM = 4;

const FETCH_TIMEOUT_MS = 3000;

/** Races a promise against a timeout so a slow/dead API never blocks the game. */
async function withTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
): Promise<T> {
    return Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
            setTimeout(
                () => reject(new Error("weather fetch timeout")),
                timeoutMs,
            ),
        ),
    ]);
}

async function _getWeatherForCoords(
    lat: number,
    lng: number,
): Promise<WeatherResult> {
    const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${lat}&longitude=${lng}` +
        `&current=weather_code,wind_speed_10m,precipitation`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Open-Meteo request failed: ${response.status}`);
    }

    const data = await response.json();
    const weatherCode: number = data?.current?.weather_code ?? 0;
    const windSpeedKph: number = data?.current?.wind_speed_10m ?? 0;
    const precipitationMm: number = data?.current?.precipitation ?? 0;

    const isStorm =
        STORM_WEATHER_CODES.has(weatherCode) ||
        windSpeedKph >= STORM_WIND_THRESHOLD_KPH ||
        precipitationMm >= STORM_PRECIP_THRESHOLD_MM;

    return {
        isStorm,
        weatherCode,
        windSpeedKph,
        precipitationMm,
        description: WMO_DESCRIPTIONS[weatherCode] ?? "Unknown conditions",
    };
}

/**
 * Fetches current weather for a lat/lng. Never throws -- on any failure
 * (network down, rate limited, timeout) it resolves to calm weather so a
 * flaky API can never break or stall the game.
 */
export async function getWeatherForCoords(
    lat: number,
    lng: number,
): Promise<WeatherResult> {
    try {
        return await withTimeout(
            () => _getWeatherForCoords(lat, lng),
            FETCH_TIMEOUT_MS,
        );
    } catch {
        return {
            isStorm: false,
            weatherCode: 0,
            windSpeedKph: 0,
            precipitationMm: 0,
            description: "Unavailable",
        };
    }
}
