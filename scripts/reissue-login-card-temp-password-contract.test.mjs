import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const edge = await read("supabase/functions/academy-student-manager/index.ts");

const from = edge.indexOf("const reissueStudentLoginCard = async (");
assert.notEqual(from, -1, "找不到 reissueStudentLoginCard");
const fn = edge.slice(from, edge.indexOf("const listClasses = async (", from));

// 只有管理員、只對還沒開通的帳號
assert.match(fn, /requireAdmin\(caller\)/);
assert.match(fn, /if \(student\.activated_at\)/, "已開通的帳號不能重新發卡");

// 重新發卡時一起產生新的臨時密碼，格式和批次建立的一樣（Ae-XXXX-XXXX）
assert.match(fn, /const temporaryPassword = createTemporaryPassword\(\);/);
assert.match(fn, /temporary_password: temporaryPassword/, "要把新的臨時密碼回給管理員（只顯示一次）");

// 順序：先作廢舊卡並建立新卡 → 改 Firebase 密碼 → 再記錄發放時間（+2 秒）
const revoke = fn.indexOf('academy_student_recovery_codes").update({ revoked_at: now })');
const firebase = fn.indexOf("updateFirebasePasswordByUid");
const record = fn.indexOf("temporary_password_issued_at: new Date(Date.now() + 2000).toISOString()");
assert.ok(revoke > -1 && firebase > revoke, "要先作廢舊卡、建立新卡，再改臨時密碼");
assert.ok(record > firebase, "要先改 Firebase 密碼，再記錄發放時間，避免被誤判成學生已改密碼");
assert.match(fn, /must_change_password: true/);
assert.match(fn, /\.is\("activated_at", null\)/, "只更新還沒開通的帳號");

// 不可把臨時密碼寫進 log
assert.doesNotMatch(fn, /console\.(log|error|warn)\([^)]*temporaryPassword/);

// 回傳中英文姓名給貼紙用
assert.match(fn, /chinese_name: student\.chinese_name \|\| student\.name/);
assert.match(fn, /english_name: student\.english_name \|\| ""/);

console.log("reissue login card temporary password contract checks passed");
