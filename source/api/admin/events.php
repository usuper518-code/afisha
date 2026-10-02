<?php

$pdo = getDB();

// GET /admin/events/stats – сводка. Идёт раньше списка: у списка нет id.
if ($method === 'GET' && ($action === 'stats' || $id === 'stats')) {
    // По типам событий
    $stmtTypes = $pdo->query("SELECT event_type, COUNT(*) AS count FROM events GROUP BY event_type");
    $byType = $stmtTypes->fetchAll(PDO::FETCH_ASSOC);

    // По типам сущностей
    $stmtEntities = $pdo->query("SELECT entity_type, COUNT(*) AS count FROM events GROUP BY entity_type");
    $byEntity = $stmtEntities->fetchAll(PDO::FETCH_ASSOC);

    // По дням (последние 30 дней)
    $stmtDays = $pdo->query("SELECT DATE(created_at) AS date, event_type, COUNT(*) AS count
                             FROM events 
                             WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
                             GROUP BY DATE(created_at), event_type
                             ORDER BY date");
    $byDay = $stmtDays->fetchAll(PDO::FETCH_ASSOC);

    // Топ пользователей по активности
    $stmtTopUsers = $pdo->query("SELECT u.id, u.nickname, COUNT(e.id) AS events_count
                                 FROM events e
                                 JOIN users u ON e.user_id = u.id
                                 GROUP BY u.id
                                 ORDER BY events_count DESC
                                 LIMIT 10");
    $topUsers = $stmtTopUsers->fetchAll(PDO::FETCH_ASSOC);

    // Топ сущностей по событиям
    $stmtTopEntities = $pdo->query("SELECT e.entity_type, e.entity_id,
                                    CASE 
                                        WHEN e.entity_type = 'release' THEN (SELECT title FROM releases WHERE id = e.entity_id)
                                        WHEN e.entity_type = 'track' THEN (SELECT title FROM tracks WHERE id = e.entity_id)
                                    END AS entity_title,
                                    COUNT(*) AS events_count
                                    FROM events e
                                    GROUP BY e.entity_type, e.entity_id
                                    ORDER BY events_count DESC
                                    LIMIT 10");
    $topEntities = $stmtTopEntities->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse([
        'by_type' => $byType,
        'by_entity' => $byEntity,
        'by_day' => $byDay,
        'top_users' => $topUsers,
        'top_entities' => $topEntities
    ]);
}

if ($method === 'GET' && !$id && $action !== 'stats') {
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

    $eventType = $_GET['event_type'] ?? null;
    $entityType = $_GET['entity_type'] ?? null;
    $userId = $_GET['user_id'] ?? null;

    $allowedOrder = ['id', 'event_type', 'entity_type', 'created_at'];
    if (!in_array($order, $allowedOrder))
        $order = 'created_at';
    if (!in_array($direction, ['ASC', 'DESC']))
        $direction = 'DESC';

    $sql = "SELECT e.id, e.event_type, e.entity_type, e.entity_id, e.created_at,
                   u.id AS user_id, u.nickname,
                   CASE 
                       WHEN e.entity_type = 'release' THEN (SELECT title FROM releases WHERE id = e.entity_id)
                       WHEN e.entity_type = 'track' THEN (SELECT title FROM tracks WHERE id = e.entity_id)
                   END AS entity_title
            FROM events e
            JOIN users u ON e.user_id = u.id";

    $params = [];
    $whereConditions = [];

    if ($eventType) {
        $whereConditions[] = "e.event_type = ?";
        $params[] = $eventType;
    }

    if ($entityType) {
        $whereConditions[] = "e.entity_type = ?";
        $params[] = $entityType;
    }

    if ($userId) {
        $whereConditions[] = "e.user_id = ?";
        $params[] = $userId;
    }

    if (!empty($whereConditions)) {
        $sql .= " WHERE " . implode(' AND ', $whereConditions);
    }

    $sql .= " ORDER BY e.$order $direction LIMIT $limit OFFSET $offset";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $events = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $countSql = "SELECT COUNT(*) FROM events e";
    $countParams = [];
    if (!empty($whereConditions)) {
        $countSql .= " WHERE " . implode(' AND ', $whereConditions);
        $countParams = $params;
    }
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($countParams);
    $total = $countStmt->fetchColumn();

    jsonResponse(['data' => $events, 'total' => (int) $total]);
}

// GET /admin/events/stats – статистика по событиям
// GET /admin/events?id={id} – одно событие
if ($method === 'GET' && $id && $id !== 'stats') {
    $stmt = $pdo->prepare("SELECT e.*, u.nickname,
                           CASE 
                               WHEN e.entity_type = 'release' THEN (SELECT title FROM releases WHERE id = e.entity_id)
                               WHEN e.entity_type = 'track' THEN (SELECT title FROM tracks WHERE id = e.entity_id)
                           END AS entity_title
                           FROM events e
                           JOIN users u ON e.user_id = u.id
                           WHERE e.id = ?");
    $stmt->execute([$id]);
    $event = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$event)
        jsonError('Событие не найдено', 404);
    jsonResponse($event);
}

// DELETE /admin/events?id={id} – удаление события
if ($method === 'DELETE' && $id && $id !== 'stats') {
    $stmt = $pdo->prepare("DELETE FROM events WHERE id = ?");
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0)
        jsonError('Событие не найдено', 404);
    jsonResponse(['success' => true]);
}

jsonError('Метод не разрешен', 405);
