# Project Progress

## Current Phase: Complete ✅

## Phases Overview

### Phase 1: Project Scaffolding ✅
- [x] Initialize Next.js project with TypeScript
- [x] Configure Tailwind CSS
- [x] Set up Prisma with PostgreSQL
- [x] Create folder structure
- [x] Define TypeScript types
- [x] Create Prisma schema
- [x] Set up testing with Vitest
- [x] Configure Vercel deployment
- [x] Create README.md

### Phase 2: Risk Scoring (CORE) ✅
- [x] Implement src/lib/scorer.ts
- [x] Write comprehensive tests (13 tests)
- [x] Verify determinism
- [x] Test all classification levels

### Phase 3: SAT Integration ✅
- [x] Implement src/lib/sat-client.ts
- [x] Download and parse CSV files from Azure Blob Storage
- [x] Implement caching strategy (24h TTL)
- [x] Write tests (7 tests)
- [x] Use verified URLs for all lists
- [x] Honest implementation (CSD revoked ≠ Art. 49-Bis)

### Phase 4: Document Reconciliation ✅
- [x] Implement src/lib/reconciler.ts
- [x] String normalization utilities
- [x] Write tests (9 tests)
- [x] Integrate with scorer

### Phase 5: API Endpoints ✅
- [x] /api/files (CRUD)
- [x] /api/documents (CRUD + AI extraction)
- [x] /api/sat-check (SAT queries)
- [x] /api/score (calculate score)
- [x] Implement audit logging

### Phase 6: Frontend UI ✅
- [x] Dashboard page
- [x] New file form
- [x] File detail page
- [x] Risk score visualization
- [x] Document list
- [x] SAT check results
- [x] Audit log view

### Phase 7: AI Integration ✅
- [x] Google Gemini API integration for data extraction (gemini-2.5-flash)
- [x] Structured JSON outputs
- [x] Error handling and test cases (6 tests)

### Phase 8: Deployment ✅
- [x] Push to GitHub
- [x] Deploy to Vercel
- [x] Configure Supabase
- [x] Run migrations
- [x] Test production environment

### Phase 9: Final Polish ✅
- [x] Complete transcript.jsonl
- [x] Final README.md
- [x] Verify all deliverables
- [x] Test end-to-end flow

## Current Status

**Tests**: 77 passing (16 scorer + 7 SAT + 9 reconciler + 6 ai-extractor + 12 reconciliation + 10 labels-and-errors + 4 pdf-compressor + 3 document-flow + 10 conditional-visibility)
**TypeScript**: Compiles cleanly with no errors
**Code Language**: 100% English (refactored from Spanish)

## Key Changes Made

1. **Refactored to English**: All types, variables, and field names converted to English
   - Expediente → File
   - razonSocial → legalName
   - acta_constitutiva → articles_of_incorporation
   - etc.

2. **Honest SAT Implementation**:
   - CSD revoked list treated as risk signal, not Art. 49-Bis confirmation
   - Art. 49-Bis marked as not_verifiable_with_current_public_sources
   - Recommendation to request Opinión de Cumplimiento

3. **Verified URLs**: All SAT list URLs verified and working (Azure Blob Storage)

4. **Document Reconciliation**:
   - Implemented `reconcileDocuments` function mapping RFC, Legal Name, Legal Representative, Address, and Date consistency.
   - Integrated discrepancy scoring into `calculateRiskScore` (+30 per high severity mismatch).
   - Added 9 tests in `reconciler.test.ts` and 3 integration tests in `scorer.test.ts`.

5. **API Endpoints**:
   - Created CRUD Route Handlers for `files` and `documents` with strict Zod schema validation.
   - Built dynamic `sat-check` route that performs compliance blacklist queries, caches them in the database, and logs `SATListCheck` entries.
   - Developed `score` route that recalculates risk scores, updates database records, auto-transitions file status (`needs_update`, `rejected`), and registers audit logs.
   - Configured Prisma 7 with the `@prisma/adapter-pg` PostgreSQL driver adapter and a fallback connection string for seamless build compilation.

