# Encounter Caseboard (canary)

The canary Investigations page links to `/investigations/encounters`. The index
shows the latest eight recorded vessel rendezvous from the past seven days and
offers vessel search. Opening a lead selects that exact ledger event; selecting
another partner updates the case URL so the same event can be shared.

The caseboard presents the subject vessel and up to 20 most recent ledger
events. An exact event link remains openable even after it drops out of that
list. For the selected event, it reads at most 250 actual AIS fixes per
identity branch (IMO-tagged and current-MMSI candidate for each side) in a
window around the recorded first and last proximity times. A visible notice
appears if a branch contains more retained rows than the plot shows. The
window stops at the current time and reads no farther back than seven days.
The two colored fix sets use a north-up coordinate plot. Solid segments are
IMO-tagged fixes. Dashed segments and hollow markers are provisional
current-MMSI candidates, which may belong to a different hull historically.
Segments stop at gaps longer than 45 minutes; isolated fixes remain visible as points. A shared time
rail selects the nearest retained fix within 30 minutes for each vessel. A
paired separation appears only when both IMO-tagged fixes are within 15 minutes
of the selected time and no more than 10 minutes apart. Candidate MMSI fixes
never contribute to a vessel-pair distance. The distance is calculated from
those two retained coordinates and is separate from the ledger's minimum.

The detector's ledger records sustained proximity, not a verified ship-to-ship
transfer. An event is a lead for inspection. Its centroid is not plotted as an
encounter location because it comes from later latest-position data. Archived
sanctions flags refer to the data at archival time. A fix tagged with the IMO
is distinguished from a null-IMO fix matched by the vessel's *current* MMSI;
that linkage cannot prove historical hull identity. Raw fixes may be pruned while a ledger event
remains. Missing positions or an empty ledger do not prove that no meeting
occurred. The current-map link shows live context, not this historical case.

Both new API routes and pages return 404 outside the enabled canary. The canary
role has SELECT on the source tables but no public-table write permission. The
case endpoint accepts only a seven-digit IMO and a bounded event identifier,
uses parameterized queries, and reads only one selected pair. The recent-leads
endpoint returns at most eight rows and caches responses for 60 seconds. No
new database tables or migrations are required.

## Acceptance path

1. Open `/investigations/encounters` on canary; confirm dated leads appear or
   an explicit empty/unavailable state is shown.
2. Open one lead. Confirm the URL includes its event ID, both vessel tracks
   show UTC fixes and identity basis, and the plot has a path only between
   nearby observations. Check that provisional MMSI candidates are dashed and
   hollow rather than part of a confirmed vessel track.
3. Select a nearby fix in either time lane. Confirm both lanes and the plot
   move to that UTC moment. Check that a paired distance appears only when two
   IMO-tagged fixes are near in time.
4. Check a vessel with no ledger events and an older event without retained
   tracks. Verify both states explain the evidence limit without a verdict.
5. Run the targeted tests, lint, typecheck, production and canary builds, the
   canary role verifier, and a desktop/phone browser journey. After a canary
   push, repeat the journey against the deployed revision and check the
   production gate still returns 404 for both paths.
