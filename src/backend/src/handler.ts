import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { isWordEntry, normalizeWord, isRecord } from "../../validation/word";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
type Command = GetCommand | PutCommand | ScanCommand | DeleteCommand;
type Result = { Item?: Record<string, any>; Items?: Record<string, any>[]; LastEvaluatedKey?: Record<string, any> };

/** Dependency injection keeps handler tests independent of AWS credentials. */
export function createHandler(send: (command: Command) => Promise<Result>, config: { tableName: string; ownerSub: string }) {
  const response = (statusCode: number, body?: unknown): APIGatewayProxyStructuredResultV2 => ({
    statusCode, headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
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
          if (updating) {
            const existing = await send(new GetCommand({ TableName, Key: { id }, ConsistentRead: true }));
            if (!existing.Item) return response(404, { message: "Word not found" });
            createdAt = existing.Item.createdAt;
          }
          const word = normalizeWord(payload);
          word.id = updating ? id! : randomUUID();
          word.createdAt = createdAt;
          word.updatedAt = new Date(Math.max(Date.now(), updating ? Date.parse(payload.updatedAt) + 1 : 0)).toISOString();
          await send(new PutCommand({ TableName, Item: word,
            ConditionExpression: updating ? "attribute_exists(id) AND updatedAt = :expected" : "attribute_not_exists(id)",
            ...(updating ? { ExpressionAttributeValues: { ":expected": payload.updatedAt } } : {}) }));
          return response(updating ? 200 : 201, word);
        }
        case "DELETE /words/{id}": {
          if (!id) return response(400, { message: "Word ID is required" });
          const expected = event.headers["if-match"] ?? event.headers["If-Match"];
          if (!expected || !Number.isFinite(Date.parse(expected))) return response(400, { message: "If-Match updatedAt is required" });
          await send(new DeleteCommand({ TableName, Key: { id },
            ConditionExpression: "attribute_exists(id) AND updatedAt = :expected",
            ExpressionAttributeValues: { ":expected": expected } }));
          return response(204);
        }
        default: return response(404, { message: "Route not found" });
      }
    } catch (error) {
      if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
        return response(409, { message: "Word changed or was deleted. Reload before trying again." });
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
  await client.send(command); return {};
}, {
  tableName: process.env.TABLE_NAME ?? "", ownerSub: process.env.OWNER_SUB ?? "",
});
