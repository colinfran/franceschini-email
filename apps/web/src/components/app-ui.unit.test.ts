import { createElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { signOut } from "next-auth/react";
import { SidebarProvider } from "@usesend/ui/src/sidebar";
import { AppSidebar, NavUser } from "./AppSideBar";
import LoginPage from "~/app/login/login-page";
import { DashboardLayout } from "~/app/(dashboard)/dasboard-layout";
import { ThemeSwitcher } from "./theme/ThemeSwitcher";

const { accountMenuActions, navigationActions, mobileState } = vi.hoisted(
  () => ({
    accountMenuActions: [] as Array<() => Promise<void>>,
    navigationActions: [] as Array<{ href: string; onClick?: () => void }>,
    mobileState: { isMobile: false, setOpenMobile: vi.fn() },
  }),
);

vi.mock("@usesend/ui/src/sidebar", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@usesend/ui/src/sidebar")>();
  return {
    ...actual,
    useSidebar: () => ({ ...actual.useSidebar(), ...mobileState }),
  };
});

vi.mock("next/link", () => ({
  default: ({
    href,
    onClick,
    children,
    ...props
  }: Omit<ComponentProps<"a">, "onClick"> & { onClick?: () => void }) => {
    if (href) {
      navigationActions.push({ href, onClick });
    }
    return createElement("a", { ...props, href, onClick }, children);
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: { name: "Test User", email: "test@example.com", isAdmin: false },
    },
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("./FeedbackDialog", () => ({
  FeedbackDialog: ({ trigger }: { trigger: ReactNode }) => trigger,
}));

vi.mock("./payments/UpgradeModal", () => ({
  UpgradeModal: () => null,
}));

vi.mock("@usesend/ui/src/tooltip", () => {
  const passthrough = ({ children }: { children?: ReactNode }) => children;
  return {
    Tooltip: passthrough,
    TooltipProvider: passthrough,
    TooltipTrigger: passthrough,
    TooltipContent: () => null,
  };
});

vi.mock("@usesend/ui/src/dropdown-menu", () => {
  const passthrough = ({ children }: { children?: ReactNode }) => children;
  return {
    DropdownMenu: passthrough,
    DropdownMenuContent: passthrough,
    DropdownMenuGroup: passthrough,
    DropdownMenuItem: ({
      children,
      onClick,
    }: {
      children?: ReactNode;
      onClick?: () => Promise<void>;
    }) => {
      if (onClick) accountMenuActions.push(onClick);
      return children;
    },
    DropdownMenuLabel: passthrough,
    DropdownMenuSeparator: () => null,
    DropdownMenuTrigger: passthrough,
  };
});

describe("Franceschini Email UI", () => {
  it("shows the new brand without a beta badge and preserves navigation", () => {
    const html = renderToStaticMarkup(
      createElement(SidebarProvider, null, createElement(AppSidebar)),
    );

    expect(html).toContain("Franceschini");
    expect(html).toContain("Email");
    expect(html).not.toMatch(/useSend|Beta/);
    for (const href of ["/dashboard", "/emails", "/domains"]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).not.toContain('href="/admin"');
    expect(html).not.toContain('href="/contacts"');
    expect(html).not.toContain('href="/campaigns"');
    expect(html).not.toContain('href="/templates"');
    expect(html).not.toContain("Marketing");
    expect(html).not.toContain('href="/settings/admin"');
    expect(html.match(/href="\/settings"/g) ?? []).toHaveLength(1);
  });

  it("keeps settings, theme, and sign-out in the account menu without Team or Usage", () => {
    const html = renderToStaticMarkup(
      createElement(
        SidebarProvider,
        null,
        createElement(NavUser, {
          user: { name: "Test User", email: "test@example.com" },
        }),
      ),
    );

    expect(html).toContain('href="/settings"');
    expect(html).not.toContain('href="/settings/team"');
    expect(html).toContain("Theme");
    expect(html).toContain('aria-label="Use system theme"');
    expect(html).toContain("Log out");
    expect(html).not.toContain("Usage");
  });

  it.each([true, false])(
    "closes navigation destinations only on mobile (isMobile=%s)",
    (isMobile) => {
      mobileState.isMobile = isMobile;
      mobileState.setOpenMobile.mockClear();
      navigationActions.length = 0;
      renderToStaticMarkup(
        createElement(SidebarProvider, null, createElement(AppSidebar)),
      );

      expect(navigationActions.map(({ href }) => href)).toEqual([
        "/dashboard",
        "/dashboard",
        "/emails",
        "/suppressions",
        "/domains",
        "/webhooks",
        "/dev-settings",
        "/docs",
        "/settings",
      ]);
      for (const { onClick } of navigationActions) {
        expect(onClick).toBeDefined();
        onClick?.();
      }
      expect(mobileState.setOpenMobile).toHaveBeenCalledTimes(
        isMobile ? navigationActions.length : 0,
      );
      if (isMobile) {
        expect(mobileState.setOpenMobile).toHaveBeenCalledWith(false);
      }
      mobileState.isMobile = false;
    },
  );

  it("provides an always-accessible sidebar trigger and a single main landmark", () => {
    const html = renderToStaticMarkup(
      createElement(
        DashboardLayout,
        null,
        createElement("p", null, "Page content"),
      ),
    );

    expect(html.match(/<main\b/g)).toHaveLength(1);
    expect(html).toContain('href="#main-content"');
    expect(html).toContain('id="main-content"');
    expect(html).toContain("Toggle Sidebar");
    expect(html).toContain("Analytics");
    expect(html).toContain("Page content");
    expect(html).not.toContain("Change theme (current:");
  });

  it("signs out directly to login instead of returning to the protected dashboard", async () => {
    accountMenuActions.length = 0;
    renderToStaticMarkup(
      createElement(
        SidebarProvider,
        null,
        createElement(NavUser, {
          user: { name: "Test User", email: "test@example.com" },
        }),
      ),
    );

    expect(accountMenuActions).toHaveLength(1);
    await accountMenuActions[0]?.();

    expect(signOut).toHaveBeenCalledExactlyOnceWith({ callbackUrl: "/login" });
  });

  it("renders a personal GitHub-only login without signup", () => {
    const providers = [
      {
        id: "github",
        name: "GitHub",
        type: "oauth" as const,
        signinUrl: "/api/auth/signin/github",
        callbackUrl: "/api/auth/callback/github",
      },
      {
        id: "email",
        name: "Email",
        type: "email" as const,
        signinUrl: "/api/auth/signin/email",
        callbackUrl: "/api/auth/callback/email",
      },
    ];
    const login = renderToStaticMarkup(createElement(LoginPage, { providers }));

    expect(login).toContain("Franceschini Email");
    expect(login).toContain("Private access with GitHub");
    expect(login).toContain("Continue with GitHub");
    expect(login).not.toContain("Change theme (current:");
    expect(login).not.toContain("<input");
    expect(login).not.toContain("<form");
    expect(login).not.toMatch(
      /Email address|one-time-code|continue with email|create|sign up|already have an account|\/signup/i,
    );
    expect(login).not.toMatch(/useSend|w-\[350px\]/);
  });
  it("shows an explicit error when GitHub sign-in is not configured", () => {
    const html = renderToStaticMarkup(
      createElement(LoginPage, { providers: [] }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("GitHub sign-in is not configured");
  });

  it("labels all three theme choices", () => {
    const html = renderToStaticMarkup(createElement(ThemeSwitcher));
    for (const theme of ["system", "light", "dark"]) {
      expect(html).toContain(`aria-label="Use ${theme} theme"`);
    }
    expect(html.match(/class="[^"]*h-6 w-6[^"]*"/g)).toHaveLength(3);
    expect(html.match(/class="[^"]*h-4 w-4[^"]*"/g)).toHaveLength(4);
  });
});
