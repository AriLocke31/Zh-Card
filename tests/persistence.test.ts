import assert from "node:assert/strict";
import { test } from "node:test";
import { createHandler } from "../src/backend/src/handler";
import { createRequire } from "node:module";
const { GetCommand, PutCommand, ScanCommand, DeleteCommand, TransactWriteCommand } = createRequire(new URL("../src/backend/package.json", import.meta.url))("@aws-sdk/lib-dynamodb");
import { ApiWordRepository, ApiError } from "../src/repositories/ApiWordRepository";
import { mockWord } from "../src/data/mockWords";
import { isWordEntry, isStoredWordEntry } from "../src/validation/word";
import { parsePinyin, isValidNumberedPinyin, getToneOptions } from "../src/utils/pinyin";
import { convertHanzi } from "../src/utils/hanziConversion";

function database() {
  const items = new Map<string, any>();
  const commands: any[] = [];
  const metadata = new Map<string, any>([["owner:SUMMARY", { userId: "owner", key: "SUMMARY", schemaVersion: 1, formIndexVersion: 1,
    wordCount: 0, wordsCreatedTotal: 0, initializedAt: "2026-10-26T00:00:00.000Z", updatedAt: "2026-10-26T00:00:00.000Z" }]]);
  const faults = { cancelNextTransaction: false };
  const canceled = () => Object.assign(new Error("Canceled"), { name: "TransactionCanceledException", CancellationReasons: [{ Code: "ConditionalCheckFailed" }] });
  const send = async (command: any) => {
    commands.push(command);
    const input = command.input;
    if (command instanceof GetCommand) return { Item: structuredClone(input.TableName === "metadata"
      ? metadata.get(`${input.Key.userId}:${input.Key.key}`) : items.get(input.Key.id)) };
    if (command instanceof TransactWriteCommand) {
      const stagedWords = new Map(items);
      const stagedMetadata = new Map([...metadata].map(([key, value]) => [key, structuredClone(value)]));
      for (const operation of input.TransactItems) {
        if (operation.Put) {
          const put = operation.Put;
          const target = put.TableName === "metadata" ? stagedMetadata : stagedWords;
          const key = put.TableName === "metadata" ? `${put.Item.userId}:${put.Item.key}` : put.Item.id;
          if (put.TableName === "metadata" && put.Item.key.startsWith("FORM#")) {
            assert.equal(put.ConditionExpression, "attribute_not_exists(userId) OR wordId = :wordId");
            if (target.has(key) && target.get(key).wordId !== put.ExpressionAttributeValues[":wordId"]) throw canceled();
          } else if (put.ConditionExpression.includes("updatedAt")) {
            if (target.get(key)?.updatedAt !== put.ExpressionAttributeValues[":expected"]) throw canceled();
          } else if (target.has(key)) throw canceled();
          target.set(key, structuredClone(put.Item));
        } else if (operation.Update) {
          const update = operation.Update;
          const key = `${update.Key.userId}:${update.Key.key}`;
          const summary = stagedMetadata.get(key);
          assert.equal(update.ConditionExpression, "attribute_exists(userId) AND schemaVersion = :version AND formIndexVersion = :version AND wordCount >= :minimum");
          const values = update.ExpressionAttributeValues;
          if (!summary || summary.schemaVersion !== 1 || summary.wordCount < values[":minimum"]) throw canceled();
          summary.wordCount += values[":delta"];
          if (values[":one"]) summary.wordsCreatedTotal += values[":one"];
          summary.updatedAt = values[":now"];
        } else if (operation.ConditionCheck) {
          const check = operation.ConditionCheck;
          if (stagedMetadata.get(`${check.Key.userId}:${check.Key.key}`)?.formIndexVersion !== 1) throw canceled();
        } else if (operation.Delete) {
          const del = operation.Delete;
          if (del.TableName === "metadata") {
            const key = `${del.Key.userId}:${del.Key.key}`;
            assert.equal(del.ConditionExpression, "wordId = :wordId");
            if (stagedMetadata.get(key)?.wordId !== del.ExpressionAttributeValues[":wordId"]) throw canceled();
            stagedMetadata.delete(key);
          } else {
            assert.equal(del.ConditionExpression, "attribute_exists(id) AND updatedAt = :expected");
            if (stagedWords.get(del.Key.id)?.updatedAt !== del.ExpressionAttributeValues[":expected"]) throw canceled();
            stagedWords.delete(del.Key.id);
          }
        }
      }
      if (faults.cancelNextTransaction) { faults.cancelNextTransaction = false; throw canceled(); }
      items.clear(); stagedWords.forEach((value, key) => items.set(key, value));
      metadata.clear(); stagedMetadata.forEach((value, key) => metadata.set(key, value));
      return {};
    }
    if (command instanceof ScanCommand) {
      const values = [...items.values()];
      const offset = input.ExclusiveStartKey ? values.findIndex(item => item.id === input.ExclusiveStartKey.id) + 1 : 0;
      const page = values.slice(offset, offset + input.Limit);
      return { Items: structuredClone(page), ...(offset + page.length < values.length ? { LastEvaluatedKey: { id: page.at(-1).id } } : {}) };
    }
    if (command instanceof PutCommand && input.TableName === "metadata") {
      const key = `${input.Item.userId}:${input.Item.key}`;
      const existing = metadata.get(key);
      if (input.ConditionExpression === "attribute_not_exists(userId)" && existing) {
        const error = new Error("Conditional failure"); error.name = "ConditionalCheckFailedException"; throw error;
      }
      if (input.ConditionExpression === "updatedAt = :expected" &&
          existing?.updatedAt !== input.ExpressionAttributeValues[":expected"]) {
        const error = new Error("Conditional failure"); error.name = "ConditionalCheckFailedException"; throw error;
      }
      metadata.set(key, structuredClone(input.Item));
      return {};
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
  return { items, metadata, faults, commands, send };
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
  const handler = createHandler(db.send, { tableName: "words", ownerSub: "owner", metadataTableName: "metadata" });
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

test("study order repository reads and syncs through study endpoints", async () => {
  const requests: { url: string; method: string; body?: string }[] = [];
  const repository = new ApiWordRepository("https://example.test", async () => "access-token", async (input, init) => {
    requests.push({ url: String(input), method: init?.method ?? "GET", ...(typeof init?.body === "string" ? { body: init.body } : {}) });
    return Response.json(requests.at(-1)?.method === "POST"
      ? { updatedAt: "2026-11-09T12:00:00.000Z" }
      : { order: ["newest"], updatedAt: "2026-11-09T11:00:00.000Z" });
  });
  assert.deepEqual(await repository.getStudyOrder(), { order: ["newest"], updatedAt: "2026-11-09T11:00:00.000Z" });
  assert.equal(await repository.syncStudyOrder(["newest", "older"], "2026-11-09T11:00:00.000Z"), "2026-11-09T12:00:00.000Z");
  assert.deepEqual(requests.map(request => [new URL(request.url).pathname, request.method]), [
    ["/study/order", "GET"], ["/study/sync", "POST"],
  ]);
  assert.deepEqual(JSON.parse(requests[1]!.body!), {
    order: ["newest", "older"], expectedUpdatedAt: "2026-11-09T11:00:00.000Z",
  });
});

test("repository and handler persist create/read/update/delete across repository instances", async () => {
  const db = database();
  const handler = createHandler(db.send, { tableName: "words", ownerSub: "owner", metadataTableName: "metadata" });
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
  const handler = createHandler(db.send, { tableName: "words", ownerSub: "owner", metadataTableName: "metadata" });
  for (let i = 0; i < 3; i++) assert.equal((await handler(event("POST /words", { body: JSON.stringify({ ...fixture(), id: `draft-${i}`, forms: [{ ...fixture().forms[0], text: `unique-${i}` }] }) }))).statusCode, 201);
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

test("study order API reads, syncs, validates and rejects stale syncs", async () => {
  const db = database();
  const handler = createHandler(db.send, { tableName: "words", ownerSub: "owner", metadataTableName: "metadata" });
  const get = async () => JSON.parse((await handler(event("GET /study/order"))).body!);
  assert.deepEqual(await get(), { order: [] });
  const first = await handler(event("POST /study/sync", { body: JSON.stringify({ order: ["newest", "older"] }) }));
  assert.equal(first.statusCode, 200);
  const updatedAt = JSON.parse(first.body!).updatedAt;
  assert.deepEqual(await get(), { order: ["newest", "older"], updatedAt });
  assert.equal((await handler(event("POST /study/sync", { body: JSON.stringify({
    order: ["older", "newest"], expectedUpdatedAt: "2026-10-26T00:00:00.000Z",
  }) }))).statusCode, 409);
  assert.equal((await handler(event("POST /study/sync", { body: JSON.stringify({ order: ["same", "same"] }) }))).statusCode, 400);
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
  const handler = createHandler(db.send, { tableName: "words", ownerSub: "owner", metadataTableName: "metadata" });
  for (const route of ["GET /words/lookup", "GET /metadata", "GET /study/order", "POST /study/sync",
    "GET /words", "GET /words/{id}", "POST /words", "PUT /words/{id}", "DELETE /words/{id}"]) {
    assert.equal((await handler(event(route, { requestContext: {} }))).statusCode, 401);
    assert.equal((await handler(event(route, { requestContext: { authorizer: { jwt: { claims: { sub: "owner", token_use: "id" } } } } }))).statusCode, 401);
    assert.equal((await handler(event(route, { requestContext: { authorizer: { jwt: { claims: { sub: "another-user", token_use: "access" } } } } }))).statusCode, 403);
  }
  assert.equal(db.commands.length, 0);
  assert.equal((await handler(event("GET /words"))).statusCode, 200);
  const unconfigured = createHandler(db.send, { tableName: "words", ownerSub: "", metadataTableName: "metadata" });
  assert.equal((await unconfigured(event("GET /words"))).statusCode, 503);
});

test("a missing session never sends an API request", async () => {
  let called = false;
  const repository = new ApiWordRepository("https://example.test", async () => { throw new Error("Sign in first"); },
    async () => { called = true; return Response.json({ items: [] }); });
  await assert.rejects(repository.list(), /Sign in first/);
  assert.equal(called, false);
});

test("metadata tracks current/lifetime counts; creation retries and concurrent requests count once", async () => {
  const db = database();
  const handler = createHandler(db.send, { tableName: "words", ownerSub: "owner", metadataTableName: "metadata" });
  const metadata = async () => JSON.parse((await handler(event("GET /metadata"))).body!);
  const draft = fixture();
  const create = (body = draft) => handler(event("POST /words", { body: JSON.stringify(body), headers: { "idempotency-key": draft.id } }));
  const [first, retry] = await Promise.all([create(), create()]);
  assert.equal(first.statusCode, 201); assert.equal(retry.statusCode, 201);
  const saved = JSON.parse(first.body!);
  assert.equal(JSON.parse(retry.body!).id, saved.id);
  assert.equal((await metadata()).wordCount, 1);
  assert.equal((await metadata()).wordsCreatedTotal, 1);
  const freshTimestamps = structuredClone(draft); freshTimestamps.updatedAt = new Date().toISOString(); freshTimestamps.senses[0]!.updatedAt = new Date().toISOString();
  assert.equal(JSON.parse((await create(freshTimestamps)).body!).id, saved.id);
  const changed = structuredClone(draft); changed.tags.push("different content");
  assert.equal((await create(changed)).statusCode, 409);
  const updated = await handler(event("PUT /words/{id}", { pathParameters: { id: saved.id }, body: JSON.stringify({ ...saved, tags: ["edited"] }) }));
  assert.equal(updated.statusCode, 200);
  assert.equal((await metadata()).wordsCreatedTotal, 1);
  assert.equal((await handler(event("DELETE /words/{id}", { pathParameters: { id: saved.id }, headers: { "if-match": saved.updatedAt } }))).statusCode, 409);
  assert.equal((await metadata()).wordCount, 1);
  const latest = JSON.parse(updated.body!);
  assert.equal((await handler(event("DELETE /words/{id}", { pathParameters: { id: saved.id }, headers: { "if-match": latest.updatedAt } }))).statusCode, 204);
  assert.equal((await metadata()).wordCount, 0);
  assert.equal((await metadata()).wordsCreatedTotal, 1);
  assert.equal((await handler(event("DELETE /words/{id}", { pathParameters: { id: saved.id }, headers: { "if-match": latest.updatedAt } }))).statusCode, 409);
  assert.equal((await metadata()).wordCount, 0);
  // Replaying a completed create never resurrects a deleted word.
  assert.equal((await create()).statusCode, 201);
  assert.equal(db.items.size, 0);
  assert.equal((await metadata()).wordCount, 0);
});

test("failed transactions cannot partially create/delete a word or change counters", async () => {
  const db = database();
  const handler = createHandler(db.send, { tableName: "words", ownerSub: "owner", metadataTableName: "metadata" });
  db.faults.cancelNextTransaction = true;
  const create = () => handler(event("POST /words", { body: JSON.stringify(fixture()) }));
  assert.equal((await create()).statusCode, 409);
  assert.equal(db.items.size, 0); assert.equal(db.metadata.size, 1);
  assert.equal(db.metadata.get("owner:SUMMARY").wordCount, 0);
  const saved = JSON.parse((await create()).body!);
  db.faults.cancelNextTransaction = true;
  assert.equal((await handler(event("DELETE /words/{id}", { pathParameters: { id: saved.id }, headers: { "if-match": saved.updatedAt } }))).statusCode, 409);
  assert.equal(db.items.size, 1); assert.equal(db.metadata.get("owner:SUMMARY").wordCount, 1);
});

test("missing initialization blocks create/delete, not word reads; metadata is validated by the client", async () => {
  const db = database(); db.metadata.clear();
  const handler = createHandler(db.send, { tableName: "words", ownerSub: "owner", metadataTableName: "metadata" });
  assert.equal((await handler(event("GET /metadata"))).statusCode, 503);
  assert.equal((await handler(event("POST /words", { body: JSON.stringify(fixture()) }))).statusCode, 503);
  assert.equal((await handler(event("DELETE /words/{id}", { pathParameters: { id: "missing" }, headers: { "if-match": new Date().toISOString() } }))).statusCode, 503);
  assert.equal((await handler(event("GET /words"))).statusCode, 200);
  const invalid = new ApiWordRepository("https://example.test", async () => "access-token", async () => Response.json({ wordCount: -1 }));
  await assert.rejects(invalid.getMetadata(), /invalid word metadata/);
});

test("backfill counts every page, defaults to dry-run, requires paused writers, and refuses overwrite", async () => {
  const { initializeMetadata } = createRequire(new URL("../src/backend/package.json", import.meta.url))("./scripts/backfill-metadata.cjs");
  const calls: any[] = [];
  let existing = false;
  const send = async (command: any) => {
    calls.push(command);
    if (command instanceof GetCommand) return existing ? { Item: { wordCount: 99 } } : {};
    if (command instanceof ScanCommand) return command.input.ExclusiveStartKey ? { Items: [3, 4, 5].map(i => ({ id: `word-${i}`, forms: [{ text: `form-${i}` }] })) }
      : { Items: [1, 2].map(i => ({ id: `word-${i}`, forms: [{ text: `form-${i}` }] })), LastEvaluatedKey: { id: "last" } };
    return {};
  };
  const config = { tableName: "words", metadataTableName: "metadata", ownerSub: "owner" };
  const dry = await initializeMetadata(send, config);
  assert.equal(dry.applied, false); assert.equal(dry.summary.wordCount, 5); assert.equal(dry.summary.wordsCreatedTotal, 5);
  assert.equal(calls.filter(command => command instanceof PutCommand).length, 0);
  await assert.rejects(initializeMetadata(send, { ...config, apply: true }), /Pause ALL/);
  const applied = await initializeMetadata(send, { ...config, apply: true, writesPaused: true });
  assert.equal(applied.applied, true);
  assert.equal(calls.at(-1).input.ConditionExpression, "attribute_not_exists(userId)");
  existing = true;
  await assert.rejects(initializeMetadata(send, { ...config, apply: true, writesPaused: true }), /refusing to overwrite/);
});

test("written forms resolve exact normalized aliases and concurrent duplicate creation counts once", async () => {
  const db = database();
  const handler = createHandler(db.send, { tableName: "words", ownerSub: "owner", metadataTableName: "metadata" });
  const first = fixture(); first.forms[0]!.text = "cafe\u0301";
  const second = { ...structuredClone(first), id: "second-draft" };
  const results = await Promise.all([first, second].map(draft => handler(event("POST /words", { body: JSON.stringify(draft) }))));
  assert.deepEqual(results.map(result => result.statusCode).sort(), [201, 409]);
  const saved = JSON.parse(results.find(result => result.statusCode === 201)!.body!);
  const duplicate = JSON.parse(results.find(result => result.statusCode === 409)!.body!);
  assert.equal(duplicate.code, "WRITTEN_FORM_EXISTS");
  assert.equal(duplicate.existingWord.id, saved.id);
  assert.equal(db.items.size, 1); assert.equal(db.metadata.get("owner:SUMMARY").wordCount, 1);
  const lookup = async (form: string) => handler(event("GET /words/lookup", { queryStringParameters: { form } }));
  assert.equal(JSON.parse((await lookup("  caf\u00e9  ")).body!).id, saved.id);
  assert.equal(JSON.parse((await lookup(first.forms[1]!.text)).body!).id, saved.id);
  assert.equal((await lookup("absent")).statusCode, 404);
  assert.equal((await handler(event("GET /words/lookup"))).statusCode, 400);
});

test("changing and deleting forms maintains reservations; conflicting edits roll back", async () => {
  const db = database();
  const handler = createHandler(db.send, { tableName: "words", ownerSub: "owner", metadataTableName: "metadata" });
  const make = (id: string, text: string) => ({ ...fixture(), id, forms: [{ ...fixture().forms[0]!, text }] });
  const create = async (id: string, text: string) => JSON.parse((await handler(event("POST /words", { body: JSON.stringify(make(id, text)) }))).body!);
  const first = await create("first", "first-form"); const second = await create("second", "second-form");
  const edit = (word: any) => handler(event("PUT /words/{id}", { pathParameters: { id: word.id }, body: JSON.stringify(word) }));
  const conflicting = { ...first, forms: [{ ...first.forms[0], text: "second-form" }] };
  const conflict = await edit(conflicting);
  assert.equal(conflict.statusCode, 409); assert.equal(JSON.parse(conflict.body!).existingWord.id, second.id);
  assert.equal(db.items.get(first.id).forms[0].text, "first-form");
  const updated = JSON.parse((await edit({ ...first, forms: [{ ...first.forms[0], text: "renamed-form" }] })).body!);
  assert.equal((await handler(event("GET /words/lookup", { queryStringParameters: { form: "first-form" } }))).statusCode, 404);
  assert.equal((await handler(event("GET /words/lookup", { queryStringParameters: { form: "renamed-form" } }))).statusCode, 200);
  assert.equal(db.metadata.get("owner:SUMMARY").wordCount, 2);
  await handler(event("DELETE /words/{id}", { pathParameters: { id: updated.id }, headers: { "if-match": updated.updatedAt } }));
  assert.equal((await handler(event("GET /words/lookup", { queryStringParameters: { form: "renamed-form" } }))).statusCode, 404);
  const reused = await create("third", "renamed-form");
  assert.ok(reused.id); assert.equal(db.metadata.get("owner:SUMMARY").wordCount, 2);
});

test("backfill detects collisions before writing; index upgrade preserves counters", async () => {
  const { initializeMetadata } = createRequire(new URL("../src/backend/package.json", import.meta.url))("./scripts/backfill-metadata.cjs");
  const calls: any[] = [];
  const summary = { userId: "owner", key: "SUMMARY", schemaVersion: 1, wordCount: 2, wordsCreatedTotal: 7, initializedAt: "2026-10-01T00:00:00.000Z" };
  let duplicates = true;
  const send = async (command: any) => {
    calls.push(command);
    if (command instanceof GetCommand) return { Item: summary };
    if (command instanceof ScanCommand) return { Items: [{ id: "one", forms: [{ text: "one" }] }, { id: "two", forms: [{ text: duplicates ? "one" : "two" }] }] };
    return {};
  };
  const config = { tableName: "words", metadataTableName: "metadata", ownerSub: "owner", apply: true, writesPaused: true, upgradeFormIndex: true };
  await assert.rejects(initializeMetadata(send, config), /collisions/);
  assert.equal(calls.filter(command => command instanceof PutCommand).length, 0);
  duplicates = false;
  const result = await initializeMetadata(send, config);
  assert.equal(result.summary.wordCount, 2); assert.equal(result.summary.wordsCreatedTotal, 7);
  assert.equal(result.summary.initializedAt, summary.initializedAt); assert.equal(result.summary.formIndexVersion, 1);
  assert.equal(calls.at(-1).input.Item.key, "SUMMARY");
});

test("repository resolves lookup misses and exposes validated duplicate data for editor replacement", async () => {
  const saved = fixture();
  const repository = new ApiWordRepository("https://example.test", async () => "access-token", async (input, init) => {
    const url = new URL(String(input));
    if (init?.method === "POST") return Response.json({ code: "WRITTEN_FORM_EXISTS", message: "Already exists", existingWord: saved }, { status: 409 });
    assert.equal(url.pathname, "/words/lookup");
    return url.searchParams.get("form") === "missing" ? Response.json({ message: "No match" }, { status: 404 }) : Response.json(saved);
  });
  assert.equal(await repository.lookupByForm("missing"), null);
  assert.deepEqual(await repository.lookupByForm(saved.forms[0]!.text), saved);
  await assert.rejects(repository.create(fixture()), (error: any) => error instanceof ApiError && error.existingWord?.id === saved.id);
});
