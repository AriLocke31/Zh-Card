import type { WordEntry } from "../types";

export interface StudySession {
  initialized: boolean;
  order: string[];
  reviewedIds: string[];
  updatedAt?: string;
}

export function initialStudyOrder(words: WordEntry[], savedOrder: string[]): string[] {
  const byId = new Map(words.map(word => [word.id, word]));
  const saved = savedOrder.filter(id => byId.has(id));
  const savedIds = new Set(saved);
  const newWords = words.filter(word => !savedIds.has(word.id))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id));
  return [...newWords.map(word => word.id), ...saved];
}

export function moveStudyCard(order: string[], id: string, remembered: boolean): string[] {
  const currentIndex = order.indexOf(id);
  if (currentIndex < 0 || order.length < 2) return order;
  const next = [...order];
  next.splice(currentIndex, 1);
  const targetIndex = remembered ? next.length : Math.min(currentIndex + 3, next.length);
  next.splice(targetIndex, 0, id);
  return next;
}
