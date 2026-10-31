import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { checkLine, probeStream, verdictFor } from "../src/check.js";

let server;
let base;
let userInfo;

before(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://local");
    if (url.searchParams.get("action") === "get_live_streams") return res.end('[{"stream_id":7}]');
    if (url.pathname === "/player_api.php") return res.end(userInfo);
    if (url.pathname === "/live/user/pass/7.ts") return res.end("data");
    res.statusCode = 404;
    res.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const line = () => ({ server: base, username: "user", password: "pass" });

test("verdicts", () => {
  const future = "2999-01-01T00:00:00.000Z";
  assert.equal(verdictFor({ auth: 1, status: "Active" }, future), "active");
  assert.equal(verdictFor({ auth: 1, status: "Active" }, "2000-01-01T00:00:00.000Z"), "expired");
  assert.equal(verdictFor({ auth: 1, status: "Banned" }, null), "banned");
  assert.equal(verdictFor({ auth: 0 }, null), "wrong_credentials");
});

test("reports an active line", async () => {
  userInfo = JSON.stringify({ user_info: { auth: 1, status: "Active", exp_date: "32503680000", max_connections: "2", active_cons: "1", is_trial: "0" } });
  assert.deepEqual(await checkLine(line()), {
    ok: true,
    verdict: "active",
    expiresAt: "3000-01-01T00:00:00.000Z",
    isTrial: false,
    maxConnections: 2,
    activeConnections: 1,
  });
});

test("flags a server that is not a panel", async () => {
  userInfo = "<html></html>";
  assert.deepEqual(await checkLine(line()), { ok: false, error: "not_xtream" });
});

test("flags an unreachable server without exposing the login", async () => {
  const result = await checkLine({ server: "http://127.0.0.1:1", username: "user", password: "secret" });
  assert.deepEqual(result, { ok: false, error: "unreachable" });
});

test("probes the first live stream", async () => {
  assert.deepEqual(await probeStream(line()), { ok: true });
});
