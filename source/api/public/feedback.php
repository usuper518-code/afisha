<?php
//feedback.php

$sessionId = getClientId();
if (!$sessionId) {
    jsonError('Не передан идентификатор клиента', 400);
}    

// GET — получить старый отзыв пользователя на этот альбом
if ($method === 'GET') {
    $releaseId = (int) ($_GET['release_id'] ?? 0);
    if (!$releaseId) {
        jsonError('Необходим ИД релиза', 400);
    }

    $pdo = getDB();
    $userId = getOrCreateUser($pdo, $sessionId);

    if (!$userId) {
        jsonResponse(['review' => null, 'status' => null]);
    }

    $stmt = $pdo->prepare("SELECT content, status, want_booklet, booklet_sent_at FROM reviews WHERE release_id = ? AND user_id = ?");
    $stmt->execute([$releaseId, $userId]);
    $review = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($review) {
        $booklet = null;
        if (!empty($review['want_booklet'])) {
            $booklet = $review['booklet_sent_at'] ? 'sent' : 'queued';
        }
        jsonResponse([
            'review' => $review['content'],
            'status' => $review['status'],
            'booklet' => $booklet,
        ]);
    } else {
        jsonResponse(['review' => null, 'status' => null, 'booklet' => null]);
    }
}

// POST — отправка отзыва
if ($method === 'POST') {
    enforcePublicRate('feedback', 6, 30, 3600);

    $data = getRequestBody();
    $releaseId = (int) ($data['release_id'] ?? 0);
    $review = trim($data['review'] ?? '');

    if (!$releaseId) {
        jsonError('Необходим ИД релиза', 400);
    }
    if (!$review) {
        jsonError('Необходим текст отзыва', 400);
    }
    if (mb_strlen($review) > 5000) {
        jsonError('Слишком длинный отзыв', 400);
    }

    $nickname = trim($data['name'] ?? '');
    $email = trim($data['email'] ?? '');
    $wantBooklet = !empty($data['want_booklet']);
    $subscribe = !empty($data['subscribe']);

    if (mb_strlen($nickname) > 100) {
        jsonError('Имя слишком длинное', 400);
    }
    if ($email !== '' && !isSafeEmail($email)) {
        jsonError('Некорректный email', 400);
    }
    if ($wantBooklet && $email === '') {
        jsonError('Для получения буклета укажите email', 400);
    }

    $pdo = getDB();
    $userId = getOrCreateUser($pdo, $sessionId, [
        'nickname' => $nickname,
        'email' => $email,
        'subscribe' => $subscribe
    ]);

    $stmt = $pdo->prepare("INSERT INTO reviews (release_id, user_id, content, status, want_booklet) 
                          VALUES (?, ?, ?, 'pending', ?) 
                          ON DUPLICATE KEY UPDATE 
                              content = VALUES(content), 
                              status = 'pending', 
                              want_booklet = VALUES(want_booklet)");
    $stmt->execute([$releaseId, $userId, $review, $wantBooklet ? 1 : 0]);

    $stmt = $pdo->prepare("INSERT INTO events (user_id, event_type, entity_type, entity_id) VALUES (?, ?, ?, ?)");
    $stmt->execute([$userId, 'review', 'release', $releaseId]);

    // Буклет не отправляем отсюда. Именной PDF собирает крон send-booklets.php.
    $booklet = null;
    if ($wantBooklet && $email !== '') {
        $sent = $pdo->prepare("SELECT booklet_sent_at FROM reviews WHERE release_id = ? AND user_id = ?");
        $sent->execute([$releaseId, $userId]);
        $booklet = $sent->fetchColumn() ? 'sent' : 'queued';
    }

    jsonResponse(['success' => true, 'booklet' => $booklet]);
}
jsonError('Метод не разрешен', 405);
