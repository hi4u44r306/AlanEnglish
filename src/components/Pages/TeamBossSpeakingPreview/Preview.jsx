import React, {useEffect, useRef, useState} from 'react';
import {NativeBattle} from '../../fragment/TeamBossNativeBattle';
import {EXPANSION_PROFILES} from '../../../game/teamBossRpg/native/bosses/expansion-profiles.mjs';
import {NATIVE_CHARACTERS, NATIVE_ITEMS, NATIVE_SLOTS} from '../../../game/teamBossRpg/native/native-rig.mjs';
import {CLASSES, LEARNERS, defaultDraft, candidates, selectedQuestions, publish, join, hpShare, listeningTracks, currentQuestion, simulate, rewards, heartsOf, gearBonus, GEAR_TIERS, ITEM_TIERS, RULES} from './model.mjs';
import TeamBossClassProfileCard from '../../fragment/TeamBossClassProfileCard';
import TeamBossNativeArt from '../../fragment/TeamBossNativeArt';
import useLocalRecording from './useLocalRecording';
import {scoreReading} from './scoring.mjs';
import {BATTLE_SOUNDS} from './sound.mjs';
import {retainLocalSpeakingRecognizer} from '../../../services/localSpeakingRecognizer';
import {convertAudioBlobToWav} from '../../../utils/audioWav';
import {useAuth} from '../../../auth/AuthContext';
import {getSpeakingChallengeSet} from '../../../services/speakingChallengeService';
import {getAccessibleBook} from '../../../services/contentAccessService';
import {speakingListeningPath, speakingListeningSource} from '../../../utils/speakingListening';
import './preview.scss';

// Registered at runtime so the bundler does not try to resolve the url(); the file is served from public/fonts.
if (typeof document !== 'undefined' && !document.getElementById('sr-mantou-font')) {
  const style = document.createElement('style'); style.id = 'sr-mantou-font';
  style.textContent = "@font-face{font-family:'Mantou Sans';src:url('/fonts/MantouSans-Regular.ttf') format('truetype');font-display:swap;}";
  document.head.append(style);
}

