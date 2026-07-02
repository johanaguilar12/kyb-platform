# Project Progress

## Current Phase: Phase 5 - API Endpoints

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

### Phase 5: API Endpoints 🔄
- [ ] /api/files (CRUD)
- [ ] /api/documents (CRUD + AI extraction)
- [ ] /api/sat-check (SAT queries)
- [ ] /api/score (calculate score)
- [ ] Implement audit logging

### Phase 6: Frontend UI ⏳
- [ ] Dashboard page
- [ ] New file form
- [ ] File detail page
- [ ] Risk score visualization
- [ ] Document list
- [ ] SAT check results
- [ ] Audit log view

### Phase 7: AI Integration ⏳
- [ ] OpenAI integration for PDF extraction
- [ ] Structured outputs
- [ ] Error handling

### Phase 8: Deployment ⏳
- [ ] Push to GitHub
- [ ] Deploy to Vercel
- [ ] Configure Supabase
- [ ] Run migrations
- [ ] Test production environment

### Phase 9: Final Polish ⏳
- [ ] Complete transcript.jsonl
- [ ] Final README.md
- [ ] Verify all deliverables
- [ ] Test end-to-end flow

## Current Status

**Tests**: 32 passing (16 scorer + 7 SAT + 9 reconciler)
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

## Notes
- Focus on Phase 4 (reconciliation) next
- Tests are mandatory for all business logic
- SAT integration uses real data
- Audit log is required for compliance
- All code must remain in English