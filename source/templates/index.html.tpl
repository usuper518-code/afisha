<!DOCTYPE html>
<!-- index.html.tpl -->
<html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        {{META}}
        <link rel="stylesheet" href="/css/all.min.css">
        <link rel="stylesheet" href="/css/common.css">
        <link rel="stylesheet" href="/css/afisha.css">
        <link rel="stylesheet" href="/css/album.css">
        {{THEME_CSS}}
    </head>
    <body>
        <div id="preloader"></div>

        <audio id="hall-noise" loop preload="auto">
            <source src="/media/hall-noise.mp3" type="audio/mpeg">
        </audio>

        <div class="container">
            {{HEADER}}
            <main>
                <section class="album-premiere">
                    <div class="album-cover-wrapper"{{ALBUM_VIDEO_ATTR}}>
                        <img src="{{ALBUM_COVER}}" alt="{{ALBUM_TITLE}}" class="album-cover">
                        {{ALBUM_VIDEO_BTN}}
                        <div id="badge-container"></div>
                    </div>

                    <h1 class="album-title smolder-text">{{ALBUM_TITLE}}</h1>
                    <p class="album-subtitle">{{ALBUM_SUBTITLE}}</p>

                    <div class="program">
                        <h2 class="program-title"><i class="fas fa-scroll swing-on-hover"></i> Программа</h2>
                        <ul class="tracklist">
                            {{TRACKLIST}}
                        </ul>
                    </div>

                    <div class="album-meta">
                        <span><i class="fas fa-clock"></i> {{DURATION_TOTAL}}</span>
                        <span><i class="fas fa-users"></i> Труппа голосов</span>
                    </div>

                    <p class="album-description">{{ALBUM_DESCRIPTION}}</p>

                    <div class="action-center">
                        <a href="track-1.html" class="btn-premiere" id="action-button" data-audio="{{FIRST_TRACK_AUDIO}}">
                            <i class="fas fa-ticket-alt swing-on-hover"></i> НАЧАТЬ ПРЕДСТАВЛЕНИЕ</a>
                        <p class="action-hint">Занавес открывается...</p>
                        <p class="action-hint">Кликните и услышите шорохи зала...</p>
                    </div>
                    <div class="text-center mt-4">
                        <a href="/" class="album-btn">
                            <i class="fas fa-home swing-on-hover"></i> На афишу
                        </a>
                    </div>
                </section>
                <div id="reviews-container">
                    <!-- Загружается динамически -->
                    <section class="reviews"><h3><i class="fas fa-comment-dots"></i> Голоса из зала</h3>
                        <div class="review-item">
                            <p class="review-text">«Пока тихо»</p>
                            <p class="review-author">Эхо</p>
                        </div>    
                    </section>    
                </div>
            </main>
            {{FOOTER}}
        </div>
        <div id="volume-control" title="Громкость зала">
            <i class="fas fa-volume-xmark"></i>
        </div>
        <!-- Модальное окно «Напомнить» -->
        <div id="remind-modal" class="modal" style="display:none;">
            <div class="modal-content">
                <span class="modal-close">✕</span>
                <h3>Управление подпиской</h3>
                <form id="remind-form">
                    <div class="form-group">
                        <label>Ваше имя</label>
                        <input type="text" id="remind-name" name="name" required>
                    </div>
                    <div class="form-group">
                        <label>Ваш email</label>
                        <input type="email" id="remind-email" name="email" required>
                    </div>
                    <div class="checkbox-group">
                        <input type="checkbox" id="remind-subscribe" name="subscribe" checked>
                        <label for="remind-subscribe">Сообщать о событиях</label>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="album-btn album-btn-primary">Подписаться</button>
                    </div>
                </form>
            </div>
        </div>    
        <canvas id="dust-canvas" aria-hidden="true" class="canvas"></canvas>
        <script>
            window.ALBUM_ID = {{ALBUM_ID}};
            window.ALBUM_SLUG = {{ALBUM_SLUG_JS}};
            window.METRIKA_ID = {{METRIKA_ID}};
            window.EMOTION_MAP = {{EMOTION_MAP_JSON}};
            window.PREMIERE_DATE = {{PREMIERE_DATE_JS}};
        </script>
        <script src="/js/common.js"></script>
        <script src="/js/album.js"></script>
    </body>
</html>