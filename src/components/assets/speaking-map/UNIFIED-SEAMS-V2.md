# Map seam fixes — 2026-10-06

Built-in imagegen edits; generated PNGs converted to quality-88 WebP without upscaling. Only snow-b, sky-a/b and magic-a/b use v2; original assets retained. New files are 1536×1024, not native 4K.

The other assets are unchanged. SVG alpha masks join their existing terrain over 100 world units, following low-contrast scenery and a short linear blend across the central road. Invisible road traces and 41-unit marker perimeter clearance are recalculated from the composited colors. Generated metadata is speakingUnifiedSeams.json: overlap, cut points, plain/joined center samples and safe flags. Metadata must be regenerated/reviewed when source art or mask geometry changes.

Snow-b prompt: Keep the polar bear, igloo, snowman and existing central scenery. Align top/bottom yellow road at x768, nominal width145px, vertical edge approach with smooth curves into existing road. Calm low-detail snow at edges; no text/UI/additional roads. Source: exec-b6aa6579-1006-49f0-8114-4f9d984fd546.png. The final trace uses measured pixels, not the requested coordinates.

## sky-a

Source: exec-fd8024cf-2739-4b1f-a116-271c9758f3c5.png

Precise local edit of this production children's game map tile. Preserve landscape1536x1024 overall layout, cute characters, cloud house/windmill, pastel trees, lamb/bird, yellow winding road and its exact central bends. FIX ONLY TOP EDGE REGION of this repeating vertical map. The top 160 pixels must show the SAME CLOSE-UP OVERHEAD TERRAIN and same object scale as the bottom 160 pixels, so repeating vertically has no sky horizon or distant backdrop at the join. Replace ALL open blue sky and distant tiny clouds in the upper edge with close-up fluffy white/lilac cloud ground continuous with the bottom cloud ground. No horizon, no blue sky strip, no remote vista. Preserve the road top and bottom nearly vertical, at horizontal center x768 and width150 pixels, with smooth blends into the original winding road. Small gentle ground texture along upper and lower border; no edge-cut tall objects. Maintain sharp high quality cute children's cartoon painterly style. Everything below y200 should stay as close to the original as possible. No labels, buttons, UI, added paths, numbers, frame. Output one full edited tile.

## sky-b

Source: exec-d891856a-6cc7-446b-959a-338eaa3fe425.png

Precise local edit of this production children's game map tile. Preserve landscape1536x1024 overall layout, cute characters, cloud house/windmill, pastel trees, lamb/bird, yellow winding road and its exact central bends. FIX ONLY TOP EDGE REGION of this repeating vertical map. The top 160 pixels must show the SAME CLOSE-UP OVERHEAD TERRAIN and same object scale as the bottom 160 pixels, so repeating vertically has no sky horizon or distant backdrop at the join. Replace ALL open blue sky and distant tiny clouds in the upper edge with close-up fluffy white/lilac cloud ground continuous with the bottom cloud ground. No horizon, no blue sky strip, no remote vista. Preserve the road top and bottom nearly vertical, at horizontal center x768 and width150 pixels, with smooth blends into the original winding road. Small gentle ground texture along upper and lower border; no edge-cut tall objects. Maintain sharp high quality cute children's cartoon painterly style. Everything below y200 should stay as close to the original as possible. No labels, buttons, UI, added paths, numbers, frame. Output one full edited tile.

## magic-a

Source: exec-d0978d5e-1064-45dc-a5c7-6de2e69a2260.png

Precise local edit of this production children's game map tile. Preserve landscape1536x1024 overall layout, cute characters, dragon/fox, crystals, orange trees, tower and waterfalls, yellow winding road and its exact central bends. FIX ONLY TOP EDGE REGION of this repeating vertical map. The top 160 pixels must show the SAME CLOSE-UP OVERHEAD TERRAIN and same object scale as the bottom 160 pixels, so repeating vertically has no sky horizon or distant backdrop at the join. Replace ALL purple sky and horizon clouds in the upper edge with lavender rock ground and low green moss/shrubs continuing the ground at the bottom. The small volcanos should be local miniature ground landmarks beside the path, surrounded by ground, never distant horizon mountains. No sky, no distant panorama. Preserve the road top and bottom nearly vertical, at horizontal center x768 and width150 pixels, with smooth blends into the original winding road. Small gentle ground texture along upper and lower border; no edge-cut tall objects. Maintain sharp high quality cute children's cartoon painterly style. Everything below y200 should stay as close to the original as possible. No labels, buttons, UI, added paths, numbers, frame. Output one full edited tile.

## magic-b

Source: exec-5efce6e8-d323-4b71-acf6-886f00f4cb15.png

Precise local edit of this production children's game map tile. Preserve landscape1536x1024 overall layout, cute characters, dragon/fox, crystals, orange trees, tower and waterfalls, yellow winding road and its exact central bends. FIX ONLY TOP EDGE REGION of this repeating vertical map. The top 160 pixels must show the SAME CLOSE-UP OVERHEAD TERRAIN and same object scale as the bottom 160 pixels, so repeating vertically has no sky horizon or distant backdrop at the join. Replace ALL purple sky and horizon clouds in the upper edge with lavender rock ground and low green moss/shrubs continuing the ground at the bottom. The small volcanos should be local miniature ground landmarks beside the path, surrounded by ground, never distant horizon mountains. No sky, no distant panorama. Preserve the road top and bottom nearly vertical, at horizontal center x768 and width150 pixels, with smooth blends into the original winding road. Small gentle ground texture along upper and lower border; no edge-cut tall objects. Maintain sharp high quality cute children's cartoon painterly style. Everything below y200 should stay as close to the original as possible. No labels, buttons, UI, added paths, numbers, frame. Output one full edited tile.
