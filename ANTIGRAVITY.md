# KYB Platform - Project Context for AI Assistant

## Project Overview
Build a KYB (Know Your Business) platform for a Mexican customs agency that determines if a Mexican legal entity (persona moral) is safe, requires review, or is high-risk for foreign trade operations.

**Time constraint**: 48 hours
**Target**: Deploy to Vercel with a public URL

## Tech Stack (MANDATORY)
- **Runtime**: Node.js 20+ with TypeScript (strict mode)
- **Framework**: Next.js 16+ with App Router
- **Database**: PostgreSQL via Supabase (free tier)
- **ORM**: Prisma 7.x
- **Styling**: Tailwind CSS + Shadcn/ui
- **Validation**: Zod
- **Testing**: Vitest
- **Deployment**: Vercel (monorepo, single URL)
- **AI**: OpenAI GPT-4o mini for document extraction (MANDATORY per requirements)

## Code Conventions
- All code, variables, functions, files, and comments in **ENGLISH**
- TypeScript strict mode enabled
- Deterministic logic only (NO Math.random, NO Date.now() in scoring)
- Every business rule must be unit tested
- API responses format: `{ success: boolean, data?: any, error?: string }`
- Use functional programming over classes when possible
- Pure functions for business logic (easier to test)

## Critical Business Rules

### Risk Score (DETERMINISTIC - MOST IMPORTANT)
Same inputs = same output ALWAYS. This is the core of the platform.

**Scoring factors (additive):**
- +50: Found in SAT list 69-B CFF (`list_69_b` - EFOS, presumably non-existent operations)
- +40: Found in SAT list 69-B Bis CFF (`list_69_b_bis` - EDOS, definitive)
- +30: Found in SAT list 69 CFF (`list_69_not_located` - taxpayers not located at fiscal address)
- +30: Material discrepancy between documents (RFC, legal name, legal representative)
- +25: Tax status certificate (`tax_status_certificate`) not from current month
- +25: RFC found in CSD revoked list (`csd_revoked` - risk signal, unspecified cause, may include Art. 49-Bis but not confirmed)
- +20: Any expired document
- +15: Per missing required document
- +20: Incomplete legal representative, shareholders, or controlling party data
- +10: SAT lists not reviewed in last 90 days
- -5: All documents valid and up-to-date (bonus)

**Classification:**
- score < 30 → `safe` (operable)
- 30 ≤ score < 70 → `review_required` (manual review needed)
- score ≥ 70 → `high_risk` (blocked, cannot approve)

**Important**: Article 49-Bis CFF does NOT have a consolidated public dataset. We use CSD revoked list as a risk signal, but explicitly mark Art. 49-Bis as `not_verifiable_with_current_public_sources` and recommend requesting Opinión de Cumplimiento from taxpayer.

### Required Documents (minimum)
1. `articles_of_incorporation` - Articles of incorporation (acta constitutiva)
2. `legal_representative_id` - ID of legal representative
3. `power_of_attorney` - Power of attorney (when applicable)
4. `proof_of_address` - Proof of address
5. `rfc` - Tax ID
6. `tax_status_certificate` - Tax status certificate (CSF)
7. `manifestation_under_protest` - Manifestation under protest
8. `controlling_party` - Partners/shareholders/controlling party (when exists)

### Reconciliation Rules
Compare data across documents and flag material discrepancies:
- RFC and legal name: tax_status_certificate vs articles_of_incorporation vs form
- Legal representative: power_of_attorney vs legal_representative_id vs form
- Address: tax_status_certificate vs proof_of_address vs form
- Issue dates, validity, expiration dates

Use normalized string comparison (uppercase, trim, remove accents).

### SAT Fiscal Lists (REAL DATA, NO MOCKS)

**VERIFIED URLs (July 2, 2026):**

1. **Article 69 CFF - Not Located** (`list_69_not_located`):
   - URL: `https://wu1agsprosta001.blob.core.windows.net/agsc-publicaciones/Datos_abiertos/Documents_AGR/No_localizados.csv`
   - Status: ✅ Verified working

2. **Article 69-B CFF - EFOS** (`list_69_b`):
   - URL: `https://wu1agsprosta001.blob.core.windows.net/agsc-publicaciones/Datos_abiertos/Documents_AGAFF/Listado_completo_69-B.csv`
   - Status: ✅ Verified working

