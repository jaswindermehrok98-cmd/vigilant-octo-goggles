const GEO = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER = "https://api.open-meteo.com/v1/forecast";

function signalWithTimeout(parent, ms) {
  const local = AbortSignal.timeout(ms);
  return parent ? AbortSignal.any([parent, local]) : local;
}

export async function lookupEnvironment(location, parentSignal) {
  const query = String(location || "").trim().slice(0, 100);
  if (!query) throw new Error("A city or location is required.");

  const geoResponse = await fetch(GEO + "?name=" + encodeURIComponent(query) + "&count=1&language=en&format=json", {
    signal: signalWithTimeout(parentSignal, 8000)
  });
  if (!geoResponse.ok) throw new Error("Environment lookup failed.");
  const geo = await geoResponse.json();
  const place = geo?.results?.[0];
  if (!place) return { ok: false, error: "Location not found." };

  const weatherUrl = WEATHER +
    "?latitude=" + encodeURIComponent(place.latitude) +
    "&longitude=" + encodeURIComponent(place.longitude) +
    "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto";
  const weatherResponse = await fetch(weatherUrl, { signal: signalWithTimeout(parentSignal, 8000) });
  if (!weatherResponse.ok) throw new Error("Environment forecast failed.");
  const weather = await weatherResponse.json();

  return {
    ok: true,
    location: { name: place.name, country: place.country, latitude: place.latitude, longitude: place.longitude },
    current: {
      temperature: weather?.current?.temperature_2m ?? null,
      humidity: weather?.current?.relative_humidity_2m ?? null,
      windSpeed: weather?.current?.wind_speed_10m ?? null,
      weatherCode: weather?.current?.weather_code ?? null,
      units: weather?.current_units ?? {}
    }
  };
}
