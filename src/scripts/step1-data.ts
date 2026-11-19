
import type { BuildingVariant } from '../types/project';

// =============================
// Начальные данные
// =============================

const STORAGE_KEY = 'sunlight-building-variants';

const defaultVariants: BuildingVariant[] = [
    {
        id: '1',
        name: 'А · Квартал',
        area: 42000,
        floors: 8,
        density: 15000,
        insolation: 2.6
    },
    {
        id: '2',
        name: 'Б · Башни',
        area: 48000,
        floors: 12,
        density: 17000,
        insolation: 3.1
    },
    {
        id: '3',
        name: 'В · Линейный',
        area: 39000,
        floors: 7,
        density: 14000,
        insolation: 2.3
    }
];

// =============================
// Работа с хранилищем
// =============================

function loadVariants(): BuildingVariant[] {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) {
            return defaultVariants.map(item => ({ ...item }));
        }

        const parsed: unknown = JSON.parse(saved);

        if (
            !Array.isArray(parsed) ||
            !parsed.every(item =>
                item !== null &&
                typeof item === 'object' &&
                typeof item.id === 'string' &&
                typeof item.name === 'string' &&
                typeof item.area === 'number' &&
                typeof item.floors === 'number' &&
                typeof item.density === 'number' &&
                typeof item.insolation === 'number'
            )
        ) {
            return defaultVariants.map(item => ({ ...item }));
        }

        return parsed as BuildingVariant[];

    } catch {
        return defaultVariants.map(item => ({ ...item }));
    }
}

let variants: BuildingVariant[] = loadVariants();

function saveVariants(): void {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(variants)
        );
    } catch (error) {
        console.error('Не удалось сохранить данные:', error);
    }
}

// =============================
// Получение элементов HTML
// =============================

const tableBody = document.querySelector<HTMLTableSectionElement>(
    '#variants-body'
);

const addButton = document.querySelector<HTMLButtonElement>(
    '#add-variant'
);

const nextButton = document.querySelector<HTMLButtonElement>(
    '#next-step'
);

const validationMessage = document.querySelector<HTMLDivElement>(
    '#validation-message'
);

if (!tableBody || !addButton || !nextButton || !validationMessage) {
    throw new Error('Не удалось найти необходимые элементы интерфейса');
}

// =============================
// Создание строки таблицы
// =============================

function createInput(
    field: keyof BuildingVariant,
    value: string | number,
    variantId: string,
    label: string
): HTMLInputElement {

    const input = document.createElement('input');

    input.className = 'cell-input';

    input.dataset.field = field;
    input.dataset.id = variantId;

    input.setAttribute('aria-label', label);

    if (field === 'name') {
        input.type = 'text';
        input.value = String(value);
        input.placeholder = 'Название варианта';
    } else {
        input.type = 'number';
        input.step = field === 'insolation' ? '0.1' : '1';
        input.min = '0';
        input.value = String(value);
        input.placeholder = 'Введите число';
        input.inputMode = 'decimal';
    }

    return input;
}

function renderRows(): void {

    tableBody.innerHTML = '';

    variants.forEach((variant, index) => {

        const row = document.createElement('tr');

        // Название варианта
        const nameCell = document.createElement('td');

        nameCell.appendChild(
            createInput(
                'name',
                variant.name,
                variant.id,
                `Название варианта ${index + 1}`
            )
        );

        row.appendChild(nameCell);

        // Общая площадь
        const areaCell = document.createElement('td');

        areaCell.appendChild(
            createInput(
                'area',
                variant.area,
                variant.id,
                `Общая площадь варианта ${index + 1}`
            )
        );

        row.appendChild(areaCell);

        // Этажность
        const floorsCell = document.createElement('td');

        floorsCell.appendChild(
            createInput(
                'floors',
                variant.floors,
                variant.id,
                `Этажность варианта ${index + 1}`
            )
        );

        row.appendChild(floorsCell);

        // Плотность
        const densityCell = document.createElement('td');

        densityCell.appendChild(
            createInput(
                'density',
                variant.density,
                variant.id,
                `Плотность варианта ${index + 1}`
            )
        );

        row.appendChild(densityCell);

        // Инсоляция
        const insolationCell = document.createElement('td');

        insolationCell.appendChild(
            createInput(
                'insolation',
                variant.insolation,
                variant.id,
                `Инсоляция варианта ${index + 1}`
            )
        );

        row.appendChild(insolationCell);

        // Кнопка удаления
        const actionsCell = document.createElement('td');

        const deleteButton = document.createElement('button');

        deleteButton.type = 'button';
        deleteButton.className = 'delete-button';
        deleteButton.textContent = '×';
        deleteButton.title = 'Удалить вариант';
        deleteButton.setAttribute(
            'aria-label',
            `Удалить вариант ${variant.name}`
        );

        deleteButton.dataset.deleteId = variant.id;

        actionsCell.appendChild(deleteButton);

        row.appendChild(actionsCell);

        tableBody.appendChild(row);
    });
}

