# Darkroom

A studio workspace for photographers: projects, clients, galleries, invoices, contracts, and email in one place.

## Run locally

Requires Node.js 22.16 or newer.

```bash
npm install
npm run dev
```

Open the exact URL printed by `npm run dev`. Darkroom starts at `http://127.0.0.1:4173` when available and selects another port if it is occupied. Create an account and choose sample records, an empty studio, or records from an earlier browser version.

Accounts, studios, and records live in `data/darkroom.sqlite`. One account can create and switch between multiple studios. Each studio has separate records, members, settings, and email delivery. Existing installations are migrated on startup. Previous browser records can be imported while creating an account.

## General and project workspaces

Use the **Workspace** selector in the sidebar to switch between the general studio and a project. General holds studio-wide email and reusable email or contract templates. Each project holds its galleries, invoices, contracts, and email history. Create a project with its client name and optional email address; that address fills in new project messages and documents.

The general Invoices, Contracts, and Galleries tabs ask you to choose a project instead of showing every file. In the email composer, only PDFs belonging to the selected project can be attached, and the recipient must match the email on each attached document. General messages cannot include project PDFs.

On startup, older records are linked to a project when the match is clear. Ambiguous records appear in **Needs sorting** so you can place them in the right project before sending.

## Galleries and client sharing

Open a project's **Galleries** tab to create a gallery for its client. Upload JPEG, PNG, or WebP photos (up to 20 MB each and 150 per gallery), preview them, and remove photos. The photo count reflects uploaded images; older sample galleries start empty.

Use **Share via email** from a gallery to compose a message to that gallery's client email. Sending creates a private, seven-day gallery link and includes it in the email. Clients can open the link without a Darkroom account, view photos, and download them. Anyone with the link can access it until it expires or you choose **Disable all links** in the gallery. Resending a gallery email creates a fresh link. Gallery selection in the composer is limited to the chosen project, and the server checks the gallery, project, and recipient before sending.

Photos and share records are stored in SQLite and included in database backups. **Export studio data** exports record metadata, not photo files. Set `PUBLIC_BASE_URL` to your public HTTPS app origin (for example, `https://studio.example.com`) when sending gallery links from a deployed server. Localhost links work for local development but cannot be opened by clients on other devices.

## Studio settings and team

Open **Settings** to edit the studio name, contact information, currency, invoice defaults, SMTP connection, members, and roles. Create an invitation link for an email address, then share that link with the person. Invitations expire after 7 days and can be revoked. Invited users can create an account with that email or sign in to an existing account. Invitation links are created in the app; Darkroom does not automatically email them.

- **Owner:** full studio access; owner role cannot be removed or changed.
- **Admin:** manage studio settings, members, and records.
- **Editor:** create and edit records, and send email.
- **Viewer:** read records and export studio data.

SMTP passwords are encrypted at rest using `data/studio-secrets.key`. The key must stay with the database for stored SMTP credentials to work. Enter SMTP details separately for each studio in Settings. Darkroom requires TLS for SMTP ports other than 465 and uses implicit TLS on port 465.

## Contracts, invoices, and email

Create or edit a contract with the rich text editor. Headings, bold, italic, bullets, and numbered lists are saved with the document and rendered in its PDF. Review your own contract text before using it with clients.

Invoices contain multiple line items, quantities, rates, discounts, tax, paid amount, balance due, payment terms, and notes. The PDF uses the current studio name and business profile. Existing invoices remain readable and can be edited into the detailed format.

Open an invoice or contract and choose **Download PDF**, or choose **Email PDF** to attach it to a message. PDFs are generated from the current record when downloaded or sent. The email composer has a rich text editor, preview, draft saving, and project-scoped attachments. Open a sent email to view the message and download the exact PDF copy that was sent. **Resend email** uses the saved recipient, subject, message, and PDF copies with the studio’s current SMTP sender; **Reuse as draft** starts a new editable message. An email or contract can be saved as a general template. Sending requires valid SMTP settings for that studio.

Sent PDF copies are stored in the SQLite database with the email history, so they are included in database backups. Messages sent before this feature was added may lack downloadable PDF copies and cannot be resent exactly if they had attachments; reuse them as drafts instead.

## Backups and export

Darkroom creates a SQLite backup at startup and every 24 hours while the server runs. It keeps the latest 14 dated backups in `backups/`. Run `npm run backup` to create one immediately. When present, the SMTP encryption key is copied to the backup directory as `studio-secrets.key`. Copy the backups off the machine for disaster recovery. In Settings, **Export studio data** downloads the current studio's records as JSON. The export excludes account credentials and SMTP settings.

## Production

```bash
npm run build
npm run start
```

Set `HOST`, `PORT`, `DB_PATH`, and `BACKUP_DIR` as needed. Serve the app over HTTPS when reachable from other devices. If a trusted HTTPS reverse proxy terminates TLS, set `TRUST_PROXY=true` so Darkroom sets secure session cookies. Keep database and backup directories private and persistent. SQLite is intended for one app server.

Account recovery, email verification, online payments, a full client account portal, and legally reviewed contract templates are not implemented yet.
