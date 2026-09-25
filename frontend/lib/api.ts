import createClient from "openapi-fetch";
import type { paths } from "./api-types";

// `paths` comes entirely from api-types.ts, which comes entirely from the
// backend's OpenAPI schema. createClient<paths>() is what turns that type
// information into compile-time checking on every call below: get the URL
// wrong, misspell a query param, or misread what a 200 response contains,
// and TypeScript catches it before the code ever runs.
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const api = createClient<paths>({ baseUrl: apiBaseUrl });
