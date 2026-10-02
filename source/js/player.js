class AlbumPlayer {
    constructor(tracks, startIndex) {
        this.tracks = tracks;
        this.currentIndex = startIndex;
        this.activePlayer = null;
        this.preloadPlayer = null;
        this.volume = 0;
        this.karaoke = window.matchMedia('(orientation: portrait)').matches;
        this.playReported = false;
        this.playBtn = document.getElementById('play-pause-btn');
        this.bounceInterval = null;

        // Инициализируем плееры
        this.playerA = document.getElementById('player-A');
        this.playerB = document.getElementById('player-B');
        this.activePlayer = this.playerA;
        this.preloadPlayer = this.playerB;

        // Навешиваем обработчики
        this.playerA.addEventListener('ended', () => this.next());
        this.playerB.addEventListener('ended', () => this.next());
        this.playerA.addEventListener('timeupdate', () => this.updateProgress());
        this.playerB.addEventListener('timeupdate', () => this.updateProgress());
        this.playerA.addEventListener('play', () => this.play());
        this.playerB.addEventListener('play', () => this.play());
        this.playerA.addEventListener('pause', () => this.pause());
        this.playerB.addEventListener('pause', () => this.pause());

        // Буферизация — визуальная обратная связь, пока трек грузится
        // (особенно заметно сразу после переключения, когда player.load()
        // сбрасывает буфер). Показываем только для активного плеера —
        // фоновый может грузиться незаметно.
        const onWaiting = (e) => {
            if (e.target === this.activePlayer) this.playBtn.classList.add('buffering');
        };
        const onReady = (e) => {
            if (e.target === this.activePlayer) this.playBtn.classList.remove('buffering');
        };
        this.playerA.addEventListener('waiting', onWaiting);
        this.playerB.addEventListener('waiting', onWaiting);
        this.playerA.addEventListener('canplay', onReady);
        this.playerB.addEventListener('canplay', onReady);
        this.playerA.addEventListener('playing', onReady);
        this.playerB.addEventListener('playing', onReady);

        window.matchMedia('(orientation: portrait)').addEventListener('change', (e) => {
            this.karaoke = e.matches;
            // Иначе оверлей караоке остаётся от прошлой ориентации,
            // пока плеер сам не пришлёт timeupdate.
            if (document.getElementById('lyrics-overlay-text')) this.updateProgress();
        });
        const progressContainer = document.getElementById('progress-container');
        progressContainer.addEventListener('click', (e) => {
            const rect = progressContainer.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            const player = this.getActive();
            player.currentTime = percent * player.duration;
        });        

        // Кнопки управления
        this.playBtn.addEventListener('click', () => this.togglePlay());
        document.getElementById('prev-btn').addEventListener('click', () => this.prev());
        document.getElementById('next-btn').addEventListener('click', () => this.next());

        // Начинаем с нужного трека
        this.switchTo(startIndex, true);
    }
    
    play() {
        this.playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        this.startBounce();
    }
    pause() {
        this.playBtn.innerHTML = '<i class="fas fa-play"></i>';
        this.stopBounce();
    }

    getActive() { return this.activePlayer; }

    switchTo(index) {
        if (index < 0) return;
        if (index >= this.tracks.length) {
            location.href = 'finale.html';
            return;
        }
        
        const track = this.tracks[index];

        const player = this.getActive();
        const handed = player.dataset.handoff === '1';
        if (handed) {
            delete player.dataset.handoff;
        } else {
            player.src = track.audio;
            player.load();
        }
        
        this.playReported = false;
        this.currentIndex = index;

        //для share-btn
        window.CURRENT_TRACK_SLUG = track.slug;
        window.CURRENT_TRACK_ID = track.id;
        safeYm('reachGoal', 'track_view', { album: window.ALBUM_SLUG, track: window.CURRENT_TRACK_SLUG });
        
        this.updateUI(track);
        
        setTimeout(() => {
            initVolumeControl(null, 'albumPlayer', 1);
            if (handed) {
                if (!player.paused) this.play();
            } else {
                this.activePlayer.play().catch(() => {});
            }
        }, 10);
        
        history.replaceState(null, '', `track-${index + 1}.html`);
    }

    next() {
        this.switchTo(this.currentIndex + 1);
    }

    prev() {
        this.switchTo(this.currentIndex - 1);
    }

    togglePlay() {
        const player = this.getActive();
        if (player.paused) {
            player.play().catch(() => {});
        } else {
            player.pause();
        }
    }

    syncStageVideo(track) {
        const stage = document.querySelector('.stage-visual');
        if (!stage) return;
        stage.classList.remove('video-active');
        const clip = stage.querySelector(':scope > video');
        if (clip) {
            clip.pause();
            clip.remove();
        }
        let btn = stage.querySelector(':scope > .media-video-toggle');
        if (track.video) {
            stage.dataset.video = track.video;
            if (!btn) {
                btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'media-video-toggle';
                const overlay = stage.querySelector('.lyrics-overlay');
                stage.insertBefore(btn, overlay);
            }
            btn.innerHTML = '<i class="fas fa-play"></i>';
            btn.setAttribute('aria-label', 'Смотреть видео');
            btn.classList.remove('loading');
            btn.disabled = false;
        } else if (typeof track.video === 'string') {
            delete stage.dataset.video;
            if (btn) btn.remove();
        }
    }

    updateUI(track) {
        document.getElementById('track-num-display').textContent = `Сцена ${(this.currentIndex+1)}`;
        document.getElementById('track-title-display').textContent = track.title;
        document.getElementById('track-meta-display').textContent = (track.is_instrumental ? 'Инструментал' : 'Вокал') + ' · ' + formatDuration(track.duration);
        document.getElementById('track-authors-display').textContent = track.authors;
        document.getElementById('track-artists-display').textContent = track.artists;

        const prevBtn = document.getElementById('prev-btn');
        if (this.currentIndex > 0) {
            prevBtn.disabled = false;
        } else {
            prevBtn.disabled = true;
        }
        const nextBtn = document.getElementById('next-btn');
        if (this.currentIndex < this.tracks.length - 1) {
            nextBtn.innerHTML = '<i class="fas fa-forward-step"></i>';
        } else {
            nextBtn.innerHTML = '<i class="fas fa-mask"></i>';
        }   

        // Обложка
        const overlayText = document.getElementById('lyrics-overlay-text');
        function applyColor() {
            try {
                const best = getKaraokeVibrantContrastColor(coverImg);
                overlayText.style.color = best.hex;
            } catch (e) {
                // Битая или ещё пустая обложка не должна обрывать сцену:
                // ниже этой функции обновляются текст, видео и эмоции.
                overlayText.style.color = '#FFD700';
            }
        }
        const coverImg = document.querySelector('.stage-visual img');
        coverImg.src = track.cover;
        coverImg.alt = track.title;
        if (coverImg.complete) {
            applyColor();
        } else {
            coverImg.addEventListener('load', applyColor, { once: true });
        }
        this.syncStageVideo(track);        

        // Текст и таймкоды
        const lyricsContainer = document.getElementById('lyrics-container');
        lyricsContainer.innerHTML = '<p class="no-lyrics"><i class="fas fa-music"></i> Инструментальная композиция</p>';
        overlayText.innerHTML = '';        
        if (track.lyrics_timed && track.lyrics_timed.length) {
            lyricsContainer.innerHTML = '';
            track.lyrics_timed.forEach(item => {
                const p = document.createElement('p');
                p.className = 'lyric-line';
                p.textContent = item.text;
                lyricsContainer.appendChild(p);
            });
        }

        this.renderEmotions(track);
    }

    renderEmotions(track) {
        const container = document.getElementById('emotion-container');
        container.innerHTML = '';
        const savedEmotions = getTrackEmotions(track.id);

        const containerLegend = document.getElementById('emotion-legend');
        containerLegend.innerHTML = Object.entries(window.EMOTION_MAP)
            .map(([code, data]) => `${data.emoji} ${data.name}`)
            .join(' · ');

        Object.entries(window.EMOTION_MAP).forEach(([code, data]) => {
            const btn = document.createElement('span');
            btn.className = 'emotion-option';
            btn.textContent = data.emoji;
            btn.title = data.name;
            btn.dataset.emotion = code;
            if (savedEmotions.includes(code)) btn.classList.add('selected');
            
            btn.addEventListener('click', () => {
                btn.classList.toggle('selected');
                const isAdding = btn.classList.contains('selected');
                const current = getTrackEmotions(track.id);
                const updated = btn.classList.contains('selected') ? [...current, code] : current.filter(c => c !== code);
                setTrackEmotions(track.id, updated);
                safeYm('reachGoal', isAdding ? 'emotion_add' : 'emotion_remove', {
                    album: window.ALBUM_SLUG,
                    track: window.CURRENT_TRACK_SLUG,
                    emotion: code
                });
                apiRequest('reactions', { release_id: ALBUM_ID, track_id: track.id, emotions: updated });
                logEvent(isAdding ? 'reaction_add' : 'reaction_remove', 'track', track.id);
            });
            container.appendChild(btn);
        });
    }

    startBounce() {
        this.stopBounce();
        this.bounceInterval = setInterval(() => {
            const track = this.tracks[this.currentIndex];
            const suggested = track.suggested_emotions;
            if (!suggested || !suggested.length) return;
            
            const code = suggested[Math.floor(Math.random() * suggested.length)];
            if (!/^[A-G]$/.test(code)) return;
            const el = document.querySelector(`.emotion-option[data-emotion="${code}"]`);
            if (el) {
                el.classList.add('bounce');
                setTimeout(() => el.classList.remove('bounce'), 600);
            }
        }, 2000);
    }

    stopBounce() {
        if (this.bounceInterval) {
            clearInterval(this.bounceInterval);
            this.bounceInterval = null;
        }
    }

    updateProgress() {
        const player = this.getActive();
        const bar = document.getElementById('progress-bar');
        const pct = (player.currentTime / player.duration) * 100;
        bar.style.width = (isNaN(pct) ? 0 : pct) + '%';
        
        //фиксируем что трек проигран
        if (!this.playReported && (player.currentTime >= 10 || pct >= 25)) {
            this.playReported = true;
            safeYm('reachGoal', 'track_play', {
                album: window.ALBUM_SLUG,
                track: window.CURRENT_TRACK_SLUG
            });
            logEvent('play', 'track', window.CURRENT_TRACK_ID);
        }
        
        const lyricsLines = document.querySelectorAll('.lyric-line');
        const overlayText = document.getElementById('lyrics-overlay-text');
        const track = this.tracks[this.currentIndex];
        
        const t = player.currentTime;
        let active = -1;
        for (let i = track.lyrics_timed.length - 1; i >= 0; i--) {
            if (track.lyrics_timed[i].time <= t) {
                active = i;
                break;
            }
        }            

        if (this.karaoke) {
            const start = Math.max(0, active - 2);
            const end = Math.min(track.lyrics_timed.length, start + 5);
            overlayText.replaceChildren();
            for (let i = start; i < end; i++) {
                if (!lyricsLines[i]) continue;
                const line = document.createElement('div');
                line.className = 'lyrics-overlay-line' + (i === active ? ' highlight' : '');
                line.textContent = lyricsLines[i].textContent.trim();
                overlayText.appendChild(line);
            }
        } else {
            overlayText.innerHTML = '';
            lyricsLines.forEach((el, i) => {
                el.classList.toggle('highlight', i === active);
            });
            if (active >= 0) {
                lyricsLines[active].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }          
        }
    }

    updateVolume(value=null) {
        if (value !== null) {
            this.volume = value;
        }
        const player = this.getActive();
        player.volume = this.volume;
    }
}


