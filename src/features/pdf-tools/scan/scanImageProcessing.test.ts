import { describe, expect, it } from "vitest";

import {
  applyHomography,
  computeHomography,
  resolveDocumentOutputSize,
  type Point,
} from "./scanImageProcessing";

describe("scan image geometry", () => {
  it("maps a rectangle to a skewed document quadrilateral", () => {
    const rectangle: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 200 },
      { x: 0, y: 200 },
    ];
    const documentCorners: Point[] = [
      { x: 12, y: 24 },
      { x: 146, y: 7 },
      { x: 132, y: 232 },
      { x: 3, y: 214 },
    ];

    const transform = computeHomography(rectangle, documentCorners);

    rectangle.forEach((point, index) => {
      const mapped = applyHomography(transform, point);
      expect(mapped.x).toBeCloseTo(documentCorners[index].x, 5);
      expect(mapped.y).toBeCloseTo(documentCorners[index].y, 5);
    });
  });

  it("keeps document output within the scanner maximum edge", () => {
    const size = resolveDocumentOutputSize([
      { x: 0, y: 0 },
      { x: 5000, y: 0 },
      { x: 5000, y: 3000 },
      { x: 0, y: 3000 },
    ]);

    expect(Math.max(size.width, size.height)).toBe(2600);
    expect(size.width / size.height).toBeCloseTo(5000 / 3000, 2);
  });
});
