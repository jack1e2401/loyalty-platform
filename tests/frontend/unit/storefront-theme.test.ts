import { describe, expect, it } from "vitest";
import { storefrontAccent } from "../../../apps/frontend/src/features/storefront/shared/storefront-theme";

function contrastWithWhite(hex: string) {
  const rgb = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 1.05 / (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] + 0.05);
}

describe("storefront accent", () => {
  it("preserves readable brand colors and safely darkens colors too light for white text", () => {
    expect(storefrontAccent("#49382D")).toBe("#49382d");
    for (const color of ["#ffff00", "#ffffff", "#88ccff", "#00ff00"]) {
      expect(contrastWithWhite(storefrontAccent(color))).toBeGreaterThanOrEqual(4.5);
    }
    expect(storefrontAccent("invalid")).toBe("#335e3d");
  });
});
