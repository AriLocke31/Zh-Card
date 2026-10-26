import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import Article from "../src/components/Article";
import ArticlesMenu from "../src/components/ArticlesMenu";
import { articles } from "../src/data/articles";

const menu = (url: string) => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [url] }, createElement(ArticlesMenu)));

test("article menu paginates local snippets and links to article routes", () => {
  const first = menu("/articles");
  for (const article of articles.slice(0, 3)) assert.ok(first.includes(`/articles/${article.id}`));
  assert.ok(!first.includes(`/articles/${articles[3]!.id}`));
  const second = menu("/articles?page=2");
  assert.ok(second.includes(`/articles/${articles[3]!.id}`));
  assert.ok(!second.includes(`/articles/${articles[0]!.id}`));
  assert.ok(menu("/articles?page=bad").includes(`/articles/${articles[0]!.id}`));
  assert.ok(menu("/articles?page=999").includes(`/articles/${articles[3]!.id}`));
});

test("Article renders all supplied sections as keyboard-accessible scroll regions", () => {
  const article = articles[0]!;
  const html = renderToStaticMarkup(createElement(Article, { article }));
  assert.equal((html.match(/role="region"/g) ?? []).length, article.sections.length);
  assert.equal((html.match(/tabindex="0"/g) ?? []).length, article.sections.length);
  assert.ok(html.includes("overflow-y:auto"));
  for (const section of article.sections) assert.ok(html.includes(section.title));
  const empty = renderToStaticMarkup(createElement(Article, { article: { ...article, sections: [] } }));
  assert.ok(empty.includes(article.title));
  assert.ok(!empty.includes('role="region"'));
});
