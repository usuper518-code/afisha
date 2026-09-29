requireAdminAuth();
// ==================== МЕНЕДЖЕР СПИСКОВ ====================
let listState = {
    currentPage: 1,
    currentOrder: 'id',
    currentDirection: 'DESC',
    currentSearch: '',
    limit: 15
};

let currentFilters = {};
let listConfig = {};
let tbody, totalInfo, paginationDiv, tableHead;

async function initListManager(config) {
    listConfig = config;
    listConfig.limit = config.limit || 10;

    paginationDiv = document.getElementById('pagination');
    totalInfo = document.getElementById('total-info');
    if (!paginationDiv || !totalInfo) {
        console.error('Не найдены необходимые DOM элементы');
        return;
    }

    await loadReferenceData();

    if (!config.customRender) {
        // Получаем DOM элементы
        tbody = document.getElementById('data-table');
        tableHead = document.querySelector('#data-table').closest('table').querySelector('thead tr');

        if (!tbody || !tableHead) {
            console.error('Не найдены необходимые DOM элементы');
            return;
        }

        // Генерируем шапку таблицы
        renderTableHead();

        // Загружаем данные
        updateSortIndicators();
    }
    
    // Привязываем обработчики
    bindEvents();
    
    loadData();
}

async function loadReferenceData() {
    const refConfig = listConfig.referenceData || {};

    // Эмоции
    if (refConfig.emotions) {
        const data = await apiRequest('/emotions');
        if (!data.error) {
            listConfig.EMOTION_MAP = data;
        }
    }
}

function renderTableHead() {
    const columns = listConfig.columns || [];
    let html = '';

    for (const col of columns) {
        const sortable = col.sortable !== false;
        const field = col.field;
        const label = col.label || field;
        const width = col.width || 'auto';

        if (sortable) {
            html += `<th class="sortable" style="width: ${width};" data-field="${field}">${label}<span class="sort-indicator"></span></th>`;
        } else {
            html += `<th style="width: ${width};">${label}</th>`;
        }
    }

    // Добавляем колонку действий
    html += `<th style="width: ${listConfig.actionWidth};">Действия</th>`;

    tableHead.innerHTML = html;
}

function bindEvents() {
    
    if (tableHead) {
        // Сортировка по клику на заголовок (делегирование)
        tableHead.addEventListener('click', (e) => {
            const th = e.target.closest('.sortable');
            if (!th)
                return;

            const field = th.dataset.field;
            if (listState.currentOrder === field) {
                listState.currentDirection = listState.currentDirection === 'ASC' ? 'DESC' : 'ASC';
            } else {
                listState.currentOrder = field;
                listState.currentDirection = 'ASC';
            }
            listState.currentPage = 1;
            updateSortIndicators();
            loadData();
        });
    }
    
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const resetSearchBtn = document.getElementById('reset-search-btn');
    const applyBtn = document.getElementById('apply-filters-btn');
    const resetBtn = document.getElementById('reset-filters-btn');
    
    // Поиск
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            listState.currentSearch = searchInput.value.trim();
            listState.currentPage = 1;
            loadData();
        });
    }
    
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                listState.currentSearch = searchInput.value.trim();
                listState.currentPage = 1;
                loadData();
            }
        });
    }

    if (resetSearchBtn) {
        resetSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            listState.currentSearch = '';
            listState.currentPage = 1;
            loadData();
        });
    }

    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            if (searchInput) {
                listState.currentSearch = searchInput.value.trim();
            }
            // Собираем значения из всех фильтров
            currentFilters = {};
            listConfig.filters.forEach(filter => {
                const element = document.querySelector(filter.selector);
                if (element) {
                    currentFilters[filter.param] = element.value;
                }
            });
            listState.currentPage = 1;
            loadData();
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                listState.currentSearch = '';
            }
            listConfig.filters.forEach(filter => {
                const element = document.querySelector(filter.selector);
                if (element) {
                    element.value = '';
                }
            });
            currentFilters = {};
            listState.currentPage = 1;
            loadData();
        });
    }    
}

