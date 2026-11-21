import type { BuildingVariant } from '../types/project';
import {
    METHOD_TITLES,
    rankVariants,
    type CriterionInput,
    type MethodId,
    type MethodRanking
} from './math';

// =============================
// Типы
// =============================

export interface ResultCriterion extends CriterionInput {
    name: string;
    unit: string;
    needsConfirm?: boolean; // звёздочка «допущение макета»
}

const STORAGE_KEY = 'sunlight-building-variants';

const METHOD_ORDER: MethodId[] = ['topsis', 'ahp', 'pareto', 'formulaV'];

// =============================
// Элементы
// =============================

function getElement<T extends HTMLElement>(selector: string): T {
    const element = document.querySelector<T>(selector);

    if (!element) {
        throw new Error(`Не найден элемент третьего экрана: ${selector}`);
    }

    return element;
}

const resultBadge = getElement<HTMLElement>('#result-badge');
const resultTitle = getElement<HTMLElement>('#result-title');
const rankingValueHeader = getElement<HTMLElement>('#ranking-value-header');
const rankingBody = getElement<HTMLTableSectionElement>('#ranking-body');
const explanationValueHeader = getElement<HTMLElement>('#explanation-value-header');
const explanationBody = getElement<HTMLTableSectionElement>('#explanation-body');
const comparisonBody = getElement<HTMLTableSectionElement>('#comparison-body');
const backToDataButton = getElement<HTMLButtonElement>('#back-to-data');
const toWeightsButton = getElement<HTMLButtonElement>('#to-weights');

const stepLinks = document.querySelectorAll<HTMLAnchorElement>('.steps .step');

// =============================
// Состояние
// =============================

// Результаты методов копятся, пока данные и веса не менялись.
// Если что-то изменилось, старые столбцы сбрасываются в «—».
let signature = '';
let rankings: Partial<Record<MethodId, MethodRanking>> = {};

let currentMethod: MethodId = 'topsis';
let variants: BuildingVariant[] = [];
let criteria: ResultCriterion[] = [];
let selectedVariantId = '';

// =============================
// Вспомогательные функции
// =============================

function readVariants(): BuildingVariant[] {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) {
            return [];
        }

        const parsed: unknown = JSON.parse(saved);

        return Array.isArray(parsed) ? (parsed as BuildingVariant[]) : [];

    } catch {
        return [];
    }
}

function isCalculable(items: BuildingVariant[]): boolean {
    return items.length >= 2 && items.every(item =>
        Number.isFinite(item.area) &&
        Number.isFinite(item.floors) &&
        Number.isFinite(item.density) &&
        Number.isFinite(item.insolation)
    );
}

// «Б · Башни» → «Б»
function getLetter(name: string): string {
    return name.split('·')[0].trim() || name;
}

function formatNumber(value: number): string {
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
}

function createCell(text: string): HTMLTableCellElement {
    const cell = document.createElement('td');
    cell.textContent = text;
    return cell;
}

function findVariant(id: string): BuildingVariant | undefined {
    return variants.find(item => item.id === id);
}

// =============================
// Рейтинг
// =============================

function renderRanking(): void {

    const ranking = rankings[currentMethod];

    if (!ranking) {
        return;
    }

    const title = METHOD_TITLES[currentMethod];
    const leader = findVariant(ranking.items[0].variantId);

    resultBadge.textContent = `РАСЧЁТ ВЫПОЛНЕН · ${title.toUpperCase()}`;

    resultTitle.textContent =
        `${title} · первым показан вариант ${leader ? getLetter(leader.name) : '—'}`;

    rankingValueHeader.textContent =
        ranking.kind === 'layer' ? 'Слой Парето' : 'Близость к идеалу';

    rankingBody.replaceChildren();

    ranking.items.forEach((item, index) => {

        const variant = findVariant(item.variantId);

        if (!variant) {
            return;
        }

        const value = ranking.kind === 'layer'
            ? String(item.value)
            : item.value.toFixed(2).replace('.', ',');

        const row = document.createElement('tr');

        row.dataset.id = item.variantId;
        row.tabIndex = 0;
        row.classList.toggle('is-leader', index === 0);

        row.append(
            createCell(String(item.place)),
            createCell(variant.name),
            createCell(value),
            createCell(index === 0 ? 'Лидер расчёта' : 'Для сравнения')
        );

        rankingBody.appendChild(row);
    });
}

