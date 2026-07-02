# Architecture Details

## Layer Separation

### 1. Presentation Layer (src/app/)
- Next.js App Router
- Server Components by default (better performance)
- Client Components only when needed ('use client')
- Shadcn/ui for consistent UI components

### 2. API Layer (src/app/api/)
- Next.js Route Handlers
- Validate inputs with Zod
- Return consistent format: { success, data?, error? }
- Handle errors with try/catch

### 3. Business Logic Layer (src/lib/)
- Pure functions (no side effects)
- Testable with Vitest
- No framework dependencies
- Deterministic (same input = same output)

### 4. Data Layer (Prisma + PostgreSQL)
- PostgreSQL via Supabase
- Type-safe queries via Prisma
- Migrations versioned in prisma/migrations/

## Key Design Decisions

### Why Pure Functions for Scorer?
- Deterministic (same input = same output)
- Testable without mocking DB
- Easy to reason about
- No hidden state
- Can be called from anywhere

### Why Prisma?
- Type-safe (TypeScript integration)
- Auto-generated client
- Easy migrations
- Works great with Vercel + Supabase

### Why Serverless Functions (Next.js API Routes)?
- No server to maintain
- Auto-scaling on Vercel
- Single deployment
- Pay per use

### Why Download SAT Lists Instead of Scraping?
- Real data (not mocks)
- Fast queries (local DB)
- No scraping fragility
- Cache for 24h
- Traceable (source, timestamp, reference)

### Why Honest SAT List Implementation?
- Art. 49-Bis CFF is a verification procedure, not a public list
- CSD revoked list is a risk signal, not confirmation of Art. 49-Bis
- Being honest avoids audit issues
- Recommend Opinión de Cumplimiento for Art. 49-Bis verification

## Data Flow

1. User creates file → POST /api/files
2. User uploads document → POST /api/documents (metadata + AI extraction)
3. User triggers SAT check → POST /api/sat-check
4. System calculates score → src/lib/scorer.ts (pure function)
5. System reconciles data → src/lib/reconciler.ts (pure function)
6. User views result → GET /api/files/:id
7. Every action → audit log

## SAT Lists Strategy

### Verified Sources (Azure Blob Storage):
1. **list_69_not_located**: No_localizados.csv
2. **list_69_b**: Listado_completo_69-B.csv
3. **list_69_b_bis**: Listado_69_B_Bis_Completo.csv
4. **csd_revoked**: CSDsinefectos.csv
5. **article_49_bis**: No public dataset (manual verification required)

### Implementation:
- Download CSV files from Azure Blob Storage
- Parse and store in `sat_list_caches` table
- Update every 24h via cron or on-demand
- Query locally when checking RFC
- Store result in `sat_list_checks` table with metadata
- Return signals structure with explicit Art. 49-Bis status

## AI Integration

Use OpenAI GPT-4o mini for:
- Extract structured data from Tax Status Certificate PDF (RFC, legal name, issue date)
- Extract data from Articles of Incorporation
- Validate document content

Use Structured Outputs to get JSON responses.

## Testing Strategy

- Unit tests for all pure functions (scorer, reconciler, validators)
- Integration tests for API routes
- E2E tests for critical flows (optional if time allows)
- Coverage target: 80% for src/lib/

## Deployment

1. Push to GitHub
2. Connect repo to Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy (automatic on push to main)
5. Run migrations: `npx prisma migrate deploy`