async function loadData() {
    const params = new URLSearchParams({
        limit: listConfig.limit,
        offset: (listState.currentPage - 1) * listConfig.limit,
        order: listState.currentOrder,
        direction: listState.currentDirection,
        fields: listConfig.fields || 'id'
    });

    if (listState.currentSearch) {
        params.append('search', listState.currentSearch);
    }

    // Добавляем фильтры
    Object.entries(currentFilters).forEach(([key, value]) => {
        if (value) {
            params.append(key, value);
        }
    });

    const data = await adminApiRequest(`${listConfig.endpoint}?${params}`);
    if (data.error) {
        toastError(`Ошибка получения данных: ${data.error}`);
        return;
    }

    if (listConfig.customRender) {
        listConfig.customRender(data.data);
    } else {
        renderTable(data.data);
    }
    
    renderPagination(data.total);
    
    if (totalInfo) {
        if (data.total) {
            totalInfo.textContent = `Всего: ${data.total}`;
        } else {
            totalInfo.textContent = '';
        }
    }
}

function renderTable(data) {
    if (!data.length) {
        tbody.innerHTML = `<tr><td colspan="100">${listConfig.objNamePlural || 'Записи'} не найдены</td></tr>`;
        return;
    }

    const columns = listConfig.columns || [];

    tbody.innerHTML = data.map(item => {
        let row = '<tr>';

        for (const col of columns) {
            const value = item[col.field];
            let displayValue = value;

            // Форматирование
            if (typeof col.format === 'function') {
                displayValue = col.format(value, item);
            } else if (col.format === 'date') {
                displayValue = formatDate(value);
            } else if (col.format === 'duration') {
                displayValue = formatDuration(value);
            } else if (col.format === 'boolean') {
                displayValue = value ? 'Да' : 'Нет';
            } else {
                displayValue = escapeHtml(value ?? '');
            }

            // Ссылка на редактирование
            if (col.link) {
                displayValue = `<a href="/admin/${listConfig.obj}-form.html?id=${item.id}">${displayValue}</a>`;
            }

            row += `<td>${displayValue}</td>`;
        }

        // Кнопка удаления
        const titleField = listConfig.titleField || 'title';
        row += `<td>
            <button class="btn-icon delete-btn" data-id="${item.id}" data-title="${escapeHtml(item[titleField] || '')}" title="Удалить">✕</button>
        </td>`;

        row += '</tr>';
        return row;
    }).join('');

    setDeleteListener();
}

function setDeleteListener() {
    tbody.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const id = btn.dataset.id;
            const title = btn.dataset.title;

            showConfirm(
                    `Удалить ${listConfig.objName || 'запись'} «${title}»?`,
                    async () => {  // <-- колбэк должен быть async
                const result = await adminApiRequest(`${listConfig.endpoint}?id=${id}`, {method: 'DELETE'});
                if (result.error) {
                    toastError(`Ошибка удаления: ${result.error}`);
                    return;
                }
                loadData();
                toastSuccess('Запись удалена');
            }
            );
        });
    });
}

function renderPagination(total) {
    const totalPages = Math.ceil(total / listConfig.limit);
    if (totalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }

    let html = '';

    if (listState.currentPage > 1) {
        html += `<a href="#" data-page="1">«</a>`;
        html += `<a href="#" data-page="${listState.currentPage - 1}">‹</a>`;
    }

    for (let i = Math.max(1, listState.currentPage - 2); i <= Math.min(totalPages, listState.currentPage + 2); i++) {
        if (i === listState.currentPage) {
            html += `<span class="current">${i}</span>`;
        } else {
            html += `<a href="#" data-page="${i}">${i}</a>`;
        }
    }

    if (listState.currentPage < totalPages) {
        html += `<a href="#" data-page="${listState.currentPage + 1}">›</a>`;
        html += `<a href="#" data-page="${totalPages}">»</a>`;
    }

    paginationDiv.innerHTML = html;

    paginationDiv.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            listState.currentPage = parseInt(link.dataset.page);
            loadData();
        });
    });
}

function updateSortIndicators() {
    tableHead.querySelectorAll('.sortable').forEach(th => {
        const field = th.dataset.field;
        const indicator = th.querySelector('.sort-indicator');
        if (indicator) {
            indicator.textContent = (field === listState.currentOrder)
                    ? (listState.currentDirection === 'ASC' ? ' ▲' : ' ▼')
                    : '';
        }
    });
}
