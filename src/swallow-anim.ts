/*
 * Анимированная схема глотания: голова и шея ребёнка в сагиттальном разрезе, лицом влево.
 * Спереди (слева) — гортань и трахея, сзади (справа) — пищевод, за ними позвоночник.
 *
 * Все анимации — SMIL с одинаковой длительностью, поэтому идут синхронно:
 *   0–30%   ротовая фаза: комок на языке, язык толкает его назад;
 *   12–40%  импульсы от центра глотания по нервам;
 *   30–55%  глоточная фаза: мягкое нёбо поднимается, надгортанник закрывает гортань;
 *   55–100% пищеводная фаза: комок спускается по пищеводу.
 * Цвета задаются классами и переменными CSS — схема меняется вместе с темой.
 */

const DUR = '6s';
const LOOP = `dur="${DUR}" repeatCount="indefinite"`;

/* Номер-метка с выноской, как в легенде под схемой */
function marker(n: number, kind: 'center' | 'nerve' | 'organ', x: number, y: number, tx: number, ty: number): string {
  return `
    <g class="an-marker an-marker-${kind}">
      <line x1="${tx}" y1="${ty}" x2="${x}" y2="${y}" class="an-leader"/>
      <circle cx="${tx}" cy="${ty}" r="10"/>
      <text x="${tx}" y="${ty + 4}" text-anchor="middle">${n}</text>
    </g>`;
}

/* Фраза о текущей фазе: видна только в своём отрезке цикла */
function phaseLabel(text: string, from: number, to: number): string {
  const keyTimes = from === 0 ? `0;${to}` : to === 1 ? `0;${from}` : `0;${from};${to}`;
  const values = from === 0 ? '1;0' : to === 1 ? '0;1' : '0;1;0';
  return `
    <text x="200" y="469" text-anchor="middle" class="an-phase" opacity="${from === 0 ? 1 : 0}">${text}
      <animate attributeName="opacity" ${LOOP} calcMode="discrete" keyTimes="${keyTimes}" values="${values}"/>
    </text>`;
}

/* Импульс по нерву: светлая черта пробегает по пути один раз за цикл */
function pulse(d: string, start: number, end: number): string {
  return `
    <path d="${d}" class="an-nerve"/>
    <path d="${d}" class="an-pulse" pathLength="100" stroke-dasharray="14 100" stroke-dashoffset="114" opacity="0">
      <animate attributeName="stroke-dashoffset" ${LOOP} keyTimes="0;${start};${end};1" values="114;114;0;0"/>
      <animate attributeName="opacity" ${LOOP} calcMode="discrete" keyTimes="0;${start};${end};1" values="0;1;0;0"/>
    </path>`;
}

