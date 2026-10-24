import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { docsHref } from "~/lib/docs";

type ContentProps = { children?: ReactNode };
type TitledProps = ContentProps & { title?: string };

function DocLink({ href = "", children, ...props }: ComponentProps<"a">) {
  return (
    <Link href={docsHref(href)} {...props}>
      {children}
    </Link>
  );
}

function Callout({ children, title }: TitledProps) {
  return (
    <aside className="my-5 rounded-lg border border-primary/30 bg-muted p-4">
      {title ? <p className="font-semibold">{title}</p> : null}
      {children}
    </aside>
  );
}

export const mdxComponents = {
  a: DocLink,
  // Documentation screenshots have arbitrary sizes and may be external.
  img: ({ src = "", alt = "", ...props }: ComponentProps<"img">) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      src={typeof src === "string" ? docsHref(src) : src}
      alt={alt}
      loading="lazy"
    />
  ),
  CardGroup: ({ children }: ContentProps) => (
    <div className="my-6 grid gap-4 sm:grid-cols-2">{children}</div>
  ),
  Card: ({
    title,
    href,
    children,
  }: TitledProps & { href: string; icon?: string }) => (
    <DocLink
      href={href}
      className="block rounded-lg border p-5 no-underline hover:bg-muted"
    >
      <span className="font-semibold">{title}</span>
      <div className="text-sm text-muted-foreground">{children}</div>
    </DocLink>
  ),
  Steps: ({ children }: ContentProps) => (
    <div className="my-6 space-y-6 border-l pl-6">{children}</div>
  ),
  Step: ({ title, children }: TitledProps) => (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  ),
  CodeGroup: ({ children }: ContentProps) => (
    <div className="space-y-3">{children}</div>
  ),
  Frame: ({ children }: ContentProps) => (
    <figure className="my-6 rounded-lg border p-3">{children}</figure>
  ),
  AccordionGroup: ({ children }: ContentProps) => (
    <div className="my-6 divide-y rounded-lg border px-4">{children}</div>
  ),
  Accordion: ({ title, children }: TitledProps) => (
    <details className="py-3">
      <summary className="cursor-pointer font-medium">{title}</summary>
      {children}
    </details>
  ),
  Note: Callout,
  Info: Callout,
  Tip: Callout,
  Warning: Callout,
  Update: ({
    label,
    description,
    children,
  }: ContentProps & { label: string; description?: string }) => (
    <section className="my-10 border-b pb-6">
      <h2>{label}</h2>
      <p>{description}</p>
      {children}
    </section>
  ),
};
