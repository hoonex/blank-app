import { describe, expect, test } from "bun:test";
import { cacheKey, dateKey, monday, escapeHtml, subjectKey } from "../data.js";

describe("legacy data compatibility", () => {
  test("dateKey is local YYYYMMDD", () => {
    expect(dateKey(new Date(2026, 10, 12, 12))).toBe("20261112");
  });
  test("Monday date is stable", () => {
    expect(dateKey(monday(new Date(2026, 10, 12, 12)))).toBe("20261109");
  });
  test("cache key preserves v1 namespace", () => {
    const profile = { school: { schoolCode: "123" }, grade: 2, className: "6" };
    expect(cacheKey(profile, new Date(2026, 10, 12, 12))).toBe("flow-school-cache-v4:123:2:6:20261109:2026-11:20261112");
  });
  test("subject override key preserves legacy format", () => {
    const profile = { school: { schoolCode: "123" }, grade: 2, className: "6" };
    expect(subjectKey(profile, {date: "20261112", period: 3})).toBe("123:2:6:4:3");
  });
  test("HTML escaping never trusts API strings", () => {
    expect(escapeHtml('<img src="x">')).toBe("&lt;img src=&quot;x&quot;&gt;");
  });
});
