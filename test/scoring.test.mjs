import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  completedMonths, parseIsoDate, checkAgeMonths, getAgeGroup, groupById,
  itemsForGroup, totalScore, levelFromScore, isComplete,
} from '../dist-test/scoring.mjs';
import { AGE_GROUPS, ITEMS, LEVEL_RANGES } from '../dist-test/content.mjs';

const d = (s) => parseIsoDate(s);

test('пункты и максимум по группам — как в бланке', () => {
  assert.deepEqual([...groupById('0-5').items], [1, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual([...groupById('6-9').items], [1, 2, 3, 5, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual([...groupById('10-24').items], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  for (const g of AGE_GROUPS) assert.equal(g.items.length, g.maxScore, g.id);
  assert.equal(ITEMS.length, 12);
});

test('возрастные группы: границы 5/6 и 9/10, до 24 мес. включительно', () => {
  assert.equal(getAgeGroup(0).id, '0-5');
  assert.equal(getAgeGroup(5).id, '0-5');
  assert.equal(getAgeGroup(6).id, '6-9');
  assert.equal(getAgeGroup(9).id, '6-9');
  assert.equal(getAgeGroup(10).id, '10-24');
  assert.equal(getAgeGroup(24).id, '10-24');
  assert.throws(() => getAgeGroup(25));
  assert.throws(() => getAgeGroup(-1));
});

test('полные месяцы по датам', () => {
  assert.equal(completedMonths(d('2026-01-15'), d('2026-01-15')), 0);
  assert.equal(completedMonths(d('2026-01-15'), d('2026-02-14')), 0);
  assert.equal(completedMonths(d('2026-01-15'), d('2026-02-15')), 1);
  assert.equal(completedMonths(d('2025-10-16'), d('2026-10-15')), 11);
  assert.equal(completedMonths(d('2025-10-16'), d('2026-10-16')), 12);
  // 9 мес. 29 дн. — ещё группа 6–9 (в оригинале 6–9,99 мес.)
  assert.equal(getAgeGroup(completedMonths(d('2026-01-01'), d('2026-10-30'))).id, '6-9');
  // родился 31-го: в коротком месяце полный месяц наступает в последний день
  assert.equal(completedMonths(d('2026-01-31'), d('2026-02-27')), 0);
  assert.equal(completedMonths(d('2026-01-31'), d('2026-02-28')), 1);
  assert.equal(completedMonths(d('2024-01-31'), d('2024-02-29')), 1);
  assert.equal(completedMonths(d('2026-03-10'), d('2026-03-01')), -1);
});

test('разбор дат отклоняет несуществующие', () => {
  assert.equal(parseIsoDate('2026-02-30'), null);
  assert.equal(parseIsoDate('16.10.2026'), null);
  assert.ok(parseIsoDate('2024-02-29'));
});

test('проверка возраста', () => {
  assert.deepEqual(checkAgeMonths(0), { ok: true, months: 0 });
  assert.deepEqual(checkAgeMonths(24), { ok: true, months: 24 });
  assert.deepEqual(checkAgeMonths(25), { ok: false, reason: 'too-old' });
  assert.deepEqual(checkAgeMonths(-1), { ok: false, reason: 'future' });
  assert.deepEqual(checkAgeMonths(3.5), { ok: false, reason: 'invalid' });
});

test('сумма: все «да» = максимум, все «нет» = 0, лишние пункты не считаются', () => {
  for (const g of AGE_GROUPS) {
    const yes = Object.fromEntries(g.items.map((id) => [id, 1]));
    const no = Object.fromEntries(g.items.map((id) => [id, 0]));
    assert.equal(totalScore(yes, g), g.maxScore);
    assert.equal(totalScore(no, g), 0);
  }
  const g = groupById('0-5');
  const answers = { ...Object.fromEntries(g.items.map((id) => [id, 0])), 2: 1, 4: 1, 12: 1 };
  assert.equal(totalScore(answers, g), 0);
});

test('неполные ответы не дают результата', () => {
  const g = groupById('6-9');
  const partial = { 1: 1, 2: 1 };
  assert.equal(isComplete(partial, g), false);
  assert.throws(() => totalScore(partial, g));
});

test('уровни по таблице бланка — каждый балл каждой группы', () => {
  const expected = {
    '0-5':   ['severe', null, 'moderate', 'moderate', 'mild', 'mild', 'none', 'none'],
    '6-9':   ['severe', 'moderate', 'moderate', 'moderate', 'mild', 'mild', 'mild', 'none', 'none', 'none', 'none'],
    '10-24': ['severe', 'moderate', 'moderate', 'moderate', 'moderate', 'mild', 'mild', 'mild', 'mild', 'none', 'none', 'none', 'none'],
  };
  for (const [id, levels] of Object.entries(expected)) {
    const g = groupById(id);
    levels.forEach((lvl, score) => assert.equal(levelFromScore(g, score), lvl, `${id}, балл ${score}`));
    assert.throws(() => levelFromScore(g, g.maxScore + 1));
    assert.throws(() => levelFromScore(g, -1));
  }
});

test('диапазоны таблицы не пересекаются и не выходят за максимум', () => {
  for (const g of AGE_GROUPS) {
    const seen = new Set();
    for (const [from, to] of Object.values(LEVEL_RANGES[g.id])) {
      assert.ok(from <= to && to <= g.maxScore, g.id);
      for (let s = from; s <= to; s++) {
        assert.ok(!seen.has(s), `${g.id}: балл ${s} в двух уровнях`);
        seen.add(s);
      }
    }
  }
});

test('у каждого пункта есть оба ответа', () => {
  for (const g of AGE_GROUPS) for (const item of itemsForGroup(g)) {
    assert.ok(item.text && item.yes && item.no, `пункт ${item.id}`);
  }
});
