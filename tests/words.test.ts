import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import WordThumb from "../src/components/WordThumb";
import { mockWord } from "../src/data/mockWords";

const render = (word: typeof mockWord) => renderToStaticMarkup(createElement(MemoryRouter, null,
  createElement(WordThumb, { word })));

test("WordThumb links to the encoded word ID and shows only the preferred Hanzi", () => {
  const word = structuredClone(mockWord);
  word.id = "word/with spaces";
  const html = render(word);
  assert.match(html, /href="\/words\/word%2Fwith%20spaces"/);
  assert.ok(html.includes(word.forms.find(form => form.isPreferred)!.text));
  for (const form of word.forms.filter(form => !form.isPreferred)) assert.ok(!html.includes(form.text));
  assert.ok(!html.includes(word.senses[0]!.definition));
  assert.ok(!html.includes(word.readings[0]!.romanization));
});

test("WordThumb falls back to the first form when no form is preferred", () => {
  const word = structuredClone(mockWord);
  word.forms.forEach(form => { form.isPreferred = false; });
  assert.ok(render(word).includes(word.forms[0]!.text));
  word.forms = [];
  assert.match(render(word), />-<\/span>/);
});
