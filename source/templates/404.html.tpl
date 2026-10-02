<!DOCTYPE html>
<!-- 404.html.tpl -->
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
    <div class="container">
        <div class="page-404">
            <div class="page-404-icon">
                <i class="fas fa-masks-theater"></i>
            </div>
            <h1 class="page-404-title">404</h1>
            <p class="page-404-text">Сцена пуста. Страница не найдена.</p>
            <p class="finale-exit"><a href="/"><i class="fas fa-home"></i> Вернуться к афише</a></p>
        </div>
    </div>
    <canvas id="dust-canvas" aria-hidden="true" class="canvas"></canvas>
    <script>
        window.METRIKA_ID = {{METRIKA_ID}};
    </script>
    <script src="/js/common.js"></script>
</body>
</html>
