# Plan solve times

Measured with `npm run measure:plan` (since S09) or in the browser on the demo data. Target: ≤ 6 s
at 1×. Add a row when a session changes the model or measures again.

| Session | Model change | 1× | 1.3× | 2× | Notes |
| --- | --- | --: | --: | --: | --- |
| S04 | First LP ([ADR 0003](decisions/0003-planning-engine.md)) | ~65 ms | | | 10 products, ~2.3k columns |
| S05 | Storage pools, weekly trucks ([ADR 0005](decisions/0005-storage-pools-and-weekly-trucks.md)) | 30–90 ms | | | ~4.9k columns, ~2.7k rows |
| S06 | ~20-product demo | ~120 ms | | | dev build |
| S07 | Line-clear MILP + warm start ([ADR 0007](decisions/0007-line-clear-milp-and-warm-start.md)) | 6.0 s | | | 2,444 binaries, ~1,040 large clears |
| S08 | Campaigns across weeks ([ADR 0008](decisions/0008-campaigns-across-weeks.md)) | | 14 s | | |
| S09 | Fair share + time budgets ([ADR 0009](decisions/0009-fair-share-unmet-demand.md)) | 6.0 s | 6.4 s | 10.1 s | without budgets: 11.9 s at 1.3×, 31.6 s at 2× |
| S10 | Max campaign length, cap lifted in warm start ([ADR 0010](decisions/0010-max-campaign-length.md)) | 6.0 s | | 13.1 s | 625 / 601 large clears; capped: 19.6 s at 2× |
