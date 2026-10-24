const DOCS_HOSTS = new Set(["docs.usesend.com", "docs.unsend.com"]);
const APP_HOSTS = new Set(["app.usesend.com", "app.unsend.com"]);
const DOCS_PATH =
  /^\/(?:introduction|get-started|api-reference|guides|self-hosting|updates|changelog)(?:\/|$|[?#])/;

export function docsHref(href: string): string {
  if (href.startsWith("https://") || href.startsWith("http://")) {
    const url = new URL(href);
    if (DOCS_HOSTS.has(url.hostname)) {
      return `/docs${url.pathname === "/" ? "" : url.pathname}${url.search}${url.hash}`;
    }
    if (APP_HOSTS.has(url.hostname)) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
    return href;
  }
  if (/^\/(?:images|logo)\//.test(href)) {
    return `/docs/assets${href}`;
  }
  return DOCS_PATH.test(href) ? `/docs${href}` : href;
}

export function isDocSlug(slug: string[]): boolean {
  return (
    slug.length > 0 && slug.every((part) => /^[a-z0-9][a-z0-9-]*$/.test(part))
  );
}
