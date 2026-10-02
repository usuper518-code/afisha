//common.js
// ==================== Yandex metrika ====================
if (window.METRIKA_ID) {
    (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
    m[i].l=1*new Date();
    for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
    k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
    (window, document, "script", "https://mc.yandex.com/metrika/tag.js", "ym");
    ym(window.METRIKA_ID, "init", {clickmap:true, trackLinks:true, accurateTrackBounce:true, webvisor: true});
    
    // Единый обработчик целей Метрики через data-атрибуты
    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-ym-goal]');
        if (target && typeof ym === 'function') {
            const goal = target.getAttribute('data-ym-goal');
            let params = {};
            try { params = JSON.parse(target.getAttribute('data-ym-params') || '{}'); } catch {}
            safeYm('reachGoal', goal, params);
        }
    });    
}

function safeYm(...args) {
    if (window.METRIKA_ID && typeof ym !== 'undefined') {
        ym(window.METRIKA_ID, ...args);
    }
}

// ==================== API ====================
async function apiRequest(endpoint, data, btn = null, options = {}) {
    if (btn) {
        btn.disabled = true;
        btn.classList.add('loading-border');
    }
    const method = (options.method || 'POST').toUpperCase();

    try {
        const fetchOptions = {
            method: method,
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'}
        };
        
        // Для GET-запросов тело не добавляем
        if (method !== 'GET' && method !== 'HEAD') {
            fetchOptions.body = JSON.stringify(data);
        }        
        
        const res = await fetch('/api/' + endpoint, fetchOptions);
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
            return {error, errors, warnings, status: res.status};
        }
        return await res.json();
    } catch (e) {
        return {error: 'Ошибка сети', status: 0};
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('loading-border');
        }
    }
}

async function logEvent(eventType, entityType, entityId) {
    await apiRequest('events', { event_type: eventType, entity_type: entityType, entity_id: entityId });
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

// ==================== Обработчик поделиться ====================
document.addEventListener('click', async (e) => {
    if (!e.target.closest('#share-btn')) return;
    e.preventDefault();
    const url = window.location.href;
    const title = document.title;
    shareUrl(url, title);
    if (window.CURRENT_TRACK_SLUG) {
        safeYm('reachGoal', 'share_track', { album: window.ALBUM_SLUG, track: window.CURRENT_TRACK_SLUG });
        logEvent('share', 'track', window.CURRENT_TRACK_ID);
    } else if (window.ALBUM_SLUG) {
        safeYm('reachGoal', 'share_album', { album: window.ALBUM_SLUG, track: window.CURRENT_TRACK_SLUG });
        logEvent('share', 'release', window.ALBUM_ID);
    } else {
        safeYm('reachGoal', 'share_sait');
    }
});

async function shareUrl(url, title) {
   if (navigator.share) {
        try {
            await navigator.share({ title, url });
            return;
        } catch {}
    }

    // Фоллбэк — копирование в буфер
    try {
        await navigator.clipboard.writeText(url);
        toastSuccess('Ссылка скопирована!');
        return;        
    } catch {}  
    
    // Запасной вариант – выделение через textarea
    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try { 
        document.execCommand('copy'); 
        toastSuccess('Ссылка скопирована!'); 
    } catch {}
    document.body.removeChild(textarea);
}

// ==================== Утилиты ====================
function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function loadEmotions() {
    try {
        return JSON.parse(localStorage.getItem(`emotions_${window.ALBUM_ID}`)) || {};
    } catch {
        return {};
    }
}
function saveEmotions(emotions) {
    localStorage.setItem(`emotions_${window.ALBUM_ID}`, JSON.stringify(emotions));
}
function getTrackEmotions(trackId) {
    const emotions = loadEmotions();
    return emotions[trackId] || [];
}
function setTrackEmotions(trackId, emotionCodes) {
    const emotions = loadEmotions();
    emotions[trackId] = emotionCodes;
    saveEmotions(emotions);
}

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds))
        return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ==================== Регулятор громкости ====================
function initVolumeControl(audio, name, state=0) {
    
    const volumeBtn = document.getElementById('volume-control');
    const volumeIcon = volumeBtn.querySelector('i');
    const nameStorage = 'volume_' + name;
    
    const states = [
        {volume: 0.0, icon: 'fa-volume-xmark'},
        {volume: 0.3, icon: 'fa-volume-low'},
        {volume: 1.0, icon: 'fa-volume-high'}
    ];    
    
    const stored = localStorage.getItem(nameStorage);
    let currentState = stored !== null ? parseInt(stored) : state;
    applyState(currentState);
    
    volumeBtn.addEventListener('click', () => {
        currentState = (currentState + 1) % states.length;
        localStorage.setItem(nameStorage, currentState);
        applyState(currentState);
    });        
    
    function applyState(index) {
        const state = states[index];
        if (audio === null) {
            window[name].updateVolume(state.volume); 
        } else {
            audio.volume = state.volume;
        }
        volumeIcon.className = `fas ${state.icon}`;
    }    
}

// ==================== Заглушки на картинках ====================
(function () {
    document.querySelectorAll('img').forEach(img => {

        let noCover = img.parentElement.querySelector('.no-cover');
        
        // Функции управления видимостью
        const showPlaceholder = () => {
            if (!noCover) {
                noCover = document.createElement('div');
                noCover.className = 'no-cover';
                noCover.innerHTML = '<i class="fas fa-palette"></i> Художник еще рисует';
                img.parentNode.appendChild(noCover);
            };
            noCover.style.display = 'flex';
            img.style.visibility = 'hidden'; // Скрываем битую картинку
            img.style.opacity = '0';
        };

        const hidePlaceholder = () => {
            if (noCover) {
                noCover.remove();
            }
            img.style.visibility = 'visible';
            img.style.opacity = '1';
        };        
        
        // Проверка кэша: если изображение уже загружено
        if (img.complete) {
            img.naturalWidth > 0 ? hidePlaceholder() : showPlaceholder();
            return;
        }

        // Успешная загрузка
        img.addEventListener('load', () => {
            hidePlaceholder();
        });

        // Ошибка загрузки (404, недоступный хост и т.д.)
        img.addEventListener('error', () => {
            showPlaceholder();
        });        
        
    });
})();

