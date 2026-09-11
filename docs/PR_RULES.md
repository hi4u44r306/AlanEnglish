# Alan English — Pull Request Rules

## 1. PR 一次回答一件事

PR 標題格式：

```text
feat(scope): outcome
fix(scope): problem
test(scope): coverage
docs(scope): update
```

例如：

```text
feat(membership): add student notification lifecycle
fix(player): pause playback after hidden-tab threshold
```

---

## 2. PR 不應混入

- unrelated CSS cleanup
- package upgrades
- mass formatting
- unrelated docs rewrite
- another feature
- another database design

除非它們是完成該成果不可分割的一部分。

---

## 3. PR 描述模板

```markdown
## Goal
一句話說明成果。

## Scope
- ...

## Out of scope
- ...

## Dependencies
- Base:
- Depends on:
- Blocks:

## Changed areas
- Frontend:
- Backend:
- DB:
- Edge Functions:
- Docs:

## Contract changes
- Request:
- Response:
- DB:
- Access/role:
- None

## Security / permission
- Firebase token:
- role validation:
- entitlement:
- RLS:
- secrets:

## Tests
- [ ] targeted tests
- [ ] npm run build
- [ ] git diff --check
- [ ] desktop
- [ ] 412px mobile
- [ ] relevant role/access states

## Migration
- None / migration name
- rollback/mitigation:

## Deployment impact
- Edge Functions:
- Netlify:
- Supabase:
- Stripe:
- Cloudflare:

## Manual verification remaining
- ...

## Risk
Low / Medium / High
Reason:
```

---

## 4. Reviewer 優先順序

P0:
- data loss
- auth bypass
- wrong-user data
- secret leak
- incorrect charge/refund/subscription
- destructive migration

P1:
- permission regression
- entitlement regression
- assignment cross-class leak
- broken login
- broken checkout
- idempotency failure
- production build failure

P2:
- functional bug
- mobile blocker
- stale state
- bad error handling

P3:
- readability
- naming
- cleanup

Reviewer 不要讓 P3 掩蓋 P0～P2。

---

## 5. Merge Gate

只有全部符合才 merge：

- PR scope 清楚。
- dependency 已滿足。
- contract 沒有互相矛盾。
- targeted tests passed。
- production build passed。
- diff check passed。
- 無 secret。
- high-risk task 已走需要的授權／隔離驗證。
- reviewer 無未處理 P0/P1。
- 與最新 main 的整合風險已檢查。

---

## 6. Merge Order

一般順序：

```text
contract / schema
→ backend
→ frontend
→ integration fixes
→ docs/status
```

獨立 PR 可依 conflict 風險調整。

---

## 7. Merge 後

1. 更新 Local main。
2. 跑必要 integration test。
3. 做 deployment / online verification（依 AGENTS.md 風險規則）。
4. 更新 `docs/PROJECT_STATUS.md`。
5. 再啟動依賴這次改動的新 Worktree。
