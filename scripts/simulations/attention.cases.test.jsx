import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Provider, useSelector } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';
import { useAuth } from '../../src/auth/AuthContext';
import * as assignments from '../../src/services/assignmentService';
import * as listening from '../../src/services/listeningService';
import { getAccessibleBook } from '../../src/services/contentAccessService';
import { recordSpeakingAttention, recordListeningPause } from '../../src/services/learningActivityService';
import { clearStudentPageCache } from '../../src/services/studentPageCache';
import { clearStaffPageCache } from '../../src/services/staffPageCache';
import { sanitizeAssignmentDraft, saveTeacherAssignmentDraft, clearTeacherAssignmentDraft } from '../../src/services/teacherAssignmentDraft';
import { buildAssignmentTitle } from '../../src/components/Pages/assignmentTitle';
import { mergeTrackIds, removeTrackIds, groupSelectedTracks } from '../../src/components/Pages/assignmentTrackSelection';
import { mergeCoverageRange, getCoveredSeconds, isNaturalListeningInterval } from '../../src/utils/listeningCoverage';
import { roundFocusRate, focusLevel } from '../../src/utils/focusRate';
import { normalizeListeningTracks } from '../../src/utils/assignmentListening';
import { buildAttention, buildSpeakingAttention } from '../../supabase/functions/weekly-report/attention.ts';
import useSpeakingAttention, { SPEAKING_IDLE_MS, SPEAKING_ATTENTION_THROTTLE_MS } from '../../src/hooks/useSpeakingAttention';
import useSpeakingFocusLock, { SPEAKING_FOCUS_KEY, SPEAKING_FOCUS_TTL_MS } from '../../src/hooks/useSpeakingFocusLock';
import StudentAssignments from '../../src/components/Pages/StudentAssignments';
import TeacherAssignments from '../../src/components/Pages/TeacherAssignments';
import StudentNavbar from '../../src/components/fragment/StudentNavbar';
import MusicPlayer from '../../src/components/fragment/MusicPlayer';
import Playlist from '../../src/components/fragment/Playlist';
import musicReducer from '../../src/reducers/musicReducer';

jest.mock('../../src/auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../src/services/assignmentService', () => Object.fromEntries([
    'createAssignment', 'createAssignmentV2', 'getTeacherAssignmentBootstrap', 'getTeacherAssignments',
    'deleteAssignment', 'getAssignmentResults', 'previewAssignmentV2', 'upsertPageLearningContent',
    'getStudentAssignments', 'getStudentAssignmentsV2', 'submitAssignment', 'submitAssignmentV2Ai'
].map(name => [name, jest.fn()])));
jest.mock('../../src/services/listeningService', () => ({ startListeningSession: jest.fn(), recordTrackPlay: jest.fn(), getBookPlaybackProgress: jest.fn() }));
jest.mock('../../src/services/contentAccessService', () => ({ getAccessibleBook: jest.fn() }));
jest.mock('../../src/services/learningActivityService', () => ({ recordSpeakingAttention: jest.fn(), recordListeningPause: jest.fn() }));
jest.mock('../../src/services/attendanceService', () => ({ getStudentMakeups: jest.fn(() => Promise.resolve({ sessions: [] })) }));
jest.mock('../../src/components/Pages/ListeningTTSPlayer', () => () => null);
jest.mock('react-toastify', () => ({ toast: { info: jest.fn(), error: jest.fn(), success: jest.fn() } }));
// Keep all production MusicPlayer callbacks; only the third-party media adapter is fake.
jest.mock('react-h5-audio-player', () => {
    const React = require('react');
    return { __esModule: true, RHAP_UI: {}, default: React.forwardRef((props, ref) => {
        const audio = React.useRef(null);
        React.useImperativeHandle(ref, () => ({ audio }));
        return <><audio data-testid="audio" ref={audio} onPlay={props.onPlay} onPause={props.onPause}
            onEnded={props.onEnded} onTimeUpdate={props.onListen} onSeeking={props.onSeeking} onSeeked={props.onSeeked} />
            <div data-testid="media-controls">{props.customControlsSection}</div></>;
    }) };
});

const root = path.resolve(__dirname, '../..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');
const evidence = (file, marker) => ({ file, line: source(file).slice(0, source(file).indexOf(marker)).split('\n').length });
const results = { A: [], B: [], C: [], D: [], findings: [], boundaries: [], sourceEvidence: [] };
const add = (section, sample) => results[section].push(sample);
const finding = (title, file, marker, reproduction, fix) => results.findings.push({ title, ...evidence(file, marker), reproduction, fix });
const user = { uid: 'offline-student' };
const now = Date.parse('2026-11-03T02:00:00Z');
const book = { id: 1, name: 'Workbook 1', code: 'Workbook_1' };
const tracks = [11, 12, 13].map((id, i) => ({ id, book_id: 1, book, title: `P${22 + i * 2}`, page: `P${22 + i * 2}`, audio_url: 'offline-audio' }));
const homework = { id: 4, title: '11/3 E1 Workbook 1 P22～P26', target_class: 'E1', source_type: 'music_track',
    assigned_date: '2026-11-03', due_at: '2099-11-10T15:59:00Z', required_listens: 3, listening_progress_mode: 'assignment_window',
    tracks: tracks.map(track => ({ track, play_count: 0, required_listens: 3 })), progress: {} };
