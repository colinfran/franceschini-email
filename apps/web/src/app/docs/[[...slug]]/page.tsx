import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import { getDoc } from "~/server/docs";
import { mdxComponents } from "../mdx-components";
import { ApiOperation } from "../api-operation";

type PageProps = { params: Promise<{ slug?: string[] }> };

export const runtime = "nodejs";

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug = ["introduction"] } = await params;
  const doc = await getDoc(slug.join("/"));
  return {
    title: doc
      ? `${doc.title} | Franceschini Email Docs`
      : "Documentation not found",
    description: doc?.description,
  };
}

export default async function DocPage({ params }: PageProps) {
  const { slug = ["introduction"] } = await params;
  const doc = await getDoc(slug.join("/"));
  if (!doc) notFound();

  const { content } = await compileMDX({
    source: doc.content,
    components: mdxComponents,
    options: {
      mdxOptions: { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug] },
    },
  });
  return (
    <article className="docs-content">
      <h1>{doc.title}</h1>
      {doc.description ? (
        <p className="text-lg text-muted-foreground">{doc.description}</p>
      ) : null}
      {content}
      {doc.openapi ? <ApiOperation operation={doc.openapi} /> : null}
    </article>
  );
}
