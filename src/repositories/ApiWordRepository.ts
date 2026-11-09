import type { WordEntry } from "../types";
import { isRecord, isStoredWordEntry } from "../validation/word";
import type { WordRepository, WordPage, StudyOrder } from "./WordRepository";
import { isUserMetadata, type UserMetadata } from "../validation/metadata";

export class ApiError extends Error {
  constructor(public status: number, message: string, public existingWord?: WordEntry) { super(message); }
}

export class ApiWordRepository implements WordRepository {
  constructor(
    private baseUrl: string,
    private getToken: () => Promise<string>,
    // Native browser fetch must retain the global receiver, not the repository.
    private transport: typeof fetch = (input, init) => globalThis.fetch(input, init),
  ) {}

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await this.transport(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      ...init, headers: { ...init.headers, Authorization: `Bearer ${await this.getToken()}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}) },
    });
    if (response.status === 204 && response.ok) return undefined;
    let data: unknown;
    try { data = await response.json(); } catch { data = undefined; }
    if (!response.ok) throw new ApiError(response.status, isRecord(data) && typeof data.message === "string"
      ? data.message : `Request failed (${response.status})`,
      isRecord(data) && isStoredWordEntry(data.existingWord) ? data.existingWord : undefined);
    return data;
  }

  private word(value: unknown): WordEntry {
    if (!isStoredWordEntry(value)) throw new Error("The server returned an invalid word.");
    return value;
  }

  async getById(id: string): Promise<WordEntry | null> {
    try { return this.word(await this.request(`/words/${encodeURIComponent(id)}`)); }
    catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
  }

  async lookupByForm(form: string): Promise<WordEntry | null> {
    try { return this.word(await this.request(`/words/lookup?${new URLSearchParams({ form })}`)); }
    catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
  }

  async list(cursor?: string): Promise<WordPage> {
    const result = await this.request(`/words?limit=25${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    if (!isRecord(result) || !Array.isArray(result.items) || !result.items.every(isStoredWordEntry) ||
        (result.nextCursor !== undefined && typeof result.nextCursor !== "string")) throw new Error("The server returned an invalid word list.");
    return { items: result.items, ...(typeof result.nextCursor === "string" ? { nextCursor: result.nextCursor } : {}) };
  }

  async getStudyOrder(): Promise<StudyOrder> {
    const result = await this.request("/study/order");
    if (!isRecord(result) || !Array.isArray(result.order) ||
        !result.order.every(id => typeof id === "string") ||
        new Set(result.order).size !== result.order.length ||
        (result.updatedAt !== undefined && typeof result.updatedAt !== "string")) {
      throw new Error("The server returned an invalid study order.");
    }
    return { order: result.order, ...(typeof result.updatedAt === "string" ? { updatedAt: result.updatedAt } : {}) };
  }

  async syncStudyOrder(order: string[], expectedUpdatedAt?: string): Promise<string> {
    const result = await this.request("/study/sync", {
      method: "POST",
      body: JSON.stringify({ order, expectedUpdatedAt }),
    });
    if (!isRecord(result) || typeof result.updatedAt !== "string") throw new Error("The server returned an invalid study sync response.");
    return result.updatedAt;
  }

  async getMetadata(): Promise<UserMetadata> {
    const result = await this.request("/metadata");
    if (!isUserMetadata(result)) throw new Error("The server returned invalid word metadata.");
    return result;
  }

  async create(word: WordEntry) { return this.word(await this.request("/words", { method: "POST", headers: { "Idempotency-Key": word.id }, body: JSON.stringify(word) })); }
  async update(word: WordEntry) { return this.word(await this.request(`/words/${encodeURIComponent(word.id)}`, { method: "PUT", body: JSON.stringify(word) })); }
  async delete(id: string, updatedAt: string) {
    await this.request(`/words/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "If-Match": updatedAt } });
  }
}