const profile = (type = 'academy_student', classCode = 'E1') => ({ name: '模擬學生', class: classCode, learner_type: type,
    enrollment_status: 'active', membership: { is_active: true, effective_access: { features: { assignments: type === 'academy_student', pronunciation: true } } } });
const store = () => configureStore({ reducer: { musicReducer } });
const mount = (ui, route = '/student/assignments', state = store()) => render(<Provider store={state}><MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter></Provider>);
const visible = state => act(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
    document.dispatchEvent(new Event('visibilitychange'));
});
const tick = ms => act(() => jest.advanceTimersByTime(ms));
const compact = node => node.textContent.replace(/\s+/g, ' ').trim();
const links = () => [...document.querySelectorAll('a')].map(a => ({ text: compact(a), href: a.getAttribute('href') }));
function focusSummary(valid, pauses = [], speaking = false, completed = valid ? 1 : 0) {
    const events = pauses.map(reason => ({ activity_type: speaking ? 'other' : 'listening',
        activity_key: speaking ? `speaking-pause-${reason}` : `pause-${reason}`, occurred_at: new Date(now).toISOString() }));
    const input = { events, dailyBreakdown: [{ date: '2026-11-03', listening: valid ? 1 : 0, speaking_challenge: completed }], weekStartDate: '2026-11-02' };
    const summary = speaking ? buildSpeakingAttention(input) : buildAttention(input);
    const rounded = roundFocusRate(summary.focus_rate);
    return { rawFocusRate: summary.focus_rate, roundFocusRate: rounded, focusLevel: focusLevel(rounded), summary };
}
// Execute verbatim pure function bodies from the Edge source, stripping TS only.
const edgeFile = 'supabase/functions/record-play/index.ts';
const edgeText = source(edgeFile);
const pureEdge = edgeText.slice(edgeText.indexOf('const MINIMUM_LISTENING_COVERAGE'), edgeText.indexOf('async function verifyFirebaseIdToken'));
const edge = vm.runInNewContext(ts.transpileModule(`${pureEdge}\n;({validateCompletion});`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText);

beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    localStorage.clear(); sessionStorage.clear(); clearStudentPageCache(); clearStaffPageCache(); clearTeacherAssignmentDraft();
    visible('visible');
    useAuth.mockReturnValue({ firebaseUser: user, role: 'student', studentProfile: profile() });
    assignments.getStudentAssignments.mockResolvedValue({ assignments: [homework], today: '2026-11-03' });
    assignments.getStudentAssignmentsV2.mockResolvedValue({ assignments: [] });
    assignments.getTeacherAssignments.mockResolvedValue({ assignments: [] });
    assignments.getTeacherAssignmentBootstrap.mockResolvedValue({ classes: ['E1', 'E3', 'E5', 'E7'],
        class_materials: ['E1', 'E3', 'E5', 'E7'].map(class_code => ({ class_code, books: [book] })), tracks, page_content: [], ai_materials: [] });
    assignments.createAssignment.mockResolvedValue({ success: true });
    getAccessibleBook.mockResolvedValue({ book, tracks });
    listening.getBookPlaybackProgress.mockResolvedValue({ progress: [] });
    listening.startListeningSession.mockResolvedValue({ session: { id: 'offline-session' } });
    listening.recordTrackPlay.mockResolvedValue({ counted: true, progress: { track_id: 11, play_count: 1 } });
    recordSpeakingAttention.mockResolvedValue({ success: true });
    recordListeningPause.mockResolvedValue({ success: true });
    // Install directly: a spy restored before fake-clock uninstall can delete RAF
    // in Jest 27 and poison later tests. Each test owns a fresh inert adapter.
    window.requestAnimationFrame = () => 0;
    window.cancelAnimationFrame = () => {};
    jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function () {
        Object.defineProperty(this, 'paused', { configurable: true, value: false }); fireEvent.play(this); return Promise.resolve();
    });
    jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function () {
        Object.defineProperty(this, 'paused', { configurable: true, value: true }); fireEvent.pause(this);
    });
});
afterEach(() => { cleanup(); jest.useRealTimers(); jest.restoreAllMocks(); });
afterAll(() => {
    results.networkAttempts = global.__offlineAttempts;
    results.boundaries.push(
        '全程使用合成學生、音檔與服務回覆；沒有呼叫遠端，沒有讀取 .env。',
        'B 的同班／別班回覆是 API 契約假資料；StudentAssignments 本身不篩選班級，不能證明正式後端隔離。',
        'C 的有效聆聽是實際前端送出的區段經實際 Edge 純驗證所得的模擬資格；最終 counted、資料庫時間驗證、session 冪等及作業計次均未執行。',
        '專注度使用真實週報純函式：有效聆聽／（有效聆聽＋idle＋hidden）；口說以完成題數取代有效聆聽。完成口說題數為各樣本指定假資料，不是執行錄音或評分。',
        'jsdom 不會載入音檔／圖片；未驗收真實音訊、帳號、iPhone、Safari、R2 Range 或正式站。',
        '僅新增 scripts/simulations 與 docs/simulations；未更新既有狀態文件與手冊，未執行完整測試或正式 build，因本批無正式程式碼修改。'
    );
    fs.writeFileSync(path.join(root, 'docs/simulations/attention-results.json'), JSON.stringify(results, null, 2));
});

