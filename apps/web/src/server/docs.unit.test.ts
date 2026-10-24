import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import { describe, expect, it } from "vitest";
import { getDoc, getDocsNavigation, getDocsRoot } from "./docs";
import { mdxComponents } from "~/app/docs/mdx-components";
import { GET } from "~/app/docs/assets/[...path]/route";

async function getSlugs(
  directory = getDocsRoot(),
  prefix = "",
): Promise<string[]> {
  const files = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(
    files.map(async (file) => {
      const slug = prefix + file.name;
      if (file.isDirectory())
        return getSlugs(path.join(directory, file.name), `${slug}/`);
      return file.name.endsWith(".mdx") ? [slug.slice(0, -4)] : [];
    }),
  );
  return groups.flat();
}

describe("in-app documentation", () => {
  it("loads every page listed in navigation", async () => {
    const tabs = await getDocsNavigation();
    for (const tab of tabs) {
      for (const group of tab.groups) {
        for (const slug of group.pages)
          expect(await getDoc(slug), slug).not.toBeNull();
      }
    }
  });

  it("renders all MDX pages with local links, headings, tables, and images", async () => {
    const slugs = await getSlugs();
    expect(slugs).toEqual(
      expect.arrayContaining([
        "introduction",
        "get-started/nodejs",
        "guides/webhooks",
        "api-reference/emails/send-email",
      ]),
    );
    expect(
      slugs.filter((slug) =>
        /^(api-reference\/(?:contacts|campaigns)\/|guides\/(?:double-opt-in|campaign-personalization)$)/.test(
          slug,
        ),
      ),
    ).toEqual([]);
    for (const slug of slugs) {
      const doc = await getDoc(slug);
      expect(doc, slug).not.toBeNull();
      const { content } = await compileMDX({
        source: doc!.content,
        components: mdxComponents,
        options: {
          mdxOptions: {
            remarkPlugins: [remarkGfm],
            rehypePlugins: [rehypeSlug],
          },
        },
      });
      const html = renderToStaticMarkup(content);
      expect(html, slug).not.toMatch(
        /href="https:\/\/(?:docs|app)\.usesend\.com/,
      );
      for (const [, href] of html.matchAll(
        /href="\/docs\/(?!assets\/)([^"#?]+)"/g,
      )) {
        expect(await getDoc(href!), `${slug}: ${href}`).not.toBeNull();
      }
      for (const [, asset] of html.matchAll(/src="\/docs\/assets\/([^"]+)"/g)) {
        expect(
          (await stat(path.join(getDocsRoot(), asset!))).isFile(),
          `${slug}: ${asset}`,
        ).toBe(true);
      }
      if (slug === "guides/webhooks") {
        expect(html).toContain('<h2 id="signature-verification">');
        expect(html).toContain("<table>");
        expect(html).toContain("<details");
      }
    }
  }, 30000);

  it("returns not found for unknown pages and traversal attempts", async () => {
    expect(await getDoc("guides/missing")).toBeNull();
    expect(await getDoc("../web/package")).toBeNull();
    expect(await getDoc("guides\\webhooks")).toBeNull();
  });

  it("serves images but not arbitrary repository files", async () => {
    const image = await GET(
      new Request("http://localhost/docs/assets/images/aws/key-1.png"),
      {
        params: Promise.resolve({ path: ["images", "aws", "key-1.png"] }),
      },
    );
    expect(image.status).toBe(200);
    expect(image.headers.get("Content-Type")).toBe("image/png");
    expect((await image.arrayBuffer()).byteLength).toBeGreaterThan(0);
    for (const parts of [
      ["..", ".env"],
      ["docs.json"],
      ["images", "..", "docs.json"],
      ["images", "missing.png"],
    ]) {
      const response = await GET(
        new Request("http://localhost/docs/assets/test"),
        {
          params: Promise.resolve({ path: parts }),
        },
      );
      expect(response.status).toBe(404);
    }
  });
});
