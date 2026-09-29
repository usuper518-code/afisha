// ==================== КОНФИГУРАЦИЯ ====================
const API_BASE = '/api';

// ==================== API ЗАПРОСЫ ====================
async function apiRequest(endpoint, options = {}) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, options);
        if (!res.ok) {
            let error = `HTTP ${res.status}`;
            let errors = [];
            let warnings = [];
            try {
                const err = await res.json();
                if (err.errors && Array.isArray(err.errors)) {
                    errors = err.errors;
                }
                if (err.warnings && Array.isArray(err.warnings)) {
                    warnings = err.warnings;
                }
                if (err.error) {
                    error = err.error;
                }
            } catch (e) {
                // Не удалось распарсить JSON — оставляем HTTP-статус
                error = `HTTP ${res.status} (невалидный JSON)`;
            }
            console.error(`API Error ${res.status}:`, error, errors, warnings);
            return {error, errors, warnings, status: res.status};
        }
        return await res.json();
    } catch (e) {
        console.error('Ошибка сети:', e);
        return {error: 'Ошибка сети', status: 0};
}
}

// ==================== УТИЛИТЫ ====================
function escapeHtml(text) {
    if (!text)
        return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(value) {
    return new Date(value).toLocaleString();
}

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds))
        return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Проверка, существует ли файл по URL (HEAD-запрос)
async function checkFileExists(url) {
    try {
        const res = await fetch(url, {method: 'HEAD'});
        return res.ok;
    } catch {
        return false;
    }
}

// ==================== TOAST УВЕДОМЛЕНИЯ ====================
function showToast(message, type = 'info', duration = 5000, escape = true) {
    // Создаём контейнер, если его нет
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    if (escape) {
        message = escapeHtml(message);
    }
    toast.innerHTML = `
        <div class="toast-content">${message}</div>
        <button class="toast-close" aria-label="Закрыть">✕</button>
    `;

    container.appendChild(toast);

    // Закрытие по кнопке
    toast.querySelector('.toast-close').addEventListener('click', () => {
        removeToast(toast);
    });

    // Автоматическое закрытие
    if (duration > 0) {
        setTimeout(() => removeToast(toast), duration);
    }

    return toast;
}

function removeToast(toast) {
    toast.style.animation = 'slideOut 0.2s ease';
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
        // Удаляем контейнер, если пуст
        const container = document.querySelector('.toast-container');
        if (container && !container.children.length) {
            container.remove();
        }
    }, 200);
}

// Вспомогательные функции
function toastSuccess(message) {
    return showToast(message, 'success');
}

function toastError(message) {
    return showToast(message, 'error');
}

function toastWarning(message) {
    return showToast(message, 'warning');
}

function toastInfo(message) {
    return showToast(message, 'info');
}

// Диалог подтверждения (замена confirm)
function showConfirm(message, onConfirm, onCancel) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
        <div class="confirm-dialog">
            <div class="confirm-message">${escapeHtml(message)}</div>
            <div class="confirm-actions">
                <button class="btn btn-cancel" data-action="cancel">Отмена</button>
                <button class="btn" data-action="confirm">OK</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            close();
        }
    });

    overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
    overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => {
        close();
        if (onConfirm)
            onConfirm();
    });

    function close() {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 200);
        if (onCancel)
            onCancel();
    }

    // Анимация появления
    requestAnimationFrame(() => overlay.style.opacity = '1');
}
