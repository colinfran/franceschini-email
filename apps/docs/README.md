# Franceschini Email documentation

The web app serves these MDX files at `/docs/...`, including `/docs` for the introduction. No separate Mintlify server or subscription is required. Run `pnpm dev:docs` from the repository root and open `http://localhost:3000/docs`.

- Edit guide content in this directory and navigation in `docs.json`.
- Standard Markdown, GFM tables, fenced code blocks, and the existing Card, Step, callout, accordion, and changelog components are supported.
- Local screenshots are served at `/docs/assets/images/...`; source MDX can continue using `/images/...`.
- API reference pages use their `openapi` frontmatter to display the matching operation from this installation's `/api/v1/doc`. The interactive explorer remains at `/api/v1/ui`.
- Docker packages this directory alongside the web app. Rebuild and redeploy the image to publish documentation changes.

The SDK package names, API field names, and webhook headers retain useSend naming for compatibility. Dashboard and documentation links resolve to this installation, not the upstream hosted service.
