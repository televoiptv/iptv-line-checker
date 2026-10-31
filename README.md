# iptv-line-checker

Check your own IPTV line from the terminal. It tells you whether the problem is your account or something else, so you know what to fix before you start reinstalling apps.

## What it does

Paste one M3U or Xtream Codes link and it shows:

- Whether the line is active, expired, banned or disabled
- The expiry date and trial status
- Connections in use and the connection limit
- Whether the first live stream sends data, with `--probe`

It has no dependencies and needs Node.js 20 or later.

## Usage

```sh
git clone https://github.com/televoiptv/iptv-line-checker.git
cd iptv-line-checker
node bin/cli.js
```

The tool asks for your link, so your password stays out of your shell history. Example output:

```text
Server:      tv.example:8080
Result:      The line is active.
Expires:     2027-03-01T00:00:00.000Z
Trial:       No
Connections: 1 of 2
Stream:      Sending data
```

| Option | Meaning |
| --- | --- |
| `--probe` | Also test the first live stream. This uses one connection briefly. |
| `--json` | Print JSON for scripts. |
| `--timeout <s>` | Seconds to wait for each step. The default is 10. |

Exit codes: `0` active, `1` not active, `2` could not check.

## Use as a library

```js
import { parseLine, checkLine } from "./src/index.js";

const line = parseLine("http://tv.example:8080/get.php?username=me&password=secret");
console.log(await checkLine(line));
```

## Privacy

The link goes only to the server inside it. Nothing is stored or sent anywhere else, and the password is never printed.

## Known limits

- The account check only works with Xtream Codes compatible panels. A plain playlist URL with no login can't be checked.
- `--probe` tests one channel, so it can't prove that every channel works.
- Many panels only offer plain HTTP, so your login can travel unencrypted, as it does in your IPTV app.

## Responsible use

Only check lines that you own. The tool takes one line at a time, and bulk checking will not be added. It does not include or list any streams.

## Contributing

Bug reports with the panel type and the `--json` output are welcome. Remove your server address first. Run tests with `npm test`.

## Licence

MIT
