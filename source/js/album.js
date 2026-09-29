//album.js

function initIndexPage() {
    safeYm('reachGoal', 'album_view', { album: window.ALBUM_SLUG });
    
    // Фоновый шум зала — по умолчанию выключен (state=0), включается
    // только явным действием пользователя через регулятор громкости.
    const noise = document.getElementById('hall-noise');
    noise.volume = 0;
    noise.loop = true;
    noise.addEventListener('play', () => {
        initVolumeControl(noise, 'noise', 0);
    });
    if (noise.readyState >= 1) {
        startSound();
    } else {
        noise.addEventListener('loadedmetadata', startSound, { once: true });
    }
    function startSound() {
        // Пытаемся запустить — если браузер блокирует, запустим при первом клике
        noise.play().catch(() => {
            document.addEventListener('click', () => {
                noise.play().catch(() => {
                });
            }, {once: true});
        });
    }
    
    const now = new Date();
    const premiere = new Date(window.PREMIERE_DATE + 'T00:00:00');
    const btn = document.getElementById('action-button');
    const remindModal = document.getElementById('remind-modal');
    const reviewsСontainer = document.getElementById('reviews-container');
    
    // Если дата премьеры в будущем
    if (premiere > now) {
        // Меняем кнопку
        btn.innerHTML = '<i class="fas fa-bell swing-on-hover"></i> НАПОМНИТЬ О ПРЕМЬЕРЕ';
        btn.classList.add('remind-btn');
        btn.removeAttribute('href');
        
        // Меняем бейдж
        const badgeContainer = document.getElementById('badge-container');
        const dateStr = formatDate(premiere);
        badgeContainer.classList.add('premiere-badge');
        badgeContainer.textContent = dateStr;
    
        //показ окна подписки
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            let savedName = sessionStorage.getItem('twit_name') || '';
            let savedEmail = sessionStorage.getItem('twit_email') || '';

            if (!savedName || !savedEmail) {
                const userData = await apiRequest('get-user-profile', {}, null, { method: 'GET' });
                if (userData && userData.success) {
                    if (userData.name) savedName = userData.name;
                    if (userData.email) savedEmail = userData.email;
                }
            }
            document.getElementById('remind-name').value = savedName;
            document.getElementById('remind-email').value = savedEmail;
            remindModal.style.display = 'flex';        
        });
    
        // закрытие окна подписки
        function closeRemindModal() {
            remindModal.style.display = 'none';
        }
        remindModal.querySelector('.modal-close').addEventListener('click', closeRemindModal);
        // Клик по затемнённому фону (не по самому окну) — тоже закрывает
        remindModal.addEventListener('click', (e) => {
            if (e.target === remindModal) closeRemindModal();
        });
        // Escape — стандартный способ закрыть модалку с клавиатуры
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && remindModal.style.display === 'flex') closeRemindModal();
        });
        
        // Отправка формы подписки
        document.getElementById('remind-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const name = document.getElementById('remind-name').value.trim();
            const email = document.getElementById('remind-email').value.trim();
            const subscribe = document.getElementById('remind-subscribe').checked;

            // Простая валидация
            if (!name) {
                toastWarning('Пожалуйста, укажите ваше имя');
                return;
            }
            if (!email) {
                toastWarning('Пожалуйста, укажите ваш email');
                return;
            }
            sessionStorage.setItem('twit_email', email);
            sessionStorage.setItem('twit_name', name);
        
            safeYm('reachGoal', subscribe ? 'subscription_on' : 'subscription_off');

            const res = await apiRequest('remind', {
                email,
                name,
                subscribe,
                release_id: window.ALBUM_ID
            }, btn);
            if (res.success) {
                toastSuccess(subscribe
                    ? 'Напомним о премьере и будем сообщать о следующих.'
                    : 'Напомним об этой премьере.');
                remindModal.style.display = 'none';
            } else {
                toastError('Ошибка. Попробуйте позже.');
            }
        });        
    }  
    
    fetch(`/api/reviews?release_id=${window.ALBUM_ID}&limit=3`)
        .then(res => res.json())
        .then(data => {
            if (data.data && data.data.length) {
                let html = '<section class="reviews"><h3><i class="fas fa-comment-dots"></i> Голоса из зала</h3>';
                data.data.forEach(r => {
                    html += `<div class="review-item">
                                <p class="review-text">«${escapeHtml(r.content)}»</p>
                                <p class="review-author">— ${escapeHtml(r.nickname || 'Аноним')}</p>
                            </div>`;
                });
                html += '</section>';
                reviewsСontainer.innerHTML = html;
            }
        }).catch(() => {});    
}

