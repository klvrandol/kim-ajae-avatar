import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createMouthTracker } from "../public/audio.js";
const root = new URL("../", import.meta.url);
const digest = (data) => createHash("sha256").update(data).digest("hex");
test("approved PNG stays byte identical, RGBA, and is copied unchanged into Pages", async () => {
  const source = await readFile(
    new URL("2b00a0d8-191f-4885-9bb0-b69c95f599fe.png", root),
  );
  assert.equal(source.readUInt32BE(16), 1086);
  assert.equal(source.readUInt32BE(20), 1448);
  assert.equal(source[25], 6, "RGBA expected");
  for (const path of [
    "public/assets/kim-ajae-original.png",
    "docs/assets/kim-ajae-original.png",
  ])
    assert.equal(digest(await readFile(new URL(path, root))), digest(source));
  for (const file of await readdir(new URL("public/assets/", root)))
    assert.equal(
      digest(await readFile(new URL("public/assets/" + file, root))),
      digest(await readFile(new URL("docs/assets/" + file, root))),
      file + " needs build:pages",
    );
});
test("mouth tracker resists threshold chatter and closes after sustained quiet", () => {
  const track = createMouthTracker();
  const sample = (level, now) =>
    track({ level, mouth: level > 0.48 ? 2 : level > 0.09 ? 1 : 0 }, now).mouth;
  assert.equal(sample(0.3, 0), 0);
  assert.equal(sample(0.3, 60), 1);
  assert.equal(sample(0.08, 70), 1);
  assert.equal(sample(0.12, 140), 1);
  assert.equal(sample(0.8, 220), 1);
  assert.equal(sample(0.8, 280), 2);
  assert.equal(sample(0, 300), 2);
  assert.equal(sample(0, 420), 0);
  assert.equal(sample(0, 421), 0);
  assert.equal(sample(0, 540), 0);
});
