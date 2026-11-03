import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = value => value == null ? '資料不足' : `${Number(value.toFixed(2))}%`;
const labels = { focused: '專注', ok: '普通', needs_reminder: '需要提醒' };
const details = (title, content) => `<details><summary>${escape(title)}</summary><pre>${escape(content)}</pre></details>`;
const metric = (label, value) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`;
function card(sample) {
    const valid = sample.validListen;
    const validity = valid === true ? '符合有效聆聽資格（模擬）' : valid === false ? '不算有效聆聽（模擬）' : sample.outcome;
    return `<article class="card"><h3>${escape(sample.name)}</h3><p class="badge ${valid === false ? 'warn' : ''}">${escape(validity)}</p>
        ${sample.title ? `<p class="title">${escape(sample.title)}</p>` : ''}
        ${sample.roundFocusRate !== undefined ? `<p class="focus">專注度：${pct(sample.roundFocusRate)}${sample.focusLevel ? ` · ${labels[sample.focusLevel]}` : ''}</p>` : ''}
        <p>${escape(sample.reason)}</p>
        <dl>${sample.actualSeconds !== undefined ? metric('實際播放時間', `${Number(sample.actualSeconds.toFixed(2))} 秒`) + metric('事件時間', `${sample.wallSeconds} 秒`) + metric('音檔長度', `${sample.duration} 秒`) + metric('不重複有效覆蓋', pct(sample.coverage)) + metric('達八成門檻', sample.reaches80 ? '是' : '否') : ''}
        ${sample.completedQuestions !== undefined ? metric('指定假資料：完成題數', sample.completedQuestions) : ''}
        ${sample.pauses ? metric('中斷事件', sample.pauses.length ? sample.pauses.join('、') : '無') : ''}
        ${sample.assignmentEntry !== undefined ? metric('作業入口', sample.assignmentEntry ? '顯示' : '隱藏') : ''}
        ${sample.tracks ? metric('指定音檔 ID', sample.tracks.join('、')) + metric('發布／截止', `${sample.assignedDate}／${sample.dueDate}`) + metric('每首次數', sample.listens) : ''}
        ${sample.requiredListens ? metric('依伺服器假回覆要求', `${sample.requiredListens} 次`) : ''}</dl>
        <small>${escape(sample.proof)}</small>
        ${sample.text ? details('實際渲染文字快照（jsdom 未套 CSS）', sample.text) : ''}
        ${sample.links ? details('實際入口文字與網址', JSON.stringify(sample.links, null, 2)) : ''}
        ${sample.trace ? details('每秒事件紀錄', JSON.stringify(sample.trace, null, 2)) : ''}
        ${sample.payload ? details('實際送往假服務的資料', JSON.stringify(sample.payload, null, 2)) : ''}
    </article>`;
}
export function generateReport(root, jest) {
    const resultPath = path.join(root, 'docs/simulations/attention-results.json');
    let data;
    try { data = JSON.parse(readFileSync(resultPath, 'utf8')); }
    catch { data = { A: [], B: [], C: [], D: [], findings: [], boundaries: ['測試在產生樣本前中止，不能推論產品行為。'], networkAttempts: [] }; }
    const samples = ['A', 'B', 'C', 'D'].reduce((n, k) => n + data[k].length, 0);
    const listening = data.C.filter(s => s.validListen !== undefined);
    const summary = `離線模擬 ${jest.numPassedTests} 項通過、${jest.numFailedTests} 項失敗；八成聆聽與中斷規則有測試證據，但操作專注度無法辨識「放空但沒切頁」，並列出 ${data.findings.length} 項問題或限制。`;
    const suites = jest.testResults.flatMap(s => s.assertionResults || []);
    let history = [];
    try { history = JSON.parse(readFileSync(path.join(root, 'docs/simulations/execution-history.json'), 'utf8')); } catch {}
    const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Alan English 專注度離線模擬報告</title>
    <style>
    :root{color-scheme:light;--ink:#193252;--blue:#225fb6;--paper:#f1f5fa;--line:#dae3ee}*{box-sizing:border-box}body{margin:0;font:16px/1.75 system-ui,-apple-system,"Microsoft JhengHei",sans-serif;background:var(--paper);color:var(--ink)}main{max-width:1100px;margin:auto;padding:24px}header{background:#18375f;color:#fff;padding:32px;border-radius:20px;margin:12px 0 24px}header p{color:#e4efff}h1{font-size:clamp(1.5rem,4vw,2.25rem);line-height:1.4;margin:0 0 16px}h2{font-size:1.55rem;border-left:6px solid #f3c741;padding-left:14px;margin-top:42px}h3{font-size:1.13rem;margin-top:0}p{margin:10px 0}.intro,.limits{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,310px),1fr));gap:18px}.card{min-width:0;padding:22px;background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 4px 14px #102a4310}.badge{display:inline-block;padding:5px 11px;border-radius:8px;background:#e9f4ed;color:#205a3d;font-weight:700}.warn{background:#fff0df;color:#874000}.focus{font-size:1.15rem;font-weight:700;color:var(--blue)}dl{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0}dt{font-size:.83rem;color:#5c6d82}dd{margin:0;font-weight:700;overflow-wrap:anywhere}small{color:#5c6d82}summary{cursor:pointer;padding:10px 0;min-height:44px;color:var(--blue)}pre{font-size:.8rem;line-height:1.6;background:#f4f7fb;padding:12px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:420px;overflow:auto}nav{display:flex;flex-wrap:wrap;gap:8px}nav a{display:block;padding:8px 14px;background:#fff;color:var(--blue);border-radius:10px;min-height:44px}a{overflow-wrap:anywhere}li{margin:8px 0}.problem{border-left:5px solid #d79532;margin:18px 0;padding:18px;background:white;border-radius:10px}.test-fail{color:#963d15}.test-pass{color:#24623d}.foot{font-size:.88rem;margin-top:30px}@media(max-width:450px){main{padding:14px}header{padding:22px}.card{padding:18px}dl{gap:10px}h2{font-size:1.35rem}}@media print{body{background:white}.card,.problem{break-inside:avoid}details{display:none}nav{display:none}}
    </style></head><body><main><header><h1>Alan English<br>學生專注度離線模擬報告</h1><p>${escape(summary)}</p><small style="color:#d8e7ff">依本機原始碼執行 · 結果時間 ${escape(new Date(jest.startTime).toISOString())} · 合成資料</small></header>
    <nav aria-label="報告章節"><a href="#a">A 老師出作業</a><a href="#b">B 學生看見什麼</a><a href="#c">C 聽力樣本</a><a href="#d">D 口說與作業</a><a href="#issues">發現的問題</a></nav>
    <section class="intro"><h2>老師先看這裡</h2><p>「有效聆聽」看的是音檔中不同區段是否以合格方式聽滿八成；拖曳或重聽同一段，不能補出未聽過的部分。「專注度」看的是完成次數和系統記下的中斷事件。</p><p>聽力專注度＝有效聆聽次數 ÷（有效聆聽次數＋閒置事件＋切頁事件）；顯示時四捨五入到整十。沒有完成也沒有中斷事件時是「資料不足」。本報告以單一樣本當作一週全部資料，並非真實學生週報。</p><p>長度較短的音檔，即使孩子沒碰滑鼠，只要正常播完，仍可能計次；播放器會在連續十五分鐘或第五次自動播放結束時要求確認。三十秒未回應才記聽力 idle。口說另採九十秒無操作記 idle。</p><p><strong>${samples} 張樣本卡</strong>；C 的 ${listening.length} 個每秒樣本中，${listening.filter(s => s.validListen).length} 個符合純驗證資格。測試通過代表符合標示的實際行為；已重現的缺陷也使用通過的重現測試，不能解讀成所有產品要求都已通過。</p></section>
    <h2 id="a">A · 老師出聽力作業</h2><p>四個合法班級使用真實選曲、標題及草稿函式；必填欄位與日期另外掛載老師頁面。Edge 只執行不含 I/O 的原始驗證片段，不執行服務。</p><div class="grid">${data.A.map(card).join('')}</div>
    <h2 id="b">B · 學生一進平台看到什麼</h2><p>掛載真實學生作業頁與 StudentNavbar。班級清單由假 API 預先指定；這證明畫面與入口如何呈現，後端正式權限只讀碼。網購者與試用者的頁面是直接掛載以查看空清單，沒有執行正式路由守門。</p><div class="grid">${data.B.map(card).join('')}</div>
    <h2 id="c">C · 聽力專注度樣本</h2><p>每秒推進一次音訊事件與假時鐘，同時執行真實覆蓋率純函式及 MusicPlayer。覆蓋率和送出資料互相比對，再交給 Edge 的真實純驗證函式。最後是否落帳仍由正式後端決定，這裡沒有實際落帳。</p><div class="grid">${data.C.map(card).join('')}</div>
    <h2 id="d">D · 口說與作業聽力</h2><p>口說用真實 hook 與假時鐘；顯示的完成題數明列為假資料。作業聽力使用真實 Playlist、MusicCard、Redux 與 MusicPlayer，驗證共用中斷事件，以及網址的 required=99 不會覆蓋伺服器要求。</p><div class="grid">${data.D.map(card).join('')}</div>
    <h2 id="issues">發現的問題</h2><p>以下只記錄問題與建議，正式程式碼沒有修補。頁面信任後端回傳班級資料屬架構責任邊界，本次沒有證明正式跨班資料外洩。</p>
    ${data.findings.map(f => `<article class="problem"><h3>${escape(f.title)}</h3><p><a href="../../${escape(f.file)}">${escape(f.file)}:${f.line}</a></p><p><strong>重現：</strong>${escape(f.reproduction)}</p><p><strong>建議：</strong>${escape(f.fix)}</p></article>`).join('')}
    <h2>證據範圍與測試結果</h2><section class="limits"><ul>${data.boundaries.map(b => `<li>${escape(b)}</li>`).join('')}</ul><p>Jest：通過 ${jest.numPassedTests}／失敗 ${jest.numFailedTests}／略過 ${jest.numPendingTests}。jsdom 網路攔截嘗試：${data.networkAttempts.length} 次。</p>
    ${details('逐項測試結果', suites.map(t => `${t.status === 'passed' ? '通過' : t.status === 'failed' ? '失敗' : '略過'}　${t.fullName}${t.failureMessages?.length ? '\n' + t.failureMessages.join('\n') : ''}`).join('\n'))}
    ${history.length ? details('測試工具調整前的執行紀錄（不刪除失敗證據）', JSON.stringify(history, null, 2)) : ''}
    ${jest.testResults.some(s => s.message) ? details('測試執行診斷', jest.testResults.map(s => s.message || '').join('\n')) : ''}
    <p>重現指令：<code>node --test --test-isolation=none scripts/simulations/run-attention.test.mjs</code>。獨立 Jest 設定直接使用現有依賴，不經 react-scripts、不載入 dotenv、不安裝套件。網路與 .env 讀取有執行層阻擋。首次用預設子程序模式啟動時被本機沙箱以 spawn EPERM 阻擋，當時尚未進入任何樣本；改為同程序模式。</p></section>
    <p class="foot">本檔內嵌樣式與所有顯示內容，可離線開啟，不需要其他資源。每秒紀錄、文字快照、個別斷言及 JSON 為同次執行產物；沒有人工填入模擬結果。</p>
    </main></body></html>`;
    writeFileSync(path.join(root, 'docs/simulations/attention-simulation-report.html'), html);
}
