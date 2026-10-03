requireAdminAuth();
// ==================== МЕНЕДЖЕР ФОРМ ====================
let formConfig = {};
let currentId = null;
let isEdit = false;

// ==================== ВАЛИДАЦИЯ ФОРМ ====================
function clearValidationMessages() {
    document.querySelectorAll('.error').forEach(field => {
        field.classList.remove('error');
    });
    document.querySelectorAll('.warning').forEach(field => {
        field.classList.remove('warning');
    });
    showValidationSummary();
}

function showValidationWarnings(warnings) {
    if (warnings.length == 0) {
        return;
    }
    
    // Подсвечиваем поля мягким цветом
    warnings.forEach(warn => {
        const field = document.getElementById(warn.field);
        if (field) {
            field.classList.add('warning');
            //setTimeout(() => field.classList.remove('warning'), 3000);
        }
    });
    
    // Показываем сводку
    const messages = warnings.map(w => escapeHtml(w.message));
    const summary = messages.length === 1 ? messages[0] : `<strong>Пожалуйста обратите внимание:</strong><br>${messages.join('<br>')}`;
    showToast(summary, 'warning', 5000, false);
}

function showValidationErrors(errors) {
    if (errors.length == 0) {
        return;
    }
    
    // Подсвечиваем поля
    errors.forEach(error => {
        const field = document.getElementById(error.field);
        if (field) {
            field.classList.add('error');
        }
    });

    // Показываем сводку
    const messages = errors.map(e => escapeHtml(e.message));
    const summary = messages.length === 1 ? messages[0] : `<strong>Пожалуйста исправьте ошибки:</strong><br>${messages.join('<br>')}`;    
    //showToast(summary, 'error', 5000, false);
    showValidationSummary(summary);

    // Фокус на первое ошибочное поле
    const firstError = errors[0];
    if (firstError) {
        const field = document.getElementById(firstError.field);
        if (field)
            field.focus();
    }
}

function showValidationSummary(message = null) {
    const existing = document.querySelector('.validation-summary');
    if (existing)
        existing.remove();

    if(!message) return;

    const summary = document.createElement('div');
    summary.className = 'validation-summary';
    summary.innerHTML = message;
    const form = document.querySelector('form');
    form.insertBefore(summary, form.firstChild);
}

function validateForm() {
    clearValidationMessages();

    const errors = [];

    // Кастомная валидация из конфига
    if (formConfig.validate) {
        formConfig.validate(errors);
    }

    // Валидация обязательных полей (можно расширить)
    const requiredFields = formConfig.fields.filter(f => f.required);
    requiredFields.forEach(field => {
        const input = document.getElementById(field.name);
        if (input && !input.value.trim()) {
            const label = field.label || document.querySelector(`label[for="${field.name}"]`)?.textContent || field.name;
            errors.push({
                field: field.name,
                message: `Поле «${label}» обязательно для заполнения`
            });
        }
    });

    if (errors.length) {
        showValidationErrors(errors);
        return false;
    }

    return true;
}

async function initFormManager(config) {
    formConfig = config;
    
    // Инициализируем хранилище связанных данных
    formConfig.relatedData = {};
    if (formConfig.relatedLists) {
        Object.keys(formConfig.relatedLists).forEach(listKey => {
            formConfig.relatedData[listKey] = [];
        });
    }
    
    const params = new URLSearchParams(window.location.search);
    currentId = params.get('id');
    isEdit = !!currentId;

    // Устанавливаем заголовок
    document.getElementById('form-title').textContent = isEdit
        ? `${formConfig.objName} • Редактирование`
        : `${formConfig.objName} • Новый`;

    // Фокус на первое поле при создании
    if (!isEdit) {
        const firstField = document.getElementById(formConfig.fields[0]?.name);
        if (firstField) setTimeout(() => firstField.focus(), 100);
    }

    await loadFormData();
    bindFormEvents(); // теперь всегда привязываем обработчики
}