describe('A 老師建立聽力作業', () => {
    test.each(['E1', 'E3', 'E5', 'E7'])('%s：真實選曲、標題及草稿純函式', classCode => {
        const ids = removeTrackIds(mergeTrackIds([11], [12, 13, 11]), [12]);
        expect(ids).toEqual([11, 13]);
        const title = buildAssignmentTitle({ assignedDate: '2026-11-03', classCode, groups: groupSelectedTracks(tracks, ids) });
        expect(title).toBe(`11/3 ${classCode} Workbook 1 P22～P26`);
        const draft = sanitizeAssignmentDraft({ form: { title, target_class: classCode, assigned_date: '2026-11-03', due_date: '2026-11-10', required_listens: 3 }, trackIds: ids });
        expect(draft.form.source_type).toBe('music_track'); expect(draft.trackIds).toEqual(ids);
        add('A', { name: `${classCode} 班選兩首`, title, tracks: ids, assignedDate: draft.form.assigned_date, dueDate: draft.form.due_date, listens: draft.form.required_listens, outcome: '標題自動產生，草稿保留日期、班級與次數', reason: '選曲去重後，依日期、班級與教材頁碼命名。', proof: '真實純函式' });
    });
    test('空白及不存在的班級被純邏輯拒絕；Edge 必填、次數限制契約', () => {
        for (const target_class of ['', 'E2']) expect(sanitizeAssignmentDraft({ form: { target_class } }).form.target_class).toBe('');
        expect(buildAssignmentTitle({ assignedDate: '2026-11-03', classCode: '', groups: [] })).toBe('');
        const text = source('supabase/functions/assignment-manager/index.ts');
        const start = text.indexOf('const title = String(body?.title || "").trim()');
        const end = text.indexOf('const managedCodes = await', start);
        const body = text.slice(start, end);
        const validate = input => vm.runInNewContext(`(function(){${body}\nreturn {title, targetClass, assignedDate, dueAt, requiredListens};})()`, {
            body: input, CLASS_CODES: new Set(['E1', 'E3', 'E5', 'E7']), taiwanDate: () => '2026-11-03', json: (status, data) => ({ status, ...data }) });
        const valid = { title: '聽力', target_class: 'E1', required_listens: 99 };
        expect(validate({ ...valid, target_class: '' }).status).toBe(400);
        expect(validate({ ...valid, title: '' }).status).toBe(400);
        expect(validate(valid).requiredListens).toBe(10);
        expect(validate({ ...valid, required_listens: -2 }).requiredListens).toBe(1);
        expect(validate(valid).assignedDate).toBe('2026-11-03');
        expect(() => validate({ ...valid, due_at: 'bad-date' })).toThrow();
        expect(text).toContain('請至少選擇一個聽力音檔');
        add('A', { name: '必填與日期契約', outcome: '空白名稱／班級回傳 400；次數限制在 1–10；空白發布日預設今天；錯誤截止日拋例外', reason: '只執行 Edge 原始碼中不接觸資料庫的驗證片段；無音檔及班級授權僅讀碼。', proof: '純驗證片段＋讀碼契約' });
        finding('錯誤截止日期在驗證前就拋例外', 'supabase/functions/assignment-manager/index.ts', 'const dueAt = body?.due_at\n', '以 due_at="bad-date" 執行 create_assignment 的原始純驗證片段，toISOString 拋 RangeError，無法回傳預期日期提示；未呼叫端點。', '先用 Date.parse 檢查有效性，再轉 ISO，回傳明確 400；兩條建立路徑均應檢查。');
    });
    test('老師元件：缺名稱／缺音檔會阻擋下一步', async () => {
        useAuth.mockReturnValue({ firebaseUser: user, role: 'teacher' });
        mount(<TeacherAssignments />);
        fireEvent.click(screen.getByRole('tab', { name: /建立作業/ }));
        await waitFor(() => expect(screen.getByLabelText('作業名稱')).toBeEnabled());
        fireEvent.click(screen.getByRole('button', { name: '下一步' }));
        expect(screen.getByText(/請先填寫作業名稱/)).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('發布班級'), { target: { value: 'E1' } });
        fireEvent.click(screen.getByRole('button', { name: '下一步' }));
        fireEvent.click(screen.getByRole('button', { name: '下一步' }));
        expect(screen.getByText('請至少選擇一個教材活動。')).toBeInTheDocument();
        expect(assignments.createAssignment).not.toHaveBeenCalled();
        add('A', { name: '忘填名稱或忘選音檔', outcome: '元件擋下發布，服務呼叫 0 次', reason: '老師會先看到中文提醒，補齊內容才能繼續。', proof: 'RTL 真實老師元件' });
    });
    test.each([['空白日期', '', ''], ['截止早於發布', '2026-11-10', '2026-11-03']])('老師元件日期實際行為：%s', async (name, assigned_date, due_date) => {
        useAuth.mockReturnValue({ firebaseUser: user, role: 'teacher' });
        saveTeacherAssignmentDraft(user.uid, { form: { title: '日期測試', target_class: 'E1', assigned_date, due_date, required_listens: 3 }, bookId: '1', trackIds: [11] });
        mount(<TeacherAssignments />);
        fireEvent.click(screen.getByRole('tab', { name: /建立作業/ }));
        await waitFor(() => expect(screen.getByRole('button', { name: '恢復草稿' })).toBeEnabled());
        fireEvent.click(screen.getByRole('button', { name: '恢復草稿' }));
        fireEvent.click(screen.getByRole('button', { name: '下一步' }));
        fireEvent.click(screen.getByRole('button', { name: '下一步' }));
        fireEvent.click(screen.getByRole('button', { name: '發布作業' }));
        await waitFor(() => expect(assignments.createAssignment).toHaveBeenCalledTimes(1));
        const payload = assignments.createAssignment.mock.calls[0][1];
        expect(payload.assigned_date).toBe(assigned_date);
        expect(payload.due_at).toBe(due_date ? `${due_date}T15:59:00.000Z` : null);
        add('A', { name, outcome: '目前仍送出到假服務（日期需求缺口）', payload, reason: '目前表單沒有擋下空白日期或日期倒置；未真的發布。', proof: 'RTL 真實老師元件' });
        finding(`老師表單未擋下${name}`, 'src/components/Pages/TeacherAssignments.jsx', 'const submit = async event', `恢復含有效班級與音檔的草稿，日期設為 ${assigned_date || '空白'}／${due_date || '空白'}，下一步兩次後發布；假服務仍收到 payload。`, '明確定義截止日可否空白；發布前檢查必填日、有效日期及截止不早於發布，後端同步驗證。');
    });
});

