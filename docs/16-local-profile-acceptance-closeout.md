# EncuentrosOES — LOCAL Profile Acceptance Closeout

**Date:** 24 August 2026  
**Functional authority:** `FOUNDATION.md` 2.1.0  
**Operational profile:** `LOCAL`  
**Final status:** **ACCEPTED — 100% of the selected LOCAL profile**

## Acceptance meaning

The 100% declaration applies only to the scope currently selected by `FOUNDATION.md` for the LOCAL profile. It means that the required competitive workflows are implemented, persisted in PostgreSQL, covered by automated tests, exercised manually in the local environment, integrated in `main`, and protected by CI gates.

It does not claim that every conceivable sports-management feature exists. Features explicitly outside Foundation remain outside this percentage.

## Accepted functional path

```text
LOCAL ACCEPTANCE
├── [x] Application startup
├── [x] Authentication and authority model
├── [x] Catalog and competition setup
├── [x] Participants
├── [x] Format configuration
├── [x] Rule configuration and freeze
├── [x] Official draw preparation
├── [x] Deterministic draw execution
├── [x] Official draw confirmation
├── [x] SCORE_BASED results
├── [x] SET_BASED support
├── [x] Penalty shootout resolution
├── [x] Administrative resolutions
│   ├── [x] NO_SHOW_A
│   ├── [x] NO_SHOW_B
│   ├── [x] NO_SHOW_BOTH
│   ├── [x] WITHDRAWN_A / WITHDRAWN_B
│   └── [x] ABANDONED_A / ABANDONED_B
├── [x] Group standings
├── [x] Qualification proposal/confirmation
├── [x] Knockout continuity
├── [x] Re-draw per knockout round
├── [x] BYE handling
├── [x] Final detection
├── [x] Champion proposal/confirmation
├── [x] Competition finalization
├── [x] Competitive history
├── [x] Public evidence/publication
├── [x] Restart persistence
├── [x] Backup + SHA-256
└── [x] Isolated restore drill
```

## MATCH-RESOLUTION-001 evidence

PR #76 integrated the final regression set for match resolution. Automated coverage proves that penalties remain separate from regulation score, administrative outcomes do not invent goals/sets, `NO_SHOW_BOTH` persists without a winner, and knockout continuity does not reintroduce excluded participants or create an invalid one-participant round.

The complete manual LOCAL exercise on 24 August 2026 traversed the competitive lifecycle through finalization and champion confirmation. The observed `422` from `next-round/prepare` after the final was classified as expected behavior because no further round may be created once champion finalization is the next valid transition.

## LOCAL-RUNTIME-001 evidence

The local acceptance exercise exposed the `pg` deprecation warning:

`Calling client.query() when the client is already executing a query`

The correction was completed in three layers:

1. catalog/list competition projections were moved away from relational fan-out;
2. competition history and results workspace were rebuilt from flat reads in PR #77;
3. residual concurrent Prisma reads in `PrismaChampionFinalizationService` were serialized in PR #78.

PR #78 also added `packages/database/test/champion-runtime-warning.integration.test.ts`. The regression listens to `process.on('warning')` while exercising `PrismaChampionFinalizationService.find()` with the real PostgreSQL/Prisma adapter and fails if the concurrent-query deprecation message returns.

CI #477 passed this regression together with the complete required pipeline.

## CI acceptance gate

CI #477 on head `4ca892d57abf5a75e3f0f4ea1e3854e230e0d20f` passed:

- formatting;
- Architecture Gate;
- lint;
- typecheck;
- Prisma validate;
- migrations;
- PostgreSQL integration;
- runtime warning regression;
- REAL-STORAGE-DRILL local guards;
- verifiable backup;
- isolated restore;
- external roundtrip contract test;
- coverage;
- build;
- visual E2E Chromium.

PR #78 was merged into `main` as `aaa67f8a06c5151bb2d3668cc3f2eee554c22862`.

## Engineering hardening

Engineering Hardening remains **100% complete for its defined audit scope** with Engineering Health **88/100** and residual debt classified as **LOW / CONTROLLED**. This score is not presented as perfect code; it records the audited maintainability baseline after the completed refactor program.

There are no open P0 or P1 engineering findings in the accepted LOCAL profile.

## Excluded scope

The following remain deliberately outside the selected Foundation scope and therefore do not reduce LOCAL completion:

- match calendar/scheduling;
- venues/courts;
- referee management;
- individual athlete statistics;
- payments;
- sanctions;
- general event-management modules;
- real external-storage drill while the EXTERNAL profile is not selected.

Adding any of these requires an explicit Foundation scope change and creates a new delivery target rather than reopening this acceptance retroactively.

## Final declaration

```text
ENCUENTROSOES — LOCAL PROFILE
├── [x] Functional scope accepted
├── [x] Persistence accepted
├── [x] Recovery accepted
├── [x] Security/authority accepted
├── [x] Engineering hardening accepted
├── [x] Runtime regression protected
├── [x] CI gates green
├── [x] main integrated
└── [x] 100%
```
