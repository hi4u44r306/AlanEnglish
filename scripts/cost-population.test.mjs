import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costPopulation } from '../supabase/functions/_shared/service-cost-dashboard.ts';

test('counts only enabled students with exact HEAD and returns no profiles', async () => {
    const calls = [];
    const query = { select: (...args) => { calls.push(args); return query; }, eq: (...args) => { calls.push(args); return query; },
        then: resolve => resolve({ count: 45, data: null, error: null }) };
    const result = await costPopulation({ from: table => { assert.equal(table, 'students'); return query; } });
    assert.equal(result.active_students, 45);
    assert.deepEqual(calls, [['id', { count: 'exact', head: true }], ['role', 'student'], ['account_status', 'active']]);
    assert.deepEqual(Object.keys(result).sort(), ['active_students', 'counted_at']);
});
test('errors and missing count are unavailable, while a true zero count remains zero', async () => {
    for (const count of [null, undefined, 0]) {
        const q = { select: () => q, eq: () => q, then: resolve => resolve({ count, error: null }) };
        const result = await costPopulation({ from: () => q });
        assert.equal(result.active_students, count === 0 ? 0 : null);
    }
    assert.equal((await costPopulation({ from: () => { throw new Error('private provider failure'); } })).error, 'population_unavailable');
});
