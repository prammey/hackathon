import { describe, expect, it } from "vitest";
import { hash, pageKeyFor } from "../src/shared/hash";

describe("pageKeyFor", () => {
  it("drops ids, uuids and most query values so the same kind of page shares a layout", () => {
    expect(pageKeyFor("https://x.gov/claims/12345/edit?session=abc&page=2")).toBe("https://x.gov/claims/:id/edit?page=2&session");
    expect(pageKeyFor("https://x.gov/a/3f2b9c1e-1111-2222-3333-444455556666")).toBe("https://x.gov/a/:id");
  });
  it("keeps different pages apart", () => {
    expect(pageKeyFor("https://x.gov/apply")).not.toBe(pageKeyFor("https://x.gov/help"));
  });
});

describe("hash", () => {
  it("is deterministic and short", () => {
    expect(hash("abc")).toBe(hash("abc"));
    expect(hash("abc")).not.toBe(hash("abd"));
    expect(hash("x".repeat(10000)).length).toBeLessThanOrEqual(7);
  });
});
