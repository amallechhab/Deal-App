-- DEAL APP : schéma MySQL correspondant à api/index.js
-- Si vous utilisez phpMyAdmin/XAMPP localement, créez une base 'deal_app'
-- puis sélectionnez-la et importez ce script.
-- Sur Aiven, utilisez la base existante configurée dans DB_NAME.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS utilisateurs (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, nom VARCHAR(100) NOT NULL, email VARCHAR(190) NOT NULL UNIQUE, mot_de_passe VARCHAR(255) NOT NULL, ville VARCHAR(100) DEFAULT NULL, avatar_url VARCHAR(1500) DEFAULT NULL, actif TINYINT(1) NOT NULL DEFAULT 1, cree_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS categories (slug VARCHAR(30) PRIMARY KEY, nom VARCHAR(80) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS annonces (id VARCHAR(80) PRIMARY KEY, utilisateur_id INT UNSIGNED NOT NULL, categorie VARCHAR(30) NOT NULL, type_annonce VARCHAR(80) NOT NULL DEFAULT '', titre VARCHAR(180) NOT NULL, prix DECIMAL(12,2) NOT NULL, ville VARCHAR(100) NOT NULL, pays VARCHAR(80) NOT NULL DEFAULT 'Maroc', description TEXT NOT NULL, alt_photo VARCHAR(255) DEFAULT '', statut ENUM('active','retiree') NOT NULL DEFAULT 'active', cree_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_statut (statut), INDEX idx_categorie (categorie), FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id), FOREIGN KEY (categorie) REFERENCES categories(slug)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS photos_annonces (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, annonce_id VARCHAR(80) NOT NULL, url VARCHAR(1500) NOT NULL, position TINYINT UNSIGNED NOT NULL, UNIQUE KEY unique_photo_position (annonce_id,position), FOREIGN KEY (annonce_id) REFERENCES annonces(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS caracteristiques (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, annonce_id VARCHAR(80) NOT NULL, valeur VARCHAR(100) NOT NULL, position TINYINT UNSIGNED NOT NULL, UNIQUE KEY unique_spec_position (annonce_id,position), FOREIGN KEY (annonce_id) REFERENCES annonces(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS images_upload (id VARCHAR(36) PRIMARY KEY, utilisateur_id INT UNSIGNED NOT NULL, format VARCHAR(20) NOT NULL, image_data MEDIUMBLOB NOT NULL, cree_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS favoris (utilisateur_id INT UNSIGNED NOT NULL, annonce_id VARCHAR(80) NOT NULL, cree_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (utilisateur_id,annonce_id), FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE, FOREIGN KEY (annonce_id) REFERENCES annonces(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS messages (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, annonce_id VARCHAR(80) NOT NULL, expediteur_id INT UNSIGNED NOT NULL, destinataire_id INT UNSIGNED NOT NULL, contenu TEXT NOT NULL, cree_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_destinataire (destinataire_id,cree_le), FOREIGN KEY (annonce_id) REFERENCES annonces(id) ON DELETE CASCADE, FOREIGN KEY (expediteur_id) REFERENCES utilisateurs(id), FOREIGN KEY (destinataire_id) REFERENCES utilisateurs(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO categories (slug,nom) VALUES
('voitures','Voitures'),('motos','Motos & deux-roues'),('immobilier','Immobilier'),('telephones','Téléphones'),('informatique','Informatique'),('electronique','Électronique'),('mode','Mode & accessoires'),('maison','Maison & décoration'),('electromenager','Électroménager'),('sport','Sport & loisirs'),('enfants','Enfants & bébés'),('livres','Livres & études'),('services','Services'),('emploi','Emploi'),('autres','Autres');

-- Les annonces de démonstration sont insérées automatiquement au démarrage de l'API.

-- Migration pour une base créée avant l'ajout des pays et types d'annonces :
-- L'API Vercel effectue automatiquement les ALTER TABLE manquants au démarrage.
-- Si vous exécutez manuellement sur une ancienne base, n'exécutez que les colonnes absentes.
-- ALTER TABLE annonces ADD COLUMN pays VARCHAR(80) NOT NULL DEFAULT 'Maroc' AFTER ville;
-- ALTER TABLE annonces ADD COLUMN type_annonce VARCHAR(80) NOT NULL DEFAULT '' AFTER categorie;

-- Pour les bases existantes, l'API ajoute la colonne `avatar_url` aux utilisateurs
-- via une migration non destructive au premier démarrage.
-- La photo de profil est hébergée dans Cloudinary (dossier deal/profils),
-- seul son lien HTTPS est enregistré en MySQL.
