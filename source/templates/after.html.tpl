<!DOCTYPE html>
<!-- after.html.tpl -->
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
                <h1 class="finale-title">После спектакля</h1>
                <h1 class="album-title">{{ALBUM_TITLE}}</h1>

                <div class="feedback-section old-paper-css">
                    <form class="feedback-form" id="feedback-form">
                        <div class="form-group">
                            <label>Ваше имя</label>
                            <input type="text" name="name" required autofocus>
                        </div>

                        <div class="form-group">
                            <label>Email (для буклета)</label>
                            <input type="email" name="email" placeholder="user@example">
                        </div>

                        <div class="checkbox-group">
                            <input type="checkbox" name="want_booklet" id="want_booklet" checked>
                            <label for="want_booklet">Получить буклет спектакля на почту</label>
                        </div>

                        <div class="checkbox-group">
                            <input type="checkbox" name="subscribe" id="subscribe" checked>
                            <label for="subscribe">Присылать приглашения на будущие премьеры</label>
                        </div>

                        <div class="form-group">
                            <label>Отзыв, если хотите</label>
                            <textarea name="review" rows="4" placeholder="Можно не писать"></textarea>
                        </div>

                        <div class="form-actions">
                            <p class="action-hint"></p>
                            <button type="submit" class="album-btn album-btn-primary">Отправить</button>
                        </div>
                    </form>
                </div>

                <div class="finale-actions">
                    <a href="finale.html" class="album-btn"><i class="fas fa-chevron-left"></i> К занавесу</a>
                </div>
                <p class="finale-exit"><a href="/"><i class="fas fa-home"></i> Вернуться к афише</a></p>                
            </main>
            {{FOOTER}}    
        </div>
        <canvas id="dust-canvas" aria-hidden="true" class="canvas"></canvas>
        
<svg style="display:none">
  <filter id="old-paper-grain" x="-5%" y="-5%" width="110%" height="110%">
    <!-- Шум -->
    <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" stitchTiles="stitch" result="noise"/>
    <!-- Делаем шум монохромным и слегка тёплым -->
    <feColorMatrix type="saturate" values="0" result="bw"/>
    <feColorMatrix type="matrix" values="
      1.05 0 0 0 0
      0 1.00 0 0 0
      0 0 0.95 0 0
      0 0 0 0.15 0" in="bw" result="tint"/>
    <!-- Накладываем на фон -->
    <feBlend in="SourceGraphic" in2="tint" mode="multiply"/>
  </filter>
</svg>
     
        <script>
            window.ALBUM_ID = {{ALBUM_ID}};
            window.ALBUM_SLUG = {{ALBUM_SLUG_JS}};
            window.METRIKA_ID = {{METRIKA_ID}};
        </script>            
        <script src="/js/common.js"></script>
        <script src="/js/album.js"></script>
    </body>
</html>