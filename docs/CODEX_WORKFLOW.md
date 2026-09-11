# Alan English — Codex Workflow

## 1. 角色

### Master Codex
工作位置：`Local / main`

主要工作：
- 唯讀盤點
- 拆需求
- 建 dependency graph
- 指派 Worker
- 指派 file ownership
- 定義 contracts
- 控制 merge order
- 最終 review / integration
- 更新專案狀態

Master 預設不直接承擔大量 feature coding。

### Backend Worker
工作位置：獨立 Worktree

適合：
- additive migration
- PostgreSQL / RLS
- Supabase Edge Functions
- entitlement / membership / assignment authorization
- Stripe backend / webhook
- private R2 authorization
- backend tests

### Frontend Worker
工作位置：獨立 Worktree

適合：
- React
- Redux
- Router（僅在被指定 ownership 時）
- SCSS / RWD
- UI state / loading / error state
- API client integration
- frontend tests

### Independent Worker
工作位置：獨立 Worktree

只接與主要 backend/frontend 工作沒有直接 dependency 的功能或 bug。

### Reviewer
預設只讀。

負責：
- correctness
- regression
- auth / permission
- test gaps
- mobile / accessibility
- migration safety
- Stripe / idempotency
- secret leakage
- scope creep

---

## 2. 任務生命週期

```text
REQUEST
  ↓
MASTER READ-ONLY TRIAGE
  ↓
DEPENDENCY GRAPH
  ↓
CONTRACT DECISION
  ↓
WORKTREE ASSIGNMENT
  ↓
IMPLEMENT
  ↓
WORKER SELF-TEST
  ↓
REVIEW
  ↓
MERGE ORDER
  ↓
INTEGRATION TEST
  ↓
DEPLOY / VERIFY
  ↓
PROJECT_STATUS UPDATE
```

---

## 3. Master 拆任務格式

每個大型需求先轉成：

```text
EPIC:
最終成果：

DEPENDENCIES:
D1:
D2:

CONTRACT OWNER:
-

WORKSTREAM A:
- scope:
- ownership:
- blocked by:
- done when:

WORKSTREAM B:
- scope:
- ownership:
- blocked by:
- done when:

WORKSTREAM C:
- scope:
- ownership:
- blocked by:
- done when:

MERGE ORDER:
1.
2.
3.

HIGH-RISK GATES:
-
```

---

## 4. 平行度建議

### Level 0 — 單 Worker
適用：
- 小 bug
- 單頁 UI
- 單一 Edge Function
- 小型 RWD

### Level 1 — 2 Workers
適用：
- backend contract 已明確，可同時做 backend + frontend
- feature + tests
- feature + independent bug

### Level 2 — 3 Workers
適用：
- 大型但邊界明確的功能
- Backend / Frontend / Independent QA or second feature

### 不建議
同時啟動 4 個以上會寫程式的 Worker，除非檔案與 contract 邊界非常清楚。

---

## 5. Alan English 高風險 Single-Writer 區

下列區域同時間原則上只能一個 Writer：

- Firebase Auth / session / account lifecycle
- role / learner type
- `effective_access`
- membership / entitlement
- assignment authorization
- Stripe checkout / webhook / subscription state
- shared billing codes
- shared routing shell
- Navbar / Sidebar / global player positioning
- DB schema involving the same tables
- shared API contracts

---

## 6. Goal 使用方式

Goal 要描述「可驗收成果」，不要描述模糊願望。

### 好的 Goal

```text
完成 AI 教材訂閱 Navbar 狀態顯示。

完成條件：
1. 未購買者顯示加購入口。
2. 已購買者顯示會員標記，不再顯示廣告。
3. loading / error state 完整。
4. 不修改 Stripe webhook。
5. 不修改 membership schema。
6. 桌面與 412px 手機皆正常。
7. 相關 tests 通過。
8. npm run build 與 git diff --check 通過。
```

### 不好的 Goal

```text
把會員功能全部做好。
```

---

## 7. 遇到 Dependency 時

例如：

```text
new DB field
    ↓
Edge Function response
    ↓
React UI
```

最佳流程：

1. 先完成 schema / backend contract。
2. merge。
3. Frontend Worker 更新到新的 `main`。
4. 再完成 UI。

若要真正平行，必須先由 Master 固定 contract，例如：

```json
{
  "ai_access": {
    "active": true,
    "renewal_date": "YYYY-MM-DD"
  }
}
```

前後端只能依該 contract 實作。

---

## 8. 衝突處理

發現 conflict 時不要立即讓 Codex「全部解掉」。

先分類：

### Mechanical Conflict
不同區塊、純 import、格式差異。
→ 可以由 Integrator 解。

### Semantic Conflict
雙方修改同一邏輯。
→ 回到需求與 contract，指定唯一正確行為。

### Architecture Conflict
兩個 Worker 各自設計了不同 API/schema。
→ 不直接 merge；由 Master 選定架構，再修改其中一方。

---

## 9. 每日建議流程

開始：
1. Local/main 更新。
2. Master 看 PROJECT_STATUS。
3. 選今天最多 2～3 個成果。
4. 先畫 dependency。
5. 建 Worktrees。

工作中：
- Worker 只做 ownership。
- 重要 contract 變動回報 Master。
- 不因看到附近 bug 就擴 scope。

結束：
1. Worker 測試。
2. Reviewer review。
3. dependency 順序 merge。
4. main integration build/test。
5. 必要時 deployment。
6. 更新 PROJECT_STATUS。
