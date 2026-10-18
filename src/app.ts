import { AGE_GROUPS, LEVELS, LEVEL_RANGES, type AgeGroupId, type ItemId, type LevelId } from './content';
import { HOME, ROLE_TEXT } from './info';
import { SWALLOW_SVG, initSwallowAnimation } from './swallow-anim';
import {
  answeredCount,
  checkAgeMonths,
  completedMonths,
  getAgeGroup,
  groupById,
  isComplete,
  itemsForGroup,
  levelById,
  levelFromScore,
  parseIsoDate,
  totalScore,
  type AgeCheck,
  type Answer,
  type Answers,
} from './scoring';

/* ---------- Состояние ---------- */

type Role = 'parent' | 'doctor';
type Step = 'info' | 'role' | 'child' | 'questions' | 'result';
type AgeMode = 'dates' | 'months';

interface State {
  step: Step;
  role: Role | null;
  childName: string;
  ageMode: AgeMode;
  birth: string;
  assessed: string;
  monthsInput: string;
  answers: Answers;
  startedAt: number | null;
  minutes: string;
  minutesEdited: boolean;
  clinicalLevel: LevelId | null;
}

const STEPS: Step[] = ['info', 'role', 'child', 'questions', 'result'];
const STEP_TITLES: Record<Step, string> = {
  info: 'Главная',
  role: 'Кто заполняет',
  child: 'Данные ребёнка',
  questions: 'Вопросы',
  result: 'Результат',
};
const STORAGE_KEY = 'orsat-state-v1';

function freshState(): State {
  return {
    step: 'info',
    role: null,
    childName: '',
    ageMode: 'dates',
    birth: '',
    assessed: todayIso(),
    monthsInput: '',
    answers: {},
    startedAt: null,
    minutes: '',
    minutesEdited: false,
    clinicalLevel: null,
  };
}

let state: State = loadState() ?? freshState();

function loadState(): State | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return { ...freshState(), ...(JSON.parse(raw) as Partial<State>) };
  } catch {
    return null;
  }
}

function saveState(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* хранилище недоступно — работаем без него */
  }
}

/* ---------- Утилиты ---------- */

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c]);

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function $<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Нет элемента ${sel}`);
  return el;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ---------- Возраст ---------- */

function ageCheck(): AgeCheck | null {
  if (state.ageMode === 'months') {
    if (state.monthsInput.trim() === '') return null;
    if (!/^\d{1,3}$/.test(state.monthsInput.trim())) return { ok: false, reason: 'invalid' };
    return checkAgeMonths(Number(state.monthsInput));
  }
  if (!state.birth || !state.assessed) return null;
  const birth = parseIsoDate(state.birth);
  const assessed = parseIsoDate(state.assessed);
  if (!birth || !assessed) return { ok: false, reason: 'invalid' };
  return checkAgeMonths(completedMonths(birth, assessed));
}

function currentGroupId(): AgeGroupId | null {
  const check = ageCheck();
  return check && check.ok ? getAgeGroup(check.months).id : null;
}

function ageMessage(check: AgeCheck | null): { text: string; error: boolean } | null {
  if (!check) return null;
  if (!check.ok) {
    const text = {
      future: 'Дата рождения позже даты оценки — проверьте даты.',
      'too-old': 'Опросник предназначен для детей от 0 до 24 месяцев.',
      invalid: 'Проверьте введённый возраст.',
    }[check.reason];
    return { text, error: true };
  }
  const g = getAgeGroup(check.months);
  return {
    text: `Возраст: ${check.months} мес. Группа ${g.label}: ${g.items.length} вопросов, максимум ${g.maxScore} баллов.`,
    error: false,
  };
}

/* ---------- Навигация ---------- */

function furthestAllowed(): Step {
  if (!state.role) return 'role';
  const groupId = currentGroupId();
  if (!groupId) return 'child';
  if (!isComplete(state.answers, groupById(groupId))) return 'questions';
  return 'result';
}

function allowed(step: Step): boolean {
  if (step === 'info' || step === 'role') return true;
  return STEPS.indexOf(step) <= STEPS.indexOf(furthestAllowed());
}

function go(step: Step, push = true): void {
  const target = allowed(step) ? step : furthestAllowed();
  if (target === 'questions' && state.startedAt === null) state.startedAt = Date.now();
  state.step = target;
  saveState();
  if (push) history.pushState({ step: target }, '', `#${target}`);
  render();
}

