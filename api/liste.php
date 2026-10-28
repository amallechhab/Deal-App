<?php
require __DIR__ . '/../config/db.php';
header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = getDatabase();
    $stmt = $pdo->query('SELECT id, titre, prix, ville, categorie, description, photo FROM annonces ORDER BY id DESC');
    echo json_encode($stmt->fetchAll());
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erreur serveur']);
}