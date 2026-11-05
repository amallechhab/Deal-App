# DEAL App — Version web dynamique

Application de petites annonces, réalisée pour un projet de formation.

**Démo :** https://dealappamallechhab.vercel.app

## Architecture

- Frontend : HTML5, CSS3, JavaScript (Fetch API).
- Backend : Node.js avec une fonction Vercel `api/index.js`.
- Base de données : MySQL (service Aiven) via `mysql2`.
- Les informations sont enregistrées dans MySQL ; il n'y a plus de tableau fixe d'annonces dans `script.js`.

## Fonctionnalités

| Fonctionnalité | Base de données |
|---|---|
| Accueil et toutes les annonces | `annonces`, `photos_annonces`, `categories` |
| Recherche et filtres par catégorie | requêtes SQL avec filtres |
| Fiche annonce et profil vendeur | `annonces`, `utilisateurs`, `caracteristiques` |
| Inscription / connexion / déconnexion | `utilisateurs` ; mots de passe hachés avec scrypt |
| Publication, modification et suppression | `annonces` et tables liées |
| Upload de 3 images max, chacune 2 Mo | `images_upload` + `photos_annonces` |
| Favoris personnels | `favoris` |
| Messages envoyés et reçus | `messages` |
| Profil personnel modifiable | `utilisateurs` |

Toutes les opérations d'écriture sont traitées sur le serveur et contrôlent l'identité de l'utilisateur. Les requêtes SQL utilisent des paramètres pour les valeurs fournies par l'utilisateur.

## Pages

- `index.html` : accueil
- `annonces.html` : recherche + catégories
- `produit.html?id=golf` : détails
- `connexion.html` : connexion
- `inscription.html` : inscription
- `publier.html` : publication ou modification
- `mes-annonces.html` : gestion de ses annonces
- `favoris.html` : favoris sauvegardés dans MySQL
- `messages.html` : messages reçus et envoyés
- `profil.html` : mise à jour du profil
- `vendeur.html?id=1` : profil public du vendeur

## Configuration Vercel

Les variables d'environnement **serveur** suivantes doivent être configurées dans Settings > Environment Variables du projet Vercel (Production et Preview) :

```text
DB_HOST       = hôte MySQL Aiven
DB_PORT       = port MySQL Aiven
DB_USER       = utilisateur MySQL Aiven
DB_PASSWORD   = mot de passe MySQL Aiven
DB_NAME       = nom de la base existante (souvent defaultdb)
```

**Attention :** les valeurs doivent être lues directement dans la console Aiven. Les connecteurs peuvent masquer les secrets ; ne collez jamais des chaînes censurées ou des astérisques dans les variables. Ne commitez pas les mots de passe. Après toute modification, redéployez l'application.

Le code crée ses tables manquantes avec `CREATE TABLE IF NOT EXISTS` au premier appel. Le schéma est également disponible dans `database/deal_app_schema.sql`.

Pour vérifier la connexion MySQL, ouvrir :
`https://dealappamallechhab.vercel.app/api/index?action=health`

Une réponse comme `{"ok":true,"database":"connected","annonces":4}` indique que l'API peut lire les annonces. Le total peut varier ; une page `READY` dans Vercel ne prouve pas que MySQL est joignable.

## Démonstration devant l'enseignant

1. Afficher les annonces depuis la base.
2. Rechercher par ville/mot-clé et filtrer par catégorie.
3. Créer un compte et se connecter.
4. Publier une annonce avec une image depuis l'ordinateur.
5. Modifier l'annonce et montrer le changement immédiatement.
6. Ajouter l'annonce aux favoris, puis la retrouver dans « Mes favoris ».
7. Utiliser un deuxième compte pour envoyer un message au vendeur.
8. Consulter les messages, modifier le profil puis retirer l'annonce.

## Limitations

- Une annonce de démonstration utilise un vendeur désactivé : elle n'accepte pas de messages.
- Il n'y a pas de système d'e-mail de récupération de mot de passe ; l'interface ne doit pas promettre cette fonction.
- Le nombre d'annonces renvoyées par une recherche est actuellement limité à 100.
- Le système n'est pas un service commercial audité ; tester le parcours complet sur le déploiement et sécuriser davantage avant tout usage public à grande échelle.
