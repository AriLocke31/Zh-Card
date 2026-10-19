import assert from "node:assert/strict";
import { test } from "node:test";
import { createHandler } from "../src/backend/src/handler";
import { createRequire } from "node:module";
const { GetCommand, PutCommand, ScanCommand, DeleteCommand } = createRequire(new URL("../src/backend/package.json", import.meta.url))("@aws-sdk/lib-dynamodb");
import { ApiWordRepository, ApiError } from "../src/repositories/ApiWordRepository";
import { mockWord } from "../src/data/mockWords";
import { isWordEntry, isStoredWordEntry } from "../src/validation/word";
import { parsePinyin, isValidNumberedPinyin, getToneOptions } from "../src/utils/pinyin";
import { convertHanzi } from "../src/utils/hanziConversion";

function database() {
  const items = new Map<string, any>();
  const commands: any[] = [];
  const send = async (command: any) => {
    commands.push(command);
    const input = command.input;
    if (command instanceof GetCommand) return { Item: structuredClone(items.get(input.Key.id)) };
    if (command instanceof ScanCommand) {
      const values = [...items.values()];
      const offset = input.ExclusiveStartKey ? values.findIndex(item => item.id === input.ExclusiveStartKey.id) + 1 : 0;
      const page = values.slice(offset, offset + input.Limit);
      return { Items: structuredClone(page), ...(offset + page.length < values.length ? { LastEvaluatedKey: { id: page.at(-1).id } } : {}) };
    }
    const id = command instanceof PutCommand ? input.Item.id : input.Key.id;
    const existing = items.get(id);
    const expected = input.ExpressionAttributeValues?.[":expected"];
    assert.equal(input.ConditionExpression, expected
      ? "attribute_exists(id) AND updatedAt = :expected"
      : "attribute_not_exists(id)");
    if (expected ? !existing || existing.updatedAt !== expected : existing) {
      const error = new Error("Conditional failure"); error.name = "ConditionalCheckFailedException"; throw error;
    }
    if (command instanceof PutCommand) items.set(id, structuredClone(input.Item));
    if (command instanceof DeleteCommand) items.delete(id);
    return {};
  };
  return { items, commands, send };
}
const event = (routeKey: string, extra: any = {}) => ({
  routeKey, requestContext: { authorizer: { jwt: { claims: { sub: "owner", token_use: "access" } } } }, headers: {}, ...extra,
}) as any;
const fixture = () => structuredClone(mockWord);

test("existing words without definitions can be listed and opened, but not saved incomplete", async () => {
  const word = { ...fixture(), senses: [], readings: [], components: [], tags: [] };
  assert.equal(isStoredWordEntry(word), true);
  assert.equal(isWordEntry(word), false);
  const repository = new ApiWordRepository("https://example.test", async () => "access-token", async input =>
    Response.json(new URL(String(input)).pathname === "/words" ? { items: [word] } : word));
  assert.deepEqual((await repository.list()).items, [word]);
  assert.deepEqual(await repository.getById(word.id), word);
  const db = database();
  const handler = createHandler(db.send, { tableName: "words", ownerSub: "owner" });
  assert.equal((await handler(event("POST /words", { body: JSON.stringify(word) }))).statusCode, 400);
  assert.equal(db.commands.length, 0);
  assert.equal(isStoredWordEntry({ ...word, forms: [{}] }), false);
});

test("default transport calls browser fetch with the global receiver", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async function (this: unknown, input) {
    assert.equal(this, globalThis);
    assert.equal(String(input), "https://example.test/words?limit=25");
    return Response.json({ items: [] });
  };
  try {
    const repository = new ApiWordRepository("https://example.test", async () => "access-token");
    assert.deepEqual(await repository.list(), { items: [] });
  } finally {
    globalThis.fetch = original;
  }
});

test("repository and handler persist create/read/update/delete across repository instances", async () => {
  const db = database();
  const handler = createHandler(db.send, { tableName: "words", ownerSub: "owner" });
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const id = url.pathname.split("/")[2];
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    assert.equal(headers.authorization, "Bearer access-token");
    const route = `${init?.method ?? "GET"} ${id ? "/words/{id}" : "/words"}`;
    const response = await handler(event(route, { pathParameters: id ? { id: decodeURIComponent(id) } : {},
      queryStringParameters: Object.fromEntries(url.searchParams), headers, body: init?.body }));
    return new Response(response.body ?? null, { status: response.statusCode!, headers: response.headers as any });
  };
  const repository = () => new ApiWordRepository("https://example.test", async () => "access-token", transport);
  const original = fixture();
  const created = await repository().create(original);
  assert.notEqual(created.id, original.id);
  assert.equal(created.readings[0]?.romanization, "dian4 nao3");
  assert.deepEqual(await repository().getById(created.id), created);
  assert.deepEqual((await repository().list()).items, [created]);
  const draft = structuredClone(created); draft.senses[0]!.definition = "Updated definition";
  const saved = await repository().update(draft);
  assert.equal(saved.createdAt, created.createdAt);
  assert.notEqual(saved.updatedAt, created.updatedAt);
  assert.equal((await repository().getById(saved.id))?.senses[0]?.definition, "Updated definition");
  await assert.rejects(repository().update(created), (error: any) => error instanceof ApiError && error.status === 409);
  await assert.rejects(repository().delete(created.id, created.updatedAt), (error: any) => error.status === 409);
  assert.ok(await repository().getById(saved.id));
  const competing = await Promise.allSettled([repository().update(saved), repository().update(saved)]);
  assert.equal(competing.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(competing.filter(result => result.status === "rejected" && result.reason.status === 409).length, 1);
  const latest = (await repository().getById(saved.id))!;
  await repository().delete(latest.id, latest.updatedAt);
  assert.equal(await repository().getById(saved.id), null);
  assert.equal((await repository().list()).items.length, 0);
});

