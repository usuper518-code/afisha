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

    $stmt = $pdo->prepare("SELECT content, status FROM reviews WHERE release_id = ? AND user_id = ?");
    $stmt->execute([$releaseId, $userId]);
    $review = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($review) {
        jsonResponse(['review' => $review['content'], 'status' => $review['status']]);
    } else {
        jsonResponse(['review' => null, 'status' => null]);
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

    // Отправляем email с благодарностью и ссылкой на буклет, если нужно
    if ($email && $wantBooklet) {
        // Получаем данные альбома для письма
        $stmtAlbum = $pdo->prepare("SELECT title, slug FROM releases WHERE id = ?");
        $stmtAlbum->execute([$releaseId]);
        $release = $stmtAlbum->fetch(PDO::FETCH_ASSOC);

        if (!$release || !defined('MAIL_FROM') || MAIL_FROM === '') {
            jsonResponse(['success' => true]);
        }

        $title = str_replace(["\r", "\n"], ' ', (string) ($release['title'] ?? ''));
        $slug = str_replace(["\r", "\n"], '', (string) ($release['slug'] ?? ''));
        $subject = mb_encode_mimeheader('Спасибо за ваш отзыв! Буклет спектакля «' . $title . '»', 'UTF-8');

        $bookletUrl = BASE_URL . '/albums/' . rawurlencode($slug) . '/booklet.pdf';

        $message = "Здравствуйте, {$nickname}!\n\n";
        $message .= "Спасибо за ваш отзыв о спектакле «{$release['title']}».\n";
        $message .= "Ваш буклет доступен по ссылке: {$bookletUrl}\n\n";
        if ($subscribe) {
            $message .= "Вы подписаны на рассылку анонсов. Будем сообщать о новых премьерах!\n";
        }
        $message .= "С уважением, " . SITE_TITLE;

        $headers = "From: " . MAIL_FROM . "\r\n" .
                "Reply-To: " . MAIL_FROM . "\r\n" .
                "Content-Type: text/plain; charset=UTF-8";

        mail($email, $subject, $message, $headers);
    }

    jsonResponse(['success' => true]);
}
jsonError('Метод не разрешен', 405);