window.addEventListener('popstate', (e) => {
  const step = (e.state as { step?: Step } | null)?.step ?? 'info';
  go(STEPS.includes(step) ? step : 'info', false);
});

/* ---------- Каркас ---------- */

const ICONS = {
  parent:
    '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="18" cy="13" r="6"/><path d="M6 40c0-8 5.4-14 12-14s12 6 12 14"/><circle cx="34" cy="22" r="4.5"/><path d="M26 40c0-6 3.6-10.5 8-10.5S42 34 42 40"/></svg>',
  doctor:
    '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 6v12a8 8 0 0 0 16 0V6"/><path d="M22 26v6a8 8 0 0 0 16 0v-4"/><circle cx="38" cy="24" r="4"/><path d="M11 6h6M27 6h6"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
};

function renderStepper(): string {
  if (state.step === 'info') return '';
  const idx = STEPS.indexOf(state.step);
  return `
    <nav class="stepper" aria-label="Шаги опросника">
      <ol>
        ${STEPS.slice(1)
          .map((s, i) => {
            const n = i + 1;
            const cls = n < idx ? 'done' : n === idx ? 'current' : '';
            return `<li class="${cls}" ${n === idx ? 'aria-current="step"' : ''}><span class="dot">${n}</span><span class="lbl">${STEP_TITLES[s]}</span></li>`;
          })
          .join('')}
      </ol>
    </nav>`;
}

function render(): void {
  const main = $('#app');
  const screens: Record<Step, () => string> = {
    info: screenInfo,
    role: screenRole,
    child: screenChild,
    questions: screenQuestions,
    result: screenResult,
  };
  main.innerHTML = renderStepper() + screens[state.step]();
  bind[state.step]();
  syncChecked(main);
  document.title = `${STEP_TITLES[state.step]} — тестовая версия опросника`;
  window.scrollTo({ top: 0, behavior: 'auto' });
  const h1 = main.querySelector<HTMLElement>('h1');
  h1?.focus({ preventScroll: true });
}

function backButton(to: Step): string {
  return `<button type="button" class="btn btn-ghost" data-go="${to}">${ICONS.back}<span>Назад</span></button>`;
}

/** Класс .is-checked на выбранном варианте — работает во всех браузерах, в отличие от :has(). */
function syncChecked(root: ParentNode): void {
  root.querySelectorAll<HTMLInputElement>('.option input[type="radio"]').forEach((input) =>
    input.closest('.option')?.classList.toggle('is-checked', input.checked),
  );
}

function bindGoButtons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-go]').forEach((el) =>
    el.addEventListener('click', () => go(el.dataset.go as Step)),
  );
}

/* ---------- Экран 0: информация ---------- */

