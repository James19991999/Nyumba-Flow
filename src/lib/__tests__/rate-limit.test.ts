import { describe, expect, it } from "vitest";
import { rateLimit } from "../rate-limit";

describe("rateLimit", () => {
  it("allows requests up to the limit then blocks", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      const result = rateLimit(key, { limit: 3, windowMs: 60_000 });
      expect(result.ok).toBe(true);
    }
    const blocked = rateLimit(key, { limit: 3, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets after the window elapses", async () => {
    const key = `test-window-${Math.random()}`;
    rateLimit(key, { limit: 1, windowMs: 50 });
    const blocked = rateLimit(key, { limit: 1, windowMs: 50 });
    expect(blocked.ok).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 60));

    const afterWindow = rateLimit(key, { limit: 1, windowMs: 50 });
    expect(afterWindow.ok).toBe(true);
  });

  it("tracks independent keys separately", () => {
    const a = rateLimit(`a-${Math.random()}`, { limit: 1, windowMs: 60_000 });
    const b = rateLimit(`b-${Math.random()}`, { limit: 1, windowMs: 60_000 });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
  });
});
