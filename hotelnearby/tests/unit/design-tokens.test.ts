import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/styles/tokens.css"), "utf8");

function parseVars(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of source.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)) {
    out[match[1]!.replace(/^color-/, "")] = match[2]!.toLowerCase();
  }
  return out;
}

const vars = parseVars(css);

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const textPairs: [string, string][] = [
  ["foreground", "background"],
  ["foreground", "surface"],
  ["muted-foreground", "background"],
  ["muted-foreground", "surface"],
  ["primary-foreground", "primary"],
  ["primary-foreground", "primary-hover"],
  ["accent-foreground", "accent"],
  ["accent-text", "background"],
  ["accent-text", "surface-muted"],
  ["brand-surface-foreground", "brand-surface"],
  ["brand-surface-muted", "brand-surface"],
  ["brand-surface-accent", "brand-surface"],
  ["danger-solid-foreground", "danger-solid"],
  ["danger-solid-foreground", "danger-solid-hover"],
  ["success-fg", "success-bg"],
  ["warning-fg", "warning-bg"],
  ["danger-fg", "danger-bg"],
  ["info-fg", "info-bg"],
];

describe("Hotelnearby light design tokens", () => {
  it("uses the approved navy, ivory and champagne palette", () => {
    expect(css.toLowerCase()).toContain("#172b46");
    expect(css.toLowerCase()).toContain("#f5f2eb");
    expect(css.toLowerCase()).toContain("#c9a66b");
    expect(css.toLowerCase()).toContain("#252c35");
    expect(css.toLowerCase()).toContain("#e9edf2");
  });

  it("declares a light-only colour scheme", () => {
    expect(css).toContain("color-scheme: light;");
    expect(css).not.toContain(':root[data-theme="dark"]');
    expect(css).not.toContain("prefers-color-scheme: dark");
  });

  it.each(textPairs)("%s on %s meets WCAG AA text contrast", (foreground, background) => {
    const fg = vars[foreground];
    const bg = vars[background];
    expect(fg, `missing token ${foreground}`).toMatch(/^#[0-9a-f]{6}$/);
    expect(bg, `missing token ${background}`).toMatch(/^#[0-9a-f]{6}$/);
    expect(contrast(fg!, bg!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["input-border", "surface"],
    ["input-border", "background"],
    ["ring", "surface"],
    ["ring", "background"],
  ])("%s on %s meets non-text UI contrast", (foreground, background) => {
    expect(contrast(vars[foreground]!, vars[background]!)).toBeGreaterThanOrEqual(3);
  });
});