function screenInfo(): string {
  const { why, scope, swallow } = HOME;
  const whyText = esc(why.text).replace(esc(why.emphasis), `<em>${esc(why.emphasis)}</em>`);
  const ageList = AGE_GROUPS.map(
    (g) => `<li><strong>${esc(g.label)}</strong> — ${g.items.length} пунктов, максимум <strong>${g.maxScore} баллов</strong></li>`,
  ).join('');
  const legend = swallow.legend
    .map((l) => `<li><span class="leg-num leg-${l.kind}" aria-hidden="true">${l.n}</span><span>${esc(l.text)}</span></li>`)
    .join('');
  const d = swallow.details;

  return `
    <section class="screen">
      <h1 tabindex="-1">${esc(HOME.title)}</h1>
      <p class="lead">${esc(HOME.lead)}</p>

      <div class="callout callout-warm">
        <p class="callout-title">${esc(why.title)}</p>
        <p>${whyText}</p>
      </div>

      <h2 class="section-title">${esc(scope.title)}</h2>
      <p>${esc(scope.intro)}</p>
      <ul class="points">${scope.blocks.map((b) => `<li><strong>${esc(b.name)}</strong> — ${esc(b.text)}</li>`).join('')}</ul>
      <ul class="callout age-list">${ageList}</ul>

      <h2 class="section-title">${esc(swallow.title)}</h2>
      <p>${esc(swallow.text)}</p>

      <figure class="anatomy">
        ${SWALLOW_SVG}
        <figcaption>${esc(swallow.caption)}</figcaption>
        <button type="button" class="btn btn-secondary btn-small" id="animToggle" aria-pressed="false">Остановить анимацию</button>
        <ol class="anatomy-legend">${legend}</ol>
      </figure>

      <details class="explainer">
        <summary>${esc(d.summary)}</summary>
        <p>${esc(d.intro)}</p>
        <ul class="points">${d.nerves.map((n) => `<li><strong>${esc(n.name)}</strong> ${esc(n.text)}</li>`).join('')}</ul>
        <p>${esc(d.other)}</p>
        <p>${esc(d.sma)}</p>
      </details>

      <div class="actions sticky-actions">
        <button type="button" class="btn btn-primary btn-block" data-go="role">Начать</button>
      </div>
    </section>`;
}

/* ---------- Экран 1: кто заполняет ---------- */

function screenRole(): string {
  const tile = (role: Role) => `
    <button type="button" class="role-tile ${state.role === role ? 'selected' : ''}" data-role="${role}" aria-pressed="${state.role === role}">
      <span class="role-icon">${ICONS[role]}</span>
      <span class="role-text">
        <strong>${esc(ROLE_TEXT[role].title)}</strong>
        <span>${esc(ROLE_TEXT[role].subtitle)}</span>
      </span>
    </button>`;
  return `
    <section class="screen">
      <h1 tabindex="-1">Кто заполняет опросник?</h1>
      <div class="role-tiles">${tile('parent')}${tile('doctor')}</div>
      <div class="actions">${backButton('info')}</div>
    </section>`;
}

/* ---------- Экран 2: данные ребёнка ---------- */

function screenChild(): string {
  const msg = ageMessage(ageCheck());
  return `
    <section class="screen">
      <h1 tabindex="-1">Данные ребёнка</h1>
      <p class="hint">Данные остаются только на этом устройстве и никуда не отправляются.</p>

      <div class="field">
        <label for="childName">Имя или код ребёнка <span class="opt">(необязательно)</span></label>
        <input id="childName" type="text" autocomplete="off" maxlength="60" value="${esc(state.childName)}">
      </div>

      <fieldset class="field">
        <legend>Как указать возраст</legend>
        <div class="segmented">
          <label><input type="radio" name="ageMode" value="dates" ${state.ageMode === 'dates' ? 'checked' : ''}><span>По дате рождения</span></label>
          <label><input type="radio" name="ageMode" value="months" ${state.ageMode === 'months' ? 'checked' : ''}><span>В месяцах</span></label>
        </div>
      </fieldset>

      <div class="age-dates" ${state.ageMode === 'dates' ? '' : 'hidden'}>
        <div class="field">
          <label for="birth">Дата рождения</label>
          <input id="birth" type="date" max="${todayIso()}" value="${esc(state.birth)}">
        </div>
        <div class="field">
          <label for="assessed">Дата оценки</label>
          <input id="assessed" type="date" value="${esc(state.assessed)}">
        </div>
      </div>

      <div class="age-months" ${state.ageMode === 'months' ? '' : 'hidden'}>
        <div class="field">
          <label for="months">Полных месяцев</label>
          <input id="months" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" placeholder="например, 8" value="${esc(state.monthsInput)}">
        </div>
      </div>

      <p id="ageMsg" class="age-msg ${msg?.error ? 'error' : ''}" role="status" aria-live="polite">${msg ? esc(msg.text) : ''}</p>


      <div class="actions sticky-actions">
        ${backButton('role')}
        <button type="button" class="btn btn-primary" id="toQuestions" ${currentGroupId() ? '' : 'disabled'}>Далее</button>
      </div>
    </section>`;
}