test("pagination has no missing entries; invalid requests never write", async () => {
  const db = database();
  const handler = createHandler(db.send, { tableName: "words", ownerSub: "owner" });
  for (let i = 0; i < 3; i++) assert.equal((await handler(event("POST /words", { body: JSON.stringify(fixture()) }))).statusCode, 201);
  const first = JSON.parse((await handler(event("GET /words", { queryStringParameters: { limit: "2" } }))).body!);
  const second = JSON.parse((await handler(event("GET /words", { queryStringParameters: { limit: "2", cursor: first.nextCursor } }))).body!);
  assert.equal(new Set([...first.items, ...second.items].map(item => item.id)).size, 3);
  assert.equal(second.nextCursor, undefined);
  for (const query of [{ limit: "0" }, { cursor: "bad" }, { limit: "101" }]) {
    assert.equal((await handler(event("GET /words", { queryStringParameters: query }))).statusCode, 400);
  }
  const before = db.commands.length;
  const invalid = fixture(); invalid.readings[0]!.senseIds = ["missing"];
  assert.equal((await handler(event("POST /words", { body: JSON.stringify(invalid) }))).statusCode, 400);
  assert.equal((await handler(event("POST /words", { body: "{" }))).statusCode, 400);
  assert.equal(db.commands.length, before);
  assert.equal((await handler(event("PUT /words/{id}", { pathParameters: { id: "missing" }, body: JSON.stringify({ ...fixture(), id: "missing" }) }))).statusCode, 404);
  assert.equal((await handler(event("DELETE /words/{id}", { pathParameters: { id: "missing" } }))).statusCode, 400);
});

test("nested schema rejects malformed records and inconsistent links", () => {
  assert.equal(isWordEntry(fixture()), true);
  for (const mutate of [
    (word: any) => word.forms.push({ ...word.forms[0] }),
    (word: any) => word.senses[0].readingIds = [],
    (word: any) => word.senses[0].tags[0].category = "invalid",
    (word: any) => word.components[0].position = -1,
    (word: any) => word.readings[0].system = "jyutping",
    (word: any) => word.senses[0].createdAt = "bad",
    (word: any) => word.forms.forEach((form: any) => form.isPreferred = false),
  ]) { const word = fixture(); mutate(word); assert.equal(isWordEntry(word), false); }
});

test("Pinyin round trips phrases, accents and neutral tones; Hanzi converts both directions", () => {
  const parsed = parsePinyin("diàn nǎo ma5")!;
  assert.equal(parsed.canonical, "dian4 nao3 ma5");
  assert.equal(isValidNumberedPinyin(parsed.canonical), true);
  assert.deepEqual(parsePinyin(parsed.canonical), parsed);
  assert.equal(parsePinyin("ma"), null);
  assert.equal(parsePinyin("not-a-syllable1"), null);
  assert.equal(parsePinyin("lv4")?.canonical, "lü4");
  assert.equal(getToneOptions("ma")[3]?.display, "mà");
  assert.equal(convertHanzi("电脑", "simplified"), "電腦");
  assert.equal(convertHanzi("電腦", "traditional"), "电脑");
});

test("repository rejects malformed success responses and preserves API errors", async () => {
  const invalid = new ApiWordRepository("https://example.test", async () => "access-token", async () => Response.json({ items: [{}] }));
  await assert.rejects(invalid.list(), /invalid word list/);
  const forbidden = new ApiWordRepository("https://example.test", async () => "access-token", async () => Response.json({ message: "Forbidden" }, { status: 403 }));
  await assert.rejects(forbidden.list(), (error: any) => error.status === 403 && error.message === "Forbidden");
});

test("all routes reject missing JWT claims, ID tokens, and other owners before accessing DynamoDB", async () => {
  const db = database();
  const handler = createHandler(db.send, { tableName: "words", ownerSub: "owner" });
  for (const route of ["GET /words", "GET /words/{id}", "POST /words", "PUT /words/{id}", "DELETE /words/{id}"]) {
    assert.equal((await handler(event(route, { requestContext: {} }))).statusCode, 401);
    assert.equal((await handler(event(route, { requestContext: { authorizer: { jwt: { claims: { sub: "owner", token_use: "id" } } } } }))).statusCode, 401);
    assert.equal((await handler(event(route, { requestContext: { authorizer: { jwt: { claims: { sub: "another-user", token_use: "access" } } } } }))).statusCode, 403);
  }
  assert.equal(db.commands.length, 0);
  assert.equal((await handler(event("GET /words"))).statusCode, 200);
  const unconfigured = createHandler(db.send, { tableName: "words", ownerSub: "" });
  assert.equal((await unconfigured(event("GET /words"))).statusCode, 503);
});

test("a missing session never sends an API request", async () => {
  let called = false;
  const repository = new ApiWordRepository("https://example.test", async () => { throw new Error("Sign in first"); },
    async () => { called = true; return Response.json({ items: [] }); });
  await assert.rejects(repository.list(), /Sign in first/);
  assert.equal(called, false);
});