describe('B 學生看到的作業與導覽（假 API 契約）', () => {
    test.each([
        ['在學同班', 'academy_student', 'E1', true, true], ['在學別班', 'academy_student', 'E3', true, false],
        ['網購者', 'textbook_customer', '', false, false], ['七天試用者', 'trial_user', '', false, false]
    ])('%s', async (name, type, classCode, entry, seesWork) => {
        const p = profile(type, classCode);
        useAuth.mockReturnValue({ firebaseUser: user, role: 'student', studentProfile: p });
        assignments.getStudentAssignments.mockResolvedValue({ assignments: seesWork ? [homework] : [], today: '2026-11-03' });
        const view = mount(<><StudentNavbar profile={p} firebaseUser={user} notifications={[]} categories={[]} growthSummary={null} /><StudentAssignments /></>);
        await waitFor(() => expect(assignments.getStudentAssignments).toHaveBeenCalled());
        await act(async () => {});
        const entrances = links().filter(a => a.href === '/student/assignments');
        expect(entrances.length > 0).toBe(entry);
        expect(Boolean(screen.queryByRole('heading', { name: homework.title }))).toBe(seesWork);
        if (!seesWork) expect(document.body.textContent).not.toContain(homework.title);
        add('B', { name, outcome: seesWork ? '看見同班聽力作業' : '沒有這份作業', assignmentEntry: entry, links: links(), text: compact(view.container), reason: entry ? (seesWork ? '假 API 回傳同班作業，導覽有作業入口。' : '假 API 回空清單；仍保留自己班級的作業入口。') : '假會員權限沒有 assignments；導覽隱藏作業入口，假 API 回空清單。', proof: 'RTL 真實 StudentAssignments＋StudentNavbar；無掛載正式路由守門' });
    });
    test('別班資料誤回時：頁面信任 API；後端班級篩選只做讀碼契約', async () => {
        useAuth.mockReturnValue({ firebaseUser: user, role: 'student', studentProfile: profile('academy_student', 'E3') });
        mount(<StudentAssignments />);
        await screen.findByRole('heading', { name: homework.title });
        const text = source('supabase/functions/assignment-manager/index.ts');
        expect(text).toContain('assignment.target_class === enrollmentClass');
        expect(text).toContain('.eq("status", "active")');
        results.sourceEvidence.push(evidence('supabase/functions/assignment-manager/index.ts', 'assignment.target_class === enrollmentClass'));
        results.boundaries.push('若假 API 刻意回傳別班作業，E3 頁面仍顯示 E1 作業；隔離責任在後端，不將此 mock 結果稱為正式權限漏洞。');
    });
});

