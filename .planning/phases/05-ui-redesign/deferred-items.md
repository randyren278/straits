# Deferred Items — Phase 05 UI Redesign

## Out-of-scope discoveries during 05-03 execution

### 1. login/page.tsx still uses navy hex colors
- `bg-[#1a1a2e]` on min-h-screen wrapper
- `bg-[#16162a] rounded-lg` on login card
- Not in 05-03 scope (plan only covers components/ui/, components/charts/, analytics/page.tsx)
- Recommend: add to a follow-up quick task or 05-04 plan

### 2. VesselMap.tsx uses `#3b82f6` (blue) for vessel marker color
- File: `src/components/map/VesselMap.tsx`
- The blue is used as a vessel marker color (non-sanctioned, non-anomaly vessels)
- Not in 05-03 scope
- May be intentional (map markers use different color logic than UI)
- Recommend: review during map component pass if terminal aesthetic extends to map markers
