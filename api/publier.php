<?php
require __DIR__ . '/../vendor/autoload.php';
require __DIR__ . '/../config/db.php';

use Cloudinary\Cloudinary;

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Méthode non autorisée']);
    exit;
}

$titre       = trim($_POST['titre'] ?? '');
$prix        = $_POST['prix'] ?? '';
$ville       = trim($_POST['ville'] ?? '');
$categorie   = trim($_POST['categorie'] ?? '');
$description = trim($_POST['description'] ?? '');

if ($titre === '' || $ville === '' || $categorie === '' || !is_numeric($prix)) {
    http_response_code(400);
    echo json_encode(['error' => 'Champs invalides']);
    exit;
}

if (!isset($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'Photo obligatoire']);
    exit;
}

$allowed = ['image/jpeg', 'image/png', 'image/webp'];
$mime = mime_content_type($_FILES['photo']['tmp_name']);
if (!in_array($mime, $allowed, true) || $_FILES['photo']['size'] > 5 * 1024 * 1024) {
    http_response_code(400);
    echo json_encode(['error' => 'Image invalide (jpg/png/webp, max 5 Mo)']);
    exit;
}

try {
    $cloudinary = new Cloudinary(getenv('CLOUDINARY_URL'));
    $result = $cloudinary->uploadApi()->upload(
        $_FILES['photo']['tmp_name'],
        ['folder' => 'deal']
    );
    $photoUrl = $result['secure_url'];

    $pdo = getDatabase();
    $stmt = $pdo->prepare(
        'INSERT INTO annonces (titre, prix, ville, categorie, description, photo)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$titre, $prix, $ville, $categorie, $description, $photoUrl]);

    echo json_encode(['success' => true, 'photo' => $photoUrl]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erreur serveur']);
}