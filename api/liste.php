<?php
require __DIR__ . '/../config/db.php';
header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = getDatabase();
    $categorie = $_GET['categorie'] ?? '';

    if ($categorie !== '' && $categorie !== 'all') {
        $stmt = $pdo->prepare('SELECT * FROM annonces WHERE categorie = ? ORDER BY id DESC');
        $stmt->execute([$categorie]);
    } else {
        $stmt = $pdo->query('SELECT * FROM annonces ORDER BY id DESC');
    }

    echo json_encode($stmt->fetchAll());
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erreur serveur']);
}