---
phase: quick-10
plan: 10
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/ui/ChokepointWidget.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Chokepoint header row maintains fixed height regardless of vessel data"
    - "Clicking a chokepoint widget opens a dropdown vessel list below the header"
    - "Clicking the same widget again closes the dropdown"
    - "Only one dropdown is open at a time"
    - "Clicking a vessel in the dropdown flies the map and opens the identity panel"
  artifacts:
    - path: "src/components/ui/ChokepointWidget.tsx"
      provides: "Collapsible chokepoint widgets with absolute-positioned dropdown"
  key_links:
    - from: "ChokepointWidget header button"
      to: "dropdown vessel list"
      via: "expandedId state toggle"
      pattern: "expandedId === cp.id"
---

<objective>
Convert the chokepoint vessel list from always-visible inline content to a collapsible dropdown that appears below the header row without affecting its height.

Purpose: The header currently grows taller when vessels are present, consuming vertical space and visually cluttering the header area. A click-to-expand dropdown keeps the header compact and gives the user control over when to see vessel details.
Output: Updated ChokepointWidget.tsx with per-widget open/close toggle and an absolutely positioned dropdown panel.
</objective>

<execution_context>
@/Users/randyren/.claude/get-shit-done/workflows/execute-plan.md
@/Users/randyren/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Key decisions from STATE.md affecting this work:
- Terminal panel headers use px-3 py-1.5 border-b border-amber-500/20 with amber-500 font-mono uppercase label pattern
- ChokepointWidget vessel list container is separate from the header button — header preserves onSelect (chokepoint flyTo), vessel rows call handleVesselClick (vessel flyTo + panel)
- Sharp aesthetic: --radius-* zeroes all rounded-* utilities globally
- Palette: amber-500, gray-900 backgrounds, gray-300/gray-500 text
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add collapse state and dropdown positioning to ChokepointWidget</name>
  <files>src/components/ui/ChokepointWidget.tsx</files>
  <action>
Refactor ChokepointWidget.tsx to implement collapsible vessel lists:

1. Add `expandedId` state: `const [expandedId, setExpandedId] = useState<string | null>(null)`.

2. On the outer widget `<div>` for each chokepoint, add `relative` class so the dropdown can use `absolute` positioning anchored to the widget card.

3. Change the header `<button>` onClick to toggle expanded state:
   ```tsx
   onClick={() => {
     setExpandedId(prev => prev === cp.id ? null : cp.id);
     onSelect?.(cp.bounds, cp.name);
   }}
   ```
   NOTE: Keep calling onSelect so map flyTo still fires on click.

4. Remove the inline vessel list container entirely (the `<div className="mt-1 max-h-28 overflow-y-auto border-t ...">` block that follows the button).

5. After the header button (still inside the widget's outer `<div>`), add the dropdown — only rendered when `expandedId === cp.id`:
   ```tsx
   {expandedId === cp.id && (
     <div className="absolute left-0 top-full z-50 min-w-[200px] bg-black border border-amber-500/20 border-t-0 shadow-lg">
       {(vesselMap[cp.id] ?? []).length === 0 ? (
         <p className="px-2 py-1 text-xs text-gray-600 font-mono">NO VESSELS</p>
       ) : (
         <div className="max-h-48 overflow-y-auto">
           {(vesselMap[cp.id] ?? []).map((v) => (
             <button
               key={v.mmsi}
               onClick={() => handleVesselClick(v)}
               className="w-full flex items-center gap-1.5 px-2 py-0.5 hover:bg-gray-900 text-left"
             >
               {v.hasActiveAnomaly && (
                 <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
               )}
               <span className="text-xs font-mono text-gray-200 truncate flex-1">
                 {v.name ?? v.mmsi}
               </span>
               <span className="text-xs text-gray-500 flex-shrink-0">{v.flag ?? '??'}</span>
               <span className="text-xs font-mono text-gray-600 flex-shrink-0">
                 {shipTypeLabel(v.shipType)}
               </span>
             </button>
           ))}
         </div>
       )}
     </div>
   )}
   ```

6. Add a visual indicator on the header button that the widget is expandable. After the existing text `<div>`, add a small chevron that rotates when open — use `ChevronDown` from lucide-react:
   ```tsx
   import { Anchor, ChevronDown } from 'lucide-react';
   // ...
   <ChevronDown
     className={`w-3 h-3 text-gray-600 flex-shrink-0 transition-transform ${
       expandedId === cp.id ? 'rotate-180' : ''
     }`}
   />
   ```
   Place it at the end of the button flex row.

The header row container (`<div className="flex items-start px-4 py-2 border-t ...">` in Header.tsx) must NOT be modified — only ChokepointWidget.tsx changes.
  </action>
  <verify>
    <automated>cd /Users/randyren/Developer/tanker-tracker && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>
    - TypeScript compiles without errors
    - Each chokepoint widget header button is fixed height with no vessel list visible by default
    - Clicking a widget shows the vessel dropdown positioned below the header row
    - Clicking the same widget again hides the dropdown
    - Clicking a different widget closes the previous dropdown and opens the new one
    - Chevron icon rotates 180deg when dropdown is open
  </done>
</task>

</tasks>

<verification>
After the task completes:
1. Run `npx tsc --noEmit` — must pass with no errors
2. Start dev server and confirm the chokepoint header row is uniform height whether or not vessel data is loaded
3. Click a chokepoint widget — dropdown appears below the header, not inside it
4. Click another widget — first dropdown closes, second opens
5. Click an open widget — dropdown closes
6. Click a vessel row — map flies to vessel, identity panel opens
</verification>

<success_criteria>
Header row height is constant. Vessel lists appear on-demand via click-triggered absolute dropdown. Single-widget-at-a-time behavior enforced by shared expandedId state.
</success_criteria>

<output>
After completion, create `.planning/quick/10-chokepoint-header-vessel-list-collapse-t/10-SUMMARY.md` using the summary template.
</output>
