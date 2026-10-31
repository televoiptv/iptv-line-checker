const TYPED = new Set(["live", "movie", "series"]);
const STREAM_ID = /^\d+(\.[a-z0-9]{1,5})?$/i;
const BARE_STREAM_ID = /^\d+(\.ts)?$/i;

function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Reads { server, username, password } from an M3U, player_api or stream link, or returns null. */
export function parseLine(raw) {
  const text = String(raw ?? "").trim();
  let url;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const username = url.searchParams.get("username")?.trim();
  const password = url.searchParams.get("password")?.trim();
  if (username && password) return { server: url.origin, username, password };

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 4 && TYPED.has(parts[0].toLowerCase()) && STREAM_ID.test(parts[3])) {
    return { server: url.origin, username: decode(parts[1]), password: decode(parts[2]) };
  }
  if (parts.length === 3 && BARE_STREAM_ID.test(parts[2])) {
    return { server: url.origin, username: decode(parts[0]), password: decode(parts[1]) };
  }
  return null;
}
