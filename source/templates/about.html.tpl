<!DOCTYPE html>
<!-- about.html.tpl -->
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
                
            <main class="about-page">
                <div class="about-section">
                    <h2>Манифест</h2>
                    <p>{{ABOUT_TEXT}}</p>
                </div>
                <div class="about-section">
                    <h2>Труппа</h2>
                    <div class="troupe-grid">
                        {{TROUPE_GRID}}
                    </div>
                </div>
                <div class="about-section">
                    <h2>Автор</h2>
                    <p class="author-name">{{AUTHOR_NAME}}</p>
                    {{AUTHOR_BIO}}
                </div>
                <a href="/" class="back-link"><i class="fas fa-arrow-left"></i> Вернуться к афише</a>
            </main>
            {{FOOTER}}
        </div>
        <script>
            window.METRIKA_ID = {{METRIKA_ID}};
        </script>
        <script src="/js/common.js"></script>
        <script src="/js/afisha.js"></script>
    </body>
</html>