async function loadFormData() {
    // Загружаем справочные данные (жанры, оригинальные треки и т.д.)
    await loadReferenceData();

    // Если редактирование, загружаем данные сущности
    if (isEdit) {
        await loadEntityData();
    }
}

async function loadReferenceData() {
    const refConfig = formConfig.referenceData || {};

    // Жанры
    if (refConfig.genres) {
        const data = await adminApiRequest('/genres?order=name&direction=ASC');
        if (!data.error && data.data.length > 0) {
            const container = document.getElementById('genres-checkboxes');
            if (container) {
                container.innerHTML = data.data.map(g => `
                    <label><input type="checkbox" name="genres[]" value="${g.id}"> ${escapeHtml(g.name)}</label>
                `).join('');
            }
        } else {
            // Скрываем блок, если жанров нет
            const title = document.querySelector('h3:has(+ #genres-checkboxes)');
            if (title) title.style.display = 'none';
            const container = document.getElementById('genres-checkboxes');
            if (container) container.style.display = 'none';
        }
    }

    // Артисты
    if (refConfig.artists) {
        const data = await adminApiRequest('/artists?order=name&direction=ASC');
        if (!data.error) {
            const container = document.getElementById('artists-checkboxes');
            if (container) {
                container.innerHTML = data.data.map(a => `
                    <label><input type="checkbox" name="artists[]" value="${Number(a.id)}"> ${escapeHtml(a.name)} (${escapeHtml(a.voice_type || 'вокал')})</label>
                `).join('');
            }
        }
    }
    
    // Эмоции
    if (refConfig.emotions) {
        const data = await apiRequest('/emotions');
        if (!data.error) {
            formConfig.EMOTION_MAP = data;
        }
    }
    
}

async function loadNewData(data) {
    
    // Вызываем кастомный колбэк с данными
    if (formConfig.renderData) {
        formConfig.renderData(data);
    }

    // Заполняем обновленные поля
    for (const key of Object.keys(data)) {
        const input = document.getElementById(key);
        if (input) {
            if (input.type === 'checkbox') {
                input.checked = data[key] || false;
            } else {
                //input.value = escapeHtml(data[field.name]) || '';
                input.value = data[key] || '';
            }
        }
    }

    // Вызываем кастомный колбэк с данными
    //if (formConfig.onAfterLoad) {
    //    await formConfig.onAfterLoad(data);
    //}
    
}

async function loadEntityData() {
    const data = await adminApiRequest(`${formConfig.endpoint}?id=${currentId}`);
    if (data.error) {
        toastError(`${formConfig.objName} не найден`);
        setTimeout(() => window.location.href = formConfig.listUrl, 2000);
        return;
    }

    // Вызываем кастомный колбэк с данными
    if (formConfig.renderData) {
        formConfig.renderData(data);
    }

    // Заполняем основные поля
    for (const field of formConfig.fields) {
        const input = document.getElementById(field.name);
        if (input) {
            if (input.type === 'checkbox') {
                input.checked = data[field.name] || false;
            } else {
                //input.value = escapeHtml(data[field.name]) || '';
                input.value = data[field.name] || '';
            }
        }
    }

    // связанные таблицы
    if (formConfig.relatedLists) {
        for (const listKey of Object.keys(formConfig.relatedLists)) {
            const listConfig = formConfig.relatedLists[listKey];
            if (data[listConfig.dataKey]) {
                formConfig.relatedData[listKey] = data[listConfig.dataKey].map(item => ({
                    ...item,
                    track_number: parseInt(item.track_number)
                }));
                renderRelatedTable(listKey);
            }
        }
    }

    // Превью видео
    if (formConfig.hasVideo && data.cover_url) {
        await updateVideoPreview(data.cover_url);
    }

    // Превью обложки
    if (formConfig.hasCover && data.cover_url) {
        await updateCoverPreview(data.cover_url);
    }

    // Превью аудио
    if (formConfig.hasAudio && data.audio_url) {
        await updateAudioPreview(data.audio_url);
    }
    
    // Вызываем кастомный колбэк с данными
    if (formConfig.onAfterLoad) {
        await formConfig.onAfterLoad(data);
    }
}

