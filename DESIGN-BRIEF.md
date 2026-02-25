# Sandbars Design Brief

## Overall Mood

Calm, confident, light color scheme with shades of sand and beige. Not playful, not corporate. Serious tool energy but beautiful. Sleek and geometric design. Think: a beautifully printed nautical chart, or a high-end weather instrument -- warm, precise, inviting.

## Color Philosophy

Light base (white, sand, warm beige tones) with data as the color. UI chrome is warm and muted -- the map and data layers provide all chromatic intensity. Saturated color appears ONLY in data visualization layers (swell height, swell period, wind, quality scores). The UI itself stays in the sand/beige/white family at all times.

**Accent color:** Muted terracotta -- earthy, warm, distinctive. Used for interactive elements (active toggles, selected tabs, links, primary CTAs). Should feel natural against the sand palette, not digital. Propose a few terracotta options in the component reference sheet ranging from dusty to warm.

**Data layer color palettes** (IMPORTANT -- this replaces the existing color LUTs in the codebase):

- **Swell height:** Muted gray -> light blue -> dark blue as height increases. Calm and oceanic. The gray baseline means "nothing interesting" and the deepening blue signals intensity.
- **Swell period:** Muted gray -> light purple -> dark purple as period increases. Same visual logic as height (gray = unremarkable, color = notable) but immediately distinguishable.
- **Wind speed:** Muted gray -> teal/green. Must read clearly alongside the swell layers without visual confusion.
- **Quality score** (coastline markers): Compatible with the muted palette. Muted warm red -> sand/amber -> sage green -> deep teal for the poor -> fair -> good -> epic range. These should feel like they belong to the same design family as the rest of the UI.

## Map Treatment

Light, minimal base map -- Apple Maps is the reference for feel. The map should feel warm and continuous with the UI chrome, not like a generic Mapbox/Carto embed dropped into the page.

- **Land:** Warm sand/beige tones. Should feel like it extends from the UI background onto the map. Subtle terrain texture is fine but not required.
- **Ocean (without data layers):** Soft, desaturated blue -- slightly warm, not pure blue. Calm and inviting. This is what users see before toggling any data layers.
- **Ocean (with data layers):** The weather data layers paint over the base ocean color. Since swell height and period layers will be visually striking (blue/purple gradients), the base ocean color should be neutral enough to disappear beneath them.
- **Labels and roads:** Minimal. Muted. The map is about the ocean, not the streets. De-emphasize land features relative to default map styles.
- **Bathymetric contours** (when toggled on): Thin lines in a muted tone that's visible against both the bare ocean and data layers. Suggest a warm slate or muted blue-gray.

## Floating Controls

Floating controls on the map use a solid light panel -- sand/white background, clean edges, subtle shadow for lift. They stay light at all times (no dark mode variant for v1). The controls hover over the map content without competing with it.

No backdrop blur / frosted glass effects -- keep it clean and solid. The panels should feel like physical cards placed on top of a chart.

## Typography

Clean sans-serif. One family, minimal weight variation -- regular for body, medium for emphasis. Not three or four weights. The type should feel modern and precise but not cold.

Numbers should feel monospaced/tabular -- this is a data tool and numbers need to align cleanly in columns and forecasts. But the overall typography should be inviting, not clinical. Generous line height. The type should encourage exploration.

Start with the font **Inter** (excellent tabular figures). The font choice should reinforce "precise but approachable."

## Cards and Panels

Slightly elevated light surfaces (white or near-white) on the sand background, with subtle shadow for depth. Cards should feel like physical objects -- light, airy, gently lifted off the surface. Not boxy or heavy.

Minimal border radius -- geometric and sleek, not rounded/bubbly. Think 4-6px radius, not 12-16px.

## Iconography

Thin outline style -- Lucide or similar. Geometric, consistent stroke weight. Not chunky, not filled. Icons should feel like they were drawn with the same pen as the bathymetric contour lines.

## Information Density

Dense but organized. Surfers want data -- don't hide it. But the hierarchy must be crystal clear:

- **Primary data** (quality score, wave height) reads instantly -- largest, most prominent
- **Secondary data** (period, direction, wind speed) is clearly visible but doesn't compete with primary
- **Tertiary data** (tide state, water temp, crowd) is available on demand -- expandable or secondary panels

The eye should always know where to go first.

## Interaction States

Pressed states should feel like physical depression -- subtle darkening or slight scale reduction, not glow or color shift. Selected/active states indicated by the terracotta accent color as an underline or subtle tint, not heavy background fills.

Hover states (desktop): subtle warmth -- slight background tint or gentle elevation change. Nothing flashy.

## Motion

Purposeful, not decorative. Transitions should feel physical -- like sliding a chart across a table, or a card settling into place. No bouncy animations, no elastic easing.

Loading states should be calm -- subtle shimmer or gentle pulse, not spinning icons.

The swell propagation animation and spot-level visualizations (swell lines, wind particles) are the exception -- these are the deliberate "alive" elements of the app. They should feel fluid and natural, like watching the actual ocean. Everything else in the UI should be still and confident.

## What to Avoid

- No rounded-everything cutesy aesthetic
- No Surfline's cluttered, ad-heavy, visually noisy look
- No generic Material Design or Bootstrap feel
- No jarring saturated colors in UI chrome -- everything muted, beautiful, elegant
- No dark mode for v1
- No emoji or playful illustration in the UI
- No bright white (#FFFFFF) as a primary background -- use warm whites and sand tones
- No thin gray borders as the primary way to separate content (use spacing and subtle elevation instead)

## Reference Touchstones

These are apps/sites that capture aspects of the desired aesthetic:

- **Gaia GPS and Apple Maps:** Light, minimal cartography. Warm, clean, confident.
- **Bridge and Vercel:** Sleek geometric tool aesthetic. Dense data, clear hierarchy.
- **Windy (map feel):** The way weather data layers paint over the map. The sense of the atmosphere as a living system.
- **OpenSnow:** Forecast mobile view, clean design.
- **Made with Clay:** Design language. Fonts and colors and shapes are exactly what we're looking for.
- **Nautical charts (NOAA paper charts):** The warmth of aged paper, the precision of depth soundings, the elegance of contour lines. This is the emotional reference -- Sandbars should feel like a digital nautical chart.

## Logo

We'll skip logo for now. Please just use the text "Sandbars" in place of a logo wherever it comes up and we'll replace it later.

## Screenshots

Will be available in `/design-refs` later.