const names = {star: '星光勇者', moon: '月光法師', leaf: '森語夥伴'};
const slotNames = {weapon: '武器', shield: '盾牌', head: '頭部', cape: '披風', armor: '胸甲', boots: '靴子'};
const percent = value => Math.round(value * 100);
// Drawn as SVG: a "♥" character can render as a colour emoji that ignores CSS, which made lost hearts look full.
// Battle sounds are synthesized (see sound.mjs). Browsers only allow audio after a tap, so the first tap anywhere
// unlocks them; nothing plays while the tab is in the background.
function useBattleSound() {
  const store = useRef({context: null, muted: false}), [muted, setMuted] = useState(false);
  useEffect(() => {
    const held = store.current;
    const unlock = () => {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!held.context && Context) held.context = new Context();
      held.context?.resume?.();
    };
    window.addEventListener('pointerdown', unlock);
    return () => {window.removeEventListener('pointerdown', unlock); held.context?.close?.(); held.context = null;};
  }, []);
  function play(name, delay = 0, volume = 0.7) {
    const held = store.current, cue = BATTLE_SOUNDS[name];
    if (held.muted || !held.context || !cue || document.hidden) return;
    const out = held.context.createGain(); out.gain.value = volume; out.connect(held.context.destination);
    cue(held.context, out, held.context.currentTime + 0.02 + delay);
  }
  return {play, muted, toggle() {store.current.muted = !store.current.muted; setMuted(store.current.muted);}};
}
const HEART = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';
// Mock-ups only: where the game character would appear outside the battle. Nothing here is saved.
const mapLevels = ['P13', 'P15', 'P17', 'P24', 'P26', 'P28'], avatars = ['🦊', '🐼', '🚀', '⭐'];
export default function Preview() {
  const [view, setView] = useState('student'), [code, setCode] = useState('E1');
  const [drafts, setDrafts] = useState(() => Object.fromEntries(CLASSES.map(c => [c, defaultDraft(c)])));
  const [rounds, setRounds] = useState(() => CLASSES.map((c, i) => join(publish(defaultDraft(c), i + 1), 'star')));
  const [activity, setActivity] = useState(1), [learner, setLearner] = useState('star'), [character, setCharacter] = useState('girl-mage');
  const [review, setReview] = useState(null), [message, setMessage] = useState('先聽示範，再照著答句念出來。');
  const [confirm, setConfirm] = useState(false), [counter, setCounter] = useState(null);
  const characterOf = key => key === learner ? character : ['boy-knight', 'boy-mage', 'girl-knight'][LEARNERS.indexOf(key)];
  const [arrivals, setArrivals] = useState([]), [hit, setHit] = useState(null);
  const [gearBy, setGearBy] = useState(() => Object.fromEntries(LEARNERS.map(key => [key, {weapon: 'oak-wand'}])));
  useEffect(() => {if (!counter) return undefined; const timer = setTimeout(() => setCounter(null), 2400); return () => clearTimeout(timer);}, [counter]);
  const draft = drafts[code], round = rounds.find(r => r.revision === activity), p = round.progress[learner];
  const q = currentQuestion(round, learner, review), chosen = selectedQuestions(draft), rest = candidates(draft).filter(item => !chosen.some(x => x.id === item.id));
  const [now, setNow] = useState(() => Date.now()), resting = p.restUntil > now, hearts = heartsOf(p, now);
  useEffect(() => {if (!resting) return undefined; const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer);}, [resting]);
  const gear = gearBonus(gearBy[learner]), pay = rewards(round, gearBy), mine = pay.find(r => r.key === learner);
  const recording = useLocalRecording([view, activity, learner, q?.id].join(':'));
  function changeDraft(patch) {setConfirm(false); setDrafts(old => ({...old, [code]: {...old[code], ...patch}}));}
  function selectClass(value) {setCode(value); setConfirm(false); const last = rounds.filter(r => r.config.classCode === value).at(-1); setActivity(last.revision); setReview(null); setCounter(null); setArrivals([]); setMessage('每班可使用不同教材，同班同場順序相同。');}
  function switchActivity(value) {const next = rounds.find(r => r.revision === Number(value)); setActivity(next.revision); setCode(next.config.classCode); setReview(null); setCounter(null); setArrivals([]); setMessage('已切換示範場，原場進度保留於本頁。');}
  function run(outcome) {
    if (!q) return;
    const at = Date.now(); setNow(at);
    recording.cancel(); const result = simulate(round, learner, q.id, outcome, characterOf(learner), at, gear.damage);
    setRounds(old => old.map(r => r.revision === activity ? result.round : r));
    setMessage(result.message); if (result.counter) {setCounter(old => ({id: Date.now(), flip: !old?.flip})); sound.play('hurt', 0.3); sound.play('heart-break', 0.5);}
    if (result.round.events.length > round.events.length) {const event = result.round.events.at(-1); setArrivals([event]); const mage = characterOf(learner).endsWith('mage'), big = !!event.skills || !!event.teamwork;
      setHit({id: event.id, damage: event.damage, skill: event.skills?.key, combo: !!event.teamwork, mage});
      if (big) sound.play(event.teamwork ? 'combo' : 'skill', 0);
      sound.play(mage ? 'cast' : 'slash', mage ? 0.2 : 0.32); sound.play(big ? 'hit-heavy' : 'hit', 0.5);
      if (big) sound.play('hit-heavy', 0.62, 0.5); if (event.teamwork) sound.play('hit-heavy', 0.76, 0.5);
      if (event.won) {sound.play('victory', 1.1); sound.play('coins', 2.6);}}
    if (outcome === 'pass' || outcome === 'skip') setReview(null);
  }
  // Preview shortcut: classmates take turns until the Boss falls, so the victory screen can be reviewed quickly.
  function finish() {
    let next = round; const at = Date.now();
    for (let turn = 0; !next.won && turn < 200; turn += 1) {
      const key = LEARNERS[turn % LEARNERS.length], question = currentQuestion(next, key);
      if (question) next = simulate(next, key, question.id, 'pass', characterOf(key), at, gearBonus(gearBy[key]).damage).round;
    }
    recording.cancel(); setRounds(old => old.map(r => r.revision === activity ? next : r)); setReview(null); setArrivals(next.events.slice(-1)); setMessage('預覽：全班輪流念到 Boss 倒下。');
    if (next.won) {sound.play('victory', 0.2); sound.play('coins', 1.7);}
  }
  // Same on-device recognizer as the speaking challenge. It warms up as soon as the battle opens so the first score is not slow,
  // except on data-saver or very slow connections, where it waits until the learner asks for a score.
  // The battle is a full-screen page: site chrome (header, bottom nav, floating shortcut) is hidden while it is open.
  useEffect(() => {document.body.classList.add('sr-immersive'); return () => document.body.classList.remove('sr-immersive');}, []);
  const [tools, setTools] = useState(false), sound = useBattleSound();
  // On by default even when the device asks for reduced motion: on Windows that setting is often switched off for speed,
  // which silently hid every effect from the owner. The top-bar switch turns them off for anyone who needs that.
  const [effects, setEffects] = useState(true);
  // The battle switches its own animation off whenever the tab goes to the background and never turns it back on.
  // Remounting it when the tab is visible again restores the default (on, unless the device asks for reduced motion).
  const [wake, setWake] = useState(0);
  useEffect(() => {const awake = () => {if (!document.hidden) setWake(count => count + 1);}; document.addEventListener('visibilitychange', awake); return () => document.removeEventListener('visibilitychange', awake);}, []);
  // If a site header is still visible, the pinned battle starts below it.
  const shell = useRef(null);
  useEffect(() => {
    const header = document.querySelector('.app-header'); if (!header) return undefined;
    const apply = () => shell.current?.style.setProperty('--sr-sticky-top', Math.round(header.getBoundingClientRect().bottom) + 'px');
    const watch = new ResizeObserver(apply); apply(); watch.observe(header); window.addEventListener('resize', apply);
    return () => {watch.disconnect(); window.removeEventListener('resize', apply);};
  }, []);
  // Whoever opens the battle joins it; the Boss gains that classmate's share of HP the first time.
  useEffect(() => {setRounds(old => old.map(r => r.revision === activity ? join(r, learner) : r));}, [activity, learner]);
  // "聽本頁教材" opens the textbook's own recording for the sentence's page, through the same listening page the speaking
  // challenge links to: the Answer recording when there is one, otherwise the main one, with every part of a split page.
  // Both calls are read-only; without a login or a recording the button stays disabled.
  const {firebaseUser} = useAuth();
  const [listening, setListening] = useState({}), setId = q?.setId, pageKey = q ? q.setId + ':' + q.page : '', listen = listening[pageKey] || null;
  useEffect(() => {
    if (!firebaseUser || !pageKey || pageKey in listening) return undefined;
    let alive = true; const page = q.page;
    (async () => {
      let found = {path: null, count: 0};
      try {
        const challenge = (await getSpeakingChallengeSet(firebaseUser, setId, 'easy'))?.challenge, source = speakingListeningSource(challenge);
        const book = source ? await getAccessibleBook(firebaseUser, source.bookCode) : null;
        const tracks = listeningTracks((book?.tracks || []).filter(track => Number(track.book_id) === source.bookId), page);
        if (tracks.length) found = {path: speakingListeningPath(source, challenge.id, 'easy', tracks), count: tracks.length};
      } catch { /* optional: the battle works without it */ }
      if (alive) setListening(old => ({...old, [pageKey]: found}));
    })();
    return () => {alive = false;};
  }, [firebaseUser, pageKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const engine = useRef(null), live = useRef('');
  const [judge, setJudge] = useState({working: false, note: '', result: null}), [engineNote, setEngineNote] = useState(''), [card, setCard] = useState(null);
  const [mapLevel, setMapLevel] = useState(2), [inLevel, setInLevel] = useState(false), [avatar, setAvatar] = useState(avatars[0]);
  live.current = [activity, learner, q?.id].join(':');
  useEffect(() => {
    const held = retainLocalSpeakingRecognizer(), link = navigator.connection; let alive = true;
    engine.current = held.recognizer;
    if (link?.saveData || /(^|-)2g$/.test(link?.effectiveType || '')) setEngineNote('為了節省流量，第一次按「送出評分」時才會準備語音辨識。');
    else {
      setEngineNote('語音辨識準備中…可以先聽示範或錄音。');
      held.recognizer.prepare(note => {if (alive) setEngineNote('語音辨識準備中：' + note);}).then(() => {if (alive) setEngineNote('語音辨識準備好了。');}, () => {if (alive) setEngineNote('語音辨識還沒準備好，按「送出評分」時會再試一次。');});
    }
    return () => {alive = false; engine.current = null; held.release();};
  }, []);
  async function assess() {
    if (!recording.blob || !q || judge.working || resting) return;
    const scope = live.current, target = q, blob = recording.blob;
    setJudge({working: true, note: '正在準備語音辨識…', result: null});
    try {
      const wav = await convertAudioBlobToWav(blob, 16000, {maxSeconds: 25});
      await engine.current.prepare(note => setJudge(old => old.working ? {...old, note} : old));
      setJudge(old => ({...old, note: '正在聽你念的句子…'}));
      const heard = await engine.current.transcribe(wav, 25);
      if (scope !== live.current) {setJudge({working: false, note: '', result: null}); return;}
      const result = scoreReading(target.text, heard.recognizedText);
      setJudge({working: false, note: '', result: {...result, heard: heard.recognizedText.trim(), expected: target.text}});
      run(result.pass ? 'pass' : 'retry');
    } catch (error) {
      setJudge({working: false, note: '', result: null});
      if (scope === live.current) setMessage((error?.message || '語音辨識無法完成。') + ' 這不算跳過，也不扣愛心。');
    }
  }
  const struck = !!hit && Math.floor(hit.id / 1000) === activity, level = !struck ? 'none' : hit.combo ? 'combo' : hit.skill ? 'skill' : 'normal';
  const profiles = {label: m => names[m.member_key], canView: () => false};
  const snapshot = {mode: 'class_raid', team_name: round.config.classCode + ' 的森林冒險', team_version: activity, status: round.won ? 'won' : 'active', max_hp: round.maxHp, hp: round.hp,
    encounter: {boss_id: round.config.boss, presentation_version: 1, mechanics_profile: 'book-dragon-phases-v1', source: 'teacher_selected'},
    members: [learner].map(key => ({member_key: key, is_me: key === learner, currently_active: true, alias: names[key], character_id: characterOf(key), loadout: Object.entries(gearBy[key]).map(([slot, asset_key]) => ({slot, asset_key})), sources: round.progress[key].done.length, damage: round.progress[key].damage}))};
  return <main className="sr-preview" ref={shell} data-fx={effects ? 'on' : 'off'}>
    <div className="sr-topbar"><button type="button" className="sr-ghost" onClick={() => {if ((recording.blob || recording.phase === 'recording') && !window.confirm('你有一段錄音還沒送出，離開後要重錄。確定要離開嗎？')) return; if (window.history.length > 1) window.history.back(); else window.location.assign('/');}}>← 離開</button><strong>Boss 挑戰</strong><span className="sr-topbar-end"><button type="button" className="sr-ghost" aria-pressed={effects} aria-label={effects ? '關閉特效' : '開啟特效'} onClick={() => setEffects(on => !on)}>{effects ? '✨' : '💤'}</button><button type="button" className="sr-ghost" aria-pressed={!sound.muted} aria-label={sound.muted ? '開啟音效' : '關閉音效'} onClick={sound.toggle}>{sound.muted ? '🔇' : '🔊'}</button><button type="button" className="sr-ghost" aria-expanded={tools || view !== 'student'} disabled={view !== 'student'} aria-label="預覽工具" onClick={() => setTools(open => !open)}>⚙</button></span></div>
    {(tools || view !== 'student') && <div className="sr-toolbox">
    <div className="sr-concept"><strong>預覽版</strong><span>可以真的開口念，也能用模擬按鈕；不產生正式金幣或紀錄，重新整理會清除試玩。</span></div>
    <header className="sr-header"><div><h1>全班一起念，一起打倒 Boss</h1><p>同班同場題目順序相同，每個人依自己的步調練習，不會念可以先跳過。</p></div><nav aria-label="預覽畫面"><button aria-pressed={view === 'student'} onClick={() => {setView('student'); setConfirm(false);}}>學生戰場</button><button aria-pressed={view === 'teacher'} onClick={() => setView('teacher')}>老師設定</button><button aria-pressed={view === 'map'} onClick={() => {setView('map'); setConfirm(false);}}>地圖角色</button><button aria-pressed={view === 'settings'} onClick={() => {setView('settings'); setConfirm(false);}}>我的設定</button></nav></header>
    <details className="sr-settings"><summary>預覽設定：班級與場次</summary><div className="sr-tools"><label>示範班級<select aria-label="示範班級" value={code} onChange={e => selectClass(e.target.value)}>{CLASSES.map(c => <option key={c}>{c}</option>)}</select></label><label>已發布示範場<select aria-label="已發布示範場" value={activity} onChange={e => switchActivity(e.target.value)}>{rounds.filter(r => r.config.classCode === code).map(r => <option key={r.revision} value={r.revision}>第 {r.revision} 場 · {r.config.book} P{r.config.start}–{r.config.end}</option>)}</select></label></div></details>
    </div>}
    {view === 'teacher' ? <section className="sr-editor" aria-label="老師教材設定">
      <div className="sr-editor-title"><h2>替 {code} 準備下一場朗讀</h2><p>先核對精確頁碼與句子，再決定順序。修改草稿不會改掉已開始的場次。</p></div>
      <div className="sr-fields"><label>教材<select aria-label="教材" value={draft.book} onChange={e => changeDraft({book: e.target.value, selected: null})}><option>Workbook 4</option></select></label><label>單元<select value={draft.unit} aria-label="單元" onChange={e => changeDraft({unit: e.target.value, selected: null})}><option>{draft.unit}</option></select></label><label>學生版起頁<input aria-label="學生版起頁" inputMode="numeric" value={draft.start} onChange={e => changeDraft({start: e.target.value, selected: null})}/></label><label>學生版迄頁<input aria-label="學生版迄頁" inputMode="numeric" value={draft.end} onChange={e => changeDraft({end: e.target.value, selected: null})}/></label><label>開放天數<select aria-label="開放天數" value={draft.days} onChange={e => changeDraft({days: e.target.value})}>{['3', '5', '7', '14'].map(d => <option key={d} value={d}>{d} 天</option>)}</select></label><label>本場 Boss<select aria-label="本場 Boss" value={draft.boss} onChange={e => changeDraft({boss: e.target.value})}>{EXPANSION_PROFILES.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label></div>
      <div className="sr-paper-note">草稿只保留在本次頁面。預覽只放入 Workbook 4 P13／P15／P17 的 21 題（P14、P16 沒有題庫）。正式操作會限授權班級、已開通教材與已核准來源。</div>
      {!candidates(draft).length && <p role="alert">這個頁碼範圍沒有已發布的題目，請調整；不會自動加入其他頁。</p>}
      <h3>本場句子與順序 <span>已選 {chosen.length} / {candidates(draft).length} 句</span></h3><p className="sr-list-hint">全班都照這個順序念。用 ↑ ↓ 調整順序，不想放的句子按「移除」。</p>
      <ol className="sr-order">{chosen.map((item, i) => {const ids = chosen.map(x => x.id), move = to => {const next = [...ids]; [next[i], next[to]] = [next[to], next[i]]; changeDraft({selected: next});}; return <li key={item.id}><span><b>P{item.page}</b> {item.text}<small>Boss 問：{item.prompt}（{item.hint}）</small></span><button aria-label={'將第 ' + (i + 1) + ' 句上移'} disabled={!i} onClick={() => move(i - 1)}>↑</button><button aria-label={'將第 ' + (i + 1) + ' 句下移'} disabled={i === chosen.length - 1} onClick={() => move(i + 1)}>↓</button><button aria-label={'移除第 ' + (i + 1) + ' 句'} onClick={() => changeDraft({selected: ids.filter(id => id !== item.id)})}>移除</button></li>;})}</ol>
      {rest.length > 0 && <><h3>沒有放進本場 <span>{rest.length} 句</span></h3><ul className="sr-source-list">{rest.map(item => <li key={item.id}><span><b>P{item.page}</b> {item.text}<small>Boss 問：{item.prompt}（{item.hint}）</small></span><button aria-label={'加入 ' + item.text} onClick={() => changeDraft({selected: [...chosen.map(x => x.id), item.id]})}>加入</button></li>)}</ul></>}
      {!confirm ? <div className="sr-publish-bar"><span>已選 {chosen.length} 句 · Boss 血量 {'每位進場同學 +' + hpShare(chosen.length)} · 開放 {draft.days} 天</span><button className="sr-primary" disabled={!chosen.length} onClick={() => setConfirm(true)}>預覽發布內容</button></div> : <div className="sr-confirm" role="region" aria-label="示範發布確認"><h3>確認新場次</h3><p>{code} · {draft.book} · 學生版 P{draft.start}–{draft.end}，共 {chosen.length} 句，Boss 為{EXPANSION_PROFILES.find(b => b.id === draft.boss).name}，血量 {'每位進場同學 +' + hpShare(chosen.length)}（{chosen.length} 句 × {RULES.damage} × {RULES.hpRatio}；有同學第一次進場才加上他那一份），開放 {draft.days} 天。原場次與進度會保留。</p><button className="sr-primary" onClick={() => {const next = join(publish(draft, Math.max(...rounds.map(r => r.revision)) + 1), learner); setRounds(old => [...old, next]); setActivity(next.revision); setView('student'); setConfirm(false); setReview(null); setCounter(null); setMessage('新的示範場已準備好，所有同學使用同一份固定順序。');}}>建立新的示範場</button><button onClick={() => setConfirm(false)}>返回修改</button></div>}
    </section> : view === 'map' ? <section className="sr-map" aria-label="口說大挑戰地圖示意">
      <h2>口說大挑戰地圖（示意）</h2><p>你的角色會站在下一個要破的關卡旁邊，穿著目前的裝備；進入關卡後不顯示角色。這頁只是示意，真正的地圖畫面不變。</p>
      {inLevel ? <div className="sr-map-level"><h3>Workbook 4 · {mapLevels[mapLevel]} 口說練習</h3><p>關卡裡維持原本念句子的畫面，這裡不會出現角色。</p><button className="sr-primary" onClick={() => {setInLevel(false); setMapLevel(level => Math.min(mapLevels.length - 1, level + 1));}}>模擬：破關並回到地圖</button><button onClick={() => setInLevel(false)}>先返回地圖</button></div>
        : <ol className="sr-map-road">{mapLevels.map((name, i) => <li key={name} data-state={i < mapLevel ? 'done' : i === mapLevel ? 'current' : 'locked'}><button aria-label={name + (i < mapLevel ? ' 已破關' : i === mapLevel ? ' 進入關卡' : ' 尚未開放')} disabled={i !== mapLevel} onClick={() => setInLevel(true)}>{i < mapLevel ? '✓' : i + 1}</button><span>{name}{i === mapLevel ? ' · 下一關' : ''}</span>{i === mapLevel && <div className="sr-map-hero" role="img" aria-label="我的遊戲角色"><TeamBossNativeArt character={character} loadout={gearBy[learner]} frame={0}/></div>}</li>)}</ol>}
      {!inLevel && <button onClick={() => setMapLevel(0)}>從第 1 關重新示範</button>}
    </section> : view === 'settings' ? <section className="sr-settings-mock" aria-label="我的設定示意">
      <h2>我的設定（示意）</h2><p>頭貼和遊戲角色分開設定，互不影響。這頁只是示意，選擇不會被儲存。</p>
      <div className="sr-setting-block"><h3>我的頭貼</h3><p>維持現在的方式自己決定，用在好友、排行榜等地方。</p><div className="sr-avatar-row">{avatars.map(item => <button key={item} aria-label={'頭貼 ' + item} aria-pressed={avatar === item} onClick={() => setAvatar(item)}>{item}</button>)}</div></div>
      <div className="sr-setting-block"><h3>我的遊戲角色</h3><p>用在 Boss 戰場和口說大挑戰地圖。劍士每念對 3 句發動月光斬，法師發動星光術。</p><div className="sr-hero-grid">{NATIVE_CHARACTERS.map(item => <button key={item.id} aria-pressed={character === item.id} onClick={() => setCharacter(item.id)}><TeamBossNativeArt character={item.id} loadout={character === item.id ? gearBy[learner] : {weapon: 'oak-wand'}} frame={0}/><b>{item.name}</b><small>{item.id.endsWith('mage') ? '法師 · 星光術' : '劍士 · 月光斬'}</small></button>)}</div><p className="sr-setting-note">目前裝備：傷害 +{percent(gear.damage)}% · Boss 金幣 +{percent(gear.gold)}%（到「學生戰場」的「我的裝備」試穿）</p></div>
    </section> : <>
      {tools && <div className="sr-player-tools"><details className="sr-settings"><summary>預覽設定：試玩身份與角色</summary><div className="sr-settings-row"><label>試玩身份<select aria-label="試玩身份" value={learner} onChange={e => {setLearner(e.target.value); setReview(null); setCounter(null); setArrivals([]); setMessage('已切換同學，每個人有自己的題號與補練清單。');}}>{LEARNERS.map(l => <option key={l} value={l}>{names[l]}</option>)}</select></label><label>我的角色<select aria-label="我的角色" value={character} onChange={e => setCharacter(e.target.value)}>{NATIVE_CHARACTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div></details></div>}
      <div className="sr-stage">
      <div className="team-boss-page sr-battle-wrap" data-impact={struck ? (hit.id % 2 ? 'a' : 'b') : 'none'} data-level={level} data-counter={counter ? (counter.flip ? 'a' : 'b') : 'none'} data-won={round.won}>
        <div className="sr-hud" role="status"><div className="sr-side sr-side-me"><span className="sr-hearts" key={learner + hearts} role="img" aria-label={'我的愛心 ' + hearts + ' / ' + RULES.hearts}><b>我</b>{Array.from({length: RULES.hearts}, (_, i) => <svg key={i} viewBox="0 0 24 24" data-full={i < hearts} aria-hidden="true"><path d={HEART}/></svg>)}</span>{counter && <b key={counter.id} className="sr-pop sr-pop-me" aria-label="反擊，愛心減 1"><em>−1</em><svg viewBox="0 0 24 24" aria-hidden="true"><path d={HEART}/></svg></b>}</div><div className="sr-side sr-side-boss"><div className="sr-bossline"><strong>{EXPANSION_PROFILES.find(b => b.id === round.config.boss)?.name}</strong><span>{round.hp} / {round.maxHp}</span></div><div className="sr-hpbar-track" role="progressbar" aria-label="Boss 生命" aria-valuemin={0} aria-valuemax={round.maxHp} aria-valuenow={round.hp}><u style={{width: (round.maxHp ? round.hp / round.maxHp * 100 : 0) + '%'}}/><i style={{width: (round.maxHp ? round.hp / round.maxHp * 100 : 0) + '%'}}/></div></div></div>
        {struck && <div className="sr-fx" key={hit.id} data-kind={hit.mage ? 'mage' : 'knight'} data-level={level} aria-hidden="true">{level !== 'normal' && <><i className="sr-fx-dim"/><b className="sr-fx-banner">{hit.combo ? '全班合體技！' : hit.skill === 'star-cast' ? '星光術！' : '月光斬！'}</b></>}<i className="sr-fx-trail"/><i className="sr-fx-burst"/>{level !== 'normal' && <i className="sr-fx-burst sr-fx-burst-2"/>}{hit.combo && <i className="sr-fx-burst sr-fx-burst-3"/>}{level !== 'normal' && <i className="sr-fx-flash"/>}<b className="sr-pop sr-pop-boss"><em>−{hit.damage}</em></b></div>}
        {round.won && <div className="sr-coins" key={'coins' + activity} aria-hidden="true">{Array.from({length: 16}, (_, i) => <i key={i} style={{left: i * 6.1 + 3 + '%', animationDelay: (i * 7 % 5) * 0.13 + 's'}}/>)}</div>}
        <NativeBattle key={activity + ':' + learner + ':' + wake} profiles={profiles} state={{snapshot, history: round.events, arrivals, busy: false, error: null, refresh: () => setMessage('概念版戰況保留在本頁；正式即時同步尚待串接。')}} onWardrobe={() => setMessage('這版專注朗讀流程；原裝備室與商店保留，尚未接入這個獨立概念。')}/>
      </div>
      </div>
      {card && <TeamBossClassProfileCard onClose={() => setCard(null)} card={{busy: false, error: null, data: {available: true, is_me: card === learner, nickname: names[card], alias: names[card], real_name: null, class_code: round.config.classCode, stats: null, damage: round.progress[card].damage, sources: round.progress[card].done.length}}}/>}
      {round.won && <section className="sr-victory" aria-label="勝利結算"><p className="sr-victory-title">勝利！</p><p>全班一起打倒了{EXPANSION_PROFILES.find(b => b.id === round.config.boss)?.name}</p><div className="sr-victory-gold"><span>我拿到</span><strong>{mine.gold}</strong><span>金幣</span></div><dl><div><dt>念對 {mine.correct} 句的保底</dt><dd>{mine.base}</dd></div><div><dt>打倒 Boss 加碼（我的傷害 {mine.damage}）</dt><dd>{mine.bonus}</dd></div><div><dt>裝備加成 +{percent(gear.gold)}%</dt><dd>{mine.equip}</dd></div></dl><ol>{[...pay].sort((a, b) => b.damage - a.damage).map((r, i) => <li key={r.key} data-me={r.key === learner}><i aria-hidden="true">{i + 1}</i><b>{r.key === learner ? '我' : names[r.key]}</b><span>念對 {r.correct} 句 · 傷害 {r.damage}</span><strong>{r.gold} 金幣</strong></li>)}</ol>{p.skipped.length > 0 && <p className="sr-victory-note">你還有 {p.skipped.length} 句待補練，之後可以到口說大挑戰繼續練。</p>}{mine.correct === 0 && <p className="sr-victory-note">這一場你還沒念對句子，所以沒有金幣；下一場一起加油。</p>}</section>}
      <section className="sr-reading" data-over={round.won && !q} aria-label="Boss朗讀句子"><div className="sr-reading-head"><span>{review ? '補練時間' : '輪到你朗讀'}</span><strong>{q ? '第 ' + (round.questions.findIndex(x => x.id === q.id) + 1) + ' / ' + round.questions.length + ' 句' : '本輪句子已看完'} · 已完成 {p.done.length} 句</strong></div>
        <h2>{round.won ? (q ? 'Boss 倒下了！把剩下的句子念完，一樣算保底金幣：' : '全班一起打倒 Boss 了！') : q ? 'Boss 問你：' : p.skipped.length ? '還有句子等你回來補練' : '你完成了本場所有句子'}</h2>
        {q && <><p className="sr-prompt" lang="en" data-testid="prompt">{q.prompt}<span lang="zh-Hant">（{q.hint}）</span></p>{resting && <p className="sr-rest" role="status">愛心用完了，角色休息中… {Math.ceil((p.restUntil - now) / 1000)} 秒後愛心全滿，就能繼續。</p>}<p className="sr-answer-label">請念出這句回答：</p><p className="sr-sentence" lang="en" data-testid="sentence">{q.text}</p><p className="sr-source">{round.config.book} · 學生版 P{q.page} · 再念對 {RULES.skillEvery - p.done.length % RULES.skillEvery} 句發動{character.endsWith('mage') ? '星光術' : '月光斬'}</p><div className="sr-read-actions"><button disabled={['permission', 'recording', 'stopping'].includes(recording.phase)} onClick={() => recording.listen(q.text)}>🔈 聽這句示範</button>{recording.phase === 'recording' ? <button className="sr-record" onClick={recording.stop}>停止錄音</button> : recording.phase === 'permission' ? <button onClick={() => recording.cancel()}>取消麥克風請求</button> : <button className="sr-record" disabled={resting || recording.phase === 'stopping'} onClick={recording.start}>開始錄音</button>}{recording.blob && <button className="sr-primary" disabled={judge.working || resting} onClick={assess}>{judge.working ? '評分中…' : '送出評分'}</button>}{listen?.path ? <a className="sr-listen" href={listen.path}>🎧 聽本頁教材{listen.count > 1 ? '（' + listen.count + ' 段）' : ''}</a> : <button disabled>🎧 聽本頁教材</button>}<button disabled={resting || judge.working} onClick={() => run('skip')}>先跳過</button></div>{recording.url && <audio controls src={recording.url} aria-label="回聽我的錄音"/>}<p role="status">{recording.message}</p><small>{engineNote} 錄音只在這台裝置上辨識，不會上傳。「聽這句示範」用的是這台裝置內建的語音，免費，聲音比較機械。{listen?.path ? '「聽本頁教材」會離開戰場，去聽這一頁的教材錄音（有 Answer 錄音就聽 Answer）。' : !firebaseUser ? '這個預覽沒有登入，無法連到教材聽力。' : listen ? '這一頁找不到可以聽的教材錄音。' : '正在找這一頁的教材錄音…'}</small></>}
        {judge.working && <p className="sr-heard" role="status">{judge.note}</p>}{judge.result && <p className="sr-heard" role="status" data-pass={judge.result.pass}><b>{judge.result.pass ? '過關！' : '還差一點'} 朗讀完整度 {judge.result.score} 分</b><span lang="en">{judge.result.words.map((word, i) => <i key={i} data-hit={word.hit}>{word.text}</i>)}</span><small>系統聽到：「{judge.result.heard}」。這是有沒有把句子念完整，不是發音準確度。</small></p>}
        <details className="sr-lab" open={!round.won}><summary>不開口也能測：手動模擬評分（預覽專用）</summary><p>不方便用麥克風時，用這三個按鈕代替評分結果。</p><div><button disabled={!q || resting} onClick={() => run('pass')}>模擬：念對了（70 分以上）</button><button disabled={!q || resting} onClick={() => run('retry')}>模擬：未達 70 分</button><button disabled={!q || resting} onClick={() => run('technical')}>模擬：網路或評分失敗</button></div><div><button disabled={round.won} onClick={finish}>模擬：全班一起念到打倒 Boss</button></div><details className="sr-rules"><summary>查看規則</summary><p>規則：每念對一句 100 點傷害，同一句只算一次；每念對 3 句發動技能（劍士月光斬 ×2、法師星光術 ×1.5 並多 1 格全班能量）；全班能量集滿「人數 × 2」自動發動合體技，扣 Boss 最大血量 5%。Boss 血量＝每位進場同學 × 句數 × 100 × 2；Boss 倒下後還能繼續念完，照樣算保底金幣。跳過扣 1 顆愛心（固定 1 顆），念對一句回 1 顆；愛心歸零休息 10 秒後全滿，不扣金幣、不影響同學。</p></details></details>
        <p className="sr-feedback" role="status">{message}</p>
        <details className="sr-review-list" open={p.skipped.length > 0}><summary>待補練 {p.skipped.length} 句</summary>{p.skipped.length ? <ul>{round.questions.filter(x => p.skipped.includes(x.id)).map(item => <li key={item.id}><span lang="en">{item.text}</span><button onClick={() => {setReview(item.id); setMessage('補練念對一樣會攻擊 Boss；先聽示範，再試一次。');}}>補練這句</button></li>)}</ul> : <p>跳過的句子會放在這裡，不影響其他人的進度。</p>}{review && <button onClick={() => setReview(null)}>返回目前題號</button>}</details>
        <details className="sr-rewards" open={round.won} aria-label="金幣結算試算"><summary>{round.won ? '打倒 Boss！金幣結算' : '我目前可拿 ' + mine.gold + ' 金幣 · 看全班試算'}</summary><ul>{pay.map(r => <li key={r.key}><b>{names[r.key]}</b><span>念對 {r.correct} 句 · 傷害 {r.damage}</span><strong>{r.gold} 金幣</strong><small>{r.correct ? '保底 ' + r.base + (round.won ? ' ＋ 加碼 ' + r.bonus : '') + (r.equip ? ' ＋ 裝備 ' + r.equip : '') : '還沒念對任何一句，沒有金幣'}</small></li>)}</ul><small>保底＝每念對 1 句 3 金幣，最多 30（念對 10 句拿滿）。加碼總額＝參加人數 × 20，依個人傷害占比分配；裝備的金幣加成只套用在 Boss 金幣。</small></details>
      </section>
      <section className="sr-class" aria-label="全班同學"><div className="sr-energy"><span>全班能量 {round.energy} / {round.energyThreshold} · 合體技 {round.combos} 次 · 開放 {round.config.days} 天</span><progress value={round.energy} max={round.energyThreshold} aria-label="全班能量"/></div><ul>{LEARNERS.map(key => <li key={key} data-me={key === learner} data-acting={round.events.at(-1)?.member_key === key}><button type="button" aria-label={'查看 ' + names[key] + ' 的資料'} onClick={() => setCard(key)}><i aria-hidden="true">{names[key][0]}</i><b>{key === learner ? '我' : names[key]}</b><small>{round.joined.includes(key) ? '念對 ' + round.progress[key].done.length + ' 句' + (round.events.at(-1)?.member_key === key ? ' · 剛出手' : '') : '還沒進場'}</small></button></li>)}</ul></section>
      <details className="sr-gear"><summary>我的裝備 · 傷害 +{percent(gear.damage)}% · Boss 金幣 +{percent(gear.gold)}%</summary><div className="sr-gear-grid">{NATIVE_SLOTS.map(slot => <label key={slot}>{slotNames[slot]}<select aria-label={'裝備：' + slotNames[slot]} value={gearBy[learner][slot] || ''} onChange={e => setGearBy(old => {const outfit = {...old[learner]}; if (e.target.value) outfit[slot] = e.target.value; else delete outfit[slot]; return {...old, [learner]: outfit};})}><option value="">沒有裝備</option>{NATIVE_ITEMS.filter(item => item.slot === slot).map(item => {const tier = GEAR_TIERS[ITEM_TIERS[item.id]]; return <option key={item.id} value={item.id}>{item.name}（{tier.label}{tier.price ? ' ' + tier.price + ' 金幣' : ' 免費'}）</option>;})}</select></label>)}</div><small>預覽可以直接試穿，不扣金幣；這套裝備在商店總價 {gear.cost} 金幣。全身加成上限：傷害 +30%、Boss 金幣 +10%。每件傷害加成：普通 +2%、稀有 +4%、史詩 +6%。</small></details>
    </>}
    <footer>Alan English · 學英文是冒險的力量。概念角色／班級均為示範。</footer>
  </main>;
}
