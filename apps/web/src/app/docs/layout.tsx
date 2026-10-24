import Link from "next/link";
import type { ReactNode } from "react";
import { getDocsNavigation } from "~/server/docs";
import "./docs.css";

export default async function DocsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const tabs = await getDocsNavigation();
  return (
    <div className="min-h-screen">
      <a href="#docs-content" className="sr-only focus:not-sr-only">
        Skip to documentation
      </a>
      <header className="sticky top-0 z-10 border-b bg-background px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/docs" className="font-semibold">
            Franceschini Email{" "}
            <span className="font-normal text-muted-foreground">Docs</span>
          </Link>
          <Link
            href="/dashboard"
            className="text-sm underline underline-offset-4"
          >
            Dashboard
          </Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl md:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="border-b p-6 md:sticky md:top-[4rem] md:h-[calc(100vh-4rem)] md:overflow-y-auto md:border-b-0 md:border-r">
          <details open>
            <summary className="cursor-pointer font-semibold md:hidden">
              Documentation navigation
            </summary>
            <nav aria-label="Documentation" className="space-y-7">
              {tabs.map((tab) => (
                <section key={tab.tab}>
                  <h2 className="mb-3 font-semibold">{tab.tab}</h2>
                  {tab.groups.map((group) => (
                    <div key={group.group} className="mb-4">
                      <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {group.group}
                      </h3>
                      <ul className="space-y-1">
                        {group.pages.map((slug) => (
                          <li key={slug}>
                            <Link
                              href={`/docs/${slug}`}
                              className="block rounded px-2 py-1 text-sm hover:bg-muted"
                            >
                              {slug
                                .split("/")
                                .at(-1)
                                ?.split("-")
                                .map(
                                  (word) =>
                                    word.charAt(0).toUpperCase() +
                                    word.slice(1),
                                )
                                .join(" ")}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </section>
              ))}
            </nav>
          </details>
        </aside>
        <main id="docs-content" className="min-w-0 px-6 py-10 lg:px-12">
          {children}
        </main>
      </div>
    </div>
  );
}
