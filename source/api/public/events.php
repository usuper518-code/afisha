<?php
//events.php
if ($method !== 'POST') {
    jsonError('Метод не разрешен', 405);
}

// POST — отправка события
$data = getRequestBody();
$sessionId  = getClientId();
$eventType  = $data['event_type'] ?? '';
$entityType = $data['entity_type'] ?? '';
$entityId   = (int) ($data['entity_id'] ?? 0);

if (!$sessionId) {
    jsonError('Не передан идентификатор клиента', 400);
}
if (!$eventType || !$entityType || !$entityId) {
    jsonError('Ошибка полноты данных', 400);
}

// Допустимые типы событий
$allowedEvents = ['play', 'rating', 'review', 'reaction_add', 'reaction_remove', 'share'];
if (!in_array($eventType, $allowedEvents)) {
    jsonError('Недопустимый тип события', 400);
}

// Допустимые типы сущностей
$allowedEntities = ['release', 'track'];
if (!in_array($entityType, $allowedEntities)) {
    jsonError('Недопустимый тип сущности', 400);
}

$pdo = getDB();
$userId = getOrCreateUser($pdo, $sessionId);

$stmt = $pdo->prepare("INSERT INTO events (user_id, event_type, entity_type, entity_id) VALUES (?, ?, ?, ?)");
$stmt->execute([$userId, $eventType, $entityType, $entityId]);
jsonResponse(['success' => true]);