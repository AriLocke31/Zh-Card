import { isRecord } from "./word";

export interface UserMetadata {
  wordCount: number;
  wordsCreatedTotal: number;
  initializedAt: string;
  updatedAt: string;
}

export function isUserMetadata(value: unknown): value is UserMetadata {
  return isRecord(value) && Number.isSafeInteger(value.wordCount) && Number(value.wordCount) >= 0 &&
    Number.isSafeInteger(value.wordsCreatedTotal) && Number(value.wordsCreatedTotal) >= Number(value.wordCount) &&
    typeof value.initializedAt === "string" && Number.isFinite(Date.parse(value.initializedAt)) &&
    typeof value.updatedAt === "string" && Number.isFinite(Date.parse(value.updatedAt));
}