export const SWALLOW_SVG = `
<svg class="swallow-svg" viewBox="0 0 400 478" role="img" aria-labelledby="anTitle anDesc" xmlns="http://www.w3.org/2000/svg">
  <title id="anTitle">Схема глотания у ребёнка</title>
  <desc id="anDesc">Разрез головы и шеи. Пищевой комок движется изо рта через глотку в пищевод; мягкое нёбо поднимается, надгортанник закрывает вход в гортань; импульс идёт от центра глотания в продолговатом мозге по языкоглоточному и блуждающему нервам.</desc>

  <!-- Голова и шея -->
  <path class="an-skin" d="M306 445 C300 390 292 345 300 305 C318 255 330 200 318 140 C304 70 250 28 186 30 C130 32 92 62 86 112 C84 132 88 146 84 160 C80 172 70 180 70 189 C70 196 78 199 82 203 C79 208 80 214 84 218 C81 223 81 230 84 234 C80 240 82 252 92 262 C104 274 124 280 140 288 C150 300 154 340 152 380 L150 445 Z"/>

  <!-- Головной мозг и ствол со спинным мозгом -->
  <path class="an-brain" d="M120 112 C120 66 168 44 214 46 C262 48 300 80 300 128 C300 158 286 178 262 184 C240 189 214 178 196 170 C170 160 140 152 128 140 C122 132 120 124 120 112 Z"/>
  <path class="an-stem" d="M244 170 C252 196 254 222 256 250 C258 290 262 340 262 445" />

  <!-- Позвонки -->
  <g class="an-bone">
    <rect x="236" y="262" width="20" height="26" rx="5"/>
    <rect x="236" y="294" width="20" height="26" rx="5"/>
    <rect x="236" y="326" width="20" height="26" rx="5"/>
    <rect x="236" y="358" width="20" height="26" rx="5"/>
    <rect x="236" y="390" width="20" height="26" rx="5"/>
    <rect x="236" y="422" width="20" height="23" rx="5"/>
  </g>

  <!-- Носовая полость, глотка, гортань с трахеей и пищевод -->
  <path class="an-air" d="M86 190 C110 184 160 182 200 186 L214 196 L218 300 L198 300 L188 284 C190 266 196 252 198 236 C190 226 176 218 160 214 L96 214 C92 206 88 198 86 190 Z"/>
  <path class="an-airway" d="M168 290 L192 290 L190 445 L166 445 Z"/>
  <path class="an-eso" d="M199 300 L217 300 L218 445 L200 445 Z"/>
  <g class="an-folds">
    <line x1="168" y1="312" x2="178" y2="314"/>
    <line x1="192" y1="312" x2="182" y2="314"/>
  </g>

  <!-- Твёрдое и мягкое нёбо (нёбо поднимается и закрывает носоглотку) -->
  <path class="an-palate" d="M90 214 L164 211" />
  <path class="an-soft" d="M164 211 C176 212 186 218 192 228">
    <animateTransform attributeName="transform" type="rotate" ${LOOP}
      keyTimes="0;0.28;0.36;0.55;0.63;1" values="0 164 211;0 164 211;-32 164 211;-32 164 211;0 164 211;0 164 211"/>
  </path>

  <!-- Язык -->
  <path class="an-tongue" d="M88 236 C104 222 140 214 170 220 C188 224 198 238 196 258 C194 272 186 282 174 284 C150 284 118 266 96 252 C90 248 86 242 88 236 Z"/>

  <!-- Надгортанник: опускается и закрывает вход в гортань -->
  <path class="an-epi" d="M182 290 C182 278 186 268 194 260">
    <animateTransform attributeName="transform" type="rotate" ${LOOP}
      keyTimes="0;0.3;0.38;0.55;0.65;1" values="0 182 290;0 182 290;58 182 290;58 182 290;0 182 290;0 182 290"/>
  </path>

  <!-- Нервы от центра глотания: IX — к глотке, X — к гортани и вдоль пищевода -->
  ${pulse('M252 214 C240 226 228 238 214 250', 0.12, 0.3)}
  ${pulse('M252 214 C244 252 222 278 192 304', 0.16, 0.36)}
  ${pulse('M252 214 C244 280 228 340 219 420', 0.2, 0.42)}

  <circle cx="252" cy="214" r="5" class="an-nucleus">
    <animate attributeName="r" ${LOOP} keyTimes="0;0.08;0.16;0.28;1" values="4;4;8;4;4"/>
  </circle>

  <!-- Пищевой комок: рот → глотка → пищевод -->
  <ellipse class="an-bolus" cx="0" cy="0" rx="9" ry="6">
    <animateMotion ${LOOP} calcMode="linear" rotate="auto"
      path="M122 224 C150 220 176 222 192 238 C204 252 207 272 208 300 L209 455"
      keyPoints="0;0;0.32;0.5;1;1" keyTimes="0;0.12;0.36;0.52;0.9;1"/>
    <animate attributeName="opacity" ${LOOP} keyTimes="0;0.86;0.9;0.98;1" values="1;1;0;0;1"/>
  </ellipse>

  <!-- Метки, как в легенде -->
  ${marker(1, 'center', 252, 214, 288, 206)}
  ${marker(2, 'nerve', 226, 240, 288, 240)}
  ${marker(3, 'nerve', 226, 360, 288, 360)}
  ${marker(4, 'organ', 176, 300, 128, 312)}
  ${marker(5, 'organ', 209, 400, 128, 400)}

  ${phaseLabel('Ротовая фаза: язык толкает комок к глотке', 0, 0.3)}
  ${phaseLabel('Глоточная фаза: дыхательные пути закрыты', 0.3, 0.55)}
  ${phaseLabel('Пищеводная фаза: комок идёт в желудок', 0.55, 1)}
</svg>`;

/** Кнопка паузы и уважение к настройке «уменьшить движение». */
export function initSwallowAnimation(root: ParentNode): void {
  const svg = root.querySelector<SVGSVGElement>('.swallow-svg');
  const btn = root.querySelector<HTMLButtonElement>('#animToggle');
  if (!svg || !btn) return;
  const setPaused = (paused: boolean) => {
    if (paused) svg.pauseAnimations();
    else svg.unpauseAnimations();
    btn.textContent = paused ? 'Запустить анимацию' : 'Остановить анимацию';
    btn.setAttribute('aria-pressed', String(paused));
  };
  btn.addEventListener('click', () => setPaused(!svg.animationsPaused()));
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // кадр глоточной фазы: видно, как закрыты дыхательные пути
    svg.setCurrentTime(2.6);
    setPaused(true);
  } else {
    setPaused(false);
  }
}
