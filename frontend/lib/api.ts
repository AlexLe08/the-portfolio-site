import createClient from "openapi-fetch";
import type { paths } from "./api-types";

// `paths` is generated from the backend's OpenAPI schema, so every call
// below is type-checked: path, params and response shape.
export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const api = createClient<paths>({ baseUrl: apiBaseUrl });
