<?php

$pdo = getDB();

// GET /admin/reviews – список с фильтром по статусу
if ($method === 'GET' && !$id) {
    $status = $_GET['status'] ?? '';
    $limit = (int) ($_GET['limit'] ?? 10);
    $offset = (int) ($_GET['offset'] ?? 0);
    if ($limit < 1) {
        $limit = 1;
    }
    if ($limit > 50) {
        $limit = 50;
    }
    if ($offset < 0) {
        $offset = 0;
    }
    $search = $_GET['search'] ?? null; // поиск по rel.title

    $sql = "SELECT r.id, r.release_id, r.user_id, r.content, r.status, r.want_booklet, r.created_at,
                   u.nickname,
                   rel.title AS album_title
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            JOIN releases rel ON r.release_id = rel.id";

    $params = [];
    $whereConditions = [];
    if ($search) {
        $whereConditions[] = "rel.title LIKE ?";
        $params[] = '%' . $search . '%';
    }
    // Фильтры
    if ($status && in_array($status, ['pending', 'approved', 'rejected'])) {
        $whereConditions[] = "r.status = ?";
        $params[] = $status;
    }

    // Собираем WHERE
    if ($whereConditions) {
        $sql .= " WHERE " . implode(' AND ', $whereConditions);
    }
    $sql .= " ORDER BY r.created_at DESC LIMIT $limit OFFSET $offset";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $reviews = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Общее количество
    $countSql = "SELECT COUNT(*)
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            JOIN releases rel ON r.release_id = rel.id";

    if ($whereConditions) {
        $countSql .= " WHERE " . implode(' AND ', $whereConditions);
    }
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $total = $countStmt->fetchColumn();

    jsonResponse(['data' => $reviews, 'total' => (int) $total]);
}

// PUT /admin/reviews?id={id} – изменение статуса
if ($method === 'PUT' && $id) {
    $data = getRequestBody();
    $status = $data['status'] ?? '';
    if (!in_array($status, ['approved', 'rejected'])) {
        jsonError('Неверный статус', 400);
    }

    $stmt = $pdo->prepare("UPDATE reviews SET status = ? WHERE id = ?");
    $stmt->execute([$status, $id]);
    if ($stmt->rowCount() === 0) {
        jsonError('Отзыв не найден', 404);
    }
    jsonResponse(['success' => true]);
    return;
}

// DELETE /admin/reviews?id={id}
if ($method === 'DELETE' && $id) {
    $stmt = $pdo->prepare("DELETE FROM reviews WHERE id = ?");
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) {
        jsonError('Отзыв не найден', 404);
    }
    jsonResponse(['success' => true]);
    return;
}

jsonError('Метод не разрешен', 405);
