function initAfishaPage() {
    safeYm('reachGoal', 'afisha_view');

    const container = document.getElementById('news-container');
    fetch('/api/news')
        .then(res => res.json())
        .then(data => {
            if (data.data && data.data.length) {
                container.innerHTML = data.data.map(n =>
                `<div class="announce-item">
                    <span class="announce-date">${formatDate(n.created_at)}</span>
                    <span class="announce-text">${escapeHtml(n.content)}</span>
                    <i class="fas fa-quote-right"></i>
                </div>`).join('');
            }
        }).catch(() => {});

    initProgramNav();
}

// ============================================
// ПРОГРАММКА: вкладки-разделы + развороты по 2
// (адаптивно — по 1 в портретной ориентации)
// ============================================
function initProgramNav() {
    const nav = document.querySelector('.program-nav');
    const viewport = document.querySelector('.program-viewport');
    if (!nav || !viewport) return;

    const tabs = Array.from(nav.querySelectorAll('.program-tab'));
    const panels = Array.from(viewport.querySelectorAll('.program-panel'));

    // Если переключать нечего (панель навигации пуста — см. generate_afisha(),
    // при 2 и менее разделах кнопки не выводятся), это гарантированно
    // означает, что нет и paged-панелей («Скоро»/«Архив» отсутствуют —
    // именно они увеличивают число вкладок сверх 2). Ничего не трогаем:
    // единственная панель уже отмечена как .active на сервере.
    if (tabs.length === 0) {
        return;
    }

    const prevBtn = viewport.querySelector('.spread-prev');
    const nextBtn = viewport.querySelector('.spread-next');
    const dotsEl = viewport.querySelector('.spread-dots');
    const pagingState = new Map(); // panelId -> { spreads: HTMLElement[], index }
    const portraitQuery = window.matchMedia('(orientation: portrait)');

    function groupSize() {
        return portraitQuery.matches ? 1 : 2;
    }

    function buildSpreads(panel) {
        const cards = Array.from(panel.querySelectorAll(':scope > .poster-card'));
        panel.querySelectorAll(':scope > .spread').forEach(s => {
            // возвращаем карточки обратно в панель перед пересборкой,
            // чтобы не потерять их при смене ориентации
            while (s.firstChild) panel.appendChild(s.firstChild);
            s.remove();
        });
        if (!cards.length) return [];
        const size = groupSize();
        const spreads = [];
        for (let i = 0; i < cards.length; i += size) {
            const spread = document.createElement('div');
            spread.className = 'spread';
            cards.slice(i, i + size).forEach(c => spread.appendChild(c));
            panel.appendChild(spread);
            spreads.push(spread);
        }
        return spreads;
    }

    function renderDots(spreads, index) {
        if (!dotsEl) return;
        if (spreads.length <= 1) {
            dotsEl.hidden = true;
            dotsEl.innerHTML = '';
            return;
        }
        dotsEl.hidden = false;
        dotsEl.innerHTML = spreads.map((_, i) =>
            `<span class="spread-dot${i === index ? ' active' : ''}" data-index="${i}"></span>`
        ).join('');
    }

    function updateNavButtons(spreads, index) {
        if (!prevBtn || !nextBtn) return;
        const multi = spreads.length > 1;
        prevBtn.hidden = !multi;
        nextBtn.hidden = !multi;
        if (multi) {
            prevBtn.disabled = index === 0;
            nextBtn.disabled = index === spreads.length - 1;
        }
    }

    function stopAnyPlayingVideo() {
        document.querySelectorAll('.poster-media.video-active').forEach(media => {
            const video = media.querySelector('video');
            if (video) video.pause();
            media.classList.remove('video-active');
        });
        document.querySelectorAll('.media-video-toggle').forEach(btn => {
            btn.innerHTML = '<i class="fas fa-play"></i>';
            btn.setAttribute('aria-label', 'Смотреть видео');
            btn.classList.remove('loading');
            btn.disabled = false;
        });
    }

    function showSpread(panelId, index, direction) {
        const state = pagingState.get(panelId);
        if (!state) return;
        const { spreads } = state;
        if (index < 0 || index >= spreads.length || index === state.index) return;
        stopAnyPlayingVideo();
        const prevIndex = state.index;
        spreads.forEach((s, i) => {
            s.classList.remove('active', 'leaving-to-prev', 'leaving-to-next');
            if (i === index) {
                s.classList.add('active');
            } else if (i === prevIndex) {
                s.classList.add(direction === 'next' ? 'leaving-to-next' : 'leaving-to-prev');
            }
        });
        state.index = index;
        renderDots(spreads, index);
        updateNavButtons(spreads, index);
    }

    function initPanelPaging(panel) {
        const spreads = buildSpreads(panel);
        pagingState.set(panel.id, { spreads, index: 0 });
        if (spreads.length) spreads[0].classList.add('active');
    }

    function currentPagedPanel() {
        return panels.find(p => p.classList.contains('active') && p.dataset.paged);
    }

    function activatePanel(id) {
        tabs.forEach(t => t.classList.toggle('active', t.dataset.panel === id));
        panels.forEach(p => p.classList.toggle('active', p.id === 'panel-' + id));
        stopAnyPlayingVideo();
        const panel = currentPagedPanel();
        if (panel) {
            const state = pagingState.get(panel.id);
            if (state) {
                renderDots(state.spreads, state.index);
                updateNavButtons(state.spreads, state.index);
            }
        } else {
            if (prevBtn) prevBtn.hidden = true;
            if (nextBtn) nextBtn.hidden = true;
            if (dotsEl) { dotsEl.hidden = true; dotsEl.innerHTML = ''; }
        }
        if (history.replaceState) history.replaceState(null, '', '#' + id);
        safeYm('reachGoal', 'afisha_tab_' + id);
    }

    // Разбиваем на развороты все панели со списками
    panels.forEach(p => { if (p.dataset.paged) initPanelPaging(p); });

    tabs.forEach(tab => {
        tab.addEventListener('click', () => activatePanel(tab.dataset.panel));
    });

    if (prevBtn) prevBtn.addEventListener('click', () => {
        const panel = currentPagedPanel();
        const state = panel && pagingState.get(panel.id);
        if (state) showSpread(panel.id, state.index - 1, 'prev');
    });
    if (nextBtn) nextBtn.addEventListener('click', () => {
        const panel = currentPagedPanel();
        const state = panel && pagingState.get(panel.id);
        if (state) showSpread(panel.id, state.index + 1, 'next');
    });
    if (dotsEl) dotsEl.addEventListener('click', (e) => {
        const dot = e.target.closest('.spread-dot');
        if (!dot) return;
        const panel = currentPagedPanel();
        const state = panel && pagingState.get(panel.id);
        if (!state) return;
        const idx = parseInt(dot.dataset.index, 10);
        showSpread(panel.id, idx, idx > state.index ? 'next' : 'prev');
    });

    // Свайп по горизонтали переключает разворот
    let touchStartX = 0;
    let touchStartY = 0;
    viewport.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });
    viewport.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
        const panel = currentPagedPanel();
        const state = panel && pagingState.get(panel.id);
        if (!state) return;
        if (dx < 0) showSpread(panel.id, state.index + 1, 'next');
        else showSpread(panel.id, state.index - 1, 'prev');
    }, { passive: true });

    // При смене ориентации (портрет ⇄ альбом) — пересобрать развороты
    // с новым размером группы (1 или 2), не потеряв активную вкладку
    let currentGroupSize = groupSize();
    portraitQuery.addEventListener('change', () => {
        const newSize = groupSize();
        if (newSize === currentGroupSize) return;
        currentGroupSize = newSize;
        panels.forEach(p => { if (p.dataset.paged) initPanelPaging(p); });
        const activeTab = tabs.find(t => t.classList.contains('active'));
        if (activeTab) activatePanel(activeTab.dataset.panel);
    });

    // Открытие нужной вкладки по якорю в адресной строке
    const validIds = tabs.map(t => t.dataset.panel);
    const initialId = (window.location.hash || '').replace('#', '');
    activatePanel(validIds.includes(initialId) ? initialId : validIds[0]);
}


function initAboutPage() {
    safeYm('reachGoal', 'about_view');
}

const path = window.location.pathname;
const isAfishaPage = path === '/' || /\/index\.html$/.test(path);
const isAboutPage = /about\.html/.test(path);

if (isAfishaPage) {
    initAfishaPage();
}
if (isAboutPage) {
    initAboutPage();
}
