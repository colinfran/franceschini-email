"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { Button } from "@usesend/ui/src/button";
import { Badge } from "@usesend/ui/src/badge";

export const SettingsNavButton: React.FC<{
  href: string;
  children: React.ReactNode;
  comingSoon?: boolean;
  matchNested?: boolean;
}> = ({ href, children, comingSoon, matchNested }) => {
  const pathname = usePathname();

  const isActive =
    pathname === href || (!!matchNested && pathname.startsWith(`${href}/`));

  if (comingSoon) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" disabled>
          {children}
        </Button>
        <Badge variant="secondary">Soon</Badge>
      </div>
    );
  }

  return (
    <Button asChild variant={isActive ? "secondary" : "ghost"} size="sm">
      <Link href={href} aria-current={isActive ? "page" : undefined}>
        {children}
      </Link>
    </Button>
  );
};
