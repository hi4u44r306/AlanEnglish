# 六冊口說道路接縫修補

日期：2026-10-08。基準 main `df03c1ad`，分支 `codex/speaking-road-seams`。狀態：本機完成、待正式發布。

## 實作範圍

- 保留十二張原始整幅地圖；新增 `unified-join-{forest,island,candy,snow,sky,magic}-{a,b}-v1.webp`，每張 1500×500，合計 2,014,678 bytes。各冊只引用自己的兩種接法，瀏覽器可重複快取。
- `SegmentedSpeakingMap.jsx` 在全部原圖之後覆蓋局部修補圖，接縫位置前移 200 單位、高度 500，上下 60 單位淡化。附近才掛載，沿用載入失敗重試；原圖仍保留為 fallback。圖片為裝飾、不可遮住關卡互動。
- `speakingMapJoinTraces.json` 的中心／邊緣依最終混合後圖像描繪，`speakingMapJoins.js` 校準接縫區道路點並重新計算路長。沿用原有安全位置篩選與全程分布，圓牌直徑 80；題庫 ID／順序及學習規則不變。
- 沒有 migration、Function、Secret、Firebase、RLS、題庫、學習紀錄或獎勵變更。

## 素材與提示詞

使用內建 imagegen（非 CLI），每張修補圖先另存，再轉成 WebP 作為專案素材。原始生成 PNG、manifest 與十二種前後對照存於本機 `output/map-seam-repair-20261008`；原圖拼接輸入位於 `output/map-seam-audit-20261008`。這些一次性分析腳本不提交。

共同提示詞：

```text
Use case: precise-object-edit. Edit the provided 1500x500 landscape game-map seam image into a production-quality seamless transition patch. Preserve the EXACT composition, road position where it meets the top and bottom edges, road width, colors and existing illustration style. The top 100 pixels and bottom 100 pixels must remain visually identical to the reference and all major trees, rocks, flowers and other landmarks must stay in their original positions. Change ONLY the central horizontal join band, especially around 40% to 60% of image height: repair the tan winding road so BOTH left and right edges curve naturally through the seam, with no sudden kink, sudden width change, translucent duplicate edge or ghosting. Clean up faded duplicated scenery and rectangular mask artifacts in that narrow middle band; restore solid natural terrain and sharply defined objects that blend naturally into their untouched neighbors. One continuous sandy road, consistent pale tan texture and little footprint spots, consistent near-orthographic perspective. Do NOT add any road branches, UI, markers, text, characters, border, frame, labels or watermark. This is a precision repair of the existing map, NOT a redesigned illustration. Output one full-bleed image at the same 3:1 landscape aspect ratio, no padding.
```

各冊追加主題：森林 lush green forest；海島 tropical island grassland, palms and blue water；糖果 pink candy garden with candyfloss trees and lollipops；雪地 snowy pine forest with blue crystals；天空 pastel sky garden on clouds；魔法 purple magical terrain, volcanic rocks and colorful crystals，保留原有小龍／魔法房子。森林第一批同義提示另指定 1536×512 輸出，但工具實際回傳 2172×724，最終專案皆按正確 3:1 比例轉存 1500×500。

魔法 B 接法有額外迭代：保留已修道路，僅重繪 40%～60% 高度、35%～65% 寬度的紫色地景，清掉矩形邊界、淡化植物與重複邊緣；不改兩端、火山、水晶、橘色樹及紫色塔。最終選用檔案 `exec-ec42eaeb-00f1-4206-8593-1c3feaa99501.png`。

## 驗證

- 三個地圖相關 targeted suites，38 tests 通過，包含六冊實際代表數量、長地圖延長、關卡順序、圓牌對獨立描繪路緣的安全距離、附近圖片載入、失敗重試、舊地圖 fallback。
- 六檔 ESLint 無錯誤；git diff --check 通過。無全套測試及本機 production build，因本批只涉及裝飾素材與地圖顯示座標，Cloudflare 會執行唯一正式 build。
- 十二種原始比例合成接法前後對照已逐張目視檢查，包括修補區兩端。412px 依 0.824 倍中央視窗、1440px 依 500 單位中央視窗檢查；不是實機 Safari 測量。
- 使用實際 JSX／SCSS 的 SSR 隔離頁已成功編譯；Browser Use 因無法核對 saved browser permissions 阻擋 localhost，未繞過。正式登入捲動、桌面／412px 真正瀏覽器畫面及 iPhone 仍待驗收。

## 發布與回復

本批是局部前端顯示修正，依 AGENTS.md 的持續發布授權進入 PR、main 與 Cloudflare 發布。合併後必須核對正式修補圖、口說 chunk／CSS 與 HTTP 狀態，再更新發布紀錄。回復可 revert 本批前端 PR，原始完整地圖、資料庫、題庫及成績不需回復。
