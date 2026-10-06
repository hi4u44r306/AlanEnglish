# Unified wide forest — local pilot

2026-10-06. Generated with built-in imagegen (no API/CLI). Each vertical segment is now one full-width illustrated scene containing the central road and side scenery. No horizontal composition, side mask or separate side image is used. The long 50-level journey still uses vertical streaming of A/B segments; it is not a single huge 50-level bitmap.

## Assets

- unified-forest-a-v1.webp: 1536×1024, 315,100 bytes.
- unified-forest-b-v1.webp: 1536×1024, 289,572 bytes.
- WebP quality 88; no resizing. Total 604,672 bytes, NOT native 4K despite requested dimensions.
- Original generated PNGs remain at the source paths below; project WebPs are self-contained.

## Geometry and use

- Landscape world is 1500×1000 per segment; central gameplay coordinate frame is x=500..1000, width 500. Narrow screens crop horizontally; central frame is min(viewport, max(500px, viewport/3)). Desktop 1920px gives 640px center and 102.4px markers; 412px phones give 412px center and 65.9px markers.
- New curves sampled every 5 world units from the actual WebP road color, no visible SVG overlay. Four anchors per variant chosen along traced arc length among valid positions, avoiding narrow bends. 128 perimeter samples at radius 41 pass the road mask per anchor; minimum A/B anchor distances about 207.5/199.1 units. This checks marker containment, not a claim of exact uniform width throughout the illustration.
- Optional `buildCartoonSpeakingRoute(..., { unifiedForest: true })` enables only forest; default route and other books remain unchanged. Only local preview opts in. Existing vertical overlap 100 retained.
- Local fixture `http://127.0.0.1:3003/?book=1&levels=50`. No production deployment or real student data mutation.
- Actual screenshots `output/segmented-map/unified-{412,768,1440,1920}.png` and seam variants. 22 targeted tests, focused lint, SCSS/preview bundle and diff check; no full suite/production build needed for this local prototype. iPhone Safari hardware unverified.

## Full image prompts

### A

Reference: `cartoon-forest-a-v1.webp`.
Source: `C:\Users\user\.codex\generated_images\01a0f80d-140f-77c2-a205-8637a3c97d74\exec-f3c85dd8-bb4e-4943-bc44-c124fb36d739.png`.

Create a single cohesive wide landscape game map by OUTPAINTING the supplied narrow vertical children's cartoon forest map to the LEFT AND RIGHT. Final canvas aspect ratio 3:2 landscape, preferably 3072x2048 or higher if supported. CRITICAL GEOMETRY: the original full-height vertical map must occupy exactly the CENTRAL ONE THIRD of the final canvas, x=33.333% to 66.667%, with identical road bends, road width, and vertical layout. Do not stretch the reference horizontally. The existing winding sand road is only in the central third, enters at exact top center and exits at exact bottom center. Preserve the central scenery and road curve as closely as possible. Expand the scene sideways as a single naturally connected forest clearing: charming plump rounded trees, organic tree groups, low bushes, a few flowers and rocks flowing naturally outward from existing central trees. Mix open sunlit grassy clearings with small woodland groups, much sparser toward outer left and right. No parallel rows, no vertical borders, no rectangular central strip, no fog fade, no blur, no separate panels, no mirrored duplicates. Continuous illustrated ground across entire width. Keep the reference's warm delightful children's game look, carefully rounded forms and colorful but not busy scenery. Road width remains constant without perspective shrinking. No extra side roads, no extra ponds or buildings on sides. Top and bottom 8% are mostly green grass with centered straight sand road, so this tile can connect vertically. No text, buttons, numbers, frames, UI or watermarks. Preserve rabbit and pond near the central road. This whole wide illustration is displayed on desktop, while phones crop to only its central third.

### B

Reference: `cartoon-forest-b-v1.webp`.
Source: `C:\Users\user\.codex\generated_images\01a0f80d-140f-77c2-a205-8637a3c97d74\exec-a8f7b29c-e7fd-4fbb-b1a3-028b8db51eb0.png`.

Create a single cohesive wide landscape game map by OUTPAINTING the supplied narrow vertical children's cartoon forest map to the LEFT AND RIGHT. Final canvas aspect ratio 3:2 landscape, preferably 3072x2048 or higher if supported. CRITICAL GEOMETRY: the original full-height vertical map must occupy exactly the CENTRAL ONE THIRD of the final canvas, x=33.333% to 66.667%, with identical road bends, road width, and vertical layout. Do not stretch the reference horizontally. The existing winding sand road is only in the central third, enters at exact top center and exits at exact bottom center. Preserve the central scenery and road curve as closely as possible. Expand the scene sideways as a single naturally connected forest clearing: charming plump rounded trees, organic tree groups, low bushes, a few flowers and rocks flowing naturally outward from existing central trees. Mix open sunlit grassy clearings with small woodland groups, much sparser toward outer left and right. No parallel rows, no vertical borders, no rectangular central strip, no fog fade, no blur, no separate panels, no mirrored duplicates. Continuous illustrated ground across entire width. Keep the reference's warm delightful children's game look, carefully rounded forms and colorful but not busy scenery. Road width remains constant without perspective shrinking. No extra side roads, no extra ponds or buildings on sides. Top and bottom 8% are mostly green grass with centered straight sand road, so this tile can connect vertically. No text, buttons, numbers, frames, UI or watermarks. Preserve squirrel and tent near the central road. This whole wide illustration is displayed on desktop, while phones crop to only its central third.
