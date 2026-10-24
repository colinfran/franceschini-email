# Create T3 App

## Web UI

The web app is branded as **Franceschini Email**. It uses the shared shadcn/ui
components in `packages/ui`, with app-specific neutral light/dark tokens in
`src/app/globals.css`. The default theme follows the system preference; users can
override it from the account menu. Semantic status and chart colors
remain distinct for readability.
Shared inputs and buttons follow shadcn's control sizing: 36px inputs and default
buttons, 32px small buttons, 40px large buttons, and 36px square icon buttons.
Buttons with a direct SVG icon use reduced horizontal padding. Explicit
per-control size and padding classes remain supported.

The dashboard uses the shadcn inset sidebar pattern, with a collapsible desktop
sidebar and a mobile sheet. The account menu includes Settings, theme
selection, and sign-out; usage remains available from Settings when enabled.
Sign-out redirects directly to `/login`, without returning to a protected page
or displaying a session-required error.
Authentication, onboarding, and subscription pages use the same component system.
Dialogs use the shadcn layout: a dimmed overlay, a single border, compact corner
radius, and standard header/body/footer spacing. Domains uses a searchable,
horizontally scrollable table with DNS status and tracking controls.
Documentation and email message contents retain their existing styling.

This installation is transactional-only. Contacts, contact books, campaigns,
double opt-in, campaign unsubscribe routes, templates, the visual editor, and
their APIs/services/workers are removed. Transactional batch/scheduled sending, domain
management, suppression handling, analytics, and webhooks remain available.
The full SES send rate is used for transactional delivery. Legacy database
tables and records remain unchanged; this removal requires no migration.
Send requests require a subject and HTML or text; retired `templateId` and
`variables` fields are rejected along with other unknown request fields.
Attachments are supplied as inline base64 content. MinIO/S3 image uploads and
their configuration are removed; transactional sending needs no object storage.

The shadcn CLI configuration lives in `apps/web/components.json` and
`packages/ui/components.json`. Add shared components from `packages/ui` using
`pnpm exec shadcn add <component>`, and reuse the existing `lib/utils` helper and
individual Radix packages to match the component library's conventions.

This is a [T3 Stack](https://create.t3.gg/) project bootstrapped with `create-t3-app`.

## What's next? How do I make an app with this?

We try to keep this project as simple as possible, so you can start with just the scaffolding we set up for you, and add additional things later when they become necessary.

If you are not familiar with the different technologies used in this project, please refer to the respective docs. If you still are in the wind, please join our [Discord](https://t3.gg/discord) and ask for help.

- [Next.js](https://nextjs.org)
- [NextAuth.js](https://next-auth.js.org)
- [Prisma](https://prisma.io)
- [Drizzle](https://orm.drizzle.team)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

## Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), take a look at the following resources:

- [Documentation](https://create.t3.gg/)
- [Learn the T3 Stack](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available) — Check out these awesome tutorials

You can check out the [create-t3-app GitHub repository](https://github.com/t3-oss/create-t3-app) — your feedback and contributions are welcome!

## How do I deploy this?

Follow our deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify) and [Docker](https://create.t3.gg/en/deployment/docker) for more information.
