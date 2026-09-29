<?php

$pdo = getDB();

if ($method === 'GET') {
    // Общая статистика из events
    $totalPlays = $pdo->query("SELECT COUNT(*) FROM events WHERE event_type = 'play'")->fetchColumn();
    $totalLikes = $pdo->query("SELECT COUNT(*) FROM events WHERE event_type = 'like'")->fetchColumn();
    $totalShares = $pdo->query("SELECT COUNT(*) FROM events WHERE event_type = 'share'")->fetchColumn();
    $uniqueListeners = $pdo->query("SELECT COUNT(DISTINCT user_id) FROM events")->fetchColumn();
    $active30d = $pdo->query("SELECT COUNT(DISTINCT user_id) FROM events WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)")->fetchColumn();

    // Топ треков по прослушиваниям
    $stmtTop = $pdo->query("SELECT t.id, t.title, 
                            (SELECT COUNT(*) FROM events WHERE event_type = 'play' AND entity_type = 'track' AND entity_id = t.id) AS plays,
                            (SELECT COUNT(*) FROM events WHERE event_type = 'like' AND entity_type = 'track' AND entity_id = t.id) AS likes
                            FROM tracks t
                            WHERE t.is_published = 1
                            ORDER BY plays DESC LIMIT 10");
    $topTracks = $stmtTop->fetchAll(PDO::FETCH_ASSOC);

    // Топ жанров по прослушиваниям
    $stmtGenre = $pdo->query("SELECT g.name, COUNT(e.id) AS plays
                              FROM genres g
                              JOIN track_genre tg ON g.id = tg.genre_id
                              JOIN events e ON tg.track_id = e.entity_id
                              WHERE e.event_type = 'play' AND e.entity_type = 'track'
                              GROUP BY g.id ORDER BY plays DESC LIMIT 5");
    $topGenres = $stmtGenre->fetchAll(PDO::FETCH_ASSOC);

    // Прослушивания по дням (последние 30 дней)
    $stmtDays = $pdo->query("SELECT DATE(created_at) AS date, COUNT(*) AS count
                             FROM events 
                             WHERE event_type = 'play' AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
                             GROUP BY DATE(created_at) ORDER BY date");
    $playsByDay = $stmtDays->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse([
        'overview' => [
            'total_plays' => (int) $totalPlays,
            'total_likes' => (int) $totalLikes,
            'total_shares' => (int) $totalShares,
            'unique_listeners' => (int) $uniqueListeners,
            'active_listeners_30d' => (int) $active30d
        ],
        'top_tracks' => $topTracks,
        'top_genres' => $topGenres,
        'plays_by_day' => $playsByDay
    ]);
}
jsonError('Метод не разрешен', 405);