function bindFormEvents() {
    // Сохранение
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveEntity);
    }

    // Загрузка видео
    if (formConfig.hasVideo) {
        const videoFile = document.getElementById('video-file');
        if (videoFile) {
            videoFile.addEventListener('change', uploadVideo);
        }
    }

    // Загрузка обложки
    if (formConfig.hasCover) {
        const coverFile = document.getElementById('cover-file');
        if (coverFile) {
            coverFile.addEventListener('change', uploadCover);
        }
    }
    
    if (formConfig.hasVideo && formConfig.hasCover) {
        const btnImage = document.getElementById('btn-media-image');
        const btnVideo = document.getElementById('btn-media-video');
        const coverCard = document.getElementById('image-upload-card');
        const videoCard = document.getElementById('video-upload-card');
        btnImage.addEventListener('click', function () {
            this.classList.add('active');
            btnVideo.classList.remove('active');
            coverCard.style.display = 'block';
            videoCard.style.display = 'none';
            document.getElementById('media-type').value = 'image'; // для отправки формы
        });
        btnVideo.addEventListener('click', function () {
            this.classList.add('active');
            btnImage.classList.remove('active');
            coverCard.style.display = 'none';
            videoCard.style.display = 'block';
            document.getElementById('media-type').value = 'video'; // для отправки формы
        });
    }

    // Загрузка аудио
    if (formConfig.hasAudio) {
        const audioFile = document.getElementById('audio-file');
        if (audioFile) {
            audioFile.addEventListener('change', uploadAudio);
        }
    }

    // Инициализация ajaxSearch для полей, где он задан
    formConfig.fields.forEach(field => {
        if (field.ajaxSearch) {
            initAjaxSearch(field);
        }
    });

    bindAutoSlug();
}

// Код заполняется из названия. У тега и артиста поле называется name, у альбома и трека — title.
function bindAutoSlug() {
    if (!formConfig.autoSlug) return;
    const slugInput = document.getElementById('slug');
    const source = document.getElementById('title') || document.getElementById('name');
    if (!slugInput || !source) return;

    let slugTouched = slugInput.value.trim() !== '';
    slugInput.addEventListener('input', () => {
        slugTouched = slugInput.value.trim() !== '';
    });
    const fill = () => {
        if (slugTouched) return;
        const text = source.value.trim();
        slugInput.value = text ? generateSlug(text) : '';
    };
    source.addEventListener('input', fill);
}

function fillSlugFromTitle(data) {
    if (!formConfig.autoSlug || data.slug) return;
    const source = data.title || data.name;
    if (!source) return;
    data.slug = generateSlug(source);
    const slugInput = document.getElementById('slug');
    if (slugInput) slugInput.value = data.slug;
}

