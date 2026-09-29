<?php
//news.php
if ($method !== 'GET') {
    jsonError('Метод не разрешен', 405);
}

// GET — получить новости
$pdo = getDB();
$stmt = $pdo->query("SELECT title, content, created_at FROM news WHERE is_published = 1 ORDER BY created_at DESC LIMIT 5");
$news = $stmt->fetchAll(PDO::FETCH_ASSOC);

jsonResponse(['success' => true, 'data' => $news]);