<?php
//reviews.php
if ($method !== 'GET') {
    jsonError('Метод не разрешен', 405);
}

// GET — одобренные отзывы
$releaseId = $_GET['release_id'] ?? null;
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

$where = "WHERE r.status = 'approved' AND TRIM(r.content) <> ''";
$params = [];

if ($releaseId) {
    $where .= " AND r.release_id = ?";
    $params[] = $releaseId;
}

$sql = "SELECT r.id, r.release_id, r.user_id, r.content, r.created_at,
               u.nickname,
               rel.title AS album_title
        FROM reviews r
        JOIN users u ON r.user_id = u.id
        JOIN releases rel ON r.release_id = rel.id
        $where
        ORDER BY r.created_at DESC
        LIMIT $limit OFFSET $offset";

$pdo = getDB();
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$reviews = $stmt->fetchAll(PDO::FETCH_ASSOC);

$countSql = "SELECT COUNT(*) FROM reviews r $where";
$countStmt = $pdo->prepare($countSql);
$countStmt->execute($params);
$total = $countStmt->fetchColumn();

jsonResponse(['data' => $reviews, 'total' => (int) $total]);
