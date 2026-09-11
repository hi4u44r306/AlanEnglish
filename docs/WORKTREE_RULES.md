# Alan English — Worktree Rules

## 1. 一個 Worktree 的定義

一個 Worktree 應代表一個可以獨立回答「完成了什麼？」的成果。

好：
- `membership-notification`
- `ai-addon-navbar`
- `fix-listening-session-idempotency`

不好：
- `today`
- `misc`
- `frontend2`
- `victor-test`

---

## 2. 建立前

確認：

```bash
git status --short
git branch --show-current
git fetch origin
```

Master 要記錄：

```text
Task:
Base branch:
Base commit:
Worktree:
Feature branch:
Owner:
Write scope:
Shared files:
Dependencies:
```

---

## 3. 建議命名

Worktree 顯示名稱：

```text
WT-BE-membership-notification
WT-FE-membership-notification
WT-FIX-player-pause-overlay
```

Branch：

```text
feature/membership-notification-backend
feature/membership-notification-ui
fix/player-tab-pause-overlay
```

如果前後端高度耦合且同一 Worker 可安全完成，也可只使用：

```text
feature/membership-notification
```

不要為了形式硬拆成兩個 PR。

---

## 4. File Ownership Card

每個 Worktree 第一則任務都要包含：

```text
WRITE:
- ...

READ:
- ...

DO NOT MODIFY:
- ...

SHARED / ASK MASTER FIRST:
- ...
```

例如 Backend：

```text
WRITE:
- supabase/migrations/<new migration>
- supabase/functions/membership-manager/**
- related backend tests

READ:
- src/services/membership*
- PROJECT_LOGIC.md

DO NOT MODIFY:
- Navbar
- Router
- global Redux
- unrelated Edge Functions

SHARED / ASK MASTER FIRST:
- shared effective-access helper
- plan code constants
```

---

## 5. Worktree 中禁止

- 不 pull unrelated experimental branch。
- 不 merge 尚未 review 的其他 Worker branch。
- 不修改另一個 Worker 的 ownership。
- 不切回 main 直接寫。
- 不用 destructive git commands 清掉不理解的變更。
- 不因 build warning 進行全 repo cleanup。
- 不改 lockfile，除非任務真的需要 dependency change。

---

## 6. Dependency 更新

如果 B 依賴 A：

```text
A merge → main
B fetch/rebase or merge latest main
B rerun relevant tests
B rerun build
B review diff again
```

不要只因 B 在舊 base 上曾經 build success 就直接 merge。

---

## 7. Worktree 完成卡

```text
TASK:
BRANCH:
BASE:
FINAL COMMIT:

CHANGED:
-

CONTRACT CHANGES:
-

TESTS:
-

BUILD:
-

DIFF CHECK:
-

RISK:
-

NOT VERIFIED:
-

READY FOR REVIEW:
yes/no
```

---

## 8. Worktree 保留與刪除

保留：
- PR 尚未 merge。
- 還有 reviewer fix。
- 線上驗收需要 hotfix。

可刪：
- PR 已 merge。
- main integration 驗證完成。
- 無未推送 commit。
- PROJECT_STATUS 已更新。

不要在「程式剛寫完」就清 Worktree。
