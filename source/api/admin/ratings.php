<?php

$pdo = getDB();

// GET /admin/ratings – список
if ($method === 'GET' && !$id) {
    $limit = (int) ($_GET['limit'] ?? 10);
    $offset = (int) ($_GET['offset'] ?? 0);
    $order = $_GET['order'] ?? 'created_at';
    if ($limit < 1) {
        $limit = 1;
    }
    if ($limit > 50) {
        $limit = 50;
    }
    if ($offset < 0) {
        $offset = 0;
    }
    $direction = strtoupper($_GET['direction'] ?? 'DESC');

    $search = $_GET['search'] ?? null; // поиск по rel.title
    // Белый список разрешённых полей для ORDER BY
    $allowedOrder = ['id', 'rating', 'created_at', 'album_title', 'user_nickname'];

    // Валидация направления сортировки
    if (!in_array($direction, ['ASC', 'DESC'])) {
        $direction = 'DESC';
    }
    // Валидация поля сортировки
    if (!in_array($order, $allowedOrder)) {
        $order = 'id';
    }

    $sql = "SELECT r.id, r.release_id, r.user_id, r.rating, r.created_at,
                   u.nickname AS user_nickname,
                   rel.title AS album_title
            FROM ratings r
            JOIN users u ON r.user_id = u.id
            JOIN releases rel ON r.release_id = rel.id";

    $params = [];
    $whereConditions = [];
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
    $ratings = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Общее количество
    $countSql = "SELECT COUNT(*)
            FROM ratings r
            JOIN users u ON r.user_id = u.id
            JOIN releases rel ON r.release_id = rel.id";
    if ($whereConditions) {
        $countSql .= " WHERE " . implode(' AND ', $whereConditions);
    }
    $stmtCount = $pdo->prepare($countSql);
    $stmtCount->execute($params);
    $total = $stmtCount->fetchColumn();

    jsonResponse(['data' => $ratings, 'total' => (int) $total]);
}

if ($method === 'DELETE' && $id) {
    $stmt = $pdo->prepare("DELETE FROM ratings WHERE id = ?");
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) {
        jsonError('Оценка не найдена', 404);
    }
    jsonResponse(['success' => true]);
}

jsonError('Метод не разрешен', 405);
