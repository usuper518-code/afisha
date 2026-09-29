<!DOCTYPE html>
<!-- finale.html.tpl -->
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
        
        <div class="container">
            {{HEADER}}
            <main class="finale-scene">
                <div class="finale-icon"><i class="fas fa-mask"></i></div>
                <h1 class="finale-title">ЗАНАВЕС</h1>
                <h1 class="album-title">{{ALBUM_TITLE}}</h1>
                
                <p class="finale-message">Представление окончено.</p>

                <div class="applause-container">
                    <p class="applause-label">Аплодисменты альбому</p>
                    <div class="palms">
                        <span class="palm" data-rating="1">👏</span>
                        <span class="palm" data-rating="2">👏</span>
                        <span class="palm" data-rating="3">👏</span>
                        <span class="palm" data-rating="4">👏</span>
                        <span class="palm" data-rating="5">👏</span>
                    </div>
                    <div class="bravo-bis">
                        <button class="btn-bravo" data-rating="6">✦ БРАВО ✦</button>
                        <button class="btn-bis" data-rating="7">✦ БИС ✦</button>
                    </div>
                </div>

                <div class="finale-emotions-container">
                    <p class="emotion-selector-label">Ваши эмоции</p>
                    <div id="finale-emotions-table"></div>
                </div>

                <div class="finale-actions">
                    <a href="after.html" class="album-btn"><i class="fas fa-book"></i> Оставить отзыв и получить буклет</a>
                    <a href="/" class="album-btn"><i class="fas fa-home"></i> Вернуться к афише</a>
                </div>
            </main>
            {{FOOTER}}
        </div>
        <canvas id="dust-canvas" aria-hidden="true" class="canvas"></canvas>
        <script>
            window.ALBUM_ID = {{ALBUM_ID}};
            window.ALBUM_SLUG = '{{ALBUM_SLUG}}';
            window.METRIKA_ID = {{METRIKA_ID}};
            
            window.ALBUM_TRACKS = {{TRACKS_JSON}};
            window.EMOTION_MAP = {{EMOTION_MAP_JSON}};
        </script>
        <script src="/js/common.js"></script>
        <script src="/js/album.js"></script>
    </body>
</html>