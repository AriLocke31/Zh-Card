import assert from "node:assert/strict";
import { test } from "node:test";
import { findExistingWord, normalizeWrittenForm } from "../src/utils/writtenForm";
import { mockWord } from "../src/data/mockWords";

test("lookup normalizes and deduplicates forms, returning the full stored entry", async () => {
  const calls: string[] = [];
  const match = await findExistingWord([" ", " cafe\u0301 ", "caf\u00e9", "match"], async text => {
    calls.push(text); return text === "match" ? mockWord : null;
  });
  assert.deepEqual(calls, ["caf\u00e9", "match"]); assert.equal(match, mockWord);
  assert.notEqual(normalizeWrittenForm("a b"), normalizeWrittenForm("ab"));
});
test("outdated/composing lookup results cannot replace the draft", async () => {
  let current = true;
  let resolve!: (value: typeof mockWord) => void;
  const pending = findExistingWord(["old", "next"], () => new Promise(done => { resolve = done; }), () => current);
  current = false; resolve(mockWord);
  assert.equal(await pending, null);
  let calls = 0;
  assert.equal(await findExistingWord(["new"], async () => { calls++; return mockWord; }, () => false), null);
  assert.equal(calls, 0);
});
