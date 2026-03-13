---
phase: quick
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - src/proxy.ts
  - src/app/page.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Visiting / redirects directly to /dashboard (no login page)"
    - "No middleware intercepts requests and redirects to /login"
    - "The dashboard and analytics pages load without a session cookie"
  artifacts:
    - path: "src/proxy.ts"
      provides: "Passthrough proxy — no auth enforcement"
    - path: "src/app/page.tsx"
      provides: "Root redirect to /dashboard"
  key_links:
    - from: "src/proxy.ts"
      to: "Next.js middleware"
      via: "Would be imported in middleware.ts — file does not exist, proxy is inert"
---

<objective>
Remove authentication enforcement so the app loads directly without a password prompt.

Purpose: The proxy.ts auth guard was built but never wired as Next.js middleware (no middleware.ts exists at the root), so technically the pages are already unprotected. This plan ensures no auth enforcement can accidentally block access — it strips the JWT check from proxy.ts so it becomes a no-op passthrough, and confirms the root page.tsx correctly redirects to /dashboard.

Output: proxy.ts with auth logic removed, root page redirecting to /dashboard, no login required to access any page.
</objective>

<execution_context>
@/Users/randyren/.claude/get-shit-done/workflows/execute-plan.md
@/Users/randyren/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Strip auth from proxy.ts and confirm no middleware.ts exists</name>
  <files>src/proxy.ts</files>
  <action>
    The proxy.ts currently checks JWT cookies and redirects to /login. No middleware.ts exists at the project root so this code is never invoked — but to ensure it can never accidentally be activated, replace the body of the proxy function with a simple passthrough that always calls NextResponse.next().

    Rewrite src/proxy.ts to:
    - Remove the jose import and JWT verification logic
    - Remove the cookie check and redirect-to-login logic
    - Keep the exported `proxy` function signature and the `config` export (so it remains valid if ever imported)
    - The function body should simply return `NextResponse.next()`

    Do NOT create a middleware.ts file. The goal is to ensure that if anyone ever wires the proxy in, it passes all requests through rather than enforcing auth.

    Also verify no middleware.ts exists at the root: `ls /Users/randyren/Developer/tanker-tracker/middleware.ts 2>/dev/null || echo "confirmed: no middleware.ts"`.
  </action>
  <verify>
    grep -n "jwtVerify\|redirect.*login\|session.*cookie" /Users/randyren/Developer/tanker-tracker/src/proxy.ts | wc -l
    # Should output 0 (no auth logic remaining)
  </verify>
  <done>proxy.ts contains only a passthrough NextResponse.next() — zero JWT/session/redirect-to-login logic. No middleware.ts exists at project root.</done>
</task>

<task type="auto">
  <name>Task 2: Confirm root page redirects to /dashboard (not /login)</name>
  <files>src/app/page.tsx</files>
  <action>
    Read src/app/page.tsx. It should already contain `redirect('/dashboard')`. Confirm this is the case.

    If it redirects to /login instead, change it to redirect to /dashboard.

    If it already redirects to /dashboard, no change is needed — just confirm.

    After confirming, run the TypeScript build check to ensure no type errors were introduced by the proxy.ts change:
    `cd /Users/randyren/Developer/tanker-tracker && npx tsc --noEmit 2>&1 | head -20`
  </action>
  <verify>
    grep "redirect" /Users/randyren/Developer/tanker-tracker/src/app/page.tsx
    # Should show redirect('/dashboard') — not redirect('/login')
  </verify>
  <done>Root page redirects to /dashboard. TypeScript build passes with no new errors from auth removal.</done>
</task>

</tasks>

<verification>
After both tasks:
1. Confirm no middleware.ts at project root: `ls /Users/randyren/Developer/tanker-tracker/middleware.ts 2>/dev/null || echo "no middleware"`
2. Confirm proxy.ts has no auth logic: `grep -c "jwtVerify\|redirect.*login" /Users/randyren/Developer/tanker-tracker/src/proxy.ts` → outputs 0
3. Confirm root redirect: `grep redirect /Users/randyren/Developer/tanker-tracker/src/app/page.tsx` → shows /dashboard
4. Build check: `cd /Users/randyren/Developer/tanker-tracker && npx tsc --noEmit` → exits clean (or only pre-existing errors)
</verification>

<success_criteria>
- Visiting the app loads /dashboard directly — no password prompt, no redirect to /login
- proxy.ts is a passthrough (auth logic removed)
- No middleware.ts exists that could intercept requests
- TypeScript build has no new errors
</success_criteria>

<output>
After completion, create `.planning/quick/2-remove-auth-so-the-page-just-loads-no-pa/2-SUMMARY.md` with what was changed and confirmed.
</output>