function initFinalePage() {
    safeYm('reachGoal', 'finale_view', { album: window.ALBUM_SLUG });
    
    const applauseKey = `applause_${window.ALBUM_ID}`;
    const savedRating = localStorage.getItem(applauseKey);
    const allRatingElements = document.querySelectorAll('[data-rating]');

    if (savedRating) {
        document.querySelectorAll('[data-rating]').forEach(el => {
            if (parseInt(el.dataset.rating) <= parseInt(savedRating)) {
                el.classList.add('active');
            }
        });
    }

    allRatingElements.forEach(el => {
        el.addEventListener('click', async () => {
            const rating = parseInt(el.dataset.rating);
            localStorage.setItem(applauseKey, rating);
            safeYm('reachGoal', 'album_rated', { album: window.ALBUM_SLUG, rating: rating });

            // Подсвечиваем все элементы с рейтингом <= выбранному
            allRatingElements.forEach(e => {
                if (parseInt(e.dataset.rating) <= rating) {
                    e.classList.add('active');
                } else {
                    e.classList.remove('active');
                }
            });

            const res = await apiRequest('rate-album', {release_id: window.ALBUM_ID, rating: rating});
            if (res.error) {
                toastError('Не удалось сохранить оценку. Попробуйте ещё раз.');
            }
        });
    });

    const container = document.getElementById('finale-emotions-table');
    if (container && window.ALBUM_TRACKS) {
        const emojis = window.EMOTION_MAP || {};
        const allEmotions = Object.keys(emojis);
        const savedAll = loadEmotions();

        window.ALBUM_TRACKS.forEach(track => {
            const trackEmotions = savedAll[track.id] || [];

            const row = document.createElement('div');
            row.className = 'emotion-row';

            const titleSpan = document.createElement('span');
            titleSpan.className = 'emotion-track';
            titleSpan.textContent = track.title;
            row.appendChild(titleSpan);

            const iconsDiv = document.createElement('div');
            iconsDiv.className = 'emotion-icons';

            allEmotions.forEach(code => {
                const icon = document.createElement('span');
                icon.className = `emotion-icon ${code} ${trackEmotions.includes(code) ? 'selected' : ''}`;
                icon.textContent = emojis[code].emoji;
                iconsDiv.appendChild(icon);
            });

            row.appendChild(iconsDiv);
            container.appendChild(row);
        });
    }
}

function initAfterPage() {
    safeYm('reachGoal', 'after_page_view', { album: window.ALBUM_SLUG });
    
    const form = document.getElementById('feedback-form');
    const submitBtn = form.querySelector('button[type="submit"]');
    const note = form.querySelector('p.action-hint');
    const reviewTextarea = form.querySelector('[name="review"]');

    // Загружаем старый отзыв
    apiRequest(`feedback/?release_id=${window.ALBUM_ID}`, {}, null, {method: 'GET'}).then(data => {
        if (data && data.review) {
            reviewTextarea.value = data.review;
            submitBtn.textContent = 'Изменить';

            if (data.status === 'approved') {
                note.textContent = 'Ваш отзыв уже одобрен и опубликован.';
            } else if (data.status === 'pending') {
                note.textContent = 'Ваш отзыв находится на модерации.';
            }
        }
    });

    apiRequest('get-user-profile', {}, null, {method: 'GET'}).then(data => {
        if (data && data.success) {
            sessionStorage.setItem('twit_name', data.name || '');
            sessionStorage.setItem('twit_email', data.email || '');
        }
    });

    // Восстанавливаем имя и email из sessionStorage
    const savedName = sessionStorage.getItem('twit_name');
    const savedEmail = sessionStorage.getItem('twit_email');

    if (savedName) {
        const nameInput = form.querySelector('[name="name"]');
        if (nameInput) nameInput.value = savedName;
    }
    if (savedEmail) {
        const emailInput = form.querySelector('[name="email"]');
        if (emailInput) emailInput.value = savedEmail;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const data = Object.fromEntries(fd);
        data.want_booklet = fd.has('want_booklet');
        data.subscribe = fd.has('subscribe');
        data.release_id = window.ALBUM_ID;

        // Простая валидация
        if (!data.name || !data.name.trim()) {
            toastWarning('Пожалуйста, укажите ваше имя');
            return;
        }
        if (!data.review || !data.review.trim()) {
            toastWarning('Пожалуйста, напишите отзыв');
            return;
        }
        if (data.want_booklet && (!data.email || !data.email.trim())) {
            toastWarning('Для получения буклета укажите email');
            return;
        }

        if (data.email) {
            sessionStorage.setItem('twit_email', data.email);
        }
        if (data.name) {
            sessionStorage.setItem('twit_name', data.name);
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        safeYm('reachGoal', 'feedback_sent', { album: window.ALBUM_SLUG });
        const res = await apiRequest('feedback', data, submitBtn);
        if (res.success) {
            submitBtn.textContent = 'Изменить';
            note.textContent = 'Ваш отзыв находится на модерации.';
            toastSuccess('Спасибо! Ваш отзыв отправлен.');
        } else {
            toastError('Ошибка. Попробуйте позже.');
        }
    });
}

const path = window.location.pathname;
const isTrackPage = /track-\d+\.html/.test(path);
const isFinalePage = /finale\.html/.test(path);
const isAfterPage = /after\.html/.test(path);
const isIndexPage = !isTrackPage && !isFinalePage && !isAfterPage;

if (isIndexPage) {
    initIndexPage();
}

if (isFinalePage) {
    initFinalePage();
}

if (isAfterPage) {
    initAfterPage();
}