function updateAgeUi(): void {
  const msg = ageMessage(ageCheck());
  const el = $('#ageMsg');
  el.textContent = msg?.text ?? '';
  el.classList.toggle('error', !!msg?.error);
  $<HTMLButtonElement>('#toQuestions').disabled = !currentGroupId();
  saveState();
}

/* ---------- Экран 3: вопросы ---------- */

function measuredMinutes(): number {
  if (state.startedAt === null) return 1;
  return Math.max(1, Math.ceil((Date.now() - state.startedAt) / 60000));
}

function screenQuestions(): string {
  const groupId = currentGroupId();
  if (!groupId) return '';
  const group = groupById(groupId);
  const items = itemsForGroup(group);
  const cards = items
    .map((item, i) => {
      const a = state.answers[item.id];
      const option = (score: Answer, text: string) => `
        <label class="option">
          <input type="radio" name="q${item.id}" value="${score}" ${a === score ? 'checked' : ''}>
          <span>${esc(text)}</span>
        </label>`;
      return `
        <fieldset class="question ${a === undefined ? '' : 'answered'}" id="card-${item.id}" data-item="${item.id}">
          <legend>
            <span class="q-num">${i + 1} из ${items.length}</span>
            <span class="q-text">${esc(item.text)}</span>
            ${item.ageNote ? `<span class="q-note">(${esc(item.ageNote)})</span>` : ''}
          </legend>
          <div class="options">${option(1, item.yes)}${option(0, item.no)}</div>
        </fieldset>`;
    })
    .join('');

  return `
    <section class="screen">
      <h1 tabindex="-1">Вопросы</h1>
      <p class="callout callout-title">Группа ${esc(group.label)}: ${items.length} вопросов</p>
      <form id="questions" novalidate>
        ${cards}
        <div class="field time-field">
          <label for="minutes">Сколько времени у вас заняло заполнение опросника?</label>
          <div class="with-unit">
            <input id="minutes" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" value="${esc(state.minutesEdited ? state.minutes : String(measuredMinutes()))}">
            <span>мин</span>
          </div>
          <p class="hint">Время посчитано автоматически, его можно исправить.</p>
        </div>
      </form>
      <div class="actions sticky-actions progress-bar-wrap">
        <div class="progress" aria-live="polite">
          <span id="progressText"></span>
          <span class="bar"><span id="progressFill"></span></span>
        </div>
        <button type="button" class="btn btn-primary" id="toResult">Результат</button>
      </div>
      <div class="actions">${backButton('child')}</div>
    </section>`;
}

function updateProgress(): void {
  const groupId = currentGroupId();
  if (!groupId) return;
  const group = groupById(groupId);
  const done = answeredCount(state.answers, group);
  $('#progressText').textContent = `Отвечено ${done} из ${group.items.length}`;
  $('#progressFill').style.width = `${(done / group.items.length) * 100}%`;
  if (!state.minutesEdited) $<HTMLInputElement>('#minutes').value = String(measuredMinutes());
}

function scrollToCard(el: Element): void {
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
}

/* ---------- Экран 4: результат ---------- */

interface ResultData {
  group: ReturnType<typeof groupById>;
  score: number;
  tableLevel: LevelId | null;
  chosenLevel: LevelId | null;
}

