// =============================
// Типы и данные шага 2
// =============================

type MethodId = 'topsis' | 'ahp' | 'pareto' | 'formulaV';

interface Criterion {
    id: string;
    name: string;
    unit: string;
    direction: 'max' | 'min';
    weight: number;
    needsConfirm?: boolean; // звёздочка «допущение макета»
}

const criteria: Criterion[] = [
    { id: 'insolation', name: 'Инсоляция',     unit: 'ч',     direction: 'max', weight: 50 },
    { id: 'area',       name: 'Общая площадь', unit: 'м²',    direction: 'max', weight: 30 },
    { id: 'density',    name: 'Плотность',     unit: 'м²/га', direction: 'min', weight: 20, needsConfirm: true }
];

let selectedMethod: MethodId = 'topsis';
let selectedId: string = criteria[0].id;

// =============================
// Элементы
// =============================

const step1 = document.querySelector<HTMLElement>('#step-1');
const step2 = document.querySelector<HTMLElement>('#step-2');

const stepLinks = document.querySelectorAll<HTMLAnchorElement>('.steps .step');

const projectName = document.querySelector<HTMLElement>('#project-name');
const versionBadge = document.querySelector<HTMLElement>('#version-badge');

const nextButton = document.querySelector<HTMLButtonElement>('#next-step');
const validationMessage = document.querySelector<HTMLDivElement>('#validation-message');

const methodList = document.querySelector<HTMLDivElement>('#method-list');
const criteriaBody = document.querySelector<HTMLTableSectionElement>('#criteria-body');
const weightInput = document.querySelector<HTMLInputElement>('#weight-input');
const sumBadge = document.querySelector<HTMLSpanElement>('#sum-badge');

const backButton = document.querySelector<HTMLButtonElement>('#back-step');
const calculateButton = document.querySelector<HTMLButtonElement>('#calculate');

if (
    !step1 || !step2 || !projectName || !versionBadge ||
    !nextButton || !validationMessage ||
    !methodList || !criteriaBody || !weightInput || !sumBadge ||
    !backButton || !calculateButton
) {
    throw new Error('Не удалось найти элементы второго экрана');
}

// =============================
// Переключение экранов
// =============================

function showStep(step: 1 | 2): void {
    step1!.hidden = step !== 1;
    step2!.hidden = step !== 2;

    // Подпись проекта и бейдж в шапке — только на втором экране
    projectName!.hidden = step !== 2;
    versionBadge!.hidden = step !== 2;

    stepLinks.forEach((link, index) => {
        const isActive = index === step - 1;

        link.classList.toggle('active', isActive);

        if (isActive) {
            link.setAttribute('aria-current', 'step');
        } else {
            link.removeAttribute('aria-current');
        }
    });

    window.scrollTo({ top: 0 });
}

// Данные первого экрана считаются проверенными, если
// step1-data.ts показал сообщение об успехе.
// Этот обработчик подключается ПОСЛЕ обработчика шага 1,
// поэтому к моменту его вызова класс успеха уже выставлен.
function isStep1Valid(): boolean {
    return validationMessage!.classList.contains('has-success');
}

nextButton.addEventListener('click', () => {
    if (isStep1Valid()) {
        showStep(2);
    }
});

backButton.addEventListener('click', () => showStep(1));

stepLinks.forEach((link, index) => {
    link.addEventListener('click', (event) => {
        event.preventDefault();

        if (index === 0) {
            showStep(1);
        } else if (index === 1 && isStep1Valid()) {
            showStep(2);
        }
    });
});

// =============================
// Метод оценки
// =============================

const methodButtons = methodList.querySelectorAll<HTMLButtonElement>('.method-button');

// Запоминаем исходные подписи, чтобы добавлять и убирать «· выбран»
methodButtons.forEach(button => {
    button.dataset.label = button.textContent?.trim() ?? '';
});

function renderMethods(): void {
    methodButtons.forEach(button => {
        const isActive = button.dataset.method === selectedMethod;
        const label = button.dataset.label ?? '';

        button.textContent = isActive ? `${label} · выбран` : label;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}

methodList.addEventListener('click', (event: MouseEvent) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
        return;
    }

    const button = target.closest<HTMLButtonElement>('.method-button');

    if (!button) {
        return;
    }

    selectedMethod = button.dataset.method as MethodId;
    renderMethods();
});

// =============================
// Таблица критериев
// =============================

function createCell(text: string): HTMLTableCellElement {
    const cell = document.createElement('td');
    cell.textContent = text;
    return cell;
}

function getDirectionLabel(criterion: Criterion): string {
    const base = criterion.direction === 'max' ? 'Больше — лучше' : 'Меньше — лучше';
    return criterion.needsConfirm ? `${base}*` : base;
}

function renderCriteria(): void {
    criteriaBody!.innerHTML = '';

    criteria.forEach(criterion => {
        const row = document.createElement('tr');

        row.dataset.id = criterion.id;
        row.tabIndex = 0;
        row.classList.toggle('is-selected', criterion.id === selectedId);

        row.append(
            createCell(criterion.name),
            createCell(criterion.unit),
            createCell(getDirectionLabel(criterion)),
            createCell(`${criterion.weight} %`)
        );

        criteriaBody!.appendChild(row);
    });
}

function selectCriterion(id: string): void {
    const criterion = criteria.find(item => item.id === id);

    if (!criterion) {
        return;
    }

    selectedId = id;
    weightInput!.value = String(criterion.weight);
    weightInput!.classList.remove('invalid');

    renderCriteria();
}

criteriaBody.addEventListener('click', (event: MouseEvent) => {
    const row = (event.target as HTMLElement).closest<HTMLTableRowElement>('tr');

    if (row?.dataset.id) {
        selectCriterion(row.dataset.id);
    }
});

criteriaBody.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
        return;
    }

    const row = (event.target as HTMLElement).closest<HTMLTableRowElement>('tr');

    if (row?.dataset.id) {
        event.preventDefault();
        selectCriterion(row.dataset.id);
    }
});

// =============================
// Вес выбранного критерия и сумма
// =============================

function updateSum(): void {
    const sum = Math.round(
        criteria.reduce((total, item) => total + item.weight, 0) * 100
    ) / 100;

    const isOk = sum === 100;

    sumBadge!.classList.toggle('is-warning', !isOk);

    if (isOk) {
        sumBadge!.textContent = 'Сумма весов: 100 %';
    } else {
        const diff = Math.round((100 - sum) * 100) / 100;
        const rest = diff > 0 ? `осталось ${diff} %` : `лишние ${Math.abs(diff)} %`;

        sumBadge!.textContent = `Сумма весов: ${sum} % · ${rest}`;
    }
}

weightInput.addEventListener('input', () => {
    const criterion = criteria.find(item => item.id === selectedId);

    if (!criterion) {
        return;
    }

    const raw = weightInput.value.trim();
    const value = weightInput.valueAsNumber;

    if (raw === '' || !Number.isFinite(value) || value < 0 || value > 100) {
        weightInput.classList.add('invalid');
        return;
    }

    weightInput.classList.remove('invalid');
    criterion.weight = value;

    renderCriteria();
    updateSum();
});

// =============================
// Кнопка «Рассчитать»
// =============================

calculateButton.addEventListener('click', () => {
    updateSum();

    if (sumBadge.classList.contains('is-warning')) {
        return; // сумма ≠ 100 % — расчёт не запускаем
    }

    // Здесь позднее подключается переход на «03 Результаты».
});

// =============================
// Первоначальный запуск
// =============================

renderMethods();
renderCriteria();
updateSum();
weightInput.value = String(criteria[0].weight);