/**
 * Вычисляет насыщенный контрастный цвет текста для караоке/субтитров.
 * Использует WCAG 2.1 метрику контраста + алгоритм сохранения насыщенности.
 * 
 * @param {HTMLImageElement|HTMLVideoElement|HTMLCanvasElement} source - Источник пикселей
 * @param {Object} opts - Настройки
 * @returns {{ hex: string, rgb: string, hsl: {h:number,s:number,l:number}, bg: {r,g,b}, contrastRatio: number }}
 */
function getKaraokeVibrantContrastColor(source, opts = {}) {
  const {
    region = { x: 0.2, y: 0.3, w: 0.6, h: 0.4 },   // зона анализа
    step = 4,                                      // шаг сэмплирования
    targetSaturation = 80,                         //% минимальная насыщенность
    minContrast = 5                                // WCAG AA порог
  } = opts;

  // ─── 1. Сэмплирование фона ───
  const srcW = source.naturalWidth || source.videoWidth || source.width;
  const srcH = source.naturalHeight || source.videoHeight || source.height;
  if (!srcW || !srcH) throw new Error('Источник не загружен или имеет нулевые размеры');

  const canvas = document.createElement('canvas');
  canvas.width = 1; canvas.height = 1; // минимальный буфер
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const sx = Math.floor(srcW * region.x);
  const sy = Math.floor(srcH * region.y);
  const sw = Math.floor(srcW * region.w);
  const sh = Math.floor(srcH * region.h);

  canvas.width = sw; canvas.height = sh;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  const { data } = ctx.getImageData(0, 0, sw, sh);

  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (let i = 0; i < data.length; i += 4 * step) {
    if (data[i + 3] < 128) continue; // игнорируем полупрозрачные пиксели
    rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2];
    count++;
  }
  if (count === 0) return { hex: '#FFD700', rgb: 'rgb(255,215,0)', hsl: { h: 50, s: 100, l: 50 }, bg: { r: 0, g: 0, b: 0 }, contrastRatio: 0 };

  const bgR = Math.round(rSum / count);
  const bgG = Math.round(gSum / count);
  const bgB = Math.round(bSum / count);
  const bgHSL = rgbToHsl(bgR, bgG, bgB);

  // ─── 2. Генерация кандидатов ───
  // Ищем цвет с комплементарным/сплит-комплементарным оттенком и высокой насыщенностью
  const candidates = [
    { h: (bgHSL.h + 180) % 360, s: targetSaturation },   // прямой комплементарный
    { h: (bgHSL.h + 150) % 360, s: targetSaturation },   // сплит 1
    { h: (bgHSL.h + 210) % 360, s: targetSaturation },   // сплит 2
    { h: bgHSL.h,               s: Math.min(targetSaturation + 20, 95) } // тот же оттенок, но ярче
  ];

  let best = { hex: '#FFFFFF', rgb: 'rgb(255,255,255)', hsl: { h: 0, s: 0, l: 100 }, contrastRatio: 0 };
  const bgLum = relativeLuminance(bgR / 255, bgG / 255, bgB / 255);

  // Перебираем яркость от 5% до 95% с шагом 5%
  for (const cand of candidates) {
    for (let l = 5; l <= 95; l += 5) {
      const { r, g, b } = hslToRgb(cand.h, cand.s, l);
      const textLum = relativeLuminance(r / 255, g / 255, b / 255);
      const ratio = (Math.max(bgLum, textLum) + 0.05) / (Math.min(bgLum, textLum) + 0.05);

      if (ratio > best.contrastRatio) {
        best = {
          hex: rgbToHex(r, g, b),
          rgb: `rgb(${r},${g},${b})`,
          hsl: { h: cand.h, s: cand.s, l },
          contrastRatio: ratio
        };
      }
      // Если достигли безопасного контраста и насыщенность высокая - можно остановиться (оптимизация)
      if (ratio >= minContrast && cand.s >= targetSaturation) break;
    }
  }

  best.bg = { r: bgR, g: bgG, b: bgB };
  return best;
}

// ─── Вспомогательные математические функции (встроены для производительности) ───
function sRGBtoLinear(c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function relativeLuminance(r, g, b) { return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b); }
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}
function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}
function rgbToHex(r, g, b) {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

window.albumPlayer = new AlbumPlayer(window.ALBUM_TRACKS, window.CURRENT_TRACK_INDEX);