// Each sample is a per-second trace. Production utility accepts each segment;
// production MusicPlayer is then driven by the same events, independently.
const seconds = (n, rate = 1) => Array.from({ length: n }, () => ({ kind: 'play', rate }));
const pause = n => Array.from({ length: n }, () => ({ kind: 'pause' }));
const scenarios = [
    { name: '認真聽完整首', events: seconds(100), expected: 100, reason: '正常速度聽完所有不同區段。' },
    { name: '剛好八成', events: [...seconds(80), { kind: 'seek', to: 100 }], expected: 80, reason: '先自然聽滿八成，再跳到結尾；跳過的部分不累計。' },
    { name: '只聽七成', events: [...seconds(70), { kind: 'seek', to: 100 }], expected: 70, reason: '不重複區段不足八成，不能增加有效聆聽。' },
    { name: '一直拖曳到結尾', events: [20, 40, 60, 80, 100].map(to => ({ kind: 'seek', to })), expected: 0, reason: '位置跳動不是自然播放，沒有有效覆蓋。' },
    { name: '反覆只聽同一段二十秒', events: Array.from({ length: 5 }, (_, i) => [...(i ? [{ kind: 'seek', to: 0 }] : []), ...seconds(20)]).flat(), expected: 20, reason: '雖播放很久，同一段只算一次覆蓋。' },
    { name: '一點五倍速', events: seconds(67, 1.5), expected: 0, reason: '加速區段不計；使用過加速的工作階段也不具計次資格。' },
    { name: '播放中切到別的分頁', events: [...seconds(30), { kind: 'hidden' }, ...pause(70)], expected: 30, reason: '切走立即暫停，記一次 hidden；背景時間不累計。' },
    { name: '播放後離開未點擊', duration: 1200, events: [...seconds(900), ...pause(30)], idle: true, expected: 0, reason: '連續十五分鐘後要求確認；三十秒未回應，清除本次覆蓋並記 idle。' },
    { name: '中途暫停後繼續', events: [...seconds(40), ...pause(20), ...seconds(60)], expected: 100, reason: '暫停不累計；繼續後接上原本區段。' },
    { name: '前半認真後半放空但未切頁', events: seconds(100), expected: 100, reason: '外在事件與認真聽完全相同；系統無法知道孩子後半在放空。' }
];
async function beginPlayer(duration = 100, ui = null, route = '/student/books/Workbook_1') {
    jest.useFakeTimers(); jest.setSystemTime(now);
    const view = mount(ui || <MusicPlayer music={{ ...tracks[0], bookname: book.name, audioURL: 'offline-audio' }} />, route);
    const audio = screen.getByTestId('audio');
    Object.defineProperty(audio, 'duration', { configurable: true, value: duration });
    await act(async () => audio.play());
    return { view, audio };
}
async function replayTrace(audio, events, duration) {
    let ranges = [], position = 0, actualSeconds = 0, wallSeconds = 0, active = true;
    const trace = [];
    for (const event of events) {
        const start = position;
        tick(1000); wallSeconds++;
        if (event.kind === 'hidden') { visible('hidden'); active = false; }
        else if (event.kind === 'pause') { if (!audio.paused) act(() => audio.pause()); active = false; }
        else if (event.kind === 'seek') { position = event.to; audio.currentTime = position; fireEvent.seeking(audio); fireEvent.seeked(audio); }
        else {
            if (!active) { await act(async () => audio.play()); active = true; }
            audio.playbackRate = event.rate;
            const delta = Math.min(event.rate, duration - position);
            actualSeconds += delta / event.rate;
            position += delta; audio.currentTime = position;
            if (isNaturalListeningInterval({ start, end: position, elapsedSeconds: 1, playbackRate: event.rate, isSeeking: false, isVisible: document.visibilityState !== 'hidden', attentionBlocked: audio.paused })) ranges = mergeCoverageRange(ranges, [start, position]);
            fireEvent.timeUpdate(audio);
        }
        trace.push({ second: wallSeconds, kind: event.kind, position, paused: audio.paused, visible: document.visibilityState });
    }
    return { ranges, actualSeconds, wallSeconds, trace };
}
describe('C 每秒聽力事件序列', () => {
    test.each(scenarios)('$name', async sample => {
        const duration = sample.duration || 100;
        const { audio } = await beginPlayer(duration);
        if (sample.events.some(e => e.rate > 1)) {
            fireEvent.click(screen.getAllByRole('button', { name: '更多播放設定' })[0]);
            fireEvent.click(screen.getByRole('button', { name: '1.5x' }));
        }
        const sim = await replayTrace(audio, sample.events, duration);
        if (sample.idle) {
            expect(screen.getByRole('button', { name: '重新開始這首' })).toBeInTheDocument();
            expect(recordListeningPause.mock.calls.map(call => call[1].reason)).toEqual(['idle']);
            // Expiry invalidates the session and coverage in the production component.
            sim.ranges = [];
        } else {
            await act(async () => fireEvent.ended(audio));
        }
        const calls = listening.recordTrackPlay.mock.calls;
        const payload = calls.at(-1)?.[2];
        const pureCoverage = getCoveredSeconds(sim.ranges) / duration * 100;
        expect(pureCoverage).toBeCloseTo(sample.expected, 5);
        if (!sample.idle) {
            expect(calls).toHaveLength(1);
            expect(payload.coverage_percent).toBeCloseTo(sample.expected, 2);
        } else expect(calls).toHaveLength(0);
        const completion = payload ? edge.validateCompletion(payload, duration) : { valid: false, meetsMinimum: false };
        const eligible = completion.valid && completion.meetsMinimum;
        expect(Boolean(eligible)).toBe(sample.expected >= 80);
        const reasons = recordListeningPause.mock.calls.map(call => call[1].reason);
        add('C', { name: sample.name, duration, actualSeconds: sim.actualSeconds, wallSeconds: sim.wallSeconds,
            coverage: pureCoverage, reaches80: pureCoverage >= 80, validListen: Boolean(eligible), pauses: reasons,
            ...focusSummary(eligible, reasons), reason: sample.reason, trace: sim.trace, payload: payload || null,
            proof: '真實純函式＋MusicPlayer 每秒事件＋Edge 純驗證；counted 回覆為假資料' });
    });
    test('倍速由真實按鈕設定後，降回正常仍保留加速旗標；無字幕不顯示按鈕', async () => {
        const { audio } = await beginPlayer();
        expect(screen.queryByRole('button', { name: '切換字幕與逐字稿' })).not.toBeInTheDocument();
        fireEvent.click(screen.getAllByRole('button', { name: '更多播放設定' })[0]);
        fireEvent.click(screen.getByRole('button', { name: '1.5x' }));
        expect(audio.playbackRate).toBe(1.5);
        fireEvent.click(screen.getAllByRole('button', { name: '更多播放設定' })[0]);
        fireEvent.click(screen.getByRole('button', { name: '1x' }));
        expect(audio.playbackRate).toBe(1);
        await replayTrace(audio, seconds(100), 100);
        await act(async () => fireEvent.ended(audio));
        const payload = listening.recordTrackPlay.mock.calls[0][2];
        expect(payload.used_accelerated_playback).toBe(true);
        expect(edge.validateCompletion(payload, 100).valid).toBe(false);
        results.sourceEvidence.push(evidence('src/components/fragment/MusicPlayer.jsx', 'usedAcceleratedPlaybackRef.current = true'));
    });
    test('連續五首無人工操作觸發 noInteraction；確認後才歸零', async () => {
        const { audio } = await beginPlayer();
        for (let i = 0; i < 5; i++) await act(async () => fireEvent.ended(audio));
        expect(localStorage.getItem('ae-no-interaction')).toBe('5');
        expect(screen.getByRole('dialog', { name: '確認仍在學習' })).toBeInTheDocument();
        expect(audio.paused).toBe(true);
        fireEvent.click(screen.getByRole('button', { name: '我還在學習' }));
        expect(localStorage.getItem('ae-no-interaction')).toBe('0');
        add('C', { name: '五次結束事件的防掛機檢查', outcome: 'noInteraction 5 次後要求確認，確認歸零', reason: '此樣本刻意直接觸發 ended，只驗證防掛機計數，不代表已完成五次有效聆聽。', proof: 'MusicPlayer 真實元件；不作有效聆聽判定' });
    });
    test('有發布逐字稿：預設關閉，可依序開英文、中文、完整稿，再關閉', async () => {
        await beginPlayer(100, <MusicPlayer music={{ ...tracks[0], audioURL: 'offline-audio', subtitle_status: 'published', transcript_en: 'Hello, Alan.', transcript_zh: '你好，Alan。' }} />);
        expect(screen.queryByText('Hello, Alan.')).not.toBeInTheDocument();
        const toggle = () => fireEvent.click(screen.getAllByRole('button', { name: '切換字幕與逐字稿' })[0]);
        toggle(); expect(screen.getByText('英文字幕')).toBeInTheDocument(); expect(screen.getByText('Hello, Alan.')).toBeInTheDocument();
        toggle(); expect(screen.getByText('中文提示')).toBeInTheDocument();
        toggle(); expect(screen.getByText('完整逐字稿')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '關閉字幕再練習' }));
        expect(screen.queryByText('Hello, Alan.')).not.toBeInTheDocument();
        add('C', { name: '字幕與逐字稿操作', outcome: '預設不顯示，可開啟及關閉', reason: '沒有發布字幕時不顯示按鈕；有資料時老師或學生可以主動切換，不是自動常駐。', proof: 'MusicPlayer 真實元件；首次播放不鎖字幕按鈕，屬建議教學流程' });
    });
    test('專注度整十、等級與資料不足邊界一致', () => {
        expect(roundFocusRate(75)).toBe(80); expect(focusLevel(roundFocusRate(75))).toBe('focused');
        expect(roundFocusRate(55)).toBe(60); expect(focusLevel(roundFocusRate(55))).toBe('ok');
        expect(roundFocusRate(54)).toBe(50); expect(focusLevel(roundFocusRate(54))).toBe('needs_reminder');
        expect(roundFocusRate(null)).toBeNull(); expect(focusLevel(null)).toBeNull();
    });
});

