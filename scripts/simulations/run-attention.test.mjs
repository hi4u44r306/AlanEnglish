// Run: node --test --test-isolation=none scripts/simulations/run-attention.test.mjs
// Uses the installed Jest/RTL without react-scripts startup, dotenv, or installs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { generateReport } from './report.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
test('離線 Alan English A–D 模擬（內含 Jest 個別結果）', async () => {
    mkdirSync(path.join(root, 'docs/simulations'), { recursive: true });
    const output = path.join(root, 'docs/simulations/jest-results.json');
    const historyFile = path.join(root, 'docs/simulations/execution-history.json');
    const history = existsSync(historyFile) ? JSON.parse(readFileSync(historyFile, 'utf8')) : [];
    if (existsSync(output)) {
        const previous = JSON.parse(readFileSync(output, 'utf8'));
        const artifact = `attempt-${history.length + 1}-jest-results.json`;
        copyFileSync(output, path.join(root, 'docs/simulations', artifact));
        history.push({ startTime: previous.startTime, passed: previous.numPassedTests, failed: previous.numFailedTests, artifact });
    }
    const originals = ['src/components/fragment/MusicPlayer.jsx', 'src/components/Pages/StudentAssignments.jsx',
        'src/components/Pages/TeacherAssignments.jsx', 'src/components/fragment/StudentNavbar.jsx', 'src/components/fragment/Playlist.jsx',
        'src/hooks/useSpeakingAttention.js', 'src/hooks/useSpeakingFocusLock.js', 'src/utils/listeningCoverage.js', 'src/utils/focusRate.js',
        'src/utils/assignmentListening.js', 'supabase/functions/record-play/index.ts', 'supabase/functions/assignment-manager/index.ts',
        'supabase/functions/weekly-report/attention.ts'];
    const fingerprint = () => Object.fromEntries(originals.map(file => [file, createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex')]));
    const before = fingerprint();
    const config = {
        rootDir: root,
        roots: ['<rootDir>/scripts/simulations'],
        testMatch: ['**/attention.cases.test.jsx'],
        testEnvironment: 'jsdom',
        setupFilesAfterEnv: ['<rootDir>/scripts/simulations/setup.cjs'],
        transform: { '^.+\\.[jt]sx?$': [requirePath('babel-jest'), { babelrc: false, configFile: false, presets: [requirePath('babel-preset-react-app')] }] },
        moduleNameMapper: { '\\.(css|scss|sass|png|jpg|svg|mp3|wav)$': '<rootDir>/scripts/simulations/asset-stub.cjs', '.*supabase-config$': '<rootDir>/scripts/simulations/asset-stub.cjs' },
        cache: false,
        clearMocks: true
    };
    process.env.NODE_ENV = 'test'; process.env.BABEL_ENV = 'test'; process.env.CI = 'true';
    require('./offline-guard.cjs');
    // Windows managed sandbox forbids child processes; Jest runs in this process.
    const { results: execution } = await require('jest').runCLI({ config: JSON.stringify(config),
        runInBand: true, json: true, outputFile: output, silent: true, watch: false, watchAll: false, _: [], $0: 'attention-simulation' }, [root]);
    const after = fingerprint();
    writeFileSync(path.join(root, 'docs/simulations/source-fingerprints.json'), JSON.stringify({ before, after, unchanged: JSON.stringify(before) === JSON.stringify(after) }, null, 2));
    const result = JSON.parse(readFileSync(output, 'utf8'));
    writeFileSync(historyFile, JSON.stringify(history, null, 2));
    generateReport(root, result);
    console.log(JSON.stringify({ passed: result.numPassedTests, failed: result.numFailedTests, pending: result.numPendingTests, report: 'docs/simulations/attention-simulation-report.html' }));
    assert.equal(execution.success, true, 'Jest 模擬失敗，請查看報告中的實際結果');
    assert.deepEqual(after, before, '正式原始碼指紋必須維持不變');
});

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
function requirePath(name) { return require.resolve(name); }