// ==================== Кнопки скрола ====================
function initScrollButtons(root) {
  (root || document).querySelectorAll('.scroll-buttons').forEach(btnGroup => {
    if (btnGroup.dataset.scrollReady) return;
    const targetId = btnGroup.dataset.scrollTarget;
    if (!targetId) return;

    const scrollable = document.getElementById(targetId);
    if (!scrollable) return;
    btnGroup.dataset.scrollReady = '1';
    // Шаблон прячет блок инлайн-стилем, пока скрипт не решит, нужен ли он.
    // Дальше видимость у класса .visible: инлайн display:none победил бы CSS.
    btnGroup.style.display = '';

    const upBtn = btnGroup.querySelector('.scroll-up');
    const downBtn = btnGroup.querySelector('.scroll-down');

    const checkOverflow = () => {
        const hasOverflow = scrollable.scrollHeight > scrollable.clientHeight;
        btnGroup.classList.toggle('visible', hasOverflow);
        if (hasOverflow) {
            updateScrollButtonsState();
        }
    };

    const updateScrollButtonsState = () => {
        const scrollTop = scrollable.scrollTop;
        const maxScrollTop = scrollable.scrollHeight - scrollable.clientHeight;
        if (upBtn) upBtn.disabled = scrollTop <= 0;
        if (downBtn) downBtn.disabled = scrollTop >= maxScrollTop - 1;
    };

    // Прокрутка с удержанием и остановкой на краях.
    // Шаг нельзя считать при инициализации: в портрете колонка скрыта
    // и clientHeight равен нулю, после поворота кнопки крутили бы на 0.
    // Плавный scroll-behavior перебивает частые присваивания — на время
    // удержания листаем сразу.
    let scrollInterval = null;

    const startScroll = (direction) => {
        stopScroll();
        scrollable.style.scrollBehavior = 'auto';
        scrollInterval = setInterval(() => {
            const scrollAmount = Math.max(scrollable.clientHeight / 20, 1);
            const currentTop = scrollable.scrollTop;
            const newTop = currentTop + direction * scrollAmount;
            // Проверяем границы
            if (newTop < 0) {
                scrollable.scrollTop = 0;
                stopScroll();
            } else if (newTop > scrollable.scrollHeight - scrollable.clientHeight) {
                scrollable.scrollTop = scrollable.scrollHeight - scrollable.clientHeight;
                stopScroll();
            } else {
                scrollable.scrollTop = newTop;
            }
            updateScrollButtonsState();
        }, 50);
    };

    const stopScroll = () => {
        if (scrollInterval) {
            clearInterval(scrollInterval);
            scrollInterval = null;
        }
        scrollable.style.scrollBehavior = '';
    };

    // Обработчики для кнопок
    [upBtn, downBtn].forEach(btn => {
        if (!btn) return;
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (btn.disabled) return;
            const dir = btn.classList.contains('scroll-up') ? -1 : 1;
            startScroll(dir);
        });
        btn.addEventListener('mouseup', stopScroll);
        btn.addEventListener('mouseleave', stopScroll);
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (btn.disabled) return;
            const dir = btn.classList.contains('scroll-up') ? -1 : 1;
            startScroll(dir);
        });
        btn.addEventListener('touchend', stopScroll);
    });

    // Обновляем состояние при скролле пользователем
    scrollable.addEventListener('scroll', updateScrollButtonsState);

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    // Плеер дописывает строки уже после этой инициализации. Высота колонки
    // при этом не меняется — растёт только scrollHeight, resize его не видит.
    new MutationObserver(checkOverflow).observe(scrollable, { childList: true, subtree: true, characterData: true });
  });
}
initScrollButtons();

// ==================== Занавес ====================
function openCurtain() {
    const preloader = document.getElementById('preloader');

    // Плавно убираем затемнение
    if (preloader) {
        preloader.classList.add('complete');
    }

    // Через время анимации затемнения (0.3s) открываем занавес
    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 300);
}

// Ждём загрузки всех ресурсов, включая шрифты
Promise.all([
    new Promise((resolve) => {
        if (document.readyState === 'complete') {
            resolve();
        } else {
            window.addEventListener('load', resolve);
        }
    }),
    document.fonts ? document.fonts.ready : Promise.resolve()
]).then(openCurtain);

// Фоллбэк: если за 8 секунд ничего не загрузилось, показываем
setTimeout(() => {
    if (!document.body.classList.contains('loaded')) {
        openCurtain();
    }
}, 8000);

// ==================== Прожектор и пыль ====================
(function() {
  const canvas = document.getElementById('dust-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height;
  let mouseX = -1000, mouseY = -1000;
  let particles = [];
  let glowRadius;
  let maxSizePoint;

  const PARTICLE_COUNT = 50;
  const DRIFT_SPEED = 0.15;
  const BASE_OPACITY = 0.7;
  const PROJ_COLOR = '212, 175, 55';
  const GLOW_SIZE = 25; //%
  const POINT_SIZE = 0.5; //%

  // Управление видимостью прожектора
  let targetAlpha = 0;        // 1 — включён, 0 — выключен
  let lightAlpha = 0;         // текущая плавная альфа
  let fadeTimer = null;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    glowRadius = Math.min(height,width) * GLOW_SIZE / 100;
    maxSizePoint = Math.min(height,width) * POINT_SIZE / 100;    
  }

  function createParticles() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * maxSizePoint + 0.8,
        opacityPhase: Math.random() * Math.PI * 2,
        driftX: (Math.random() - 0.5) * DRIFT_SPEED,
        driftY: (Math.random() - 0.5) * DRIFT_SPEED,
      });
    }
  }

  // Включить прожектор и сбросить таймер исчезновения
  function activateLight() {
    targetAlpha = 1;
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => {
      targetAlpha = 0;
    }, 2000);
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    // Плавное приближение к targetAlpha
    lightAlpha += (targetAlpha - lightAlpha) * 0.08;

    // Если прожектор практически не виден, пропускаем его отрисовку
    if (lightAlpha < 0.01) {
      // Всё равно обновляем частицы, но не рисуем
      for (const p of particles) {
        p.x += p.driftX;
        p.y += p.driftY;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;
      }
      requestAnimationFrame(draw);
      return;
    }

    const lightX = mouseX < 0 ? width / 2 : mouseX;
    const lightY = mouseY < 0 ? height / 2 : mouseY;

    // Градиент прожектора, умноженный на lightAlpha
    const gradient = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, glowRadius);
    gradient.addColorStop(0, `rgba(${PROJ_COLOR}, ${0.25 * lightAlpha})`);
    gradient.addColorStop(0.5, `rgba(${PROJ_COLOR}, ${0.05 * lightAlpha})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Частицы
    const now = performance.now() / 1000;
    for (const p of particles) {
      const alpha = (Math.sin(now * 1.5 + p.opacityPhase) + 1) / 2 * BASE_OPACITY;

      const dx = p.x - lightX;
      const dy = p.y - lightY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < glowRadius) {
        const intensity = 1 - dist / glowRadius;
        const finalAlpha = alpha * intensity * 0.9 * lightAlpha;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${PROJ_COLOR}, ${finalAlpha})`;
        ctx.fill();
      }

      // Дрейф
      p.x += p.driftX;
      p.y += p.driftY;
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;
    }

    requestAnimationFrame(draw);
  }

  // --- Обработчики ---
  window.addEventListener('resize', () => {
    resize();
    createParticles();
  });

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    activateLight();
  });

  window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      mouseX = e.touches[0].clientX;
      mouseY = e.touches[0].clientY;
      activateLight();
    }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    // Не выключаем сразу, таймер сам погасит через 2 сек
    mouseX = -1000;
    mouseY = -1000;
  });

  // Запуск
  resize();
  createParticles();
  draw();
})();

