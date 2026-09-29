<?php
header('Content-Type: application/xml; charset=utf-8');
echo '<?xml version="1.0" encoding="UTF-8"?>';
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

$pdo = getDB();

// Главная
echo '<url><loc>' . BASE_URL . '/</loc><priority>1.0</priority></url>';

// Альбомы
$stmt = $pdo->query("SELECT slug, premiere_date FROM releases WHERE is_published = 1");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $loc = BASE_URL . '/albums/' . $row['slug'] . '/';
    $lastmod = date('Y-m-d', strtotime($row['premiere_date']));
    echo "<url><loc>{$loc}</loc><lastmod>{$lastmod}</lastmod><priority>0.8</priority></url>";
}

echo '</urlset>';