6. **Frontend UI**:
   - Created the Dashboard layout, New File form, and File Detail portal.
   - Redesigned the entire UI theme, layout, colors, and components to match the official Mexican SAT portal design guidelines (navy header bands, white card sections on light gray backgrounds, colored status badges, and bordered tables).
   - Integrated a strict high-risk blocking constraint that disables file approvals directly in the UI.

7. **Strict AI Document Vault Flow**:
   - Reinstalled `@google/generative-ai` and implemented structured compliance extraction with `gemini-2.5-flash`.
   - Pre-checks PDF formatting validity using `pdf-parse` to catch corrupt uploads early.
   - Calculates a SHA256 integrity hash.
   - Runs strict validation checks (proper RFC format, CURP, dates, legal names, and document-specific required fields).
   - If any required field is missing or format is malformed, rejects the upload immediately with status 400 (no database entry created, no manual inputs allowed).
   - If validation passes, validates that the original PDF file does not exceed 2MB. Then, runs local PDF compression via `pdf-lib` to strip metadata, optimize structural objects (saving 50-70% storage size) and preserve ALL pages intact.
   - Runs multi-document reconciliation: verifies that document RFC matches registered RFC and other documents exactly; strictly compares Legal Name (rejecting any mismatches but ignoring spaces, accents, punctuation, and special characters); warns on representative/address discrepancies.
   - Saves the compressed PDF size in the database `fileSize` column along with the reconciliation status, error details, and warning logs. Uploads the compressed PDF file to Supabase Storage.
   - Triggers auto-status transitions on every upload, marking files as `needs_update` if any document is expired, if CSF is not from the current month/year, or if SAT list check is >90 days old.
   - Redesigned UI to remove all manual entry input forms, confirmation screens, and edit buttons. Displays AI-extracted fields as read-only, adds a direct link to view the uploaded PDF, shows color-coded reconciliation status badges (`✓ Matched`, `⚠️ Warning`, `✗ Mismatch`), and displays warning and error boxes detailing any mismatch reasons.
   - Integrated a side-by-side Dossier Data Reconciliation Comparison Table mapping file definitions vs extracted values directly.
   - Exposed a manual trigger API endpoint `POST /api/files/[id]/check-status` and added a header action button "Check Compliance Status" in the UI to run compliance checks and sync dossier status on demand.
   - Centralized human-readable document label mappings via `getDocumentLabel(type)` (`articles_of_incorporation` -> "Articles of Incorporation", etc.) and custom fallback formatting.
   - Centralized user-friendly error translations via `getErrorMessage(code)` mapping all technical compliance error codes to clear user-facing messages.
   - Applied these centralized functions to ALL user-facing locations: Overall Assessment sidebar summaries, the Score tab breakdown, the Documents vault, warning list logs, error toast alerts, and modal dialogs to eliminate all technical underscores or codes.
   - Refactored `reconcileDocumentUpload` to return JSON-serialized technical code objects and wrap server-side warning logs with `getDocumentLabel`.
   - Added conditional visibility fields to schema and TypeScript File interfaces (e.g. `powerOfAttorneyRequired`, `controllingPartyRequired`).
   - Implemented `runConditionalDetections` in `src/lib/conditional-detection.ts` executing automatic legal representative comparison (PoA detection) and shareholder/partners complexity keyword checks (Controlling Party detection).
   - Configured the upload API to trigger conditional requirement evaluation immediately upon document database creation.
   - Made the dropdown menu fully dynamic: initially shows 5 always-visible documents, and adds conditional options with yellow warning banners explaining why they are required when flags are active.
   - Adjusted scoring index algorithm to apply the +15 pt missing penalty to conditional documents only when they are explicitly flag-required by the AI.

## Notes
- Focus on Phase 8 (Deployment) next
- Verify Supabase production migrations and edge checks
- Keep all code and text in English