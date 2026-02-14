import { describe, it, expect } from "vitest";
import { validateDomain } from "./domain-validation";

describe("validateDomain", () => {
  describe("valid domains", () => {
    it.each([
      "example.com",
      "sub.example.com",
      "deep.sub.example.com",
      "example.co.uk",
      "my-app.example.com",
    ])('accepts standard domain "%s"', (domain) => {
      expect(validateDomain(domain)).toBe(true);
    });

    it.each(["*.example.com", "*.sub.example.com"])(
      'accepts wildcard domain "%s"',
      (domain) => {
        expect(validateDomain(domain)).toBe(true);
      }
    );

    it("accepts localhost", () => {
      expect(validateDomain("localhost")).toBe(true);
    });

    it.each(["localhost:3000", "localhost:8080", "localhost:443"])(
      'accepts localhost with port "%s"',
      (domain) => {
        expect(validateDomain(domain)).toBe(true);
      }
    );

    it("accepts localhost:* (wildcard port)", () => {
      expect(validateDomain("localhost:*")).toBe(true);
    });

    it.each(["example.com:8080", "sub.domain.com:3000"])(
      'accepts domain with port "%s"',
      (domain) => {
        expect(validateDomain(domain)).toBe(true);
      }
    );
  });

  describe("invalid domains", () => {
    it("rejects empty string", () => {
      expect(validateDomain("")).toBe(false);
    });

    it("rejects spaces", () => {
      expect(validateDomain("not a domain")).toBe(false);
    });

    it("rejects URLs with protocol", () => {
      expect(validateDomain("http://example.com")).toBe(false);
      expect(validateDomain("https://example.com")).toBe(false);
    });

    it("rejects domains with path", () => {
      expect(validateDomain("example.com/path")).toBe(false);
    });

    it("rejects domains with query string", () => {
      expect(validateDomain("example.com?foo=bar")).toBe(false);
    });
  });
});
