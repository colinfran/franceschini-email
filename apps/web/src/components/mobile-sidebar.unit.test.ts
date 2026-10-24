import { createElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
} from "@usesend/ui/src/sidebar";

vi.mock("@usesend/ui/src/hooks/use-mobile", () => ({
  useIsMobile: () => true,
}));

vi.mock("@usesend/ui/src/sheet", () => ({
  Sheet: ({ children }: { children?: ReactNode }) => children,
  SheetContent: ({ children, ...props }: ComponentProps<"div">) =>
    createElement("div", props, children),
  SheetHeader: ({ children }: { children?: ReactNode }) => children,
  SheetTitle: ({ children }: { children?: ReactNode }) => children,
  SheetDescription: ({ children }: { children?: ReactNode }) => children,
}));

describe("mobile sidebar layout", () => {
  it("constrains the drawer to the viewport and lets navigation shrink to scroll", () => {
    const html = renderToStaticMarkup(
      createElement(
        SidebarProvider,
        null,
        createElement(
          Sidebar,
          null,
          createElement(SidebarHeader, null, "Brand"),
          createElement(SidebarContent, null, "Navigation"),
          createElement(SidebarFooter, null, "Account"),
        ),
      ),
    );

    expect(html).toContain('data-mobile="true"');
    expect(html).toContain(
      'class="flex h-dvh w-[var(--sidebar-width)] flex-col gap-0 overflow-hidden',
    );
    expect(html).toContain('class="flex min-h-0 w-full flex-1 flex-col"');
    expect(html).toContain(
      'class="flex min-h-0 flex-1 flex-col gap-2 overflow-auto',
    );
    expect(html).toContain("Brand");
    expect(html).toContain("Navigation");
    expect(html).toContain("Account");
  });
});