function resultData(): ResultData | null {
  const groupId = currentGroupId();
  if (!groupId) return null;
  const group = groupById(groupId);
  if (!isComplete(state.answers, group)) return null;
  const score = totalScore(state.answers, group);
  const tableLevel = levelFromScore(group, score);
  const chosenLevel = state.role === 'doctor' ? state.clinicalLevel ?? tableLevel : tableLevel;
  return { group, score, tableLevel, chosenLevel };
}

function ageText(): string {
  const check = ageCheck();
  return check && check.ok ? `${check.months} мес.` : '—';
}

function assessedDateText(): string {
  return formatDate(state.ageMode === 'dates' && state.assessed ? state.assessed : todayIso());
}

function filledByText(): string {
  return ROLE_TEXT[state.role ?? 'parent'].filledBy;
}

function minutesText(): string {
  const m = state.minutesEdited ? state.minutes : String(measuredMinutes());
  return /^\d+$/.test(m) ? `${m} мин` : '—';
}

function screenResult(): string {
  const r = resultData();
  if (!r) return '';
  const { group, score, tableLevel, chosenLevel } = r;
  const role = state.role ?? 'parent';
  const shown = chosenLevel ? levelById(chosenLevel) : null;

  const levelCard = shown
    ? `<div class="result-card level-${shown.id}">
         <p class="result-label">Уровень нарушения${role === 'doctor' && state.clinicalLevel && state.clinicalLevel !== tableLevel ? ' (по оценке специалиста)' : ''}</p>
         <p class="result-level">${esc(shown.title)}</p>
         <p class="result-score"><strong>${score}</strong> из ${group.maxScore} баллов · группа ${esc(group.label)}</p>
       </div>
       <p>${esc(shown.description)}</p>`
    : `<div class="result-card level-unknown">
         <p class="result-label">Уровень нарушения</p>
         <p class="result-level">Не определяется по таблице</p>
         <p class="result-score"><strong>${score}</strong> из ${group.maxScore} баллов · группа ${esc(group.label)}</p>
       </div>
       <p>Такая сумма баллов не попадает ни в один уровень таблицы бланка. ${
         role === 'doctor' ? 'Определите уровень по описаниям ниже.' : 'Обсудите результат с врачом.'
       }</p>`;

  const doctorLevel =
    role === 'doctor'
      ? `<fieldset class="card clinical">
           <legend><h2>Уровень по клинической картине</h2></legend>
           <p class="hint">По таблице: ${tableLevel ? esc(levelById(tableLevel).title.toLowerCase()) : 'не определяется'}. Выберите уровень по описаниям, если клиническая картина с ним не совпадает.</p>
           ${LEVELS.map(
             (l) => `
             <label class="option level-option level-${l.id}">
               <input type="radio" name="clinical" value="${l.id}" ${chosenLevel === l.id ? 'checked' : ''}>
               <span><strong>${esc(l.title)}</strong><small>${esc(l.description)}</small></span>
             </label>`,
           ).join('')}
         </fieldset>`
      : '';

  const table = `
    <div class="table-wrap">
      <table class="levels-table">
        <caption>Уровни нарушений по сумме баллов</caption>
        <thead><tr><th scope="col">Уровень</th>${AGE_GROUPS.map(
          (g) => `<th scope="col" class="${g.id === group.id ? 'cur-col' : ''}">${esc(g.label.replace(' месяцев', ' мес').replace(' месяца', ' мес'))}</th>`,
        ).join('')}</tr></thead>
        <tbody>${LEVELS.map(
          (l) => `<tr class="${l.id === tableLevel ? 'cur-row' : ''}"><th scope="row">${esc(l.title)}</th>${AGE_GROUPS.map((g) => {
            const [from, to] = LEVEL_RANGES[g.id][l.id];
            const hit = g.id === group.id && l.id === tableLevel;
            return `<td class="${g.id === group.id ? 'cur-col' : ''} ${hit ? 'hit' : ''}">${from === to ? from : `${from}–${to}`}</td>`;
          }).join('')}</tr>`,
        ).join('')}</tbody>
      </table>
    </div>`;

  const answersList = itemsForGroup(group)
    .map((item, i) => {
      const a = state.answers[item.id] as Answer;
      return `<li><span class="a-q">${i + 1}. ${esc(item.text)}</span><span class="a-a">${esc(a === 1 ? item.yes : item.no)} — <b>${a}</b></span></li>`;
    })
    .join('');

  const canShare = typeof navigator.share === 'function';

  return `
    <section class="screen">
      <h1 tabindex="-1">Результат</h1>
      ${levelCard}
      <p class="callout">${esc(ROLE_TEXT[role].resultNote)}</p>
      ${doctorLevel}

      <div class="card">
        <h2>Сведения</h2>
        <dl class="meta">
          ${state.childName.trim() ? `<dt>Ребёнок</dt><dd>${esc(state.childName.trim())}</dd>` : ''}
          <dt>Возраст</dt><dd>${ageText()}</dd>
          <dt>Дата оценки</dt><dd>${assessedDateText()}</dd>
          <dt>Заполнил</dt><dd>${esc(filledByText())}</dd>
          <dt>Время заполнения</dt><dd>${minutesText()}</dd>
        </dl>
      </div>

      <div class="card">
        <h2>Ответы</h2>
        <ol class="answers">${answersList}</ol>
        <p class="total">Сумма баллов: <b>${score}</b> из ${group.maxScore}</p>
      </div>

      <div class="card">
        <h2>Справочная таблица</h2>
        ${table}
      </div>

      <div class="actions result-actions no-print">
        <button type="button" class="btn btn-primary btn-block" id="printBtn">Сохранить PDF или распечатать</button>
        <button type="button" class="btn btn-secondary btn-block" id="shareBtn">${canShare ? 'Поделиться' : 'Скопировать результат'}</button>
        <button type="button" class="btn btn-ghost btn-block" data-go="questions">Изменить ответы</button>
        <button type="button" class="btn btn-ghost btn-block" id="resetBtn">Новый опрос</button>
      </div>
      <p class="hint" id="shareMsg" role="status" aria-live="polite"></p>
    </section>`;
}