3. **Article 69-B Bis CFF - EDOS** (`list_69_b_bis`):
   - URL: `https://wu1agsprosta001.blob.core.windows.net/agsc-publicaciones/Datos_abiertos/Documents_AGGC/Listado_69_B_Bis_Completo.csv`
   - Status: ✅ Verified working

4. **CSD Revoked** (`csd_revoked`):
   - URL: `https://wu1agsprosta001.blob.core.windows.net/agsc-publicaciones/Datos_abiertos/Documents_AGR/CSDsinefectos.csv`
   - Status: ✅ Verified working
   - Legal basis: Art. 69 CFF / Art. 17-H and 17-H Bis CFF
   - Does NOT confirm Art. 49-Bis specifically

5. **Article 49-Bis CFF** (`article_49_bis`):
   - Status: ❌ No consolidated public dataset available
   - Requires: DOF searcher monitoring and/or Compliance Opinion per RFC
   - Recommendation: Request Opinión de Cumplimiento from taxpayer

**Open data portal**: https://www.sat.gob.mx/minisitio/DatosAbiertos/contribuyentes_publicados.html

Each check MUST store: source URL, timestamp, RFC searched, result, reference to the specific list.

**Strategy**: Download CSV files from Azure Blob Storage, cache in database (24h TTL), query locally.

### Status Transitions
- `draft` → `pending_review` → `approved` | `rejected` | `needs_update`
- Auto-transition to `needs_update` when:
  - Any document expires
  - Tax status certificate is not from current month
  - SAT lists not reviewed in 90+ days
  - Client reports changes

### Audit Log
Every action must be logged: who, what, when, before/after state (JSON snapshots).

### Blocking Rules
When score is `high_risk`, the system MUST block approval. No manual override without compliance officer role.

## Project Structure (Vercel Monorepo)
```
kyb-platform/
├── ANTIGRAVITY.md
├── ARCHITECTURE.md
── PROGRESS.md
├── transcript.jsonl
├── README.md
├── vercel.json
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
├── .env.example
├── .gitignore
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── file/[id]/page.tsx
│   │   └── api/
│   │       ├── files/
│   │       ├── documents/
│   │       ├── sat-check/
│   │       └── score/
│   ├── lib/
│   │   ├── scorer.ts
│   │   ├── reconciler.ts
│   │   ├── sat-client.ts
│   │   ├── document-validator.ts
│   │   ├── audit.ts
│   │   ├── prisma.ts
│   │   └── utils/
│   │       ├── rfc-validator.ts
│   │       └── string-normalizer.ts
│   ├── components/
│   │   ├── ui/
│   │   ├── RiskScoreCard.tsx
│   │   ├── DocumentList.tsx
│   │   ├── SATCheckResult.tsx
│   │   └── AuditLog.tsx
│   └── types/
│       ├── file.types.ts
│       ├── document.types.ts
│       ├── scoring.types.ts
│       ├── sat.types.ts
│       └── audit.types.ts
└── tests/
    ├── scorer.test.ts
    ├── reconciler.test.ts
    └── sat-client.test.ts
```

## Deliverables Checklist
- [ ] Public URL deployed on Vercel
- [ ] Public GitHub repository
- [ ] transcript.jsonl with Antigravity CLI conversation
- [ ] Deterministic, explainable, testable risk score
- [ ] Real SAT fiscal lists (no mocks)
- [ ] Document reconciliation with discrepancy detection
- [ ] Vigency tracking with auto status transitions
- [ ] Audit log for all actions
- [ ] Unit tests for scoring logic
- [ ] Clear explanation of risk factors in UI

## DO NOT
- ❌ Use mocks for SAT lists
- ❌ Hardcode RFCs or test data in production code
- ❌ Put API keys in code (use .env)
- ❌ Make scoring non-deterministic
- ❌ Skip unit tests for scoring
- ❌ Use Express.js (use Next.js API routes)
- ❌ Use classes for business logic (use pure functions)
- ❌ Skip the audit log
- ❌ Allow manual override of high_risk blocking
- ❌ Mix Spanish and English in code (ALL English)
- ❌ Pretend CSD revoked list is Art. 49-Bis (be honest about limitations)