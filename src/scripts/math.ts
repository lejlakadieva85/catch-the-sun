import type { BuildingVariant } from '../types/project';

// =============================
// Типы
// =============================

export type MethodId = 'topsis' | 'ahp' | 'pareto' | 'formulaV';
export type Direction = 'max' | 'min';
export type NumericField = 'area' | 'floors' | 'density' | 'insolation';

/** Критерий для расчёта: какое поле варианта, вес в процентах и направление. */
export interface CriterionInput {
    id: NumericField;
    weight: number;
    direction: Direction;
}

export interface RankedItem {
    variantId: string;
    place: number;   // место в рейтинге
    value: number;   // балл (близость к идеалу) или номер слоя для Парето
}

export interface MethodRanking {
    method: MethodId;
    kind: 'score' | 'layer';
    items: RankedItem[]; // отсортированы: первый элемент — лидер
}

export const METHOD_TITLES: Record<MethodId, string> = {
    topsis: 'TOPSIS',
    ahp: 'AHP',
    pareto: 'Парето',
    formulaV: 'Формула V'
};

// =============================
// Нормализация одного критерия
// =============================

type NormalizationMode = 'ideal' | 'share' | 'minmax';

/**
 * Приводит значения критерия к шкале 0…1, где 1 — лучше.
 * Направление «меньше — лучше» учитывается здесь.
 *
 * ideal  — доля от лучшего значения (x / max или min / x)
 * share  — доля от суммы
 * minmax — линейное растяжение между худшим и лучшим
 */
function normalizeColumn(
    values: number[],
    direction: Direction,
    mode: NormalizationMode
): number[] {

    const max = Math.max(...values);
    const min = Math.min(...values);

    if (mode === 'minmax') {
        if (max === min) {
            return values.map(() => 1);
        }

        return values.map(value =>
            direction === 'max'
                ? (value - min) / (max - min)
                : (max - value) / (max - min)
        );
    }

    if (mode === 'share') {
        const benefit = direction === 'max'
            ? values
            : values.map(value => 1 / Math.max(value, 1e-9));

        const total = benefit.reduce((sum, value) => sum + value, 0);

        if (total <= 0) {
            return values.map(() => 1 / values.length);
        }

        return benefit.map(value => value / total);
    }

    // mode === 'ideal'
    if (direction === 'max') {
        if (max <= 0) {
            return values.map(() => 1);
        }

        return values.map(value => Math.max(value, 0) / max);
    }

    return values.map(value => (value <= 0 ? 1 : min / value));
}

// =============================
// Взвешенная нормализованная сумма
// =============================

function weightedSum(
    variants: BuildingVariant[],
    criteria: CriterionInput[],
    mode: NormalizationMode
): Record<string, number> {

    const scores: Record<string, number> = {};

    variants.forEach(variant => {
        scores[variant.id] = 0;
    });

    const totalWeight = criteria.reduce((sum, item) => sum + item.weight, 0);

    criteria.forEach(criterion => {

        // Веса из процентов переводим в доли. Если все веса нулевые — делим поровну.
        const share = totalWeight > 0
            ? criterion.weight / totalWeight
            : 1 / criteria.length;

        const column = variants.map(variant => variant[criterion.id]);
        const normalized = normalizeColumn(column, criterion.direction, mode);

        variants.forEach((variant, index) => {
            scores[variant.id] += share * normalized[index];
        });
    });

    return scores;
}

// =============================================================
// ФУНКЦИИ РАСЧЁТА
// Каждую можно заменить точными формулами от аналитиков.
// Вход: варианты и критерии. Выход: балл по id варианта (чем больше, тем лучше).
// =============================================================

/** TOPSIS (приближение): взвешенная нормализованная сумма. */
export function calculateScores(
    variants: BuildingVariant[],
    criteria: CriterionInput[]
): Record<string, number> {
    return weightedSum(variants, criteria, 'ideal');
}

