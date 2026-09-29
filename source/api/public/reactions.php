<?php
//reactions.php
if ($method !== 'POST') {
    jsonError('Метод не разрешен', 405);
}

// POST — отправка реакции
$data = getRequestBody();
$sessionId = getClientId();
$releaseId = (int) ($data['release_id'] ?? 0);
$trackId   = (int) ($data['track_id'] ?? 0);
$emotions  = $data['emotions'] ?? [];

if (!$sessionId) {
    jsonError('Не передан идентификатор клиента', 400);
}
if (!$releaseId) {
    jsonError('Необходим ИД релиза', 400);
}
if (!$trackId) {
    jsonError('Необходим ИД трека', 400);
}
if (!is_array($emotions)) {
    jsonError('Поле emotions должно быть массивом', 400);
}

// Допустимые эмоции
$emotionFields = EMOTION_MAP;
$emotions = array_unique(array_intersect($emotions, array_keys($emotionFields)));

$pdo = getDB();
$userId = getOrCreateUser($pdo, $sessionId);

// Удаляем старую запись, если есть
$stmtDel = $pdo->prepare("DELETE FROM reactions WHERE release_id = ? AND track_id = ? AND user_id = ?");
$stmtDel->execute([$releaseId, $trackId, $userId]);

if (!empty($emotions)) {
    // Формируем поля и значения для INSERT
    $columns = ['release_id', 'track_id', 'user_id'];
    $values = [$releaseId, $trackId, $userId];
    foreach (array_keys($emotionFields) as $code) {
        $columns[] = "emotion_$code";
        $values[] = in_array($code, $emotions) ? 1 : 0;
    }

    $placeholders = implode(',', array_fill(0, count($values), '?'));
    $sql = "INSERT INTO reactions (" . implode(',', $columns) . ") VALUES ($placeholders)";
    $stmtInsert = $pdo->prepare($sql);
    $stmtInsert->execute($values);
}

jsonResponse(['success' => true]);