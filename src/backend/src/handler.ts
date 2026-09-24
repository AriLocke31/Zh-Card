import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = process.env.TABLE_NAME;
const ownerSub = process.env.OWNER_SUB;

if (!TABLE_NAME)
  throw new Error("TABLE_NAME environment variable is required");

const client = new DynamoDBClient({});

const db = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

function response(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      "Content-Type": "application.json",
    },
    body: JSON.stringify(body),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (typeof value === "object" && value !== null && !Array.isArray(value));
}

function isWordPayload(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;

  return (
    Array.isArray(value.forms) &&
    value.forms.length > 0 &&
    value.forms.every(
      (form) =>
        isRecord(form) &&
        typeof form.id === "string" &&
        typeof form.text === "string" &&
        form.text.trim().length > 0 &&
        ["simplified", "traditional", "both", "variant"]
          .includes(String(form.script)) &&
        typeof form.isPreferred === "boolean"
    ) &&
    Array.isArray(value.readings) &&
    Array.isArray(value.senses) &&
    Array.isArray(value.components) &&
    Array.isArray(value.tags) &&
    value.tags.every(
      (tag) => typeof tag === "string"
    )
  );
}

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const callerSub = event.requestContext.authorizer?.jwt?.claims.sub;
    if (!ownerSub || callerSub !== ownerSub)
      return response(403, { message: "Forbidden" });

    switch (event.routeKey) {
      case "POST /words": {
        if (!event.body)
          return response(400, { message: "Request body is required", });

        let payload: unknown;

        try {
          const body = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
          payload = JSON.parse(body);
        } catch {
          return response(400, { message: "Invalid JSON" });
        }

        if (!isWordPayload(payload))
          return response(400, { message: "Invalid WordEntry structure", });

        const now = new Date().toISOString();

        const word = {
          id: randomUUID(),
          forms: payload.forms,
          readings: payload.readings,
          senses: payload.senses,
          components: payload.components,
          tags: payload.tags,
          createdAt: now,
          updatedAt: now,
        };

        await db.send(
          new PutCommand({
            TableName: TABLE_NAME,
            Item: word,
            ConditionExpression: "attribute_not_exists(id)",
          })
        );

        return response(201, word);
      }

      case "GET /words/{id}": {
        const id = event.pathParameters?.id;

        if (!id)
          return response(400, { message: "Word ID is required" });

        const result = await db.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: { id },
            ConsistentRead: true,
          })
        );

        if (!result.Item)
          return response(404, { message: "Word not found" });

        return response(200, result.Item);
      }

      default:
        return response(404, { message: "Route not found" });
    }
  } catch (error) {
    console.error("WordEntry request failed", error);

    return response(500, { message: "Internal server error" });
  }
};


