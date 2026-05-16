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

  it("keeps office conversion tools available", () => {
    const toolsBySlug = new Map(getAllTools().map((tool) => [tool.slug, tool]));

    for (const slug of [
      "pdf-to-word",
      "pdf-to-excel",
      "pdf-to-powerpoint",
      "office-to-pdf",
    ]) {
      const tool = toolsBySlug.get(slug);
      expect(tool?.status).toBe("available");
    }
  });
});
