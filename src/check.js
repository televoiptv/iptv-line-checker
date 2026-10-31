const number = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const toIso = (value) => {
  const n = number(value);
  return n && n > 0 ? new Date(n * 1000).toISOString() : null;
};

/** Turns a panel's user_info object into one verdict. */
export function verdictFor(info, expiresAt, now = Date.now()) {
  if (Number(info.auth) !== 1) return "wrong_credentials";
  const status = String(info.status ?? "").toLowerCase();
  if (status === "banned" || status === "disabled") return status;
  if (status === "expired" || (expiresAt && new Date(expiresAt).getTime() < now)) return "expired";
  return status && status !== "active" ? "inactive" : "active";
}

async function readText(response, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("response_too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function apiUrl(line, action) {
  const url = new URL("/player_api.php", line.server);
  url.searchParams.set("username", line.username);
  url.searchParams.set("password", line.password);
  if (action) url.searchParams.set("action", action);
  return url;
}

/** Asks the panel for the account's status. Errors never contain the login. */
export async function checkLine(line, { timeoutMs = 10000 } = {}) {
  let response;
  try {
    response = await fetch(apiUrl(line), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return { ok: false, error: error.name === "TimeoutError" ? "timeout" : "unreachable" };
  }
  if (response.status === 401 || response.status === 403) return { ok: true, verdict: "wrong_credentials" };
  if (!response.ok) return { ok: false, error: `http_${response.status}` };

  let body;
  try {
    body = JSON.parse(await readText(response, 1_000_000));
  } catch {
    return { ok: false, error: "not_xtream" };
  }
  if (!body?.user_info) return { ok: false, error: "not_xtream" };

  const info = body.user_info;
  const expiresAt = toIso(info.exp_date);
  return {
    ok: true,
    verdict: verdictFor(info, expiresAt),
    expiresAt,
    isTrial: number(info.is_trial) === 1,
    maxConnections: number(info.max_connections),
    activeConnections: number(info.active_cons),
  };
}

/** Requests the first live stream and reads its first bytes. This uses one connection briefly. */
export async function probeStream(line, { timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const list = await fetch(apiUrl(line, "get_live_streams"), { signal: controller.signal });
    if (!list.ok) return { ok: false, error: `http_${list.status}` };
    const streams = JSON.parse(await readText(list, 50_000_000));
    const id = Array.isArray(streams) ? streams[0]?.stream_id : null;
    if (id === undefined || id === null) return { ok: false, error: "no_streams" };

    const path = ["live", line.username, line.password, `${id}.ts`].map(encodeURIComponent).join("/");
    const stream = await fetch(new URL(`/${path}`, line.server), { signal: controller.signal });
    if (!stream.ok) return { ok: false, error: `http_${stream.status}` };
    const { value } = await stream.body.getReader().read();
    return value?.length ? { ok: true } : { ok: false, error: "empty_stream" };
  } catch (error) {
    return { ok: false, error: error.name === "AbortError" ? "timeout" : "stream_failed" };
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