function shareText(): string {
  const r = resultData();
  if (!r) return '';
  const lines = ['Опросник оральных навыков и глотания (тестовая версия) — результат'];
  if (state.childName.trim()) lines.push(`Ребёнок: ${state.childName.trim()}`);
  lines.push(
    `Возраст: ${ageText()}, группа ${r.group.label}`,
    `Дата оценки: ${assessedDateText()}`,
    `Заполнил: ${filledByText()}`,
    `Сумма баллов: ${r.score} из ${r.group.maxScore}`,
    `Уровень нарушения: ${r.chosenLevel ? levelById(r.chosenLevel).title : 'не определяется по таблице'}`,
    '',
    'Ответы:',
    ...itemsForGroup(r.group).map((item, i) => {
      const a = state.answers[item.id] as Answer;
      return `${i + 1}. ${item.text}: ${a === 1 ? item.yes : item.no} (${a})`;
    }),
  );
  return lines.join('\n');
}

/* ---------- Обработчики ---------- */

const bind: Record<Step, () => void> = {
  info() {
    bindGoButtons();
    initSwallowAnimation($('#app'));
  },

  role() {
    bindGoButtons();
    document.querySelectorAll<HTMLButtonElement>('[data-role]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const role = btn.dataset.role as Role;
        if (state.role !== role) state.clinicalLevel = null;
        state.role = role;
        go('child');
      }),
    );
  },

  child() {
    bindGoButtons();
    $<HTMLInputElement>('#childName').addEventListener('input', (e) => {
      state.childName = (e.target as HTMLInputElement).value;
      saveState();
    });
    document.querySelectorAll<HTMLInputElement>('input[name="ageMode"]').forEach((r) =>
      r.addEventListener('change', () => {
        state.ageMode = r.value as AgeMode;
        $('.age-dates').hidden = state.ageMode !== 'dates';
        $('.age-months').hidden = state.ageMode !== 'months';
        updateAgeUi();
      }),
    );
    const bindInput = (sel: string, key: 'birth' | 'assessed' | 'monthsInput') => {
      const input = $<HTMLInputElement>(sel);
      const handler = () => {
        state[key] = input.value;
        updateAgeUi();
      };
      input.addEventListener('input', handler);
      input.addEventListener('change', handler);
    };
    bindInput('#birth', 'birth');
    bindInput('#assessed', 'assessed');
    bindInput('#months', 'monthsInput');
    $('#toQuestions').addEventListener('click', () => go('questions'));
  },

  questions() {
    bindGoButtons();
    const form = $<HTMLFormElement>('#questions');
    form.addEventListener('submit', (e) => e.preventDefault());
    form.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      if (input.type !== 'radio') return;
      const card = input.closest<HTMLElement>('.question');
      if (!card) return;
      const id = Number(card.dataset.item) as ItemId;
      const wasAnswered = state.answers[id] !== undefined;
      state.answers[id] = Number(input.value) as Answer;
      card.classList.add('answered');
      syncChecked(card);
      card.classList.remove('missing');
      saveState();
      updateProgress();
      if (!wasAnswered) {
        // следующий неотвеченный ниже текущего; если ниже всё отвечено — первый пропущенный выше
        const cards = Array.from(form.querySelectorAll('.question'));
        const after = cards.slice(cards.indexOf(card) + 1);
        const next =
          after.find((c) => !c.classList.contains('answered')) ??
          cards.find((c) => !c.classList.contains('answered')) ??
          form.querySelector('.time-field');
        if (next) scrollToCard(next);
      }
    });
    const minutes = $<HTMLInputElement>('#minutes');
    minutes.addEventListener('input', () => {
      state.minutes = minutes.value.replace(/\D/g, '');
      minutes.value = state.minutes;
      state.minutesEdited = true;
      saveState();
    });
    $('#toResult').addEventListener('click', () => {
      const missing = Array.from(form.querySelectorAll<HTMLElement>('.question:not(.answered)'));
      if (missing.length) {
        missing.forEach((m) => m.classList.add('missing'));
        scrollToCard(missing[0]);
        missing[0].querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
        $('#progressText').textContent = `Осталось ответить: ${missing.length}`;
        return;
      }
      if (!state.minutesEdited) state.minutes = String(measuredMinutes());
      go('result');
    });
    updateProgress();
  },

  result() {
    bindGoButtons();
    document.querySelectorAll<HTMLInputElement>('input[name="clinical"]').forEach((r) =>
      r.addEventListener('change', () => {
        state.clinicalLevel = r.value as LevelId;
        saveState();
        render();
        document.querySelector('.clinical')?.scrollIntoView({ block: 'start' });
      }),
    );
    $('#printBtn').addEventListener('click', () => window.print());
    $('#shareBtn').addEventListener('click', async () => {
      const text = shareText();
      const msg = $('#shareMsg');
      try {
        if (typeof navigator.share === 'function') {
          await navigator.share({ title: 'Результат опросника', text });
        } else {
          await navigator.clipboard.writeText(text);
          msg.textContent = 'Результат скопирован — его можно вставить в сообщение врачу.';
        }
      } catch (err) {
        if ((err as DOMException).name !== 'AbortError') msg.textContent = 'Не получилось. Сохраните результат в PDF.';
      }
    });
    $('#resetBtn').addEventListener('click', () => {
      if (!confirm('Начать новый опрос? Текущие ответы будут удалены.')) return;
      state = freshState();
      saveState();
      go('role');
    });
  },
};

/* ---------- Запуск ---------- */

export function start(): void {
  const fromHash = location.hash.slice(1) as Step;
  const initial = STEPS.includes(fromHash) ? fromHash : state.step;
  const target = allowed(initial) ? initial : furthestAllowed();
  state.step = target;
  history.replaceState({ step: target }, '', `#${target}`);
  render();
}
