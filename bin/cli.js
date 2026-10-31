#!/usr/bin/env node
import { parseArgs } from "node:util";
import { parseLine } from "../src/parse.js";
import { checkLine, probeStream } from "../src/check.js";

const USAGE = `Check your own IPTV line.

Usage:
  iptv-line-checker                    Paste your link when asked
  IPTV_LINE="<link>" iptv-line-checker Read the link from the environment

Options:
  --probe         Also test the first live stream (uses one connection briefly)
  --json          Print JSON
  --timeout <s>   Seconds to wait for each step (default 10)
  --help          Show this help

Exit codes: 0 active, 1 not active, 2 could not check.`;

const ADVICE = {
  active: "The line is active.",
  expired: "The line has expired. Renew it with your provider.",
  banned: "The provider has banned this line.",
  disabled: "The provider has disabled this line.",
  inactive: "The line is not active. Ask your provider why.",
  wrong_credentials: "The server rejected this username and password.",
};

const ERRORS = {
  timeout: "The server did not answer in time.",
  unreachable: "Could not connect to the server.",
  not_xtream: "The server did not answer like an Xtream Codes panel.",
  no_streams: "The line has no live streams to test.",
  empty_stream: "The stream connected but sent no data.",
  stream_failed: "The stream test failed.",
};

const explain = (code) => ERRORS[code] ?? `The server answered with ${code.replace("http_", "HTTP ")}.`;

async function promptForLink() {
  if (!process.stdin.isTTY) {
    let text = "";
    for await (const chunk of process.stdin) text += chunk;
    return text;
  }
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const answer = await rl.question("Paste your M3U or Xtream link: ");
  rl.close();
  return answer;
}

function fail(message, asJson) {
  console.error(asJson ? JSON.stringify({ ok: false, error: message }) : message);
  process.exit(2);
}

let args;
try {
  args = parseArgs({
    options: {
      probe: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      timeout: { type: "string", default: "10" },
      help: { type: "boolean", default: false },
    },
  }).values;
} catch {
  console.error(USAGE);
  process.exit(2);
}

if (args.help) {
  console.log(USAGE);
  process.exit(0);
}

const timeoutMs = Number(args.timeout) * 1000;
if (!(timeoutMs > 0)) fail("--timeout must be a positive number.", args.json);

const line = parseLine(process.env.IPTV_LINE || (await promptForLink()));
if (!line) fail("No login found in that link.", args.json);

const result = await checkLine(line, { timeoutMs });
if (!result.ok) fail(explain(result.error), args.json);

const report = { ...result, server: new URL(line.server).host };
if (args.probe && result.verdict === "active") report.stream = await probeStream(line, { timeoutMs });

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Server:      ${report.server}`);
  console.log(`Result:      ${ADVICE[result.verdict]}`);
  if (result.verdict !== "wrong_credentials") {
    console.log(`Expires:     ${result.expiresAt ?? "No expiry date"}`);
    console.log(`Trial:       ${result.isTrial ? "Yes" : "No"}`);
    console.log(`Connections: ${result.activeConnections ?? "?"} of ${result.maxConnections ?? "?"}`);
  }
  if (report.stream) console.log(`Stream:      ${report.stream.ok ? "Sending data" : explain(report.stream.error)}`);
}
process.exit(result.verdict === "active" ? 0 : 1);
