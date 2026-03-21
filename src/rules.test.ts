import { describe, expect, it } from "bun:test";
import * as rules from "./rules";

describe("ShouldCopy", () => {
  it("returns false when summary doesn't include the force-sharing sign and the event is marked free (aka transparent)", () => {
    expect(rules.ShouldCopy("summary", true)).toEqual(false);
  });
  it("returns true when summary doesn't include the force-sharing sign and the event is not marked free", () => {
    expect(rules.ShouldCopy("summary", false)).toEqual(true);
  });
  it("returns true when summary includes the force-sharing sign", () => {
    [false, true].forEach((markedFree) => {
      expect(rules.ShouldCopy("some 👀 visible event", markedFree)).toEqual(true);
    });
  });
});

describe("NewSummary", () => {
  it("returns the redacted summary if present and the summary doesn't include the force-sharing sign", () => {
    expect(rules.NewSummary("summary", "redacted")).toEqual("redacted");
  });
  it("returns the original summary if it contains the force-sharing sign", () => {
    expect(rules.NewSummary("👀 forced", "redacted")).toEqual("👀 forced");
  });
  it("returns the summary if the redacted summary is not passed", () => {
    expect(rules.NewSummary("summary")).toEqual("summary");
  });
});
