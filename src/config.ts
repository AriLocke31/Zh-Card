import { ApiWordRepository } from "./repositories/ApiWordRepository";

// Authentication is temporarily unplugged; only the API endpoint is required.
const baseUrl = import.meta.env.VITE_API_BASE_URL;
export const configurationError = baseUrl ? "" : "VITE_API_BASE_URL";
export const repository = new ApiWordRepository(baseUrl ?? "");
