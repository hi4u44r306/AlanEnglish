# 生日月活動發布與回復清單

更新：2026-10-09；原基準 main d471e86a；PR #488 已合併 main d37c85cb。使用者已明確同意本批正式操作，四份 migration、gamification v36 與 Cloudflare production 已部署，正式帳號／装置仍待實機驗收。

發布核對：六支原正式函式與 Git 來源一致，生日 immutable trigger 保留。四份 SQL／原版本登記在單一交易完成，無資料回填，enabled=true／gift_points=100／version=1。RLS 與服務角色專用 RPC 通過；後端兩檔與 main 一致，OPTIONS 200／未登入及偽造管理員 401。Cloudflare build 67bf7cdd-f43f-4456-b412-e62a94f53157 於07:52:58台灣時間成功，07:54:33正式三個路由與27項資產 HTTP 200、七個生日標記通過。證據及發布前函式快照位於 output/birthday-release（忽略、不含個資）；首次檢查語法失敗整批回滾後已修正重試，沒有部分套用。以下保留原發布及回復檢查表供後續驗收。

## 可審核成果

生日月有效學習 XP ×2。生日禮預設100點，只有有效在校生可取得；在登入後 summary 先原子結算，再讀取最新 balance。獎品管理新增金額與啟用設定，採版本防覆寫與稽核。來源 birthday_gift/year:YYYY 為每人每年一次。設定更改不追回、不補差額、不重新發放舊事件。

四份 additive migration 順序：

1. 20261008145617_birthday_month_rewards.sql：新增設定／稽核表（RLS）、資格與生日禮 RPC，不回填生日或歷史獎勵。
2. 20261008150318_birthday_xp_settlement.sql：生日倍率及共用V2 grant；保留行鎖、防重、在校點數與一次性升等。
3. 20261008150529_birthday_reward_compatibility.sql：舊聽力XP、遊戲基礎XP日上限、口說實際XP回傳；不變更舊聽力點數政策或rollout、口說完成條件與每日額度。
4. 20261008151540_birthday_listening_feedback.sql：V2/V3聽力只修正獎勵回傳，從實際ledger讀XP／點數；覆蓋率、session、noInteraction、作業條件與每日可領檔數不變。

SQL重新宣告現有函式是為使版本可重現，必須逐函式比較正式定義與原Git來源。新表與RPC不授予anon/authenticated直接存取；沒有新增Secret、RLS授權給學生、Firebase或供應商設定。

## 已完成驗證

- scripts/birthday-rewards-sql.test.mjs：22項，真实新SQL、原發獎／升等／資格helper，會員API形狀由隔離替身提供。
- scripts/birthday-listening-sql.test.mjs：4項，真实V2/V3聽力session、10次熟練、作業完成與防重，生日學習權限API採替身。
- scripts/birthday-rewards-handler.test.mjs：6項，真實handler＋Firebase／DB替身，身份防偽、角色、參數、409衝突與失敗順序。
- 前端4套36項：BirthdayRewardSettings、BirthdayRewardNotice、StudentLearningHome、gamificationService。
- 五個應用檔ESLint、gamification TypeScript syntax、Production build、SEO與Cloudflare資產準備成功；最終局部border-box樣式由Sass編譯／瀏覽器重驗。未跑無關全套。
- 真實新JSX／SCSS搭配示範替身：1440／412px無水平溢位，儲存按鈕44px，100→150點儲存成功，无pageerror。證據 output/birthday-preview/checks.json 與 birthday-1440.png／birthday-412.png。不是正式網站／登入／真實學生發獎驗收。
- 未驗證：真實Firebase帳號、完整網站 Navbar／Sidebar、iPhone Safari與實際safe area、跨資料庫連線併發與正式資料資格；Cloudflare發布及HTTP資產核對已完成。

## 授權後發布次序

1. 重新核對最新main／diff、遠端migration history、四支被重新宣告的既有獎勵函式（共用V2、legacy、game、speaking）及兩支聽力函式的正式定義。若正式定義不同，先合併現行修正並重驗，不能直接覆蓋。確認get_student_effective_access參數／權限與生日鎖定仍存在。
2. 一次交易、按順序套用這四份SQL並只登記本批migration；不得盲目db push、回填、重設資料庫或執行其他平行分支migration。新函式先於Edge部署，SQL預設活動啟用；首次summary才會發生日禮，無批次補發。此步起，新學習XP可能加倍。
3. 核對新表RLS、anon/authenticated無讀寫／EXECUTE、服務角色可用；對非生日／無資格、在校生日與有效網購生日測試帳號使用現有已核准的測試資料驗收，不修改真實生日或生日鎖定。不憑空產生學生個資。
4. 由審核後main部署gamification，維持Firebase Token驗證；OPTIONS／未登入POST／學生偽裝admin檢查。record-play、speaking-challenge無程式部署變更，僅SQL回傳值相容。
5. 由最新main的唯一Cloudflare production build發布前端；驗收admin/rewards與student/dashboard、生日提示、100點入帳、重整不重領、修改未領者金額及冲突重讀。後台金額驗收使用測試環境，正式初始值保持100，避免影響尚未領取的真實學生。
6. 真實學生／老師／管理員、桌面／412px／iPhone與完整Navbar/Sidebar覆蓋另行驗收。確認倍率跨等級獎勵、非在校生零新增點數、生日礼不進遊戲日上限、過期與停用不發獎。把已完成與仍待驗證分別增量更新PROJECT_STATUS／手冊，完成前不宣稱正式上線。

## 回復

優先管理員停用生日月活動，或透過已核准的維運路徑將birthday_reward_settings.enabled改為false，即停止生日加倍與新的生日禮。其後可revert本批前端／gamification發布。若SQL本身有問題，建立新的additive rollback migration，從發布前已核對的正式定義還原受影響函式；不得修改已套用的migration、刪表、刪ledger、追回已花用的點數或刪學習紀錄。已發的合法生日禮、XP及升等紀錄保留。