// =============================
// Объяснение результата
// =============================

function renderExplanation(): void {

    const variant = findVariant(selectedVariantId);

    explanationBody.replaceChildren();

    if (!variant) {
        return;
    }

    explanationValueHeader.textContent =
        `Исходное значение ${getLetter(variant.name)}`;

    criteria.forEach(criterion => {

        const directionBase = criterion.direction === 'max' ? 'Максимум' : 'Минимум';
        const direction = criterion.needsConfirm ? `${directionBase}*` : directionBase;

        const row = document.createElement('tr');

        row.append(
            createCell(criterion.name),
            createCell(`${formatNumber(criterion.weight)} %`),
            createCell(`${formatNumber(variant[criterion.id])} ${criterion.unit}`),
            createCell(direction)
        );

        explanationBody.appendChild(row);
    });
}

function selectVariant(id: string): void {

    if (!findVariant(id)) {
        return;
    }

    selectedVariantId = id;

    rankingBody.querySelectorAll<HTMLTableRowElement>('tr').forEach(row => {
        row.classList.toggle('is-selected', row.dataset.id === id);
    });

    renderExplanation();
}

rankingBody.addEventListener('click', (event: MouseEvent) => {
    const row = (event.target as HTMLElement).closest<HTMLTableRowElement>('tr');

    if (row?.dataset.id) {
        selectVariant(row.dataset.id);
    }
});

rankingBody.addEventListener('keydown', (event: KeyboardEvent) => {

    if (event.key !== 'Enter' && event.key !== ' ') {
        return;
    }

    const row = (event.target as HTMLElement).closest<HTMLTableRowElement>('tr');

    if (row?.dataset.id) {
        event.preventDefault();
        selectVariant(row.dataset.id);
    }
});

// =============================
// Сопоставление методов
// =============================

function renderComparison(): void {

    comparisonBody.replaceChildren();

    variants.forEach(variant => {

        const row = document.createElement('tr');

        row.appendChild(createCell(variant.name));

        METHOD_ORDER.forEach(method => {

            const ranking = rankings[method];

            const item = ranking?.items.find(entry => entry.variantId === variant.id);

            // Для Парето показываем слой, для остальных — место
            const text = !ranking || !item
                ? '—'
                : String(ranking.kind === 'layer' ? item.value : item.place);

            row.appendChild(createCell(text));
        });

        comparisonBody.appendChild(row);
    });
}

// =============================
// Запуск расчёта (вызывается из step2-criteria.ts)
// =============================

/**
 * Считает выбранный метод по актуальным данным и перерисовывает экран.
 * Возвращает false, если данные нельзя рассчитать.
 */
export function calculateAndRender(
    method: MethodId,
    criteriaList: ResultCriterion[]
): boolean {

    const currentVariants = readVariants();

    if (!isCalculable(currentVariants)) {
        return false;
    }

    variants = currentVariants;
    criteria = criteriaList.map(item => ({ ...item }));
    currentMethod = method;

    const newSignature = JSON.stringify([
        variants.map(variant => [
            variant.id,
            ...criteria.map(criterion => variant[criterion.id])
        ]),
        criteria.map(criterion => [criterion.id, criterion.weight, criterion.direction])
    ]);

    // Данные или веса изменились — результаты других методов устарели
    if (newSignature !== signature) {
        signature = newSignature;
        rankings = {};
    }

    rankings[method] = rankVariants(method, variants, criteria);

    renderRanking();

    selectVariant(rankings[method].items[0].variantId);

    renderComparison();

    return true;
}

// =============================
// Кнопки футера
// =============================

// Нажимаем на вкладки навигации: логика переходов уже есть в step2-criteria.ts
backToDataButton.addEventListener('click', () => stepLinks[0]?.click());
toWeightsButton.addEventListener('click', () => stepLinks[1]?.click());