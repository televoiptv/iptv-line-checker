import test from "node:test";
import assert from "node:assert/strict";
import { parseLine } from "../src/parse.js";

const login = { server: "http://tv.example:8080", username: "user", password: "pass" };

test("reads an M3U link", () => {
  assert.deepEqual(parseLine("http://tv.example:8080/get.php?username=user&password=pass&type=m3u_plus"), login);
});

test("reads typed and bare stream links", () => {
  assert.deepEqual(parseLine("http://tv.example:8080/live/user/pass/123.ts"), login);
  assert.deepEqual(parseLine("http://tv.example:8080/user/pass/123"), login);
});

test("adds a missing scheme", () => {
  assert.deepEqual(parseLine("tv.example:8080/live/user/pass/123.ts"), login);
});

test("rejects links with no login", () => {
  assert.equal(parseLine("https://cdn.example/live/channel/hls/master.m3u8"), null);
  assert.equal(parseLine("ftp://tv.example/get.php?username=a&password=b"), null);
  assert.equal(parseLine(""), null);
});
