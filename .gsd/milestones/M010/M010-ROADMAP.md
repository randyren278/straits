# M010: 

## Vision
Fix data inconsistencies between fleet and map views, remove accumulated dead code, and add baseline UI resilience — error boundaries, loading states, responsive layout, and accessibility attributes.

## Slice Overview
| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | Anomalies Staleness Filter & Data Parity | medium | — | ✅ | Fleet tab only shows anomalies for vessels visible on the map. curl comparison confirms anomaly IMOs ⊆ vessel IMOs. |
| S02 | Dead Code Removal | low | — | ✅ | Build passes clean. No orphaned components or dead modules. ~400 lines removed. |
| S03 | Error Boundaries & Loading States | low | — | ✅ | A simulated component crash shows fallback UI instead of white screen. Route transitions show loading spinner. |
| S04 | Responsive Layout & Accessibility | medium | S03 | ⬜ | Dashboard renders usably at 768px and 375px. All buttons have accessible names. |
