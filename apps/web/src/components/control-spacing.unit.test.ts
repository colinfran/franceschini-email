import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, buttonVariants } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";

describe("shared control spacing", () => {
  it("uses shadcn input height and padding", () => {
    const html = renderToStaticMarkup(createElement(Input));

    expect(html).toContain("h-9");
    expect(html).toContain("px-3");
    expect(html).toContain("py-1");
    expect(html).toContain("min-w-0");
    expect(html).not.toMatch(/\bh-10\b|\bpy-2\b/);
  });

  it.each([
    ["default", "h-9", "px-4", "has-[>svg]:px-3"],
    ["sm", "h-8", "px-3", "has-[>svg]:px-2.5"],
    ["lg", "h-10", "px-6", "has-[>svg]:px-4"],
  ] as const)("uses shadcn %s button spacing", (size, height, padding, iconPadding) => {
    const classes = buttonVariants({ size }).split(" ");

    expect(classes).toContain(height);
    expect(classes).toContain(padding);
    expect(classes).toContain(iconPadding);
  });

  it("uses a 36px square for icon buttons", () => {
    const html = renderToStaticMarkup(createElement(Button, { size: "icon" }));

    expect(html).toContain("h-9 w-9");
    expect(html).not.toMatch(/\bh-10\b|\bw-10\b/);
  });

  it("preserves explicit control size and padding overrides", () => {
    const input = renderToStaticMarkup(
      createElement(Input, { className: "h-12 px-6 py-3" }),
    );
    const button = renderToStaticMarkup(
      createElement(Button, {
        className: "h-auto p-0 has-[>svg]:px-0",
      }),
    );

    expect(input).toContain("h-12 px-6 py-3");
    expect(input).not.toMatch(/\bh-9\b|\bpx-3\b|\bpy-1\b/);
    expect(button).toContain("h-auto p-0 has-[&gt;svg]:px-0");
    expect(button).not.toMatch(/\bh-9\b|\bpx-4\b|\bpy-2\b/);
  });
});
