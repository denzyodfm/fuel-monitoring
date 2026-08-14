# Fuel Monitoring System

A full-stack, database-driven fuel, fleet, insurance, chargeback and data-quality application built from the supplied 2026 workbook. Semi-monthly detail sheets are the transaction source of truth; monthly, usage-summary and graph sheets are reconciliation sources and are never duplicated into the ledger.

## Stack and architecture

- Next.js App Router, strict TypeScript, server actions and responsive Tailwind UI
- MySQL 8 with Prisma and precise `Decimal` columns for money, price and liters
- Signed HTTP-only session cookies, bcrypt passwords and server-side role checks
- SheetJS parser with Excel serial-date conversion, source lineage, SHA-256 workbook checksums and row fingerprints
- Normalized companies, operators/aliases, vehicles/aliases, purposes, odometer history, insurance, AP links, imports and immutable audit logs
- Vitest domain/import classification tests and Playwright authentication coverage

Every organization-scoped query includes `organizationId`. Calculated dashboard totals remain queries, not denormalized state. Times are presented in Asia/Manila and money in PHP (`en-PH`).

## Prerequisites

- Node.js 22 and npm
- Docker Desktop / Docker Compose
- The source `.xlsx` workbook (the default path is documented in `.env.example`)

## Local setup

```powershell
Copy-Item .env.example .env
docker compose up -d db
npm install
npm run db:generate
npm run db:migrate -- --name initial
npm run db:seed
npm run dev
```

Open http://localhost:3000. Development login: `admin@fuel.local` / `FuelAdmin2026!`. Change this password immediately outside local development and set a random 32+ character `AUTH_SECRET`.

The UI import wizard is at `/imports`. First run it in dry-run mode, review ambiguous/rejected rows, add aliases, then import. Exact workbook reimports are blocked by checksum; detail-row duplicates are blocked by the organization-scoped fingerprint.

The CLI performs deterministic analysis/classification without writing records:

```powershell
npm run import:excel -- "C:\Users\Dennis\Downloads\Fuel Monitoring 2026 FROM BERN 8.12.26.xlsx"
```

Confirmed workbook assumptions: transaction headers are at row 6 in semi-monthly sheets; columns A–K contain date through requested amount; formulas and totals are recalculated; blank/template/summary rows are rejected; monthly sheets are reconciliation-only; missing canonical company mappings prevent a row from being committed rather than inventing data.

## Quality commands

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## Production and Docker

Set production secrets and `DATABASE_URL`, then run `docker compose up --build`. Apply checked-in migrations with `npm run db:deploy`; never use `migrate dev` in production. Uploaded policy documents go through `UPLOAD_DIR`, which is intentionally isolated for later object-storage replacement.

## Backup and restore

```powershell
docker compose exec db mysqldump -uroot -proot_password fuel_monitoring > fuel-monitoring.sql
Get-Content fuel-monitoring.sql | docker compose exec -T db mysql -uroot -proot_password fuel_monitoring
```

Back up the configured uploads directory alongside the SQL dump. Test restores periodically and protect backups as sensitive operational data.

## Security and workflow

Administrator has full access; Encoder creates/edits and submits; Approver approves/rejects/locks; Viewer is read-only. Mutations validate server-side, check organization ownership and append audit/approval records. Amounts are computed from liters × unit price. Odometer and financial overrides require reasons in the domain model.

## Known assumptions

- The supplied workbook has inconsistent aliases; only canonical companies are auto-resolved initially. Operators, vehicles and purposes retain originals and require explicit alias mapping when uncertain.
- Local uploads are suitable for development; production should plug the storage abstraction into private object storage with malware scanning.
- Browser E2E tests require a migrated/seeded MySQL instance and the development server.
