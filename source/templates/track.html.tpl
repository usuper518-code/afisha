<!DOCTYPE html>
<!-- track.html.tpl -->
<html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        {{META}}
        <link rel="stylesheet" href="/css/all.min.css">
        <link rel="stylesheet" href="/css/common.css">
        <link rel="stylesheet" href="/css/album.css">
        {{THEME_CSS}}
    </head>
    <body>
        <div id="preloader"></div>
        <audio id="player-A" preload="none" style="display:none"></audio>
        <audio id="player-B" preload="none" style="display:none"></audio>
        
        <div class="container track-page">
            <nav class="breadcrumbs">
                <a href="index.html"><i class="fas fa-theater-masks"></i> {{ALBUM_TITLE}}</a>
                <span class="separator">/</span>
                <span id="track-num-display">Сцена {{TRACK_NUM}}</span>
            </nav>

            <main class="track-layout">
                <div class="lyrics-column" id="lyrics-column">
                    <div class="lyrics-header">
                        <h2 class="track-page-title" id="track-title-display">{{TRACK_TITLE}}</h2>
                        <p class="track-page-meta" id="track-meta-display">{{VOCAL_TYPE}} · {{TRACK_DURATION}}</p>
                    </div>
                    <div class="lyrics-text" id="lyrics-container"></div>
                    <div class="scroll-buttons" data-scroll-target="lyrics-container" style="display:none;">
                        <button class="scroll-btn scroll-up" title="Прокрутить вверх">
                            <i class="fas fa-chevron-up"></i>
                        </button>
                        <button class="scroll-btn scroll-down" title="Прокрутить вниз">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div> 
                </div>

                <div class="stage-column">
                    <div class="stage-visual"{{TRACK_VIDEO_ATTR}}>
                        <img src="{{TRACK_COVER}}" alt="{{TRACK_TITLE}}">
                        {{TRACK_VIDEO_BTN}}
                        <!-- Оверлей для караоке-лирики (виден только на мобильных) -->
                        <div class="lyrics-overlay" id="lyrics-overlay">
                            <div class="lyrics-overlay-text" id="lyrics-overlay-text"></div>
                        </div>
                    </div>
                    <div class="player-section">
                        <div class="progress-container" id="progress-container">
                            <div class="progress-bar" id="progress-bar"></div>
                        </div>

                        <div class="player-controls-custom">
                            <button id="prev-btn" class="nav-btn" {{PREV_DISABLED}}><i class="fas fa-backward-step"></i></button>
                            <button id="play-pause-btn" class="play-pause-btn"><i class="fas fa-play"></i></button>
                            <button id="next-btn" class="nav-btn"><i class="fas fa-forward-step"></i></button>
                        </div>
                        <div class="emotion-selector-container">
                            <p class="emotion-selector-label">Что чувствуете?</p>
                            <div class="emotion-legend" id="emotion-legend"></div>
                            <div class="emotion-selector" id="emotion-container"></div>
                        </div>

                        <div class="track-credits">
                            <span class="track-authors" id="track-authors-display">Автор: {{AUTHORS}}</span>
                            <span class="track-artists" id="track-artists-display">Исполняют: {{ARTISTS}}</span>
                        </div>

                        <div class="finale-actions">
                            <a href="index.html" class="album-btn"><i class="fas fa-arrow-up"></i> К программе</a>
                            <button class="album-btn" id="share-btn"><i class="fas fa-share-alt"></i> Поделиться</button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
        <div id="volume-control" title="Громкость">
            <i class="fas fa-volume-xmark"></i>
        </div>
        <canvas id="dust-canvas" aria-hidden="true" class="canvas"></canvas>
        <script>
            window.ALBUM_ID = {{ALBUM_ID}};
            window.ALBUM_SLUG = '{{ALBUM_SLUG}}';
            window.METRIKA_ID = {{METRIKA_ID}};
            
            window.CURRENT_TRACK_INDEX = {{CURRENT_TRACK_INDEX}};
            window.EMOTION_MAP = {{EMOTION_MAP_JSON}};
            window.ALBUM_TRACKS = {{ALBUM_TRACKS_JSON}};
            
            window.CURRENT_TRACK_ID = {{TRACK_ID}}; 
            window.CURRENT_TRACK_SLUG = '{{TRACK_SLUG}}';
        </script>                        
        <script src="/js/common.js"></script>
        <script src="/js/player.js"></script>
    </body>
</html>