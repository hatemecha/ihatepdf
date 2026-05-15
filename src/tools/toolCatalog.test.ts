import { describe, expect, it } from "vitest";

import { getAllTools, searchTools } from "./toolCatalog";

describe("toolCatalog search", () => {
  it("returns all tools for empty query", () => {
    expect(searchTools("")).toHaveLength(getAllTools().length);
  });

  it("finds tools by name and synonyms", () => {
    expect(searchTools("unir").some((tool) => tool.slug === "merge")).toBe(
      true,
    );
    expect(
      searchTools("comprimir").some((tool) => tool.slug === "compress"),
    ).toBe(true);
  });

  it("ignores accents in queries", () => {
    expect(
      searchTools("proteger").some((tool) => tool.slug === "protect"),
    ).toBe(true);
  });
});
