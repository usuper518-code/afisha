<?php

$pdo = getDB();

if ($method === 'GET' && !$id) {
    $limit = (int) ($_GET['limit'] ?? 10);
    $offset = (int) ($_GET['offset'] ?? 0);
    $order = $_GET['order'] ?? 'created_at';
    $direction = strtoupper($_GET['direction'] ?? 'DESC');

    $search = $_GET['search'] ?? null; // поиск по rel.title
    $allowedOrder = ['id', 'album_title', 'track_title', 'user_nickname', 'created_at'];

    // Валидация направления сортировки
    if (!in_array($direction, ['ASC', 'DESC'])) {
        $direction = 'DESC';
    }
    // Валидация поля сортировки
    if (!in_array($order, $allowedOrder)) {
        $order = 'id';
    }

    $sql = "SELECT r.id, r.release_id, r.track_id, r.user_id, r.emotion_A, r.emotion_B, r.emotion_C, r.emotion_D, r.emotion_E, r.emotion_F, r.emotion_G, r.created_at,
                   u.nickname AS user_nickname,
                   rel.title AS release_title,
                   t.title AS track_title
            FROM reactions r
            JOIN users u ON r.user_id = u.id
            JOIN releases rel ON r.release_id = rel.id
            JOIN tracks t ON r.track_id = t.id";
    $whereConditions = [];
    $params = [];
    if ($search) {
        $whereConditions[] = "rel.title LIKE ?";
        $params[] = '%' . $search . '%';
    }
    if ($whereConditions) {
        $sql .= " WHERE " . implode(' AND ', $whereConditions);
    }

    $sql .= " ORDER BY $order $direction LIMIT $limit OFFSET $offset";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $reactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $countSql = "SELECT COUNT(*)
            FROM reactions r
            JOIN users u ON r.user_id = u.id
            JOIN releases rel ON r.release_id = rel.id
            JOIN tracks t ON r.track_id = t.id";
    if ($whereConditions) {
        $countSql .= " WHERE " . implode(' AND ', $whereConditions);
    }
    $stmtCount = $pdo->prepare($countSql);
    $stmtCount->execute($params);
    $total = $stmtCount->fetchColumn();

    jsonResponse(['data' => $reactions, 'total' => (int) $total]);
    return;
}

if ($method === 'DELETE' && $id) {
    $stmt = $pdo->prepare("DELETE FROM reactions WHERE id = ?");
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) {
        jsonError('Реакция не найдена', 404);
    }
    jsonResponse(['success' => true]);
    return;
}

jsonError('Метод не разрешен', 405);
