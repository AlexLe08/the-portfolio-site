import { afterEach, describe, expect, it, vi } from "vitest";

// vi.fn handles any promise its implementation returns (to record
// settledResults), which would hide a missing .catch. So the spy only
// records the call, and a plain wrapper returns the response.
const mock = vi.hoisted(() => ({
  GET: vi.fn(),
  respond: (): Promise<unknown> => Promise.resolve({ data: { status: "ok" } }),
}));
vi.mock("./api", () => ({
  api: {
    GET: (path: string) => {
      mock.GET(path);
      return mock.respond();
    },
  },
}));

import { wakeBackend } from "./wake-backend";

const respondOk = mock.respond;

afterEach(() => {
  mock.GET.mockReset();
  mock.respond = respondOk;
});

describe("wakeBackend", () => {
  it("requests /health once", () => {
    wakeBackend();
    expect(mock.GET).toHaveBeenCalledExactlyOnceWith("/health");
  });

  it("swallows a failed request", async () => {
    mock.respond = () => Promise.reject(new TypeError("Failed to fetch"));
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      expect(() => wakeBackend()).not.toThrow();
      // Unhandled rejections are reported after the microtask queue drains.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });
});
