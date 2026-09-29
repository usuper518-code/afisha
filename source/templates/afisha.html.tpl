<!DOCTYPE html>
<!-- afisha.html.tpl -->
<html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        {{META}}
        <link rel="stylesheet" href="/css/all.min.css">
        <link rel="stylesheet" href="/css/common.css">
        <link rel="stylesheet" href="/css/afisha.css">
        {{THEME_CSS}}
    </head>
    <body>
        <div id="preloader"></div>
        
        <div class="container">
            {{HEADER}}
            <nav class="program-nav" role="tablist" aria-label="Разделы программки">
                {{PROGRAM_NAV}}
            </nav>
            <main class="program-viewport">
                {{PROGRAM_PANELS}}
                <button type="button" class="spread-nav spread-prev" aria-label="Предыдущий разворот" hidden>
                    <i class="fas fa-chevron-left"></i>
                </button>
                <button type="button" class="spread-nav spread-next" aria-label="Следующий разворот" hidden>
                    <i class="fas fa-chevron-right"></i>
                </button>
                <div class="spread-dots" hidden></div>
            </main>
            {{FOOTER}}
        </div>
        <canvas id="dust-canvas" aria-hidden="true" class="canvas"></canvas>
        <canvas id="fire-canvas" aria-hidden="true" class="canvas"></canvas>
        <canvas id="curtain-canvas_"></canvas>
        <!--
        <div class="hint" id="hint">Нажмите, чтобы открыть занавес</div>
        -->
        <script>
            window.ALBUM_ID = {{ALBUM_ID}};
            window.ALBUM_SLUG = '{{ALBUM_SLUG}}';
            window.METRIKA_ID = {{METRIKA_ID}};
        </script>
        <script src="/js/common.js"></script>
        <script src="/js/afisha.js"></script>
    </body>
</html>