// =============================
// Редактирование данных
// =============================

tableBody.addEventListener('input', (event: Event) => {

    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
        return;
    }

    const field = target.dataset.field as
        | 'name'
        | 'area'
        | 'floors'
        | 'density'
        | 'insolation'
        | undefined;

    const id = target.dataset.id;

    if (!field || !id) {
        return;
    }

    const variant = variants.find(item => item.id === id);

    if (!variant) {
        return;
    }

    if (field === 'name') {
        variant.name = target.value;
    } else {
        // Пустое поле временно сохраняем как NaN.
        // Это позволит показать ошибку при проверке.
        variant[field] = target.value.trim() === ''
            ? NaN
            : target.valueAsNumber;
    }

    target.classList.remove('invalid');

    saveVariants();
});

// =============================
// Добавление варианта
// =============================

function addVariant(): void {

    const newVariant: BuildingVariant = {
        id: crypto.randomUUID(),
        name: `Новый вариант ${variants.length + 1}`,
        area: 0,
        floors: 0,
        density: 0,
        insolation: 0
    };

    variants.push(newVariant);

    saveVariants();
    renderRows();

    showMessage(
        'Добавлен новый вариант. Заполните его числовые показатели.',
        'default'
    );

    // Переводим курсор в название новой строки
    const newInput = tableBody.querySelector<HTMLInputElement>(
        `input[data-id="${newVariant.id}"][data-field="name"]`
    );

    newInput?.focus();
}

addButton.addEventListener('click', addVariant);

// =============================
// Удаление варианта
// =============================

tableBody.addEventListener('click', (event: MouseEvent) => {

    const target = event.target;

    if (!(target instanceof HTMLElement)) {
        return;
    }

    const deleteButton = target.closest<HTMLButtonElement>(
        '[data-delete-id]'
    );

    if (!deleteButton) {
        return;
    }

    const id = deleteButton.dataset.deleteId;

    if (!id) {
        return;
    }

    variants = variants.filter(item => item.id !== id);

    saveVariants();
    renderRows();

    showMessage(
        'Вариант удалён. Перед расчётом необходимо оставить минимум два варианта.',
        'default'
    );
});

// =============================
// Вывод сообщений
// =============================

type MessageType = 'default' | 'error' | 'success';

function showMessage(
    message: string,
    type: MessageType
): void {

    validationMessage.textContent = message;

    validationMessage.className = 'validation-message';

    if (type === 'error') {
        validationMessage.classList.add('has-error');
    }

    if (type === 'success') {
        validationMessage.classList.add('has-success');
    }
}

// =============================
// Проверка данных
// =============================

function validateVariants(): boolean {

    // Сбрасываем предыдущую подсветку
    tableBody.querySelectorAll('.cell-input').forEach(input => {
        input.classList.remove('invalid');
    });

    // Проверяем количество вариантов
    if (variants.length < 2) {

        showMessage(
            'Ошибка: добавьте минимум 2 варианта для сравнения.',
            'error'
        );

        return false;
    }

    const errors: string[] = [];

    const numericFields = [
        'area',
        'floors',
        'density',
        'insolation'
    ] as const;

    variants.forEach((variant, index) => {

        numericFields.forEach(field => {

            const value = variant[field];

            const input = tableBody.querySelector<HTMLInputElement>(
                `input[data-id="${variant.id}"][data-field="${field}"]`
            );

            if (
                !Number.isFinite(value) ||
                value < 0 ||
                (field === 'floors' && !Number.isInteger(value))
            ) {

                input?.classList.add('invalid');

                errors.push(
                    `Вариант ${index + 1}: проверьте поле «${getFieldName(field)}».`
                );
            }

        });

        // Проверяем название
        if (!variant.name.trim()) {

            const input = tableBody.querySelector<HTMLInputElement>(
                `input[data-id="${variant.id}"][data-field="name"]`
            );

            input?.classList.add('invalid');

            errors.push(
                `Вариант ${index + 1}: укажите название.`
            );
        }

    });

    if (errors.length > 0) {

        showMessage(
            'Обнаружены ошибки:\n' + errors.join('\n'),
            'error'
        );

        return false;
    }

    showMessage(
        'Данные успешно проверены. Все варианты заполнены корректно. Следующий шаг — «Критерии и метод».',
        'success'
    );

    return true;
}

// =============================
// Названия полей для ошибок
// =============================

function getFieldName(field: string): string {

    const names: Record<string, string> = {
        area: 'Общая площадь',
        floors: 'Этажность',
        density: 'Плотность',
        insolation: 'Инсоляция'
    };

    return names[field] ?? field;
}

// =============================
// Кнопка перехода
// =============================

nextButton.addEventListener('click', () => {

    const isValid = validateVariants();

    if (!isValid) {
        return;
    }

    // Здесь позднее подключается переход
    // на следующий экран — «02 Критерии и метод».
});

// =============================
// Первоначальный запуск
// =============================

renderRows();
saveVariants();