async function saveEntity() {
    if (!validateForm()) return;

    setButtonLoading('save-btn', true);

    // Сбор данных
    const data = {};
    formConfig.fields.forEach(field => {
        // Пропускаем технологические поля ajax-поиска
        if (field.ajaxSearch) return;
        const input = document.getElementById(field.name);
        if (input && !input.readOnly) {
            data[field.name] = input.type === 'checkbox' ? input.checked : input.value.trim();
        }
    });

    fillSlugFromTitle(data);

    // связанные таблицы
    if (formConfig.relatedLists) {
        for (const listKey of Object.keys(formConfig.relatedLists)) {
            const listConfig = formConfig.relatedLists[listKey];
            data[listConfig.dataKey] = formConfig.relatedData[listKey].map(item => ({
                track_id: parseInt(item.id),
                track_number: parseInt(item[listConfig.numberField])
            }));
        }
    }   

    // Кастомная обработка перед сохранением
    if (formConfig.onBeforeSave) {
        formConfig.onBeforeSave(data);
    }

    const method = isEdit ? 'PUT' : 'POST';
    const url = isEdit ? `${formConfig.endpoint}?id=${currentId}` : formConfig.endpoint;
    const res = await adminApiRequest(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (res.error) {
        if (res.status == 422) {
            showValidationWarnings(res.warnings);
            showValidationErrors(res.errors);
        } else {
            toastError('Ошибка: ' + res.error);
        }
        setButtonLoading('save-btn', false);
        return;
    }
    if (res.warnings) {
        showValidationWarnings(res.warnings);
    }
    if (res.newData) {
        await loadNewData(res.newData);
    }

    const savedId = res.id || currentId;
    if (!isEdit) {
        currentId = savedId;
        //document.getElementById(`${formConfig.obj}-id`).value = savedId;
        history.replaceState(null, '', `?id=${savedId}`);
        isEdit = true;
        document.getElementById('form-title').textContent = `${formConfig.objName} • Редактирование`;
    }

    // Меняем кнопку «Отмена» на «В список»
    const cancelBtn = document.querySelector('a.btn-cancel');
    if (cancelBtn) cancelBtn.textContent = 'В список';

    setButtonLoading('save-btn', false);
    toastSuccess(`${formConfig.objName} сохранён`);
}

async function uploadVideo() {
    const input = document.getElementById('video-file');
    if (!input.files.length)
        return;
    if (!currentId) {
        toastWarning('Сначала сохраните запись');
        input.value = '';
        return;
    }

    const formData = new FormData();
    formData.append('file', input.files[0]);

    const data = await adminApiRequest(`/upload/${formConfig.obj}_video?id=${currentId}`, {
        method: 'POST',
        body: formData
    });
    input.value = '';

    if (data.error) {
        toastError('Ошибка загрузки: ' + data.error);
    } else {
        toastSuccess('Файл загружен');
        await updateVideoPreview(data.url);
    }
}

async function uploadCover() {
    const input = document.getElementById('cover-file');
    if (!input.files.length)
        return;
    if (!currentId) {
        toastWarning('Сначала сохраните запись');
        input.value = '';
        return;
    }

    const formData = new FormData();
    formData.append('file', input.files[0]);

    const data = await adminApiRequest(`/upload/${formConfig.obj}_cover?id=${currentId}`, {
        method: 'POST',
        body: formData
    });
    input.value = '';

    if (data.error) {
        toastError('Ошибка загрузки: ' + data.error);
    } else {
        toastSuccess('Файл загружен');
        await updateCoverPreview(data.url);
    }
}

async function uploadAudio() {
    const input = document.getElementById('audio-file');
    if (!input.files.length)
        return;
    if (!currentId) {
        toastWarning('Сначала сохраните запись');
        input.value = '';
        return;
    }

    const formData = new FormData();
    formData.append('file', input.files[0]);

    const data = await adminApiRequest(`/upload/audio?id=${currentId}`, {
        method: 'POST',
        body: formData
    });
    input.value = '';

    if (data.error) {
        toastError('Ошибка загрузки: ' + data.error);
    } else {
        toastSuccess('Файл загружен');
        if (data.duration) {
            document.getElementById('duration').value = data.duration;
        }
        await updateAudioPreview(data.url);
    }
}

async function updateVideoPreview(url) {
    const preview = document.getElementById('video-preview');
    if (!url) {
        preview.innerHTML = `<div class="placeholder-text">Нет видео</div>`;
        return;
    }
    // Заменяем имя файла на video.mp4, сохраняя путь
    const videoUrl = url.replace(/[^/]+$/, 'video.mp4');
    const exists = await checkFileExists(videoUrl);
    preview.innerHTML = exists
            ? `<video src="${videoUrl}?t=${Date.now()}" loop controls muted playsinline></video>`
            : `<div class="placeholder-text">Файл не найден</div>`;
}

async function updateCoverPreview(url) {
    const preview = document.getElementById('cover-preview');
    if (!url) {
        preview.innerHTML = `<div class="placeholder-text">Нет обложки</div>`;
        return;
    }
    const exists = await checkFileExists(url);
    preview.innerHTML = exists
            ? `<img src="${url}?t=${Date.now()}" alt="Обложка">`
            : `<div class="placeholder-text">Файл не найден</div>`;
}

async function updateAudioPreview(url) {
    const preview = document.getElementById('audio-preview');
    if (!url) {
        preview.innerHTML = `<div class="placeholder-text">Нет аудио</div>`;
        return;
    }
    const exists = await checkFileExists(url);
    preview.innerHTML = exists
            ? `<audio id="audio" controls src="${url}" style="width:100%;"></audio>`
            : `<div class="placeholder-text">Файл не найден</div>`;
}

// ==================== ЛОГИКА СВЯЗАННЫХ ТАБЛИЦ ====================
function renderRelatedTable(listKey) {
    const listConfig = formConfig.relatedLists[listKey];
    if (!listConfig) return;
    const data = formConfig.relatedData[listKey] || [];
    const tbody = document.getElementById(listConfig.tbodyId);
    if (!tbody) return;

    const tnField = listConfig.numberField;
    data.sort((a, b) => a[tnField] - b[tnField])
        .forEach((item, idx) => item[tnField] = idx + 1);

    if (!data.length) {
        tbody.innerHTML = `<tr><td colspan="${listConfig.columns.length}">Нет данных</td></tr>`;
        if (listConfig.render) {
            listConfig.render(data);
        }
        return;
    }

    const sorted = [...data].sort((a, b) => a[tnField] - b[tnField]);
    tbody.innerHTML = sorted.map(item => {
        return `<tr>${listConfig.columns.map(col => {
            if (col.actions) {
                let btns = '';
                if (col.actions.includes('moveUp')) btns += `<button class="btn-icon move-up-btn" data-list="${listKey}" data-id="${item.id}">⬆️</button>`;
                if (col.actions.includes('moveDown')) btns += `<button class="btn-icon move-down-btn" data-list="${listKey}" data-id="${item.id}">⬇️</button>`;
                if (col.actions.includes('remove')) btns += `<button class="btn-icon remove-btn" data-list="${listKey}" data-id="${item.id}">✕</button>`;
                return `<td>${btns}</td>`;
            }
            let value = item[col.key] || '';
            if (col.format === 'duration') value = formatDuration(value);
            if (col.link) {
                value = `<a href="${col.link}${item.id}">${escapeHtml(value)}</a>`;
            } else {
                value = escapeHtml(value);
            }
            return `<td>${value}</td>`;
        }).join('')}</tr>`;
    }).join('');

    tbody.querySelectorAll('.move-up-btn').forEach(btn => {
        btn.addEventListener('click', () => moveRelatedItem(btn.dataset.list, btn.dataset.id, 'up'));
    });
    tbody.querySelectorAll('.move-down-btn').forEach(btn => {
        btn.addEventListener('click', () => moveRelatedItem(btn.dataset.list, btn.dataset.id, 'down'));
    });
    tbody.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => removeRelatedItem(btn.dataset.list, btn.dataset.id));
    });

    if (listConfig.render) {
        listConfig.render(data);
    }
}

