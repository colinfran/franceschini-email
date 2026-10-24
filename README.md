# Franceschini Email

Franceschini Email is a personal email dashboard built for my own infrastructure and workflows. It is a heavily modified version of [useSend](https://github.com/usesend/usesend), an open-source email sending platform.

This is not an official useSend release and is not affiliated with or endorsed by the useSend project.

## Modifications

Compared with upstream useSend, this version:

- Redesigns the user interface.
- Uses custom GitHub App authentication restricted to my own account.
- Removes features, files, and documentation that I don't need.
- Adds changes for my personal infrastructure, such as Vercel DNS integration.

## Current scope

This installation is transactional-only:

- Send emails through the REST API, SDKs, or SMTP, including batch and scheduled
  sends, custom headers, replies, and inline base64 attachments.
- Manage domains and Vercel DNS records, API keys, suppressions, analytics, and
  email/domain webhooks.
- Read the embedded documentation from the dashboard.

Contacts, contact books, campaigns, marketing delivery, double opt-in,
campaign unsubscribe pages, and dashboard templates have been removed,
including their frontend routes and backend logic. There is no visual template
editor or image-upload API. Send a nonempty subject and HTML or text directly;
`templateId`, `variables`, and other unknown send fields are rejected.

PostgreSQL stores both application data and background jobs. Workers share one
queue runtime per process and use LISTEN/NOTIFY with a polling backstop rather
than aggressive idle polling. The full configured SES rate is available for
transactional delivery. MinIO/S3 object storage is no longer required.

Existing database tables and historical records are preserved; these removals
do not require migrations. Existing MinIO volumes can be retained for archival
purposes without running the service. See [Docker setup](./docker/README.md)
for deployment details, migration-free startup, and storage retirement.

The source is public, but I don't provide support, accept contributions, or maintain it as a general-purpose application. For a supported, general-purpose version, see [useSend](https://github.com/usesend/usesend).

## License

This project is licensed under the [GNU Affero General Public License v3.0](./LICENSE), the same license as useSend. See [NOTICE.md](./NOTICE.md) for attribution and details of included third-party components.
