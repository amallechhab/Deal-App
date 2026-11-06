# DEAL App — Version web dynamique

Application de petites annonces, réalisée pour un projet de formation.

**Démo :** https://dealappamallechhab.vercel.app

## Architecture

- Frontend : HTML5, CSS3, JavaScript (Fetch API).
- Backend : Node.js avec une fonction Vercel `api/index.js`.
- Base de données : MySQL (service Aiven) via `mysql2`.
- Photos des nouvelles annonces : Cloudinary (API Upload, depuis le backend Vercel).
- Les informations sont enregistrées dans MySQL ; il n'y a plus de tableau fixe d'annonces dans `script.js`.

## Fonctionnalités

| Fonctionnalité | Base de données |
|---|---|
| Accueil et toutes les annonces | `annonces`, `photos_annonces`, `categories` |
| Recherche et filtres par catégorie | requêtes SQL avec filtres |
| Fiche annonce et profil vendeur | `annonces`, `utilisateurs`, `caracteristiques` |
| Inscription / connexion / déconnexion | `utilisateurs` ; mots de passe hachés avec scrypt |
| Publication, modification et suppression | `annonces` et tables liées |
| Upload d’une photo depuis le formulaire (2 Mo max) | Cloudinary stocke l’image, MySQL `photos_annonces` conserve son URL sécurisée |
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
- `publier.html` : formulaire simplifié (Titre, Prix, Ville, Catégorie, Description, Photo), publication ou modification. Les visiteurs non connectés restent sur la page et voient un message de connexion ; aucune redirection automatique.
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
CLOUDINARY_URL = cloudinary://API_KEY:API_SECRET@CLOUD_NAME
```

**Attention :** les valeurs doivent être lues directement dans la console Aiven. Les connecteurs peuvent masquer les secrets ; ne collez jamais des chaînes censurées ou des astérisques dans les variables. Ne commitez pas les mots de passe ni la clé secrète Cloudinary. Après toute modification, redéployez l'application.

## Images Cloudinary

Le formulaire `publier.html` envoie les photos au backend Vercel (`/api/index?action=upload`).

- Le serveur vérifie que l'utilisateur est connecté et que l'image est un fichier JPG, PNG ou WebP de 2 Mo maximum.
- Le backend charge l'image dans le dossier Cloudinary `deal/annonces` via l'API authentifiée. **Jamais de clé secrète Cloudinary dans JavaScript côté navigateur.**
- Cloudinary retourne une URL HTTPS `secure_url`, enregistrée ensuite dans `photos_annonces` (MySQL).
- Les images plus anciennes qui sont déjà dans la table `images_upload` de MySQL restent accessibles par `/api/index?action=photo&id=...` : elles ne sont pas détruites lors du changement.
- Le test serveur `/api/index?action=media-health` vérifie que la configuration du compte Cloudinary permet un appel API authentifié, sans révéler les identifiants.

Le backend requiert `CLOUDINARY_URL` dans les variables d'environnement Vercel **Production et Preview**. Après toute mise à jour des variables, relancer un déploiement. Ne jamais mettre cette valeur dans le code GitHub ou dans `script.js`.

Le code crée ses tables manquantes avec `CREATE TABLE IF NOT EXISTS` au premier appel. Le schéma est également disponible dans `database/deal_app_schema.sql`.

Pour vérifier la connexion MySQL, ouvrir :
`https://dealappamallechhab.vercel.app/api/index?action=health`

Une réponse comme `{"ok":true,"database":"connected","annonces":4}` indique que l'API peut lire les annonces. Le total peut varier ; une page `READY` dans Vercel ne prouve pas que MySQL est joignable.

## Démonstration devant l'enseignant

1. Afficher les annonces depuis la base.
2. Rechercher par ville/mot-clé et filtrer par catégorie.
3. Créer un compte et se connecter.
4. Publier une annonce avec une image depuis l'ordinateur, puis retrouver le fichier dans le dossier Cloudinary `deal/annonces`.
5. Modifier l'annonce et montrer le changement immédiatement.
6. Ajouter l'annonce aux favoris, puis la retrouver dans « Mes favoris ».
7. Utiliser un deuxième compte pour envoyer un message au vendeur.
8. Consulter les messages, modifier le profil puis retirer l'annonce.

## Limitations

- Une annonce de démonstration utilise un vendeur désactivé : elle n'accepte pas de messages.
- Il n'y a pas de système d'e-mail de récupération de mot de passe ; l'interface ne doit pas promettre cette fonction.
- Le nombre d'annonces renvoyées par une recherche est actuellement limité à 100.
- Le système n'est pas un service commercial audité ; tester le parcours complet sur le déploiement et sécuriser davantage avant tout usage public à grande échelle.

## Conservation du design de amal-branch
Le site reprend la feuille de style originale de `amal-branch`, y compris le formulaire de publication. Le JavaScript de cette ancienne branche utilisait des annonces de secours et des favoris locaux : ces données ne sont pas une preuve de connexion MySQL. La version de production utilise uniquement les endpoints `/api/index` pour les données des utilisateurs.

## Migration de l'ancienne base de données
L'ancien projet PHP pouvait posséder une table `annonces` avec seulement `id, titre, prix, ville, categorie, description, photo`.

Au premier démarrage, si la table `annonces` existe mais n'a pas les colonnes du nouveau schéma, l'API :
1. **renomme** l'ancienne table en `annonces_legacy_deal` (aucune suppression de données) ;
2. crée les nouvelles tables avec `CREATE TABLE IF NOT EXISTS` ;
3. copie jusqu'à 5000 anciennes annonces vers le nouveau schéma, avec l'identifiant `legacy-...` ;
4. garde l'ancienne table comme sauvegarde jusqu'à validation manuelle de l'import.

Les anciennes annonces anonymes sont associées à un compte de démonstration inactif : leur auteur d'origine ne peut pas être identifié sans authentification antérieure. Les nouvelles annonces sont liées à un vrai compte et permettent le contact avec le vendeur.

**Important :** si l'ancienne base contient déjà une table `annonces_legacy_deal`, ne pas renommer ou supprimer des données au hasard ; vérifier d'abord la migration.

## Tests après déploiement
1. `/api/index?action=health` doit donner un JSON avec `ok:true`.
2. `/api/index?action=list` doit renvoyer le tableau `annonces`.
3. `/api/index?action=media-health` doit répondre avec `cloudinary:connected`.
4. Créer un utilisateur via `inscription.html`.
5. Publier une nouvelle annonce avec photo et vérifier sa présence après actualisation.
6. Modifier l'annonce, puis retirer l'annonce.
7. Tester `favoris.html` après reconnexion.
8. Utiliser deux comptes distincts : envoyer un message depuis la fiche annonce, consulter `messages.html`, cliquer « Répondre ».

**En cas de réponse HTTP 500 + ER_ACCESS_DENIED_ERROR :** les variables `DB_USER` / `DB_PASSWORD` (ou autre paramètre DB_*) de Vercel ne correspondent pas aux identifiants Aiven. Saisir de nouvelles valeurs dans Vercel > Project Settings > Environment Variables en se basant directement sur Aiven > MySQL > Overview. Ne pas saisir `[REDACTED]` ni partager le mot de passe dans GitHub ou ce chat. Puis redéployer.

Le certificat d'autorité MySQL est dans `certs/ca.pem` et la connexion TLS vérifie le certificat.
