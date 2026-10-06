# Eight-level art pilot v4

2026-10-05. Local review only; not activated in production catalogs or the 50-level allocator.

- Two unique landmark tiles: apple-tree pond/rabbit and pine-tree campsite. Original 941×1672 each, WebP quality 88 with no upscaling. Combined 353,844 bytes; preview assets are not native 4K.
- Road-only SVG is shared with real marker coordinates. Four horizontal runs carry two nodes each; U-turns are intentionally empty. This pilot uses regular spacing within each run rather than claiming globally equal arc-length intervals through turns.
- Width 500, height 1800, road width120, outer marker80 (2/3). Scene overlap200, ground matching on either side of the boundary. Source artwork contains no road or UI.
- Entry: http://127.0.0.1:3003/?levels=8 . Add &tools=1 to show local fixture controls. The eight numbered lessons and progress are a fixture, not new database records.
- Generated with built-in image_gen, not CLI/API fallback. Encoding only with Sharp.

## Initial generation prompts

### meadow

Use case: stylized-concept. Produce one ROADLESS terrain background for a premium cheerful children's adventure map, based on reference illustration style but with much cleaner negative space. Portrait 5:9 aspect ratio, highest available native resolution. NO roads, paths, trails, UI, buttons, letters, flags, sky or horizon. Full image is continuous top-down sunny meadow terrain. Seventy-five percent of ground should be smooth broad softly painted lime-green grass patches with very sparse grass tufts, NOT a repeated dense carpet of bushes or zigzag texture. One beautifully drawn rabbit beside a small apple tree and a tiny turquoise round pond as a compact picturesque landmark, entirely in the LEFT-CENTER area x8%-43%, y42%-60%; this landmark must not cross y30% or65%. A handful of flowers and stones beside this landmark. The entire RIGHT third is OPEN smooth grass, because a future road will pass there. The horizontal strips at y29% and69% are OPEN plain grass edge to edge. Leftmost quarter of topmost/bottommost25% must also be plain grass for turn connection. Top and bottom22% have only low-detail even warm yellow-green grassy terrain for seamless overlap, no hard boundary, no tree crowns cut off at the edges. Match the attached refined storybook game palette, dimensional foliage, gentle shadows. Keep scene bright, colorful and breathable with a strong single landmark, not busy. No tiled texture repetition, no vignette. Terrain only, absolutely no road. Bottom extra breathing space clear grass with just two small flower clusters at corners.

### forest

Use case: stylized-concept. Make the SECOND ROADLESS terrain tile of this children's game continuing upward from the attached meadow. Match its aspect ratio and rendering style. High resolution portrait5:9. NO roads, paths, trail, UI, flags, text, buttons, sky or horizon. Continuous top-down grassy clearing. Bottom25% must closely match the reference's even warm lime meadow grass, with NO landmarks or flowers at bottom edge. Above that gradually add cooler emerald grass patches and very occasional pine needles, still bright sunny inviting. 75% broad soft low-detail open grass without dense repetitive little bushes. ONE distinct compact landmark at LEFT-CENTER x8%-42%, y42%-59%: two handsome pine trees behind a small cream canvas tent, a wooden log seat and tiny glowing lantern, no animal. No fire or pond in this tile. Right third is OPEN plain grass because planned road passes there. Horizontal strips y29% and69% OPEN grass across width; the leftmost quarter above25% and below75% OPEN grass. Top20% only low-detail muted green grass to support further continuation. Crisp charming storybook game art with soft dimensional shadows, restrained purple/yellow flower cluster by tent only, no repeated rabbit/apple tree, no visible seam or border, no decorative clutter. Match the existing meadow in lighting and scale. No road at all.

## Follow-up edits

Both landmark groups were reduced to 60% size, centered near x27%, y50%, constrained to y40–60% to leave road corridors unobstructed. Meadow's isolated rocks above and right of the landmark were removed. Ground palette and overlap areas were preserved.

Final meadow source: exec-09deca10-3501-4b1a-a8fb-d59fa86df509.png

Final forest source: exec-e756802f-4b10-4c9a-8a94-3d92f17ca37a.png
