<?php
header('Content-Type: application/xml; charset=utf-8');
echo '<?xml version="1.0" encoding="UTF-8"?>';
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

$pdo = getDB();

// Главная
echo '<url><loc>' . BASE_URL . '/</loc><priority>1.0</priority></url>';

// Альбомы. Пустая дата не должна ронять карту: strtotime(null) на PHP 8 — предупреждение.
$stmt = $pdo->query("SELECT slug, premiere_date FROM releases WHERE is_published = 1");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $slug = str_replace(["\r", "\n"], '', (string) ($row['slug'] ?? ''));
    $loc = BASE_URL . '/albums/' . $slug . '/';
    $lastmod = '';
    $rawDate = (string) ($row['premiere_date'] ?? '');
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $rawDate)) {
        $ts = strtotime($rawDate);
        if ($ts) {
            $lastmod = '<lastmod>' . date('Y-m-d', $ts) . '</lastmod>';
        }
    }
    echo '<url><loc>' . $loc . '</loc>' . $lastmod . '<priority>0.8</priority></url>';
}

echo '</urlset>';
