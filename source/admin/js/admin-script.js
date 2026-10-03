// ==================== АУТЕНТИФИКАЦИЯ ====================
function getAdminKey() {
    return sessionStorage.getItem('admin_api_key');
}
function setAdminKey(key) {
    sessionStorage.setItem('admin_api_key', key);
}
function logout() {
    sessionStorage.removeItem('admin_api_key');
    window.location.href = '/admin/login.html';
}
function requireAdminAuth() {
    if (!getAdminKey()) {
        if (window.location.href != '/admin/login.html') {
            window.location.href = '/admin/login.html';
        }
        return false;
    }
    return true;
}

// ==================== УТИЛИТЫ ====================
function generateSlug(text) {
    const ruMap = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z',
        'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r',
        'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };
    let slug = text.toLowerCase().trim();
    slug = slug.split('').map(char => ruMap[char] || char).join('');
    slug = slug.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || 'untitled';
}

async function adminApiRequest(endpoint, options = {}) {
    const key = getAdminKey();
    if (!key) {
        window.location.href = '/admin/login.html';
        throw new Error('Not authenticated');
    }
    options.headers = options.headers || {};
    options.headers['X-API-Key'] = key;
    return await apiRequest('/admin' + endpoint, options);
}

// ==================== БЛОКИРОВКА КНОПОК ====================
function setButtonsLoading(loading, ...buttonIds) {
    const ids = buttonIds.length ? buttonIds : ['save-btn', 'add-track-btn'];
    ids.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            if (loading) {
                btn.classList.add('loading');
                btn.disabled = true;
                if (id === 'save-btn') {
                    btn.setAttribute('data-original-text', btn.textContent);
                    btn.textContent = 'Сохранение...';
                }
            } else {
                btn.classList.remove('loading');
                btn.disabled = false;
                if (id === 'save-btn' && btn.hasAttribute('data-original-text')) {
                    btn.textContent = btn.getAttribute('data-original-text');
                }
            }
        }
    });
}

function setButtonLoading(buttonId, loading, text=null) {
    const btn = document.getElementById(buttonId);
    if (!btn)
        return;

    if (loading) {
        btn.classList.add('loading');
        btn.disabled = true;
        btn.setAttribute('data-original-text', btn.textContent);
        if (text) {
            btn.textContent = text;
        }
    } else {
        btn.classList.remove('loading');
        btn.disabled = false;
        if (btn.hasAttribute('data-original-text')) {
            btn.textContent = btn.getAttribute('data-original-text');
        }
        btn.style.paddingLeft = ''; // сброс
    }
}

function renderAdminNav() {
    const navItems = [
        {href: '/admin/settings.html', label: 'Афиша'},
        {href: '/admin/news.html', label: 'Новости'},
        {href: '/admin/releases.html', label: 'Релизы'},
        {href: '/admin/tracks.html', label: 'Треки'},
        {href: '/admin/genres.html', label: 'Теги'},
        {href: '/admin/artists.html', label: 'Артисты'},
        {href: '/admin/users.html', label: 'Пользователи'},
        {href: '/admin/reviews.html', label: 'Отзывы'},
        {href: '/admin/ratings.html', label: 'Оценки'},
        {href: '/admin/reactions.html', label: 'Реакции'},
        {href: '/admin/events.html', label: 'События'}
    ];

    const nav = document.querySelector('nav');
    if (!nav)
        return;

    nav.innerHTML = navItems.map(item =>
            `<a href="${item.href}">${item.label}</a>`
    ).join('') + `<a href="#" id="logout-btn">Выход</a>`;

    document.getElementById('logout-btn').addEventListener('click', e => {
        e.preventDefault();
        logout();
    });
}
renderAdminNav();
