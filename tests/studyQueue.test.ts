import assert from "node:assert/strict";
import { test } from "node:test";
import { initialStudyOrder, moveStudyCard } from "../src/utils/studyQueue";
import type { WordEntry } from "../src/types";

const words = [
  { id: "older", createdAt: "2026-10-01T00:00:00.000Z" },
  { id: "newest", createdAt: "2026-10-03T00:00:00.000Z" },
  { id: "middle", createdAt: "2026-10-02T00:00:00.000Z" },
] as WordEntry[];

test("new study orders default to newest-created first and retain saved order", () => {
  assert.deepEqual(initialStudyOrder(words, []), ["newest", "middle", "older"]);
  assert.deepEqual(initialStudyOrder([...words, { ...words[0]!, id: "new" }], ["older", "missing", "middle", "newest"]),
    ["new", "older", "middle", "newest"]);
});

test("remembered cards move to the end and missed cards go behind three others", () => {
  assert.deepEqual(moveStudyCard(["a", "b", "c", "d", "e"], "a", true), ["b", "c", "d", "e", "a"]);
  assert.deepEqual(moveStudyCard(["a", "b", "c", "d", "e"], "a", false), ["b", "c", "d", "a", "e"]);
  assert.deepEqual(moveStudyCard(["a", "b"], "b", false), ["a", "b"]);
});
