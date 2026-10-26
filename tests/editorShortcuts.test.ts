import assert from "node:assert/strict";
import { test } from "node:test";
import { editorShortcut, type EditorSection } from "../src/utils/editorShortcuts";
const key = (value: string, overrides = {}) => ({ key: value, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...overrides });

test("Ctrl+Enter saves even outside an active section", () => {
  assert.deepEqual(editorShortcut(key("Enter", { ctrlKey: true }), null), { action: "save" });
  assert.equal(editorShortcut(key("Enter"), "forms"), null);
});
test("Tab adds in the next section and leaves tags and Shift+Tab to native navigation", () => {
  assert.deepEqual(editorShortcut(key("Tab"), "forms"), { action: "add", section: "readings" });
  assert.deepEqual(editorShortcut(key("Tab"), "readings"), { action: "add", section: "senses" });
  assert.deepEqual(editorShortcut(key("Tab"), "senses"), { action: "add", section: "tags" });
  assert.equal(editorShortcut(key("Tab"), "tags"), null);
  assert.equal(editorShortcut(key("Tab"), null), null);
  assert.equal(editorShortcut(key("Tab", { shiftKey: true }), "readings"), null);
});
test("Shift+A adds within each repeatable section without intercepting plain a", () => {
  for (const section of ["forms", "readings", "senses"] as EditorSection[]) {
    assert.deepEqual(editorShortcut(key("A", { shiftKey: true }), section), { action: "add", section });
    assert.deepEqual(editorShortcut(key("a", { shiftKey: true }), section), { action: "add", section });
    assert.equal(editorShortcut(key("a"), section), null);
  }
  assert.equal(editorShortcut(key("A", { shiftKey: true }), "tags"), null);
});
test("composition, held keys, and other modifier combinations never trigger edits", () => {
  for (const modifiers of [{ isComposing: true }, { repeat: true }, { altKey: true }, { metaKey: true }]) {
    assert.equal(editorShortcut(key("Tab", modifiers), "forms"), null);
    assert.equal(editorShortcut(key("Enter", { ctrlKey: true, ...modifiers }), "forms"), null);
    assert.equal(editorShortcut(key("A", { shiftKey: true, ...modifiers }), "forms"), null);
  }
  assert.equal(editorShortcut(key("Tab", { ctrlKey: true }), "forms"), null);
});
