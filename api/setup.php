<?php
require __DIR__ . '/../config/db.php';
header('Content-Type: text/plain; charset=utf-8');

try {
    $pdo = getDatabase();
    $pdo->exec("CREATE TABLE IF NOT EXISTS annonces (
        id INT AUTO_INCREMENT PRIMARY KEY,
        titre VARCHAR(150) NOT NULL,
        prix DECIMAL(12,2) NOT NULL,
        ville VARCHAR(100) NOT NULL,
        categorie VARCHAR(50) NOT NULL,
        description TEXT,
        photo VARCHAR(500) NOT NULL,
        date_publication TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
    echo "OK: table annonces prete\n\nTables:\n";
    foreach ($pdo->query('SHOW TABLES') as $row) {
        echo '- ' . array_values($row)[0] . "\n";
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo 'Erreur: ' . $e->getMessage();
}