// ==================== Искры над элементом =================
(function() {
    
  const texts = document.querySelectorAll('.smolder-text');
  if (!texts.length) return;

  texts.forEach(text => {
    const canvas = document.createElement('canvas');
    canvas.className = 'smolder-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    text.style.position = 'relative';
    text.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    let animationId = null;
    let rgbColor = '212, 175, 55'; // fallback
    let active = false;

    function resize() {
      const rect = text.getBoundingClientRect();
      // Отступ в em (не px) — синхронизирован с .smolder-canvas в
      // common.css (там -0.6em/+1.2em), иначе этот инлайн-стиль
      // всегда перебивал бы CSS своим фиксированным значением.
      const fontSize = parseFloat(getComputedStyle(text).fontSize) || 16;
      const margin = fontSize * 0.6;
      width = canvas.width = rect.width + margin * 2;
      height = canvas.height = rect.height + margin * 2;
      canvas.style.top = -margin + 'px';
      canvas.style.left = -margin + 'px';
    }

    function updateColor() {
      const style = getComputedStyle(text);
      const c = style.color;
      // Извлекаем r,g,b из формата "rgb(r, g, b)" или "rgba(r, g, b, a)"
      const match = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        rgbColor = `${match[1]}, ${match[2]}, ${match[3]}`;
      }
    }

    function spawnParticle() {
      const textRect = text.getBoundingClientRect();
      const margin = 4;
      const side = Math.floor(Math.random() * 4);
      let x, y;
      switch(side) {
        case 0: x = Math.random() * textRect.width; y = -margin; break;
        case 1: x = textRect.width + margin; y = Math.random() * textRect.height; break;
        case 2: x = Math.random() * textRect.width; y = textRect.height + margin; break;
        case 3: x = -margin; y = Math.random() * textRect.height; break;
      }
      particles.push({
        x: x + 10,
        y: y + 10,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -Math.random() * 1.8 - 0.4,
        life: 1.0,
        decay: 0.012 + Math.random() * 0.02,
        radius: 0.4 + Math.random() * 1.4,
      });
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgbColor}, ${p.life})`;
        ctx.fill();
      }

      // Подбрасываем частицы, пока активно
      if (active && Math.random() < 0.35) {
        spawnParticle();
      }

      // Останавливаем цикл, если неактивно и частицы кончились
      if (!active && particles.length === 0) {
        cancelAnimationFrame(animationId);
        animationId = null;
        return;
      }

      animationId = requestAnimationFrame(draw);
    }

    function startAnimation() {
      if (!animationId) {
        animationId = requestAnimationFrame(draw);
      }
    }

    text.addEventListener('mouseenter', () => {
      active = true;
      updateColor();
      resize();
      startAnimation();
    });

    text.addEventListener('mouseleave', () => {
      active = false;
      // Даём догореть оставшимся частицам
      setTimeout(() => {
        if (!active && particles.length === 0 && animationId) {
          cancelAnimationFrame(animationId);
          animationId = null;
        }
      }, 1000);
    });

    window.addEventListener('resize', resize);
    resize();
  });
})();

// ==================== Огонь над элементом =================
(() => {
  'use strict';
  const canvas = document.getElementById('fire-canvas');
  if (!canvas) return;  

  const CONFIG = {
    // Изменить частоту возгораний  
    igniteDelay: [2000, 5000],
    burnDelay:   [500, 1500],
    fireOrigin: 'top', // Глобальный дефолт: 'top' | 'bottom'
    
    // Сделать огонь агрессивнее
    fire: {
      spawnRate: 5, hoverSpawnRate: 12, baseAlpha: 0.7, sizeMin: 3, sizeMax: 18
    },
    // Уменьшить дым или сделать его темнее
    smoke: {
      spawnRate: 2, baseAlpha: 0.45, sizeMin: 5, sizeMax: 32,
      color: { r: 185, g: 195, b: 210 }
    }
  };

  const ctx = canvas.getContext('2d');
  let w, h, dpr;
  const particles = [];
  const buttons = [];

  const rand = (min, max) => Math.random() * (max - min) + min;
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    updateRects();
  }
  window.addEventListener('resize', resize);

  function updateRects() {
    buttons.forEach(b => b.rect = b.el.getBoundingClientRect());
  }
  window.addEventListener('scroll', updateRects, { passive: true });

  class Particle {
    constructor(x, y, type, isHover) {
      this.x = x; this.y = y;
      this.type = type; 
      this.isHover = isHover;
      
      // Физика (огонь всегда летит вверх, но старт зависит от origin)
      const spread = isHover ? 1.8 : 1.2;
      this.vx = (Math.random() - 0.5) * 2 * spread;
      this.vy = type === 'fire' ? -rand(isHover ? 3.5 : 2.5, isHover ? 5 : 4) : -rand(0.6, 1.2);
      
      this.size = rand(CONFIG[type].sizeMin, CONFIG[type].sizeMax * 0.4);
      this.maxSize = CONFIG[type].sizeMax;
      this.life = 1.0;
      this.decay = type === 'fire' ? rand(0.025, 0.045) : rand(0.008, 0.015);
      
      this.wobble = Math.random() * Math.PI * 2;
      this.wobbleSpeed = rand(0.06, 0.12);
    }

    update() {
      this.wobble += this.wobbleSpeed;
      this.x += this.vx + Math.sin(this.wobble) * 0.6;
      this.y += this.vy;
      this.size += (this.maxSize - this.size) * (this.type === 'fire' ? 0.06 : 0.03);
      this.life -= this.decay;
      return this.life > 0;
    }

    draw(ctx) {
      ctx.save();
      const a = clamp(this.life, 0, 1);
      
      if (this.type === 'fire') {
        ctx.globalCompositeOperation = 'lighter';
        const r = 255, g = Math.floor(80 + a * 160), b = Math.floor(a * 90);
        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
        grad.addColorStop(0, `rgba(${r},${g},${b},${a * CONFIG.fire.baseAlpha})`);
        grad.addColorStop(0.35, `rgba(${r},${Math.floor(g*0.6)},${Math.floor(b*0.4)},${a * CONFIG.fire.baseAlpha * 0.7})`);
        grad.addColorStop(1, `rgba(${Math.floor(r*0.4)},0,0,0)`);
        ctx.fillStyle = grad;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        const { r, g, b } = CONFIG.smoke.color;
        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
        grad.addColorStop(0, `rgba(${r},${g},${b},${a * CONFIG.smoke.baseAlpha})`);
        grad.addColorStop(0.5, `rgba(${r-15},${g-15},${b-10},${a * CONFIG.smoke.baseAlpha * 0.5})`);
        grad.addColorStop(1, `rgba(${r-30},${g-30},${b-20},0)`);
        ctx.fillStyle = grad;
      }

      ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  document.querySelectorAll('.fire-btn').forEach(el => {
    buttons.push({
      el, rect: el.getBoundingClientRect(),
      // 🎯 Читаем атрибут или берём глобальный дефолт
      origin: el.dataset.fireOrigin || CONFIG.fireOrigin,
      state: 'idle', timers: { ignite: null, burn: null }, isHover: false
    });
  });

  function scheduleIgnite(btn) {
    clearTimeout(btn.timers.ignite);
    btn.timers.ignite = setTimeout(() => {
      if (!btn.isHover) { btn.state = 'burning'; scheduleExtinguish(btn); }
      else { btn.state = 'hover'; }
    }, rand(...CONFIG.igniteDelay));
  }

  function scheduleExtinguish(btn) {
    clearTimeout(btn.timers.burn);
    btn.timers.burn = setTimeout(() => {
      if (!btn.isHover) { btn.state = 'idle'; scheduleIgnite(btn); }
    }, rand(...CONFIG.burnDelay));
  }

  buttons.forEach(btn => {
    btn.el.addEventListener('mouseenter', () => {
      btn.isHover = true; clearTimeout(btn.timers.burn); btn.state = 'hover';
    });
    btn.el.addEventListener('mouseleave', () => {
      btn.isHover = false;
      if (btn.state === 'hover') { btn.state = 'burning'; scheduleExtinguish(btn); }
    });
    scheduleIgnite(btn);
  });

  function animate() {
    ctx.clearRect(0, 0, w, h);

    buttons.forEach(btn => {
      const r = btn.rect;
      if (r.bottom < 0 || r.top > h || r.width === 0) return;

      const isBurning = btn.state === 'burning' || btn.state === 'hover';
      if (!isBurning) return;

      // 🎯 Определяем базовую точку старта огня/дыма
      const baseY = btn.origin === 'bottom' ? r.bottom : r.top;
      const spawnRange = btn.origin === 'bottom' ? 5 : 4;
      const py = baseY + (btn.origin === 'bottom' ? -rand(0, spawnRange) : rand(0, spawnRange));

      const rate = btn.state === 'hover' ? CONFIG.fire.hoverSpawnRate : CONFIG.fire.spawnRate;
      for (let i = 0; i < rate; i++) {
        particles.push(new Particle(r.left + Math.random() * r.width, py, 'fire', btn.state === 'hover'));
      }

      if (!btn.isHover) {
        const smokeY = btn.origin === 'bottom' ? py - 2 : py - rand(5, 10);
        for (let i = 0; i < CONFIG.smoke.spawnRate; i++) {
          particles.push(new Particle(r.left + Math.random() * r.width, smokeY, 'smoke', false));
        }
      }
    });

    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].update()) particles[i].draw(ctx);
      else particles.splice(i, 1);
    }

    requestAnimationFrame(animate);
  }

  resize();
  animate();
})();

// ==================== Занавес =================
(() => {
  'use strict';
  
const CONFIG = {
  // ─── 🪟 ГЕОМЕТРИЯ ЗАНАВЕСА (в % от экрана) ───
  curtain: {
    heightPercent: 0.85,      // Высота занавеса: 85% от высоты экрана
    topOffset: 0.1,           // Отступ сверху: 10% от высоты экрана
    closeMarginPercent: 0.05  // Остаток шторы по краям при открытии: 5% от ширины экрана
  },

  // ─── 🌊 ВОЛНИСТЫЙ КРАЙ (в % от экрана) ───
  wave: {
    amplitude: 0.018,         // Глубина волны: 1.8% от высоты экрана (~14px на 768px)
    wavelength: 0.06,         // Длина волны: 6% от ширины экрана (~48px на 800px)
    phase: 0,                 // Сдвиг фазы в радианах (безразмерный)
    hemLine: true,            // Рисовать золотой шов
    hemThickness: 0.003       // Толщина шва: 0.3% от высоты экрана (~2-3px)
  },

  // ─── 🎞️ АНИМАЦИЯ ───
  animation: {
    duration: 5000,           // Длительность открытия/закрытия занавеса в миллисекундах
    ease: 'quart',            // Тип функции плавности: 'cubic' | 'quart' | 'quint'. quart = тяжёлое, театральное движение
    respectReducedMotion: true // Уважать настройку ОС prefers-reduced-motion (отключать анимацию для пользователей с вестибулярными нарушениями)
  },

  // Полноширинное затухание низа убрано: чёрная полоса закрывала подвал,
  // когда шторы уже разъехались. Низ штор — бахрома по краям.

  // ✨ НОВОЕ: Затухание эффектов после открытия
  fadeOut: {
    enabled: true,        // Включить плавное затухание прожекторов и пыли
    delay: 2000,           // Задержка перед началом затухания (мс)
    duration: 5000        // Длительность затухания (мс)
  },
  
  // ─── 🔊 АУДИО-ОФОРМЛЕНИЕ ───
  audio: {
    enabled: true,            // Глобальный переключатель всех звуков

    // 🔔 Колокольчик при открытии
    chimeVol: 0.14,           // Громкость колокольчика (0.0..1.0)
    chimeDur: 2.2,            // Длительность звучания колокольчика в секундах

    // 🧵 Шум раздвигающейся ткани
    fabricVol: 0.16,          // Громкость шума ткани (0.0..1.0)

    // 🏛️ Реверберация зала (эхо)
    reverbMix: 0.65,          // Баланс сухой/мокрый сигнал для реверба (0.0 = только прямой звук, 1.0 = только эхо)
    reverbDur: 3.5,           // Длительность хвоста реверберации в секундах
    reverbDecay: 2.2,         // Скорость затухания эха (больше = быстрее гаснет, меньше = дольше висит в воздухе)

    // 🔁 Эхо-задержка (delay)
    delayTime: 0.14,          // Время задержки первого повтора в секундах
    delayFeedback: 0.28,      // Коэффициент обратной связи (сколько эха возвращается в цепь, 0.0..0.9)
    delayMix: 0.22            // Громкость эффекта delay относительно основного сигнала (0.0..1.0)
  },

  // ─── ✨ ПЫЛЬ/ЧАСТИЦЫ В ЛУЧАХ СВЕТА ───
  dust: {
    enabled: true,            // Включить отрисовку плавающих частиц
    count: 45,                // Количество частиц на экране
    opacityPeak: 0.65,        // Максимальная прозрачность частицы в пике жизни (0.0..1.0)
    lifetime: 2.5,            // Время жизни одной частицы в секундах
    sizeMin: 0.002,           // Мин. размер: 0.2% от min(w,h) (~1.5px на 768px)
    sizeMax: 0.006,           // Макс. размер: 0.6% от min(w,h) (~4.5px на 768px)
    speedMin: 0.15,           // Минимальная скорость подъёма частицы
    speedMax: 0.4             // Максимальная скорость подъёма частицы
    // ❗ Цвет частиц берётся автоматически из активной CSS-темы (--theme-curtain-dust)
  },

  // ─── 💡 СВЕТОВЫЕ ЛУЧИ В ПРОЁМЕ ───
  lightRays: {
    enabled: true,            // Включить отрисовку лучей света
    count: 5,                 // Количество лучей в проёме
    width: 0.15,              // Ширина луча: 15% от ширины экрана (~120px на 800px)
    opacity: 0.08,            // Базовая прозрачность луча (0.0..1.0)
    tilt: 0.15                // Угол наклона лучей в радианах (0 = вертикально, больше = сильнее наклон)
    // ❗ Цвет лучей берётся автоматически из активной CSS-темы (--theme-curtain-ray)
  }
};

  // Цвета занавеса читаются из активной CSS-темы (--theme-curtain-*,
  // см. css/themes/theme-*.css), а не из захардкоженного набора —
  // так занавес всегда совпадает с темой релиза, какая бы она ни
  // была, включая темы, которых ещё не существовало на момент
  // написания этого кода.
  function getPalette() {
    const cs = getComputedStyle(document.documentElement);
    const read = (name, fallback) => {
      const v = cs.getPropertyValue(name).trim();
      return v || fallback;
    };
    return {
      base: read('--theme-curtain-fabric', '#6b0023'),
      foldShadow: read('--theme-curtain-fabric-shadow', 'rgba(0,0,0,0.55)'),
      foldLight: read('--theme-curtain-fabric-highlight', 'rgba(150,25,45,0.2)'),
      gold: read('--theme-curtain-trim-bright', 'rgb(212,175,55)'),
      goldDark: read('--theme-curtain-trim-dark', '#b8860b'),
      rodBase: read('--theme-curtain-rod', '#3a2005'),
      rodGold: read('--theme-curtain-trim', '#d4af37'),
      hem: read('--theme-curtain-hem', 'rgba(212,175,55,0.6)'),
      hemLight: read('--theme-curtain-hem-light', 'rgba(255,215,0,0.3)'),
      hint: read('--theme-curtain-hint', '#d4af37'),
      stageBg: `radial-gradient(circle at center, ${read('--theme-curtain-stage-bg-start', '#1a1a3a')} 0%, ${read('--theme-curtain-stage-bg-end', '#05050a')} 100%)`,
      dust: read('--theme-curtain-dust', 'rgba(255,215,0,0.6)'),
      ray: read('--theme-curtain-ray', 'rgba(255,220,100,0.1)')
    };
  }
  const px = (percent, axis = 'h') => Math.round((axis === 'h' ? h : w) * percent);

  // ═══════════════════════════════════════════════════════
  // 🎵 АУДИО
  // ═══════════════════════════════════════════════════════
  let audioCtx = null, hallIR = null;
  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const sr = audioCtx.sampleRate, len = Math.ceil(sr * CONFIG.audio.reverbDur);
      hallIR = audioCtx.createBuffer(2, len, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = hallIR.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, CONFIG.audio.reverbDecay);
      }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playChime() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime, dur = CONFIG.audio.chimeDur, vol = CONFIG.audio.chimeVol;
    const mix = CONFIG.audio.reverbMix, dryVal = Math.max(1.0 - mix - CONFIG.audio.delayMix, 0);
    const conv = audioCtx.createConvolver(); conv.buffer = hallIR;
    const wet = audioCtx.createGain(); wet.gain.value = mix;
    const delay = audioCtx.createDelay(); delay.delayTime.value = CONFIG.audio.delayTime;
    const fb = audioCtx.createGain(); fb.gain.value = CONFIG.audio.delayFeedback;
    const dm = audioCtx.createGain(); dm.gain.value = CONFIG.audio.delayMix;
    const dry = audioCtx.createGain(); dry.gain.value = dryVal;

    conv.connect(wet); wet.connect(delay); delay.connect(fb).connect(delay); delay.connect(dm);
    const dest = audioCtx.destination; dry.connect(dest); wet.connect(dest); dm.connect(dest);

    [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
      const osc = audioCtx.createOscillator(), env = audioCtx.createGain(), pan = audioCtx.createStereoPanner();
      osc.type = 'sine'; osc.frequency.value = f;
      env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(vol * (0.9 - i * 0.15), t + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      pan.pan.value = (i % 2) * 0.25 - 0.125;
      osc.connect(env).connect(pan); pan.connect(dry); pan.connect(conv); pan.connect(delay);
      osc.start(t); osc.stop(t + dur + 0.3);
    });
  }

  function playFabricSlide() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime, dur = CONFIG.animation.duration / 1000, vol = CONFIG.audio.fabricVol, dir = isOpen ? 1 : -1;
    const len = audioCtx.sampleRate * (dur + 0.5);
    const buf = audioCtx.createBuffer(2, len, audioCtx.sampleRate);
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for(let c=0;c<2;c++) {
      const d = buf.getChannelData(c);
      for(let i=0;i<len;i++) {
        const w = Math.random()*2-1;
        b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.075076; b2=0.96900*b2+w*0.1538520;
        b3=0.86650*b3+w*0.3104856; b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
        d[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)/6; b6=w*0.115926;
      }
    }
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const filt = audioCtx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.setValueAtTime(500, t); filt.frequency.exponentialRampToValueAtTime(1100, t + dur * 0.4); filt.frequency.exponentialRampToValueAtTime(450, t + dur); filt.Q.value = 0.8;
    const env = audioCtx.createGain(); env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(vol, t + 0.1); env.gain.linearRampToValueAtTime(vol * 0.9, t + dur * 0.7); env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const pan = audioCtx.createStereoPanner(); pan.pan.setValueAtTime(dir * 0.65, t); pan.pan.linearRampToValueAtTime(0, t + dur);
    src.connect(filt).connect(env).connect(pan).connect(audioCtx.destination);
    src.start(t); src.stop(t + dur + 0.2);
  }

  // ═══════════════════════════════════════════════════════
  // ⚙️ CANVAS & ЛОГИКА
  // ═══════════════════════════════════════════════════════
  const canvas = document.getElementById('curtain-canvas');
  // Занавес рисует этот скрипт на своём холсте. На страницах без холста его нет.
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const hintEl = document.getElementById('hint');

  let w, h, dpr;
  let currentProgress = 0, visualProgress = 0, startProgress = 0, targetProgress = 0, animStart = 0, isAnimating = false;
  let isOpen = false, prefersReducedMotion = false, particles = [], lastTime = 0;
  
  // ✨ НОВОЕ: Состояние затухания эффектов
  let fadeAlpha = 1.0;           // Прозрачность лучей/пыли (1.0 = видно, 0.0 = не видно)
  let fadeOutStart = 0;          // Время начала затухания
  let isFadingOut = false;       // Флаг: идёт ли затухание
  let fadeOutTimer = null;       // Таймер задержки перед затуханием

  function init() {
    prefersReducedMotion = CONFIG.animation.respectReducedMotion && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    applyTheme(); resize();
  }
  function applyTheme() {
    const p = getPalette();
    // .hint уже красится в CSS через var(--theme-color-accent-secondary)
    // напрямую (см. common.css) — тот же источник, что и p.hint здесь,
    // так что отдельно прокидывать цвет через JS больше не нужно.
    if(p.dust) CONFIG.dust.color = p.dust;
    if(p.ray) CONFIG.lightRays.color = p.ray;
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  window.addEventListener('resize', () => { resize(); if(isAnimating || !isOpen) draw(); });
  init();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => resize());

  function toggleCurtain() {
    if (isAnimating) return;
    initAudio();
    isOpen = !isOpen;
    
    targetProgress = isOpen ? 1 : 0;
    startProgress = currentProgress;
    animStart = performance.now();
    isAnimating = true;

    // Логика затухания
    if (isOpen) {
      playChime(); playFabricSlide();
      canvas.classList.add('open');
      hintEl?.classList.add('hidden');

      if (CONFIG.fadeOut.enabled) {
        clearTimeout(fadeOutTimer);
        isFadingOut = false;
        fadeAlpha = 1.0;
        // Запускаем таймер затухания
        fadeOutTimer = setTimeout(() => {
          isFadingOut = true;
          fadeOutStart = performance.now();
        }, CONFIG.fadeOut.delay);
      }
    } else {
      playFabricSlide();
      canvas.classList.add('open');
      hintEl?.classList.remove('hidden');
      
      // Сброс при закрытии
      clearTimeout(fadeOutTimer);
      isFadingOut = false;
      fadeAlpha = 1.0;
    }
    requestAnimationFrame(animate);
  }
  
  canvas.addEventListener('click', toggleCurtain);
  canvas.addEventListener('touchend', (e) => { e.preventDefault(); toggleCurtain(); }, { passive: false });

  function easeOut(t) { return 1 - Math.pow(1 - t, 4); }

  function animate(ts) {
    const now = ts || performance.now();
    const elapsed = now - animStart;
    const duration = prefersReducedMotion ? 0 : CONFIG.animation.duration;
    
    let raw = duration === 0 ? 1 : elapsed / duration;
    if (raw < 0) raw = 0; if (raw > 1) raw = 1;

    const eased = easeOut(raw);
    currentProgress = startProgress + (targetProgress - startProgress) * eased;
    visualProgress += (currentProgress - visualProgress) * 0.3;
    
    if (raw >= 1) {
      visualProgress = targetProgress;
      currentProgress = targetProgress;
      
      // 🌑 Плавное затухание (степенное, без резкого обрыва)
      if (isOpen && CONFIG.fadeOut.enabled && isFadingOut) {
        const fadeElapsed = now - fadeOutStart;
        const fadeRaw = Math.min(fadeElapsed / CONFIG.fadeOut.duration, 1);
        // 1 -> 0 с мягким "хвостом"
        fadeAlpha = Math.max(0, 1 - Math.pow(fadeRaw, 2.2));
      } else {
        fadeAlpha = 1.0;
      }
    } else {
      fadeAlpha = 1.0;
    }

    try { draw(); updateParticles(now); } catch (e) { /* пропускаем повреждённый кадр, не прерывая анимацию */ }

    // Цикл крутится до полного исчезновения эффектов
    const shouldContinue = raw < 1 || (isOpen && CONFIG.fadeOut.enabled && fadeAlpha > 0.005);
    if (shouldContinue) {
      requestAnimationFrame(animate);
    } else {
      isAnimating = false;
      canvas.style.cursor = isOpen ? 'default' : 'pointer';
      try { draw(); } catch(e){}
    }
  }

  class Dust {
    constructor() { this.reset(); }
    reset() {
      const d = CONFIG.dust, p = getPalette();
      this.x = w*0.3+Math.random()*w*0.4;
      this.y = h*CONFIG.curtain.topOffset+Math.random()*h*CONFIG.curtain.heightPercent*0.8;
      const baseSize = Math.min(w, h);
      this.size = baseSize * (d.sizeMin + Math.random()*(d.sizeMax - d.sizeMin));
      this.speed = d.speedMin+Math.random()*(d.speedMax-d.speedMin);
      this.drift = (Math.random()-0.5)*0.3;
      this.life = 0;
      this.maxLife = d.lifetime*(0.8+Math.random()*0.4);
      this.opacity = 0;
      const match = (d.color || p.dust).match(/[\d.]+/g);
      this.r = parseInt(match[0]); this.g = parseInt(match[1]); this.b = parseInt(match[2]);
    }
    update(dt) {
      this.life += dt;
      this.x += this.drift*dt*60;
      this.y -= this.speed*dt*30;
      this.opacity = CONFIG.dust.opacityPeak * Math.sin((this.life/this.maxLife)*Math.PI);
      if (this.life > this.maxLife) { this.reset(); }
    }
    // ✅ Принимаем fadeAlpha и умножаем явно (надёжнее чем globalAlpha)
    draw(ctx, fadeAlpha = 1.0) {
      const a = ((this.opacity ?? 0) * fadeAlpha).toFixed(2);
      ctx.fillStyle = `rgba(${this.r},${this.g},${this.b},${a})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
      ctx.fill();
    }
  }
  
  for(let i=0;i<CONFIG.dust.count;i++) particles.push(new Dust());

  function updateParticles(ts) {
    if (!CONFIG.dust.enabled) return;
    const dt = lastTime ? (ts-lastTime)/1000 : 0.016;
    lastTime = ts;

    // ✅ Обновляем физику всегда, пока проем открыт. 
    // Прозрачность контролируется только в draw()
    if (visualProgress > 0.1 && visualProgress < 0.95) {
      particles.forEach(p => p.update(dt));
    }
  }

  function drawDustAndRays(ctx) {
    if (fadeAlpha < 0.01) return;
    if(!CONFIG.dust.enabled && !CONFIG.lightRays.enabled) return;
    
    const p = getPalette();
    const margin = w * CONFIG.curtain.closeMarginPercent;
    const halfW = w / 2;
    const visibleWidth = halfW - (halfW - margin) * visualProgress;
    const gap = w - visibleWidth * 2;
    if (gap < 10) return;

    ctx.save();

    if (CONFIG.lightRays.enabled && visualProgress > 0.15) {
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < CONFIG.lightRays.count; i++) {
        const x = (w/2-gap/2) + (gap/CONFIG.lightRays.count)*i + gap*0.1;
        const tilt = CONFIG.lightRays.tilt * visualProgress * 2;
        const baseAlpha = Math.min(1, (visualProgress - 0.15) * 2) * CONFIG.lightRays.opacity;
        
        // ✅ Явное умножение на fadeAlpha
        const alpha = (baseAlpha * fadeAlpha).toFixed(2);
        
        const g = ctx.createLinearGradient(x, h*0.1, x, h*0.95);
        g.addColorStop(0, p.ray.replace(/[\d.]+\)$/,'0)'));
        g.addColorStop(0.2, p.ray.replace(/[\d.]+\)$/,`${alpha})`));
        g.addColorStop(0.8, p.ray.replace(/[\d.]+\)$/,`${(alpha*0.3).toFixed(2)})`));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.save(); ctx.translate(x, h*0.1); ctx.rotate(tilt*(i%2?1:-1));
        ctx.fillStyle = g;
        ctx.fillRect(-px(CONFIG.lightRays.width,'w')/2, 0, px(CONFIG.lightRays.width,'w'), h*0.9);
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    if (CONFIG.dust.enabled && visualProgress > 0.1 && visualProgress < 0.95) {
      particles.forEach(p => p.draw(ctx, fadeAlpha));
    }
    
    ctx.restore();
  }
  
  function getWaveY(x, baseY) { 
    return baseY + px(CONFIG.wave.amplitude, 'h') * Math.sin((x / px(CONFIG.wave.wavelength, 'w')) * Math.PI * 2 + CONFIG.wave.phase); 
  }

  function draw() {
    ctx.clearRect(0,0,w,h);
    const p = getPalette();
    const topY = stageTop();
    // Бахрома и волна рисуются НИЖЕ линии низа. Если считать высоту
    // от шапки как 85% экрана, край уходит за окно. Держим бахрому
    // внутри кадра, с небольшим полом под ней.
    const amplitude = h * CONFIG.wave.amplitude;
    const fringe = h * 0.055;
    const floorGap = h * 0.028;
    const bottomBaseY = Math.min(
      topY + h * CONFIG.curtain.heightPercent,
      h - amplitude - fringe - floorGap
    );
    
    const margin = w * CONFIG.curtain.closeMarginPercent;
    const halfW = w / 2;
    const visibleWidth = halfW - (halfW - margin) * visualProgress;
    if(visibleWidth < 2) return;

    const gap = w - visibleWidth * 2;
    if (gap > 0) {
      // ✅ Тень растягивается до самого низа экрана
      const shadowH = h - topY + 50;
      // Тень редеет вместе с проёмом. Иначе центр остаётся почти чёрным
      // все пять секунд разъезда и афиша проявляется только после остановки штор.
      const shadowAlpha = Math.max(0, 1 - visualProgress);
      
      const grad = ctx.createLinearGradient(w/2-gap/2, topY, w/2+gap/2, topY);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.3, `rgba(0,0,0,${0.6 * shadowAlpha})`);
      grad.addColorStop(0.5, `rgba(0,0,0,${0.95 * shadowAlpha})`);
      grad.addColorStop(0.7, `rgba(0,0,0,${0.6 * shadowAlpha})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(w/2-gap/2, topY, gap, shadowH);
    }

    drawRod(topY, p);
    drawCurtain(0, visibleWidth, topY, bottomBaseY, p);
    drawCurtain(w-visibleWidth, w, topY, bottomBaseY, p);
    
    if (fadeAlpha > 0.005) drawDustAndRays(ctx);
  }

  function stageTop() {
    const header = document.querySelector('.afisha-header');
    if (header) {
      const bottom = header.getBoundingClientRect().bottom;
      if (bottom > 0 && bottom < h) return bottom;
    }
    return h * CONFIG.curtain.topOffset;
  }

  function drawRod(y, p) {
    // Штанга целиком в полосе под шапкой, ткань начинается от её нижнего края.
    const rodH = px(0.018, 'h');
    const top = y - rodH;
    ctx.fillStyle=p.rodBase; ctx.fillRect(0, top, w, rodH);
    ctx.fillStyle=p.rodGold; ctx.fillRect(0, top+px(0.0026,'h'), w, Math.max(1, rodH-px(0.008,'h')));
    ctx.fillStyle=p.gold; ctx.fillRect(0, top+px(0.0026,'h'), w, px(0.0026,'h'));
    ctx.fillStyle=p.goldDark; ctx.fillRect(0, top+rodH-px(0.004,'h'), w, px(0.004,'h'));
  }

  function drawCurtain(startX, endX, topY, bottomBaseY, p) {
    const width = endX - startX;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(startX, topY); ctx.lineTo(endX, topY);
    for(let x=endX;x>=startX;x-=3) ctx.lineTo(x, getWaveY(x, bottomBaseY));
    ctx.closePath(); ctx.clip();
    
    ctx.fillStyle = p.base; 
    const extraBottom = px(0.065, 'h');
    ctx.fillRect(startX, topY, width, bottomBaseY - topY + extraBottom);
    
    const vGrad = ctx.createLinearGradient(startX, topY, startX, bottomBaseY);
    vGrad.addColorStop(0,'rgba(0,0,0,0.35)'); vGrad.addColorStop(0.3,p.foldLight); vGrad.addColorStop(0.7,'rgba(40,10,20,0.25)'); vGrad.addColorStop(1,'rgba(0,0,0,0.5)');
    ctx.fillStyle = vGrad; ctx.fillRect(startX, topY, width, bottomBaseY - topY + extraBottom);

    const foldUnit = px(0.0225, 'w');
    const folds = Math.max(2, Math.floor(width / foldUnit));
    const foldW = width / folds;
    for(let i=0;i<folds;i++) {
      const fx = startX + i*foldW;
      const g = ctx.createLinearGradient(fx, topY, fx+foldW, topY);
      if(i%2===0) { g.addColorStop(0,p.foldShadow); g.addColorStop(0.3,p.foldLight.replace(/[\d.]+\)$/,'0.2)')); g.addColorStop(0.7,p.foldLight.replace(/[\d.]+\)$/,'0.2)')); g.addColorStop(1,p.foldShadow); }
      else { g.addColorStop(0,'rgba(0,0,0,0.25)'); g.addColorStop(0.4,p.foldLight); g.addColorStop(0.5,p.gold.replace(')',',0.1)').replace('rgb','rgba')); g.addColorStop(0.6,p.foldLight); g.addColorStop(1,'rgba(0,0,0,0.25)'); }
      ctx.fillStyle=g; ctx.fillRect(fx, topY, foldW, bottomBaseY - topY + extraBottom);
      ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=px(0.0013,'h'); ctx.beginPath(); ctx.moveTo(fx+foldW/2,topY); ctx.lineTo(fx+foldW/2,bottomBaseY); ctx.stroke();
    }
    ctx.restore();

    // Пол под бахромой того же цвета, что сцена: иначе подвал
    // просвечивает в щели закрытой шторы.
    const floorTop = bottomBaseY + px(CONFIG.wave.amplitude, 'h');
    if (floorTop < h) {
      ctx.fillStyle = p.rodBase;
      ctx.fillRect(startX, floorTop, width, h - floorTop + 2);
    }

    drawFringe(startX, endX, bottomBaseY, p);
    if(CONFIG.wave.hemLine) drawWaveHem(startX, endX, bottomBaseY, p);
  }

  function drawWaveHem(startX, endX, baseY, p) {
    ctx.beginPath(); ctx.moveTo(startX, getWaveY(startX,baseY)); for(let x=startX;x<=endX;x+=3) ctx.lineTo(x, getWaveY(x,baseY));
    ctx.strokeStyle=p.hem; ctx.lineWidth=px(CONFIG.wave.hemThickness, 'h'); ctx.stroke();
    ctx.strokeStyle=p.hemLight; ctx.lineWidth=px(0.0013,'h'); ctx.beginPath(); for(let x=startX;x<=endX;x+=3) ctx.lineTo(x, getWaveY(x,baseY)-px(0.0013,'h')); ctx.stroke();
  }

  function drawFringe(startX, endX, baseY, p) {
    const fringeH = px(0.055, 'h');
    const spacing = px(0.01, 'w');
    const padX = px(0.0125, 'w');
    const padY = px(0.0065, 'h');
    
    ctx.save();
    ctx.beginPath(); ctx.rect(startX-padX, baseY-padY, endX-startX+padX*2, fringeH+px(0.02,'h')); ctx.clip();
    for(let x=startX+spacing/2;x<endX;x+=spacing) {
      const wy = getWaveY(x, baseY), sway = Math.sin(x*0.08+visualProgress*7)*(1+visualProgress*2.5);
      ctx.strokeStyle=p.goldDark; ctx.lineWidth=px(0.0013,'h'); ctx.beginPath(); ctx.moveTo(x,wy+px(0.0026,'h')); ctx.lineTo(x+sway,wy+fringeH*0.35); ctx.stroke();
      ctx.fillStyle=p.gold.replace(')',',0.85)').replace('rgb','rgba'); ctx.beginPath(); ctx.ellipse(x+sway,wy+fringeH*0.42,px(0.004,'w'),px(0.0065,'h'),0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=p.goldDark; ctx.lineWidth=px(0.00065,'h'); ctx.stroke();
      ctx.strokeStyle=p.gold.replace(')',',0.65)').replace('rgb','rgba'); ctx.lineWidth=px(0.0012,'h');
      for(let t=-2;t<=2;t++) { ctx.beginPath(); ctx.moveTo(x+sway,wy+fringeH*0.55); ctx.quadraticCurveTo(x+sway+t*px(0.003,'w'),wy+fringeH*0.75,x+sway+t*px(0.0065,'w'),wy+fringeH); ctx.stroke(); }
    }
    ctx.restore();
  }

  draw();
})();
// ============================================
// Переключатель «обложка ⇄ видео» — универсальный,
// работает на любой странице с элементом [data-video].
// Ролик сажается в рамку обложки, а не на всю карточку.
// ============================================
document.addEventListener('click', function (e) {
    const btn = e.target.closest('.media-video-toggle');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    const host = btn.closest('[data-video]');
    if (!host) return;

    // Рамка — .poster-media. На премьере она прямой потомок карточки,
    // в «Скоро» и «Архиве» она внутри ссылки, поэтому прямой потомок
    // её не находит. На программке и на сцене рамка — сам [data-video].
    // URL видео в любом случае лежит в data-video хоста.
    const media = host.querySelector('.poster-media') || host;

    const isActive = media.classList.contains('video-active');
    if (isActive) {
        const video = media.querySelector(':scope > video');
        if (video) video.pause();
        media.classList.remove('video-active');
        btn.innerHTML = '<i class="fas fa-play"></i>';
        btn.setAttribute('aria-label', 'Смотреть видео');
        return;
    }

    let video = media.querySelector(':scope > video');
    if (!video) {
        video = document.createElement('video');
        video.src = host.dataset.video;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = 'none';
        // Вставляем сразу после <img>, а не в конец — иначе видео
        // перекроет более поздние оверлеи (бейдж премьеры, текст
        // караоке и т.п.), которые должны оставаться поверх.
        const img = media.querySelector(':scope > img');
        if (img && img.nextSibling) media.insertBefore(video, img.nextSibling);
        else media.appendChild(video);
    }

    // Картинка остаётся видна, пока видео реально не готово (preload
    // отключён специально — не грузим то, что не факт что откроют).
    // Без этого между кликом и первым кадром был бы момент пустого
    // экрана на медленном соединении.
    btn.classList.add('loading');
    btn.disabled = true;
    video.currentTime = 0;
    video.play().then(() => {
        media.classList.add('video-active');
        btn.innerHTML = '<i class="fas fa-image"></i>';
        btn.setAttribute('aria-label', 'Вернуться к обложке');
        safeYm('reachGoal', 'media_video_play');
    }).catch(() => {
        // Не удалось запустить — остаёмся на обложке
    }).finally(() => {
        btn.classList.remove('loading');
        btn.disabled = false;
    });
});
