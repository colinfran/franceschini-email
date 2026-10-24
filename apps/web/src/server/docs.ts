import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { cache } from "react";
import { z } from "zod";
import { isDocSlug } from "~/lib/docs";

const groupSchema = z.object({
  group: z.string(),
  pages: z.array(z.string()),
});
const navigationSchema = z.object({
  navigation: z.object({
    tabs: z.array(z.object({ tab: z.string(), groups: z.array(groupSchema) })),
  }),
});
const frontmatterSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  openapi: z.string().optional(),
});

export function getDocsRoot() {
  const candidates = [
    path.resolve(process.cwd(), "../docs"),
    path.resolve(process.cwd(), "apps/docs"),
  ];
  const root = candidates.find((candidate) =>
    existsSync(path.join(candidate, "docs.json")),
  );
  if (!root) {
    throw new Error(
      "Documentation content is missing. Package apps/docs with the web application.",
    );
  }
  return root;
}

export function isMissingDoc(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export const getDocsNavigation = cache(async () => {
  const source = await readFile(path.join(getDocsRoot(), "docs.json"), "utf8");
  return navigationSchema.parse(JSON.parse(source)).navigation.tabs;
});

export const getDoc = cache(async (slug: string) => {
  const parts = slug.split("/");
  if (!isDocSlug(parts)) {
    return null;
  }
  let source: string;
  try {
    source = await readFile(
      path.join(getDocsRoot(), ...parts) + ".mdx",
      "utf8",
    );
  } catch (error) {
    if (isMissingDoc(error)) return null;
    throw error;
  }
  const parsed = matter(source);
  const frontmatter = frontmatterSchema.parse(parsed.data);
  const title =
    frontmatter.title ??
    parts
      .at(-1)!
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  return { ...frontmatter, title, content: parsed.content };
});
