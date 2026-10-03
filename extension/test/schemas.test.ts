import { describe, expect, it } from "vitest";
import { FillAnswerSchema, TidyPlanSchema } from "../src/shared/schemas";

const plan = { pagePurpose: "p", primaryTask: "t", isOfficialSite: false, roles: [], emphasis: [], collapse: [], protect: [], steps: [] };

describe("AI response validation", () => {
  it("accepts a well-formed plan", () => {
    expect(TidyPlanSchema.safeParse({ ...plan, roles: [{ id: "p1abc", role: "clutter" }] }).success).toBe(true);
  });
  it("rejects ids that could be selectors or script", () => {
    expect(TidyPlanSchema.safeParse({ ...plan, roles: [{ id: "body *", role: "clutter" }] }).success).toBe(false);
    expect(TidyPlanSchema.safeParse({ ...plan, roles: [{ id: "p1", role: "script" }] }).success).toBe(false);
  });
  it("rejects oversized plans", () => {
    const many = Array.from({ length: 401 }, (_, i) => ({ id: `p${i}`, role: "nav" }));
    expect(TidyPlanSchema.safeParse({ ...plan, roles: many }).success).toBe(false);
  });
  it("requires provenance on fill suggestions", () => {
    const field = { id: "p1", explanation: "e", hasSuggestion: true, value: "x", optionValues: [], checked: false, evidence: "", confidence: "high" };
    expect(FillAnswerSchema.safeParse({ overview: "", questions: [], fields: [field] }).success).toBe(false);
    expect(FillAnswerSchema.safeParse({ overview: "", questions: [], fields: [{ ...field, source: "profile" }] }).success).toBe(true);
  });
});
