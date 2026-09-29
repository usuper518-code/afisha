<?php
//rate-album.php
if ($method !== 'POST') {
    jsonError('Метод не разрешен', 405);
}

// POST — отправка оценки
$data = getRequestBody();
$sessionId = getClientId();
$releaseId = (int) ($data['release_id'] ?? 0);
$rating = (int) ($data['rating'] ?? 0);

if (!$sessionId) {
    jsonError('Не передан идентификатор клиента', 400);
}
if (!$releaseId) {
    jsonError('Необходим ИД релиза', 400);
}
if ($rating < 1 || $rating > 7) {
    jsonError('Рейтинг должен быть от 1 до 7', 400);
}

$pdo = getDB();
$userId = getOrCreateUser($pdo, $sessionId);

$stmt = $pdo->prepare("INSERT INTO ratings (release_id, user_id, rating) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE rating = VALUES(rating)");
$stmt->execute([$releaseId, $userId, $rating]);

$stmt = $pdo->prepare("INSERT INTO events (user_id, event_type, entity_type, entity_id) VALUES (?, ?, ?, ?)");
$stmt->execute([$userId, 'rating', 'release', $releaseId]);

jsonResponse(['success' => true]);