const AttentionProbe = props => { useSpeakingAttention(props); return null; };
const attentionProps = { firebaseUser: user, role: 'student', questionSetId: 7, mode: 'easy', busy: false };
describe('D 口說專注度與鎖定', () => {
    test.each([
        ['專心答題', 'active', 3, []], ['發呆', 'idle', 0, ['idle']], ['切走分頁', 'hidden', 1, ['hidden']],
        ['錄音中', 'recording', 1, []], ['評分中', 'assessing', 1, []]
    ])('%s', (name, kind, completed, expected) => {
        jest.useFakeTimers(); jest.setSystemTime(now);
        mount(<AttentionProbe {...attentionProps} busy={['recording', 'assessing'].includes(kind)} />);
        if (kind === 'active') for (let i = 0; i < 3; i++) { tick(60000); fireEvent.pointerDown(window); }
        else if (kind === 'hidden') visible('hidden');
        else { tick(SPEAKING_IDLE_MS - 1); expect(recordSpeakingAttention).not.toHaveBeenCalled(); tick(1); }
        const reasons = recordSpeakingAttention.mock.calls.map(call => call[1].reason);
        expect(reasons).toEqual(expected);
        add('D', { name: `口說：${name}`, completedQuestions: completed, pauses: reasons,
            ...focusSummary(false, reasons, true, completed), outcome: `記錄 ${reasons.length} 次注意力事件`,
            reason: kind === 'active' ? '持續操作會重設閒置計時。' : kind === 'idle' ? '滿九十秒沒操作，記一次 idle。' : kind === 'hidden' ? '切走記 hidden；假資料完成一題，因此不是零分。' : '忙碌旗標有效時，錄音／評分不記 idle。', proof: '真實 hook＋fake timers；完成題數為指定假資料' });
    });
    test('同原因三十秒節流，異原因各自記錄', () => {
        jest.useFakeTimers(); jest.setSystemTime(now); mount(<AttentionProbe {...attentionProps} />);
        visible('hidden'); visible('visible'); tick(SPEAKING_ATTENTION_THROTTLE_MS - 1); visible('hidden');
        expect(recordSpeakingAttention).toHaveBeenCalledTimes(1);
        visible('visible'); tick(1); visible('hidden');
        expect(recordSpeakingAttention).toHaveBeenCalledTimes(2);
        visible('visible'); tick(SPEAKING_IDLE_MS);
        expect(recordSpeakingAttention.mock.calls.map(c => c[1].reason)).toEqual(['hidden', 'hidden', 'idle']);
    });
    test.each(['teacher', 'admin'])('非學生 %s 不記口說與聽力注意力', async role => {
        jest.useFakeTimers(); jest.setSystemTime(now);
        mount(<AttentionProbe {...attentionProps} role={role} />); visible('hidden'); tick(SPEAKING_IDLE_MS * 2);
        expect(recordSpeakingAttention).not.toHaveBeenCalled(); cleanup(); visible('visible');
        useAuth.mockReturnValue({ firebaseUser: user, role });
        const { audio } = await beginPlayer(); visible('hidden'); tick(16 * 60 * 1000);
        expect(recordListeningPause).not.toHaveBeenCalled();
        await act(async () => fireEvent.ended(audio)); expect(listening.recordTrackPlay).not.toHaveBeenCalled();
    });
    test('忙碌跨過九十秒後解除，無新操作時閒置計時沒有重新啟動', () => {
        jest.useFakeTimers(); jest.setSystemTime(now);
        const view = render(<AttentionProbe {...attentionProps} busy />);
        tick(SPEAKING_IDLE_MS + 1);
        view.rerender(<AttentionProbe {...attentionProps} busy={false} />);
        tick(SPEAKING_IDLE_MS * 2);
        expect(recordSpeakingAttention).not.toHaveBeenCalled();
        fireEvent.pointerDown(window); tick(SPEAKING_IDLE_MS);
        expect(recordSpeakingAttention).toHaveBeenCalledTimes(1);
        finding('長時間錄音／評分後，閒置計時可能停止', 'src/hooks/useSpeakingAttention.js', 'if (!busyRef.current', 'busy=true 超過九十秒讓一次性 timer 到期，再改 busy=false；繼續等待一百八十秒仍無 idle；直到新點擊才恢復。', 'busy 結束時重新啟動 idle timer，或讓 busy 中到期的 timer 安全重新排程；避免錄音本身被當成閒置。');
    });
    test('錄音中切走仍記 hidden，只有 idle 被忙碌旗標排除', () => {
        jest.useFakeTimers(); jest.setSystemTime(now); mount(<AttentionProbe {...attentionProps} busy />);
        visible('hidden'); expect(recordSpeakingAttention.mock.calls[0][1].reason).toBe('hidden');
    });
    test('鎖定：離開帶回、回原關解除、三十分鐘後導覽解除、換帳號與登出清除', () => {
        jest.useFakeTimers(); jest.setSystemTime(now);
        const prep = '/student/books/WB3?speaking=11&mode=easy&tracks=5';
        let navigate;
        const parentText = source('src/components/fragment/Containerfull.jsx');
        const callbackText = parentText.slice(parentText.indexOf('const recordLeftPrep = useCallback'), parentText.indexOf('    useSpeakingFocusLock({'));
        const productionCallback = vm.runInNewContext(`${callbackText}; recordLeftPrep`, { useCallback: fn => fn, firebaseUser: user, recordSpeakingAttention });
        const blocked = jest.fn(productionCallback);
        const Probe = ({ uid = user.uid, role = 'student' }) => {
            useSpeakingFocusLock({ uid, role, authLoading: false, onLeaveBlocked: blocked });
            navigate = useNavigate(); const location = useLocation(); return <output data-testid="where">{location.pathname}{location.search}</output>;
        };
        const view = mount(<Probe />, prep);
        act(() => navigate('/student/progress')); expect(screen.getByTestId('where').textContent).toBe(prep); expect(blocked).toHaveBeenCalledTimes(1);
        expect(recordSpeakingAttention).toHaveBeenCalledWith(user, { reason: 'left_prep', question_set_id: 11, mode: 'easy' });
        act(() => navigate('/student/speaking-challenges/11?mode=easy')); expect(sessionStorage.getItem(SPEAKING_FOCUS_KEY)).toBeNull();
        act(() => navigate(prep)); tick(SPEAKING_FOCUS_TTL_MS + 1); act(() => navigate('/student/progress'));
        expect(screen.getByTestId('where').textContent).toBe('/student/progress');
        act(() => navigate(prep)); view.unmount();
        mount(<Probe uid="different" />, '/student/progress'); expect(sessionStorage.getItem(SPEAKING_FOCUS_KEY)).toBeNull(); cleanup();
        sessionStorage.setItem(SPEAKING_FOCUS_KEY, JSON.stringify({ uid: user.uid })); mount(<Probe uid={null} />, '/student/progress');
        expect(sessionStorage.getItem(SPEAKING_FOCUS_KEY)).toBeNull();
        const reasons = recordSpeakingAttention.mock.calls.map(call => call[1].reason);
        add('D', { name: '口說前聽力的頁面鎖定', outcome: '離開被帶回；回原口說關卡、逾時後導覽、換帳號及登出會解除', blockedEvents: blocked.mock.calls.length,
            pauses: reasons, ...focusSummary(false, reasons, true, 1), completedQuestions: 1,
            reason: '限制同分頁的導覽；hook 回呼交給父元件真實回呼片段，記下 left_prep。', proof: '真實 hook＋父元件原始回呼片段＋fake timers；未掛載整個 Containerfull' });
    });
});