/** AHP / МАИ — ЗАГЛУШКА. Настоящий метод требует матрицы парных сравнений. */
export function calculateAhpScores(
    variants: BuildingVariant[],
    criteria: CriterionInput[]
): Record<string, number> {
    return weightedSum(variants, criteria, 'share');
}

/** Формула V (UrbanSketch) — ЗАГЛУШКА до получения формулы от аналитиков. */
export function calculateFormulaVScores(
    variants: BuildingVariant[],
    criteria: CriterionInput[]
): Record<string, number> {
    return weightedSum(variants, criteria, 'minmax');
}

/** Парето: слои недоминируемых вариантов. Слой 1 — лучший. */
export function calculateParetoLayers(
    variants: BuildingVariant[],
    criteria: CriterionInput[]
): Record<string, number> {

    const isBetter = (
        a: BuildingVariant,
        b: BuildingVariant,
        criterion: CriterionInput
    ): boolean =>
        criterion.direction === 'max'
            ? a[criterion.id] > b[criterion.id]
            : a[criterion.id] < b[criterion.id];

    const isWorse = (
        a: BuildingVariant,
        b: BuildingVariant,
        criterion: CriterionInput
    ): boolean =>
        criterion.direction === 'max'
            ? a[criterion.id] < b[criterion.id]
            : a[criterion.id] > b[criterion.id];

    // a доминирует b: нигде не хуже и хотя бы в одном критерии лучше
    const dominates = (a: BuildingVariant, b: BuildingVariant): boolean =>
        !criteria.some(criterion => isWorse(a, b, criterion)) &&
        criteria.some(criterion => isBetter(a, b, criterion));

    const layers: Record<string, number> = {};

    let remaining = [...variants];
    let layer = 1;

    while (remaining.length > 0) {

        const front = remaining.filter(variant =>
            !remaining.some(other => other !== variant && dominates(other, variant))
        );

        // Защита от зацикливания при некорректных данных
        const current = front.length > 0 ? front : remaining;

        current.forEach(variant => {
            layers[variant.id] = layer;
        });

        remaining = remaining.filter(variant => !current.includes(variant));
        layer++;
    }

    return layers;
}

// =============================
// Ранжирование
// =============================

function rankByScores(
    variants: BuildingVariant[],
    scores: Record<string, number>
): RankedItem[] {

    const sorted = [...variants].sort((a, b) => scores[b.id] - scores[a.id]);

    let previousPlace = 0;
    let previousScore = Number.NaN;

    return sorted.map((variant, index) => {
        const score = scores[variant.id];

        // Равные баллы делят одно место
        const place = index > 0 && Math.abs(score - previousScore) < 1e-9
            ? previousPlace
            : index + 1;

        previousPlace = place;
        previousScore = score;

        return { variantId: variant.id, place, value: score };
    });
}

/** Единая точка входа: считает выбранный метод и возвращает отсортированный рейтинг. */
export function rankVariants(
    method: MethodId,
    variants: BuildingVariant[],
    criteria: CriterionInput[]
): MethodRanking {

    switch (method) {

        case 'topsis':
            return {
                method,
                kind: 'score',
                items: rankByScores(variants, calculateScores(variants, criteria))
            };

        case 'ahp':
            return {
                method,
                kind: 'score',
                items: rankByScores(variants, calculateAhpScores(variants, criteria))
            };

        case 'formulaV':
            return {
                method,
                kind: 'score',
                items: rankByScores(variants, calculateFormulaVScores(variants, criteria))
            };

        case 'pareto': {
            const layers = calculateParetoLayers(variants, criteria);

            // Внутри слоя порядок задаёт взвешенная сумма
            const tieBreak = calculateScores(variants, criteria);

            const sorted = [...variants].sort((a, b) =>
                layers[a.id] - layers[b.id] || tieBreak[b.id] - tieBreak[a.id]
            );

            return {
                method,
                kind: 'layer',
                items: sorted.map((variant, index) => ({
                    variantId: variant.id,
                    place: index + 1,
                    value: layers[variant.id]
                }))
            };
        }
    }
}