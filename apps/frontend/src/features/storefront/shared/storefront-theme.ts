const DEFAULT_ACCENT = "#335e3d";

/** Keep the merchant hue while retaining contrast on white and pale accent surfaces. */
export function storefrontAccent(input: string | null | undefined): string {
  const hex = input && /^#[0-9a-f]{6}$/i.test(input) ? input.toLowerCase() : DEFAULT_ACCENT;
  const rgb = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  const contrast = (channels: number[]) => {
    const linear = channels.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 1.05 / (0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] + 0.05);
  };
  if (contrast(rgb) >= 5.3) return hex;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 16; step++) {
    const middle = (low + high) / 2;
    const channels = rgb.map((channel) => Math.floor(channel * middle));
    if (contrast(channels) >= 5.3) low = middle;
    else high = middle;
  }
  return `#${rgb.map((channel) => Math.floor(channel * low).toString(16).padStart(2, "0")).join("")}`;
}
