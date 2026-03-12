## Deferred Items

### Pre-existing Build Error (discovered during 02-03)

**File:** src/components/panels/VesselPanel.tsx:105
**Error:** Type error - 'unknown' is not assignable to type 'ReactNode'
**Cause:** JSX comment syntax issue with sanctions section type narrowing
**Impact:** Blocks production builds but doesn't affect development
**Recommendation:** Fix in separate commit or during 02-02 review

