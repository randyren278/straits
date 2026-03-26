---
estimated_steps: 3
estimated_files: 5
skills_used: []
---

# T01: Build ErrorBoundary component, loading/error/layout route files, and ErrorBoundary tests

Create the reusable ErrorBoundary class component, the (protected) route group's layout.tsx, loading.tsx, and error.tsx, and a test file that verifies the ErrorBoundary catches render errors and shows fallback UI.

The ErrorBoundary must be a 'use client' class component (React 19 still requires class components for componentDidCatch). Default fallback uses Bloomberg terminal aesthetic: bg-black, text-amber-500, font-mono, uppercase tracking-widest, sharp corners, border-amber-500/20. Includes a 'RETRY' button that resets the boundary's error state.

The layout.tsx is a pass-through ({children}) needed so loading.tsx has a Suspense boundary for route transitions. loading.tsx shows a Bloomberg-styled pulse animation with 'LOADING...' text. error.tsx is the last-resort page-level error boundary receiving error and reset props.

## Inputs

- ``src/app/(protected)/dashboard/page.tsx` — reference for Bloomberg aesthetic patterns (bg-black, amber accents, font-mono, no border-radius)`
- ``tests/setup.ts` — existing test setup with happy-dom and @testing-library/jest-dom`
- ``src/components/fleet/__tests__/AnomalyTable.test.tsx` — reference for RTL test patterns including afterEach(cleanup)`

## Expected Output

- ``src/components/ui/ErrorBoundary.tsx` — reusable 'use client' class component with componentDidCatch, configurable fallback, retry button`
- ``src/components/ui/__tests__/ErrorBoundary.test.tsx` — tests: catches render error and shows fallback, retry resets boundary, renders children when no error`
- ``src/app/(protected)/layout.tsx` — pass-through layout exporting {children}`
- ``src/app/(protected)/loading.tsx` — Bloomberg-styled loading indicator with pulse animation`
- ``src/app/(protected)/error.tsx` — 'use client' page-level error boundary with error message and reset button`

## Verification

npx vitest run src/components/ui/__tests__/ErrorBoundary.test.tsx && npx tsc --noEmit
