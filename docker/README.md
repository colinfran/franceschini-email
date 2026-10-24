# Docker Setup for useSend

The following guide will walk you through setting up useSend using Docker. You can choose between a production setup using Docker Compose or a standalone container.

## Prerequisites

Before you begin, ensure that you have the following installed:

- Docker
- Docker Compose (if using the Docker Compose setup)
- Node.js 20.19 or newer (Prisma requires at least v20.19 in the build image)

## Option 1: Production Docker Compose Setup

This setup includes PostgreSQL and the useSend application. Background jobs are stored in PostgreSQL.

The app shares one pg-boss runtime per Node.js process, including Next.js
instrumentation and route bundles. Queue workers use PostgreSQL LISTEN/NOTIFY for
immediate wakeups, with a five-second polling backstop for delayed/retried jobs
and missed notifications. A logged notification failure falls back to
two-second polling. Direct PostgreSQL connections support notifications;
transaction-pooled PgBouncer connections do not.

Each queue uses one polling loop and processes a batch concurrently, up to its
configured worker concurrency. Full batches are drained without a polling delay;
successful and failed jobs are acknowledged independently so a failed job does
not cause successful jobs to be retried. Contacts, campaigns, and marketing
delivery have been removed from this installation, including their UI, APIs,
and workers. There is no campaign scheduler or idle campaign tick traffic.
Transactional delivery uses the full configured SES send rate, without a
marketing quota split. Transactional batch sending and scheduled emails remain
available. Existing contact/campaign tables, records, and historical job rows
are left intact; the retired queues are not consumed.
These changes require an app image rebuild and recreation, not a schema migration.

Templates, the visual editor, template rendering, and image-upload endpoints
have also been removed. Send a nonempty subject and HTML or text directly, for
both single and batch sends. `templateId`, `variables`, and other unknown send
fields are rejected. Inline base64 attachments do not use object storage.
MinIO/S3 is no longer required and is absent from the repository's Compose
files. System notification emails (such as invitations and domain status) are
still rendered in code and do not require MinIO.

1. Use this fork's [production Compose file](./prod/compose.yml), not the upstream file, and build the customized image as described below.
2. Navigate to the directory containing the `compose.yml` file.
3. Create a `.env` file in the same directory. Copy the contents of `.env.selfhost.example`
4. Run the following command to start the containers:

```
docker-compose --env-file ./.env up -d
```

This will start the PostgreSQL database and the useSend application containers.

5. Access the useSend application by visiting `http://localhost:3000` in your web browser.

## Option 2: Standalone Docker Container

If you prefer to host the application on your container provider of choice,
build this fork's customized image. Upstream DockerHub/GitHub images do not
include these feature removals. Provide your own database and SMTP host.

1. Build this fork's image:

```
docker build -f docker/Dockerfile -t franceschini-email-local:transactional-only .
```

2. Run the Docker container, providing the necessary environment variables for your database and SMTP host:

```
docker run -d \
  -p 3000:3000 \
  -e NEXTAUTH_URL="<your-nextauth-url>" \
  -e NEXTAUTH_SECRET="<your-nextauth-secret>" \
  -e DATABASE_URL="<your-database-url>" \
  -e AWS_ACCESS_KEY_ID="<your-aws-access-key-id>" \
  -e AWS_SECRET_ACCESS_KEY="<your-aws-secret-access-key>" \
  -e AWS_DEFAULT_REGION="<your-aws-region>" \
  -e GITHUB_ID="<your-github-client-id>" \
  -e GITHUB_SECRET="<your-github-client-secret>" \
  franceschini-email-local:transactional-only
```

Replace the placeholders with your actual database and AWS details.

1. Access the useSend application by visiting the URL you provided in the `NEXTAUTH_URL` environment variable in your web browser.

## Success

You have now successfully set up useSend using Docker. You can start sending emails efficiently. If you encounter any issues or have further questions, please refer to the official useSend documentation or seek assistance from the community.

## Building and using a customized image

From the repository root, build a local image (no environment file or secrets are
needed at build time):

```powershell
docker build -f docker\Dockerfile -t franceschini-email-local:transactional-only .
```

In your existing deployment's Compose file, change only the `usesend` service's
`image` to `franceschini-email-local:transactional-only`. Keep its environment, networks, volumes,
and other services unchanged. Then, from that deployment directory, recreate
only the application:

```powershell
docker compose up -d --no-deps --pull never usesend
```

**Important:** The image's existing startup script runs Prisma migrations before
starting the server. Back up your database and explicitly approve those migrations
before recreating the application. These feature removals need no schema changes.
Do not use `docker compose down -v`; that can delete your stored data.

To roll back, restore the previous image name and run the same recreate command.

If your database schema is already up to date and you explicitly want to skip
startup migrations, add this command override to the `usesend` service before
recreating it:

```yaml
command: ["node", "apps/web/server.js"]
```

Remove the override when a future upgrade requires migrations, after reviewing
and approving those database changes.

## Retiring an existing MinIO service

After deploying the template-free app, remove MinIO from your deployment's
Compose services and remove any MinIO dependency and `S3_COMPATIBLE_*` app
environment entries. Remove `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` requirements
from the Compose configuration too. Check for images hosted by MinIO in
previously sent emails before stopping it; those URLs will no longer resolve.

Stop and remove only the retired MinIO container, preserving its named data
volume. Do not run `down -v`, volume pruning, or delete its stored files.
Keep that volume for archival or rollback purposes; historical template
database rows are likewise left intact. Future `compose up` commands should
start only PostgreSQL, the app, and any SMTP service you use.

## Adding DNS records through Vercel

1. Make sure your domain uses Vercel nameservers, not just Vercel hosting.
2. As a team admin, open **Settings > DNS**. Create a
   [Vercel API token](https://vercel.com/account/tokens) with access to your domains.
   Enter it along with the Vercel team ID from Vercel team settings if your domains
   belong to a team, then click **Save connection**.
3. Open **Domains**, select a domain, then click **Add records to Vercel**. The
   team's saved connection is reused; no credentials are requested for each domain.
4. Click **Add DNS records** to confirm. useSend adds the displayed MX, DKIM and SPF records,
   plus the recommended DMARC record when absent. Records are added to the parent
   registrable domain's DNS zone; sending subdomains keep their relative record
   names, and DMARC remains at the parent domain, matching the manual setup.
5. Allow time for DNS propagation, then click **Verify domain**.

The token is sent to your useSend server over the current connection and saved
encrypted with AES-256-GCM in the existing application settings table, separately
for each useSend team. It is never returned to the browser or included in tRPC
request logs. Only team admins can save, replace, or remove credentials; team
members can use the saved connection for their team's domains. Leave the token
field blank when editing settings to keep the saved token. Use **Remove connection**
to delete it. Use HTTPS for a remotely accessible deployment.

Encryption uses `NEXTAUTH_SECRET`, which must remain stable across deployments.
After changing it, remove and save the Vercel connection again. No Vercel
environment variables or database schema migrations are needed.
Matching records are skipped, existing DMARC policies are preserved, and
conflicting records are reported before any writes. Unrelated records are left
untouched. If Vercel rejects a request partway through, some records may already
exist; retrying skips those records and continues.