function removeRelatedItem(listKey, id) {
    const listConfig = formConfig.relatedLists[listKey];
    if (!listConfig) return;
    const data = formConfig.relatedData[listKey];
    formConfig.relatedData[listKey] = data.filter(item => item.id != id);
    renderRelatedTable(listKey);
}

function moveRelatedItem(listKey, id, direction) {
    const listConfig = formConfig.relatedLists[listKey];
    if (!listConfig) return;
    const data = formConfig.relatedData[listKey];
    const tnField = listConfig.numberField;
    const index = data.findIndex(item => item.id == id);
    if (index === -1) return;

    const sorted = [...data].sort((a, b) => a[tnField] - b[tnField]);
    const currentPos = sorted.findIndex(item => item.id == id);
    const swapPos = direction === 'up' ? currentPos - 1 : currentPos + 1;
    if (swapPos < 0 || swapPos >= sorted.length) return;

    const temp = sorted[currentPos][tnField];
    sorted[currentPos][tnField] = sorted[swapPos][tnField];
    sorted[swapPos][tnField] = temp;

    sorted.forEach(item => {
        const orig = data.find(i => i.id == item.id);
        if (orig) orig[tnField] = item[tnField];
    });
    renderRelatedTable(listKey);
}

// ==================== ДИНАМИЧЕСКИЙ ПОИСК ====================
function initAjaxSearch(fieldConfig) {
    const input = document.getElementById(fieldConfig.name);
    const hiddenInputId = fieldConfig.ajaxSearch.hiddenInputId || `${fieldConfig.name}_id`;
    const hiddenInput = document.getElementById(hiddenInputId);
    const datalistId = `${fieldConfig.name}-datalist`;
    const addBtn = fieldConfig.ajaxSearch.addBtn && document.getElementById(fieldConfig.ajaxSearch.addBtn);
    
    let datalist = document.getElementById(datalistId);
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = datalistId;
        input.setAttribute('list', datalist.id);
        input.parentNode.appendChild(datalist);
    }

    let searchTimeout;
    // Флаг, показывающий, что опции загружены и именно для текущего ввода
    let optionsLoaded = false;

    input.addEventListener('input', function () {
        clearTimeout(searchTimeout);
        const query = this.value.trim();
        datalist.innerHTML = '';
        optionsLoaded = false;  // сбрасываем флаг, потому что опции будут перезагружаться

        if (query.length < 2) {
            if (hiddenInput) hiddenInput.value = '';
            return;
        }

        searchTimeout = setTimeout(async () => {
            optionsLoaded = await searchAjax(query, fieldConfig, datalist);
            // после загрузки опций проверяем, вдруг значение уже выставлено (если пользователь кликнул)
            checkSelection();
        }, 300);
    });

    // Проверка выбора: вызывается после загрузки опций или сразу при вводе, если опции ещё не грузились
    function checkSelection() {
        if (!optionsLoaded) return; // опции ещё не подгружены, ничего не делаем

        const value = input.value;
        const option = Array.from(datalist.options).find(opt => opt.value === value);
        if (option) {
            hiddenInput.value = option.dataset.id;
            // Активируем кнопку «Добавить», если указано
            if (addBtn) addBtn.disabled = false;
        } else {
            hiddenInput.value = '';
            if (addBtn) addBtn.disabled = true;
        }
    }

    // При любом вводе после загрузки опций тоже проверяем
    input.addEventListener('input', function () {
        if (optionsLoaded) {
            checkSelection();
        } else {
            if (addBtn) addBtn.disabled = true;
        }
    });

    // Если пользователь очистил поле вручную
    input.addEventListener('blur', function () {
        if (!this.value) {
            hiddenInput.value = '';
            if (addBtn) addBtn.disabled = true;
        }
    });
}

// Функция поиска теперь возвращает true, если были добавлены опции
async function searchAjax(query, fieldConfig, datalist) {
    const params = new URLSearchParams({
        search: query,
        order: 'title',
        direction: 'ASC',
        fields: fieldConfig.ajaxSearch.fields || 'id,title',
        limit: 20
    });

    if (fieldConfig.ajaxSearch.excludeSelf && currentId) {
        params.append('exclude_ids', currentId);
    }

    const data = await adminApiRequest(`${fieldConfig.ajaxSearch.endpoint}?${params}`);
    if (data.error || !data.data?.length) {
        datalist.innerHTML = '<option value="" disabled>Ничего не найдено</option>';
        return true;
    }

    const displayField = fieldConfig.ajaxSearch.displayField || 'title';
    datalist.innerHTML = data.data.map(item => {
        // Собираем все возможные дополнительные поля
        const extras = Object.entries(item)
            .filter(([key]) => !['id', displayField].includes(key))
            .map(([key, val]) => `data-${key}="${escapeHtml(String(val))}"`)
            .join(' ');
        return `<option value="${escapeHtml(item[displayField])}" data-id="${Number(item.id)}" ${extras}>${escapeHtml(item[displayField])}</option>`;
    }).join('');
    return true;
}
