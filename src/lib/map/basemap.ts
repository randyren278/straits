/**
 * Basemap cartography rules.
 *
 * CARTO dark-matter is a general-purpose street map. Straits is a maritime
 * picture, so at operational zooms the inland road network, buildings and
 * points of interest are noise. Layers whose ids match this pattern are
 * hidden after the style loads; water, coastline, boundaries, country and
 * major-place labels are left alone.
 *
 * Layer ids observed in dark-matter-gl-style: `road_*`, `roadname_*`,
 * `tunnel_*`, `bridge_*`, `building`, `poi_*`, `housenumber`, `aeroway_*`,
 * `railway_*`, `place_hamlet`, `place_village`, `place_suburb`.
 */
export const BASEMAP_CLUTTER_PATTERN =
  /^(road|roadname|tunnel|bridge|building|poi|housenumber|aeroway|railway|transit|place_(hamlet|village|suburb|neighbourhood|locality|isolated_dwelling))/;
