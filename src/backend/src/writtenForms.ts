import { createHash } from "node:crypto";
import type { TransactWriteCommandInput } from "@aws-sdk/lib-dynamodb";
import { normalizeWrittenForm } from "../../utils/writtenForm";

export const formKey = (text: string) => `FORM#${createHash("sha256").update(normalizeWrittenForm(text)).digest("hex")}`;
export const formTexts = (forms: { text: string }[]) => [...new Set(forms.map(form => normalizeWrittenForm(form.text)))];

/** Reservations live outside WordEntry so word scans contain only words. */
export function formChanges(tableName: string, userId: string, wordId: string, before: string[], after: string[]): NonNullable<TransactWriteCommandInput["TransactItems"]> {
  return [
    ...before.filter(text => !after.includes(text)).map(text => ({ Delete: {
      TableName: tableName, Key: { userId, key: formKey(text) },
      ConditionExpression: "wordId = :wordId", ExpressionAttributeValues: { ":wordId": wordId },
    } })),
    // Reassert retained reservations too, catching missing or corrupted mappings.
    ...after.map(text => ({ Put: {
      TableName: tableName, Item: { userId, key: formKey(text), text, wordId },
      ConditionExpression: "attribute_not_exists(userId) OR wordId = :wordId",
      ExpressionAttributeValues: { ":wordId": wordId },
    } })),
  ];
}
