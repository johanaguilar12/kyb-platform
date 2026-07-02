# KYB Platform - Project Context for AI Assistant

## Project Overview
Build a KYB (Know Your Business) platform for a Mexican customs agency that determines if a Mexican legal entity (persona moral) is safe, requires review, or is high-risk for foreign trade operations.

**Target**: Deploy to Vercel with a public URL

## Tech Stack (MANDATORY)
- **Runtime**: Node.js 20+ with TypeScript (strict mode)
- **Framework**: Next.js 14+ with App Router
- **Database**: PostgreSQL via Supabase (free tier)
- **ORM**: Prisma
- **Styling**: Tailwind CSS + Shadcn/ui
- **Validation**: Zod
- **Testing**: Vitest
- **Deployment**: Vercel (monorepo, single URL)
- **AI**: OpenAI GPT-4o mini for document extraction (MANDATORY per requirements)

## 📋 Code Conventions
- All code, variables, functions, files, and comments in **ENGLISH**
- TypeScript strict mode enabled
- Deterministic logic only (NO Math.random, NO timestamps in scoring)
- Every business rule must be unit tested
- API responses format: `{ success: boolean, data?: any, error?: string }`
- Use functional programming over classes when possible
- Pure functions for business logic (easier to test)

## Critical Business Rules

### Risk Score (DETERMINISTIC - MOST IMPORTANT)
Same inputs = same output ALWAYS. This is the core of the platform.

**Scoring factors (additive):**
- +50: Found in SAT list 69-B CFF (presumably non-existent operations)
- +40: Found in SAT list 69-B Bis CFF (definitive)
- +30: Found in SAT list 69 CFF (non-compliant taxpayers)
- +30: Material discrepancy between documents (RFC, legal rep, address)
- +25: CSF (Constancia de Situación Fiscal) not from current month
- +20: Any expired document
- +15: Per missing required document
- +20: Incomplete legal representative, shareholders, or controlling party data
- +10: SAT lists not reviewed in last 90 days
- -5: All documents valid and up-to-date (bonus)

**Classification:**
- score < 30 → `safe` (operable)
- 30 ≤ score < 70 → `review_required` (manual review needed)
- score ≥ 70 → `high_risk` (blocked, cannot approve)

### Required Documents (minimum)
1. `articles_of_incorporation` - Articles of incorporation (acta constitutiva)
2. `legal_representative_id` - ID of legal representative
3. `power_of_attorney` - Power of attorney (when applicable)
4. `proof_of_address` - Proof of address
5. `rfc` - Tax ID
6. `csf` - Constancia de Situación Fiscal (tax status certificate)
7. `manifestation_under_protest` - Manifestation under protest
8. `controlling_party` - Partners/shareholders/controlling party (when exists)

### Reconciliation Rules
Compare data across documents and flag material discrepancies:
- RFC and company name: CSF vs Acta vs Form
- Legal representative: Power of attorney vs ID vs Form
- Address: CSF vs Proof of address vs Form
- Issue dates, validity, expiration dates

Use normalized string comparison (uppercase, trim, remove accents).

### SAT Fiscal Lists (REAL DATA, NO MOCKS)
- Article 69 CFF: https://wwwmat.sat.gob.mx/consultas/11981/consulta-la-relacion-de-contribuyentes-incumplidos
- Article 69-B CFF: https://wwwmat.sat.gob.mx/consultas/76674/consulta-la-relacion-de-contribuyentes-con-operaciones-presuntamente-inexistentes
- Article 69-B Bis CFF: (definitive list from SAT open data)
- Article 49 Bis CFF: (subcontracting from SAT open data)
- Open data portal: https://www.sat.gob.mx/minisitio/DatosAbiertos/contribuyentes_publicados.html

Each check MUST store: source URL, timestamp, RFC searched, result, reference to the specific list.

**Strategy**: Download CSV files from SAT open data, cache in database, query locally.

### Status Transitions
- `draft` → `pending_review` → `approved` | `rejected` | `needs_update`
- Auto-transition to `needs_update` when:
  - Any document expires
  - CSF is not from current month
  - SAT lists not reviewed in 90+ days
  - Client reports changes

### Audit Log
Every action must be logged: who, what, when, before/after state (JSON snapshots).

### Blocking Rules
When score is `high_risk`, the system MUST block approval. No manual override without compliance officer role.

##  Project Structure (Vercel Monorepo)