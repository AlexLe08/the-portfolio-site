import { cookies } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setTheme } from "@/app/theme-actions";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE } from "./theme";

// The theme toggle's Server Action, with Next's cookie store mocked.
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const store = { set: vi.fn() };

function form(fields: Record<string, string> = {}) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

beforeEach(() => {
  vi.mocked(cookies).mockReset().mockResolvedValue(store as never);
  store.set.mockReset();
});

describe("setTheme", () => {
  it.each(["light", "dark"])("saves %s for the whole site, for a year", async (theme) => {
    await setTheme(form({ theme }));
    expect(store.set).toHaveBeenCalledOnce();
    expect(store.set).toHaveBeenCalledWith(THEME_COOKIE, theme, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: THEME_COOKIE_MAX_AGE,
    });
  });

  // Secure only in production: localhost is plain http.
  it.each([
    ["production", true],
    ["development", false],
  ])("with NODE_ENV %s, sets secure to %s", async (env, secure) => {
    vi.stubEnv("NODE_ENV", env);
    try {
      await setTheme(form({ theme: "dark" }));
    } finally {
      vi.unstubAllEnvs();
    }
    expect(store.set.mock.calls[0][2]).toMatchObject({ secure });
  });

  it.each<Record<string, string>>([{}, { theme: "" }, { theme: "system" }, { theme: "DARK" }])(
    "leaves the setting alone for %j",
    async (fields) => {
      await setTheme(form(fields));
      expect(store.set).not.toHaveBeenCalled();
    },
  );
});