const ConnectedPlayer = () => {
    const music = useSelector(state => state.musicReducer.playing);
    return music?.id ? <MusicPlayer music={music} /> : null;
};
describe('D 作業路徑使用共用播放器', () => {
    test.each(['專心聽完', '切走後回來聽完', '閒置不回應', '暫停後繼續'])('%s', async name => {
        // Start the fake clock before filling caches. Rewinding after load would
        // correctly invalidate production snapshots saved in the future.
        jest.useFakeTimers(); jest.setSystemTime(now);
        const view = mount(<><Routes><Route path="/student/books/:playlistId" element={<Playlist />} /></Routes><ConnectedPlayer /></>, '/student/books/Workbook_1?assignment=4&tracks=11&required=99');
        await screen.findByRole('button', { name: '播放 P22' });
        expect(view.container.textContent).toContain('老師指定：3 次');
        // Find the real MusicCard playback action, not a stubbed onStart.
        const playButton = screen.getAllByRole('button').find(button => /播放/.test(button.getAttribute('aria-label') || button.textContent));
        expect(playButton).toBeDefined();
        fireEvent.click(playButton);
        const audio = screen.getByTestId('audio');
        const duration = name === '閒置不回應' ? 1200 : 100;
        Object.defineProperty(audio, 'duration', { configurable: true, value: duration });
        await act(async () => audio.play());
        if (name === '切走後回來聽完') {
            await replayTrace(audio, seconds(30), duration); visible('hidden'); expect(audio.paused).toBe(true); visible('visible');
            await act(async () => fireEvent.click(screen.getByRole('button', { name: '繼續播放' })));
            // Continue from the same audio position using the production callbacks.
            for (let i = 31; i <= 100; i++) { tick(1000); audio.currentTime = i; fireEvent.timeUpdate(audio); }
        } else if (name === '閒置不回應') {
            tick(15 * 60 * 1000); for (let i = 0; i < 30; i++) tick(1000);
            expect(screen.getByRole('button', { name: '重新開始這首' })).toBeInTheDocument();
        } else await replayTrace(audio, name === '暫停後繼續' ? [...seconds(40), ...pause(20), ...seconds(60)] : seconds(100), duration);
        const valid = name !== '閒置不回應';
        if (valid) {
            assignments.getStudentAssignments.mockResolvedValue({ assignments: [{ ...homework, tracks: homework.tracks.map(row => ({ ...row, play_count: row.track.id === 11 ? 1 : 0 })) }] });
            await act(async () => fireEvent.ended(audio));
            expect(listening.recordTrackPlay).toHaveBeenCalledTimes(1);
            const payload = listening.recordTrackPlay.mock.calls[0][2];
            expect(edge.validateCompletion(payload, duration).meetsMinimum).toBe(true);
            await waitFor(() => expect(view.container.textContent).toContain('還需 2 次'));
        } else expect(listening.recordTrackPlay).not.toHaveBeenCalled();
        const reasons = recordListeningPause.mock.calls.map(call => call[1].reason);
        expect(reasons).toEqual(name === '切走後回來聽完' ? ['hidden'] : name === '閒置不回應' ? ['idle'] : []);
        const normalized = normalizeListeningTracks(homework);
        expect(normalized[0].requiredListens).toBe(3);
        add('D', { name: `作業聽力：${name}`, validListen: valid, pauses: reasons, ...focusSummary(valid, reasons),
            requiredListens: normalized[0].requiredListens, text: compact(view.container),
            reason: valid ? '真實作業網址經 Playlist→MusicCard→Redux→MusicPlayer；共用播放器照樣記中斷，後端假回覆後才更新作業次數。' : '作業頁也會要求確認；逾時未回應記 idle，不送完成。', proof: 'RTL 真實作業路徑；音訊與儲存回覆為假資料' });
    });
});

test('離線保護：沒有任何網路嘗試；記錄不可直接觀測的專注度限制', () => {
    expect(global.__offlineAttempts).toEqual([]);
    const attentive = results.C.find(s => s.name === '認真聽完整首');
    const distracted = results.C.find(s => s.name === '前半認真後半放空但未切頁');
    expect(distracted.roundFocusRate).toBe(attentive.roundFocusRate);
    finding('放空但未切頁，無法由目前事件辨識', 'supabase/functions/weekly-report/attention.ts', 'const denominator = tracked + idle + hidden', '完整正常播放與前半認真後半放空使用相同事件序列，兩者有效聆聽與專注度完全相同；不是眼動或理解力測驗。', '向老師清楚標示此為操作中斷指標；若需驗證理解，另設教學問題或人工確認，避免把此數字當作心理專注證明。');
});
