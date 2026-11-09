import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { createHash, randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, DeleteCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { isWordEntry, normalizeWord, isRecord } from "../../validation/word";

import { formChanges, formKey, formTexts } from "./writtenForms";
import { normalizeWrittenForm } from "../../utils/writtenForm";
import { isStoredWordEntry } from "../../validation/word";
import { isUserMetadata } from "../../validation/metadata";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
type Command = GetCommand | PutCommand | ScanCommand | DeleteCommand | TransactWriteCommand;
type Result = { Item?: Record<string, any>; Items?: Record<string, any>[]; LastEvaluatedKey?: Record<string, any> };

/** Dependency injection keeps handler tests independent of AWS credentials. */
export function createHandler(send: (command: Command) => Promise<Result>, config: { tableName: string; ownerSub: string; metadataTableName: string }) {
  const response = (statusCode: number, body?: unknown): APIGatewayProxyStructuredResultV2 => ({
    statusCode, headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const metadataKey = { userId: config.ownerSub, key: "SUMMARY" };
  const readSummary = async () => {
    if (!config.metadataTableName || config.metadataTableName === config.tableName) return null;
    const result = await send(new GetCommand({ TableName: config.metadataTableName, Key: metadataKey, ConsistentRead: true }));
    return result.Item?.schemaVersion === 1 && result.Item.formIndexVersion === 1 && isUserMetadata(result.Item) ? result.Item : null;
  };
  const summaryUpdate = (delta: 1 | -1) => ({
    TableName: config.metadataTableName, Key: metadataKey,
    UpdateExpression: delta === 1
      ? "SET updatedAt = :now ADD wordCount :delta, wordsCreatedTotal :one"
      : "SET updatedAt = :now ADD wordCount :delta",
    ConditionExpression: "attribute_exists(userId) AND schemaVersion = :version AND formIndexVersion = :version AND wordCount >= :minimum",
    ExpressionAttributeValues: { ":now": new Date().toISOString(), ":delta": delta, ":version": 1,
      ":minimum": delta === -1 ? 1 : 0, ...(delta === 1 ? { ":one": 1 } : {}) },
  });
  const findForm = async (text: string) => {
    const mapping = await send(new GetCommand({ TableName: config.metadataTableName,
      Key: { userId: config.ownerSub, key: formKey(text) }, ConsistentRead: true }));
    if (!mapping.Item) return null;
    const result = await send(new GetCommand({ TableName: config.tableName, Key: { id: mapping.Item.wordId }, ConsistentRead: true }));
    if (!isStoredWordEntry(result.Item) || !formTexts(result.Item.forms).includes(normalizeWrittenForm(text))) {
      throw new Error("Written-form index is inconsistent; reconcile the index before writing");
    }
    return result.Item;
  };
  const conflict = async (forms: { text: string }[], excludingId?: string) => {
    for (const text of formTexts(forms)) {
      const existing = await findForm(text);
      if (existing && existing.id !== excludingId) return response(409, {
        code: "WRITTEN_FORM_EXISTS", message: "This written form already exists. Editing the existing word.", existingWord: existing,
      });
    }
    return null;
  };
  return async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyStructuredResultV2> => {
    try {
      if (!config.tableName || !config.ownerSub) return response(503, { message: "Service is not configured" });
      const claims = event.requestContext.authorizer?.jwt?.claims;
      if (!claims || claims.token_use !== "access" || typeof claims.sub !== "string" || !claims.sub) {
        return response(401, { message: "A valid Cognito access token is required" });
      }
      if (claims.sub !== config.ownerSub) return response(403, { message: "Forbidden" });
      const TableName = config.tableName;
      const id = event.pathParameters?.id;
      switch (event.routeKey) {
        case "GET /metadata": {
          const summary = await readSummary();
          if (!summary) return response(503, { message: "Word metadata is not initialized. Run the metadata backfill before enabling writes." });
          return response(200, { wordCount: summary.wordCount, wordsCreatedTotal: summary.wordsCreatedTotal,
            initializedAt: summary.initializedAt, updatedAt: summary.updatedAt });
        }
        case "GET /study/order": {
          if (!config.metadataTableName || config.metadataTableName === TableName) return response(503, { message: "Study order storage is not configured" });
          const result = await send(new GetCommand({ TableName: config.metadataTableName,
            Key: { userId: config.ownerSub, key: "STUDY_ORDER" }, ConsistentRead: true }));
          if (!result.Item) return response(200, { order: [] });
          if (result.Item.schemaVersion !== 1 || !Array.isArray(result.Item.order) ||
              !result.Item.order.every(id => typeof id === "string" && id.length > 0) ||
              new Set(result.Item.order).size !== result.Item.order.length ||
              typeof result.Item.updatedAt !== "string") {
            throw new Error("Stored study order is invalid");
          }
          return response(200, { order: result.Item.order, updatedAt: result.Item.updatedAt });
        }
        case "POST /study/sync": {
          if (!await readSummary()) return response(503, { message: "Word metadata is not initialized. Run the metadata backfill before enabling writes." });
          let payload: unknown;
          try { payload = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body ?? "", "base64").toString("utf8") : event.body ?? ""); }
          catch { return response(400, { message: "Invalid JSON" }); }
          if (!isRecord(payload) || !Array.isArray(payload.order) ||
              !payload.order.every(id => typeof id === "string" && id.length > 0 && id.length <= 128) ||
              new Set(payload.order).size !== payload.order.length ||
              payload.order.length > 10000 ||
              Buffer.byteLength(JSON.stringify(payload.order), "utf8") > 350000 ||
              (payload.expectedUpdatedAt !== undefined &&
                (typeof payload.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(payload.expectedUpdatedAt))))) {
            return response(400, { message: "Invalid study order" });
          }
          const updatedAt = new Date(Math.max(Date.now(), payload.expectedUpdatedAt ? Date.parse(payload.expectedUpdatedAt) + 1 : 0)).toISOString();
          const Item = { userId: config.ownerSub, key: "STUDY_ORDER", schemaVersion: 1, order: payload.order, updatedAt };
          try {
            await send(new PutCommand({ TableName: config.metadataTableName, Item,
              ...(payload.expectedUpdatedAt === undefined
                ? { ConditionExpression: "attribute_not_exists(userId)" }
                : { ConditionExpression: "updatedAt = :expected", ExpressionAttributeValues: { ":expected": payload.expectedUpdatedAt } }) }));
          } catch (error) {
            if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
              return response(409, { message: "Study order changed in another session. Reload the Study tab before syncing again." });
            }
            throw error;
          }
          return response(200, { updatedAt });
        }
        case "GET /words/lookup": {
          const text = event.queryStringParameters?.form;
          if (!text?.trim()) return response(400, { message: "A written form is required" });
          if (!await readSummary()) return response(503, { message: "Written-form index is not initialized. Run the metadata backfill." });
          const existing = await findForm(text);
          return existing ? response(200, existing) : response(404, { message: "No matching word" });
        }
        case "GET /words": {
          const query = event.queryStringParameters ?? {};
          const limit = query.limit === undefined ? 25 : Number(query.limit);
          if (!Number.isInteger(limit) || limit < 1 || limit > 100) return response(400, { message: "limit must be between 1 and 100" });
          let cursor: { id: string } | undefined;
          if (query.cursor) {
            try {
              const decoded: unknown = JSON.parse(Buffer.from(query.cursor, "base64url").toString("utf8"));
              if (!isRecord(decoded) || typeof decoded.id !== "string" || !decoded.id || Object.keys(decoded).length !== 1) throw new Error();
              cursor = { id: decoded.id };
            } catch { return response(400, { message: "Invalid cursor" }); }
          }
          const result = await send(new ScanCommand({ TableName, Limit: limit, ConsistentRead: true,
            ...(cursor ? { ExclusiveStartKey: cursor } : {}) }));
          return response(200, { items: result.Items ?? [],
            ...(result.LastEvaluatedKey ? { nextCursor: Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64url") } : {}) });
        }
        case "GET /words/{id}": {
          if (!id) return response(400, { message: "Word ID is required" });
          const result = await send(new GetCommand({ TableName, Key: { id }, ConsistentRead: true }));
          return result.Item ? response(200, result.Item) : response(404, { message: "Word not found" });
        }
        case "POST /words":
        case "PUT /words/{id}": {
          const updating = event.routeKey.startsWith("PUT");
          if (updating && !id) return response(400, { message: "Word ID is required" });
          let payload: unknown;
          try { payload = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body ?? "", "base64").toString("utf8") : event.body ?? ""); }
          catch { return response(400, { message: "Invalid JSON" }); }
          if (!isWordEntry(payload)) return response(400, { message: "Invalid WordEntry structure or references" });
          if (updating && payload.id !== id) return response(400, { message: "Word ID does not match route" });
          let createdAt = new Date().toISOString();
          let previousForms: string[] = [];
          if (updating) {
            const existing = await send(new GetCommand({ TableName, Key: { id }, ConsistentRead: true }));
            if (!existing.Item) return response(404, { message: "Word not found" });
            createdAt = existing.Item.createdAt;
            previousForms = formTexts(existing.Item.forms);
          }
          const word = normalizeWord(payload);
          word.id = updating ? id! : randomUUID();
          word.createdAt = createdAt;
          word.updatedAt = new Date(Math.max(Date.now(), updating ? Date.parse(payload.updatedAt) + 1 : 0)).toISOString();
          if (updating) {
            if (!await readSummary()) return response(503, { message: "Written-form index is not initialized. Run the metadata backfill." });
            const existing = await conflict(word.forms, word.id);
            if (existing) return existing;
            const changes = formChanges(config.metadataTableName, config.ownerSub, word.id, previousForms, formTexts(word.forms));
            if (changes.length + 2 > 100) return response(400, { message: "Too many written forms for one transaction" });
            try {
              await send(new TransactWriteCommand({ TransactItems: [
                { Put: { TableName, Item: word, ConditionExpression: "attribute_exists(id) AND updatedAt = :expected",
                  ExpressionAttributeValues: { ":expected": payload.updatedAt } } },
                { ConditionCheck: { TableName: config.metadataTableName, Key: metadataKey,
                  ConditionExpression: "formIndexVersion = :version", ExpressionAttributeValues: { ":version": 1 } } },
                ...changes,
              ] }));
            } catch (error) {
              if (error instanceof Error && error.name === "TransactionCanceledException") {
                const existing = await conflict(word.forms, word.id);
                if (existing) return existing;
              }
              throw error;
            }
          } else {
            const requestId = event.headers["idempotency-key"] ?? event.headers["Idempotency-Key"] ?? payload.id;
            if (!/^[a-zA-Z0-9_-]{1,128}$/.test(requestId)) return response(400, { message: "Invalid Idempotency-Key" });
            // Ignore editor-generated timestamps so retrying Save after a lost response is safe.
            const { createdAt: _created, updatedAt: _updated, ...content } = normalizeWord(payload);
            const fingerprint = createHash("sha256").update(JSON.stringify({ ...content,
              senses: content.senses.map(({ createdAt, updatedAt, ...sense }) => sense) })).digest("hex");
            const requestKey = { userId: config.ownerSub, key: `CREATE#${requestId}` };
            const readRequest = async () => (await send(new GetCommand({ TableName: config.metadataTableName, Key: requestKey, ConsistentRead: true }))).Item;
            const replay = (record: Record<string, any>) => record.fingerprint === fingerprint
              ? response(201, record.word) : response(409, { message: "This creation request already succeeded with different content. Open the saved word before editing it." });
            if (!config.metadataTableName || config.metadataTableName === config.tableName) return response(503, { message: "METADATA_TABLE_NAME must name a separate metadata table" });
            const previous = await readRequest();
            if (previous) return replay(previous);
            if (!await readSummary()) return response(503, { message: "Word metadata is not initialized. Run the metadata backfill before enabling writes." });
            const existing = await conflict(word.forms);
            if (existing) return existing;
            const changes = formChanges(config.metadataTableName, config.ownerSub, word.id, [], formTexts(word.forms));
            if (changes.length + 3 > 100) return response(400, { message: "Too many written forms for one transaction" });
            try {
              await send(new TransactWriteCommand({ TransactItems: [
                { Put: { TableName, Item: word, ConditionExpression: "attribute_not_exists(id)" } },
                { Update: summaryUpdate(1) },
                { Put: { TableName: config.metadataTableName, Item: { ...requestKey, fingerprint, word },
                  ConditionExpression: "attribute_not_exists(userId)" } },
                ...changes,
              ] }));
            } catch (error) {
              // A concurrent retry can win the transaction while this request is running.
              if (error instanceof Error && error.name === "TransactionCanceledException") {
                const previous = await readRequest();
                if (previous) return replay(previous);
                const existing = await conflict(word.forms);
                if (existing) return existing;
              }
              throw error;
            }
          }
          return response(updating ? 200 : 201, word);
        }
        case "DELETE /words/{id}": {
          if (!id) return response(400, { message: "Word ID is required" });
          const expected = event.headers["if-match"] ?? event.headers["If-Match"];
          if (!expected || !Number.isFinite(Date.parse(expected))) return response(400, { message: "If-Match updatedAt is required" });
          if (!await readSummary()) return response(503, { message: "Word metadata is not initialized. Run the metadata backfill before enabling writes." });
          const existing = await send(new GetCommand({ TableName, Key: { id }, ConsistentRead: true }));
          if (!existing.Item) return response(409, { message: "Word was already deleted" });
          const changes = formChanges(config.metadataTableName, config.ownerSub, id, formTexts(existing.Item.forms), []);
          if (changes.length + 2 > 100) return response(400, { message: "Too many written forms for one transaction" });
          await send(new TransactWriteCommand({ TransactItems: [
            { Delete: { TableName, Key: { id }, ConditionExpression: "attribute_exists(id) AND updatedAt = :expected",
              ExpressionAttributeValues: { ":expected": expected } } },
            { Update: summaryUpdate(-1) },
            ...changes,
          ] }));
          return response(204);
        }
        default: return response(404, { message: "Route not found" });
      }
    } catch (error) {
      if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
        return response(409, { message: "Word changed or was deleted. Reload before trying again." });
      }
      if (error instanceof Error && error.name === "TransactionCanceledException") {
        const reasons = (error as Error & { CancellationReasons?: { Code?: string }[] }).CancellationReasons ?? [];
        if (reasons.some(reason => reason.Code === "ConditionalCheckFailed")) return response(409, { message: "Word changed, was deleted, or its metadata needs reconciliation. Reload before trying again." });
        if (reasons.some(reason => ["TransactionConflict", "ProvisionedThroughputExceeded", "ThrottlingError"].includes(reason.Code ?? ""))) {
          return response(503, { message: "The dictionary is busy. Retry the same request shortly." });
        }
      }
      console.error("WordEntry request failed", error);
      return response(500, { message: "Internal server error" });
    }
  };
}
export const handler = createHandler(async command => {
  if (command instanceof GetCommand) return client.send(command);
  if (command instanceof ScanCommand) return client.send(command);
  if (command instanceof PutCommand) { await client.send(command); return {}; }
  if (command instanceof DeleteCommand) { await client.send(command); return {}; }
  await client.send(command); return {};
}, {
  tableName: process.env.TABLE_NAME ?? "", ownerSub: process.env.OWNER_SUB ?? "",
  metadataTableName: process.env.METADATA_TABLE_NAME ?? "",
});
