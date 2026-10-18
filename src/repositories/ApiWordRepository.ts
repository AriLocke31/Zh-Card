import type { WordEntry } from "../types";
import { isRecord, isWordEntry } from "../validation/word";
import type { WordRepository, WordPage } from "./WordRepository";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export class ApiWordRepository implements WordRepository {
  constructor(private baseUrl: string, private transport: typeof fetch = fetch) {}

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await this.transport(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      ...init, headers: { ...init.headers,
        ...(init.body ? { "Content-Type": "application/json" } : {}) },
    });
    if (response.status === 204 && response.ok) return undefined;
    let data: unknown;
    try { data = await response.json(); } catch { data = undefined; }
    if (!response.ok) throw new ApiError(response.status, isRecord(data) && typeof data.message === "string"
      ? data.message : `Request failed (${response.status})`);
    return data;
  }

  private word(value: unknown): WordEntry {
    if (!isWordEntry(value)) throw new Error("The server returned an invalid word.");
    return value;
  }

  async getById(id: string): Promise<WordEntry | null> {
    try { return this.word(await this.request(`/words/${encodeURIComponent(id)}`)); }
    catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
  }

  async list(cursor?: string): Promise<WordPage> {
    const result = await this.request(`/words?limit=25${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    if (!isRecord(result) || !Array.isArray(result.items) || !result.items.every(isWordEntry) ||
        (result.nextCursor !== undefined && typeof result.nextCursor !== "string")) throw new Error("The server returned an invalid word list.");
    return { items: result.items, ...(typeof result.nextCursor === "string" ? { nextCursor: result.nextCursor } : {}) };
  }

  async create(word: WordEntry) { return this.word(await this.request("/words", { method: "POST", body: JSON.stringify(word) })); }
  async update(word: WordEntry) { return this.word(await this.request(`/words/${encodeURIComponent(word.id)}`, { method: "PUT", body: JSON.stringify(word) })); }
  async delete(id: string, updatedAt: string) {
    await this.request(`/words/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "If-Match": updatedAt } });
  }
}
