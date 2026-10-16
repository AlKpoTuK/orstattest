import {
  AGE_GROUPS,
  ITEMS,
  LEVEL_RANGES,
  LEVELS,
  type AgeGroup,
  type AgeGroupId,
  type Item,
  type ItemId,
  type LevelId,
} from './content';

export type Answer = 0 | 1;
export type Answers = Partial<Record<ItemId, Answer>>;

export const MAX_AGE_MONTHS = 24;

/** Дата в формате YYYY-MM-DD (значение <input type="date">). */
export function parseIsoDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
}

/**
 * Возраст в полных месяцах на дату оценки (ВОПРОС АВТОРАМ 5).
 * Месяц считается полным, когда наступило то же число месяца, что и в дате рождения;
 * для рождённых 29–31 числа — последний день короткого месяца.
 */
export function completedMonths(birth: Date, onDate: Date): number {
  let months = (onDate.getUTCFullYear() - birth.getUTCFullYear()) * 12 + (onDate.getUTCMonth() - birth.getUTCMonth());
  const lastDayOfMonth = new Date(Date.UTC(onDate.getUTCFullYear(), onDate.getUTCMonth() + 1, 0)).getUTCDate();
  const anniversaryDay = Math.min(birth.getUTCDate(), lastDayOfMonth);
  if (onDate.getUTCDate() < anniversaryDay) months -= 1;
  return months;
}

export type AgeCheck =
  | { ok: true; months: number }
  | { ok: false; reason: 'future' | 'too-old' | 'invalid' };

export function checkAgeMonths(months: number): AgeCheck {
  if (!Number.isInteger(months)) return { ok: false, reason: 'invalid' };
  if (months < 0) return { ok: false, reason: 'future' };
  if (months > MAX_AGE_MONTHS) return { ok: false, reason: 'too-old' };
  return { ok: true, months };
}

export function getAgeGroup(months: number): AgeGroup {
  const group = AGE_GROUPS.find((g) => months >= g.minMonths && months <= g.maxMonths);
  if (!group) throw new RangeError(`Возраст вне диапазона опросника: ${months} мес.`);
  return group;
}

export function groupById(id: AgeGroupId): AgeGroup {
  const group = AGE_GROUPS.find((g) => g.id === id);
  if (!group) throw new RangeError(`Неизвестная возрастная группа: ${id}`);
  return group;
}

export function itemsForGroup(group: AgeGroup): Item[] {
  return group.items.map((id) => {
    const item = ITEMS.find((i) => i.id === id);
    if (!item) throw new Error(`Нет пункта ${id}`);
    return item;
  });
}

export function answeredCount(answers: Answers, group: AgeGroup): number {
  return group.items.filter((id) => answers[id] === 0 || answers[id] === 1).length;
}

export function isComplete(answers: Answers, group: AgeGroup): boolean {
  return answeredCount(answers, group) === group.items.length;
}

/** Сумма баллов по пунктам группы. Ответы на пункты вне группы не учитываются. */
export function totalScore(answers: Answers, group: AgeGroup): number {
  if (!isComplete(answers, group)) throw new Error('Не на все вопросы получен ответ');
  return group.items.reduce((sum, id) => sum + (answers[id] as Answer), 0);
}

/**
 * Уровень нарушения по таблице бланка.
 * Возвращает null, если балл не попадает ни в один диапазон
 * (сейчас так только для 1 балла в группе 0–5 мес. — ВОПРОС АВТОРАМ 1).
 */
export function levelFromScore(group: AgeGroup, score: number): LevelId | null {
  if (!Number.isInteger(score) || score < 0 || score > group.maxScore) {
    throw new RangeError(`Балл ${score} вне диапазона 0–${group.maxScore}`);
  }
  const ranges = LEVEL_RANGES[group.id];
  for (const level of LEVELS) {
    const [from, to] = ranges[level.id];
    if (score >= from && score <= to) return level.id;
  }
  return null;
}

export function levelById(id: LevelId) {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`Нет уровня ${id}`);
  return level;
}
