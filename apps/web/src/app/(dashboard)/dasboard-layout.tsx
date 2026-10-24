"use client";

import { AppSidebar } from "~/components/AppSideBar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@usesend/ui/src/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@usesend/ui/src/breadcrumb";
import { Separator } from "@usesend/ui/src/separator";
import { UpgradeModal } from "~/components/payments/UpgradeModal";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const sectionTitles: Record<string, string> = {
  dashboard: "Analytics",
  emails: "Emails",
  suppressions: "Suppressions",
  domains: "Domains",
  webhooks: "Webhooks",
  "dev-settings": "Developer settings",
  settings: "Settings",
  admin: "Admin",
  payments: "Payments",
};

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLDivElement>(null);
  const sectionTitle =
    sectionTitles[pathname.split("/")[1] ?? ""] ?? "Workspace";

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollLeft = 0;
    }

    window.scrollTo({ left: 0 });
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
  }, [pathname]);

  return (
    <div className="min-h-svh bg-sidebar">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-background p-3 text-sm focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset
          id="main-content"
          tabIndex={-1}
          className="min-w-0 md:border"
        >
          <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b px-4 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage>{sectionTitle}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <div
            ref={mainRef}
            className="flex-1 overflow-x-hidden p-4 md:p-6 lg:p-8"
          >
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <UpgradeModal />
    </div>
  );
}
