// DEAL App — API MySQL sur Vercel (Node.js)
'use strict';
const mysql = require('mysql2/promise');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomUUID, scryptSync, createHmac, timingSafeEqual } = require('node:crypto');

const catNames = { voitures: 'Voitures', immobilier: 'Immobilier', telephones: 'Téléphones', mode: 'Mode' };
const fallbackPhoto = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"900\" height=\"600\" viewBox=\"0 0 900 600\"><rect width=\"900\" height=\"600\" fill=\"#f5f1e8\"/><rect x=\"240\" y=\"200\" width=\"420\" height=\"200\" rx=\"28\" fill=\"#dfe9e3\"/><text x=\"450\" y=\"325\" font-family=\"Arial,sans-serif\" font-weight=\"bold\" font-size=\"58\" text-anchor=\"middle\" fill=\"#295b49\">DEAL</text></svg>");
const cookieName = 'deal_session';
const sessionSeconds = 60 * 60 * 24 * 7;

function cloudinaryConfig() {
  const raw=process.env.CLOUDINARY_URL;
  if(!raw)httpError('Cloudinary non configuré sur Vercel.',503);
  try {
    const uri=new URL(raw);
    if(uri.protocol!=='cloudinary:' || !uri.username || !uri.password || !/^[a-z0-9_-]+$/i.test(uri.hostname)) throw Error('invalid config');
    return {
      cloudName:uri.hostname,
      key:decodeURIComponent(uri.username),
      secret:decodeURIComponent(uri.password)
    };
  }catch {
    httpError('Configuration Cloudinary invalide. Vérifiez CLOUDINARY_URL sur Vercel.',503);
  }
}
function cloudinaryAuth(cfg) {
  return 'Basic '+Buffer.from(cfg.key+':'+cfg.secret).toString('base64');
}
async function uploadToCloudinary(dataUrl) {
  const cfg=cloudinaryConfig();
  const uploadUrl='https://api.cloudinary.com/v1_1/'+encodeURIComponent(cfg.cloudName)+'/image/upload';
  const data=new FormData();
  data.set('file',dataUrl);
  data.set('folder','deal/annonces');
  data.set('public_id',randomUUID());
  data.set('overwrite','false');
  let response;
  try {
    response=await fetch(uploadUrl,{
      method:'POST',
      headers:{Authorization:cloudinaryAuth(cfg)},
      body:data,
      signal:AbortSignal.timeout(25000)
    });
  } catch(err) {
    console.error('Cloudinary network:',err?.name||'network error');
    httpError('Service photos temporairement indisponible.',503);
  }
  if(!response.ok){
    console.error('Cloudinary upload HTTP:',response.status);
    httpError('Impossible de téléverser la photo vers Cloudinary.',502);
  }
  const result=await response.json();
  const url=result.secure_url;
  if(typeof url!=='string'||!url.startsWith('https://res.cloudinary.com/'+cfg.cloudName+'/image/upload/')) {
    console.error('Cloudinary response URL invalid');
    httpError('Réponse invalide du service photos.',502);
  }
  return {url,public_id:result.public_id};
}

let pool;
let initialized;

function database() {
  if (!pool) {
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD ||
        ['DB_HOST','DB_USER','DB_PASSWORD','DB_NAME','DB_PORT'].some(key =>
          /^\[REDACTED\]$|^\*+$/.test(String(process.env[key]||''))))
      throw new Error('Paramètres MySQL manquants ou masqués. Vérifiez les variables Vercel DB_*.');
    pool = mysql.createPool({
      host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
      database: process.env.DB_NAME || 'defaultdb',
      user: process.env.DB_USER, password: process.env.DB_PASSWORD,
      ssl: { ca: fs.readFileSync(path.join(__dirname, '../certs/ca.pem')), rejectUnauthorized: true }, charset: 'utf8mb4',
      waitForConnections: true, connectionLimit: 3, queueLimit: 15, connectTimeout: 12000,
      enableKeepAlive: true
    });
  }
  return pool;
}

async function backupLegacyTable(db) {
  const [tables]=await db.query("SHOW TABLES LIKE 'annonces'");
  if(!tables.length)return;
  const [columns]=await db.query("SHOW COLUMNS FROM annonces");
  const current=new Set(columns.map(c=>c.Field));
  if(current.has('utilisateur_id')&&current.has('statut')&&current.has('alt_photo'))return;
  // Never drop old data: preserve the entire original table unchanged.
  const [existingBackup]=await db.query("SHOW TABLES LIKE 'annonces_legacy_deal'");
  if(existingBackup.length)throw Error('La base contient deux schémas anciens. Migration manuelle requise.');
  await db.query("RENAME TABLE annonces TO annonces_legacy_deal");
}
async function importLegacyTable(db, ownerId) {
  const [tables]=await db.query("SHOW TABLES LIKE 'annonces_legacy_deal'");
  if(!tables.length)return;
  const [rows]=await db.query("SELECT * FROM annonces_legacy_deal ORDER BY id LIMIT 5000");
  for(const row of rows) {
    const oldId=String(row.id ?? '');
    if(!oldId || oldId.length>60)continue;
    const id='legacy-'+oldId;
    const title=String(row.titre||'Annonce importée').slice(0,180);
    const city=String(row.ville||'Maroc').slice(0,100);
    const desc=String(row.description||'Annonce importée depuis la version précédente.');
    const category=String(row.categorie||'divers').toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,30)||'divers';
    const price=Number(row.prix);
    if(!Number.isFinite(price)||price<0||price>9999999999)continue;
    await db.execute("INSERT IGNORE INTO categories (slug,nom) VALUES (?,?)",[category,catNames[category]||category]);
    await db.execute("INSERT IGNORE INTO annonces (id,utilisateur_id,categorie,titre,prix,ville,description,alt_photo) VALUES (?,?,?,?,?,?,?,?)",
      [id,ownerId,category,title,price,city,desc,title]);
    const photo=String(row.photo||'');
    if(/^https?:\/\//.test(photo)&&photo.length<1500)
      await db.execute('INSERT IGNORE INTO photos_annonces (annonce_id,url,position) VALUES (?,?,1)',[id,photo]);
  }
}

async function setup() {
  if (!initialized) {
    initialized = (async () => {
      const db = database();
      await backupLegacyTable(db);
      const statements = [
        "CREATE TABLE IF NOT EXISTS utilisateurs (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, nom VARCHAR(100) NOT NULL, email VARCHAR(190) NOT NULL UNIQUE, mot_de_passe VARCHAR(255) NOT NULL, ville VARCHAR(100) DEFAULT NULL, actif TINYINT(1) NOT NULL DEFAULT 1, cree_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        "CREATE TABLE IF NOT EXISTS categories (slug VARCHAR(30) PRIMARY KEY, nom VARCHAR(80) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        "CREATE TABLE IF NOT EXISTS annonces (id VARCHAR(80) PRIMARY KEY, utilisateur_id INT UNSIGNED NOT NULL, categorie VARCHAR(30) NOT NULL, titre VARCHAR(180) NOT NULL, prix DECIMAL(12,2) NOT NULL, ville VARCHAR(100) NOT NULL, description TEXT NOT NULL, alt_photo VARCHAR(255) DEFAULT '', statut ENUM('active','retiree') NOT NULL DEFAULT 'active', cree_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_statut (statut), INDEX idx_categorie (categorie), FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id), FOREIGN KEY (categorie) REFERENCES categories(slug)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        "CREATE TABLE IF NOT EXISTS photos_annonces (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, annonce_id VARCHAR(80) NOT NULL, url VARCHAR(1500) NOT NULL, position TINYINT UNSIGNED NOT NULL, UNIQUE KEY unique_photo_position (annonce_id,position), FOREIGN KEY (annonce_id) REFERENCES annonces(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        "CREATE TABLE IF NOT EXISTS caracteristiques (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, annonce_id VARCHAR(80) NOT NULL, valeur VARCHAR(100) NOT NULL, position TINYINT UNSIGNED NOT NULL, UNIQUE KEY unique_spec_position (annonce_id,position), FOREIGN KEY (annonce_id) REFERENCES annonces(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        "CREATE TABLE IF NOT EXISTS images_upload (id VARCHAR(36) PRIMARY KEY, utilisateur_id INT UNSIGNED NOT NULL, format VARCHAR(20) NOT NULL, image_data MEDIUMBLOB NOT NULL, cree_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        "CREATE TABLE IF NOT EXISTS favoris (utilisateur_id INT UNSIGNED NOT NULL, annonce_id VARCHAR(80) NOT NULL, cree_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (utilisateur_id,annonce_id), FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE, FOREIGN KEY (annonce_id) REFERENCES annonces(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        "CREATE TABLE IF NOT EXISTS messages (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, annonce_id VARCHAR(80) NOT NULL, expediteur_id INT UNSIGNED NOT NULL, destinataire_id INT UNSIGNED NOT NULL, contenu TEXT NOT NULL, cree_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_destinataire (destinataire_id,cree_le), FOREIGN KEY (annonce_id) REFERENCES annonces(id) ON DELETE CASCADE, FOREIGN KEY (expediteur_id) REFERENCES utilisateurs(id), FOREIGN KEY (destinataire_id) REFERENCES utilisateurs(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
      ];
      for (const sql of statements) await db.query(sql);
      for (const [slug, nom] of Object.entries(catNames)) await db.execute('INSERT IGNORE INTO categories (slug,nom) VALUES (?,?)', [slug,nom]);
      await db.execute("INSERT IGNORE INTO utilisateurs (nom,email,mot_de_passe,ville,actif) VALUES ('Vendeur démonstration','demo-deal@example.invalid','!desactive!','Casablanca',0)");
      const [[demo]] = await db.execute("SELECT id FROM utilisateurs WHERE email='demo-deal@example.invalid'");
      const demos = [
        {id:'golf',cat:'voitures',title:'Volkswagen Golf 7',price:185000,city:'Casablanca',desc:'Golf 7 en excellent état, entretenue régulièrement. Climatisation, boîte manuelle et carnet d’entretien disponible. Visible à Casablanca.',alt:'Voiture sportive garée en extérieur',photos:['photo-1503376780353-7e6692767b70','photo-1492144534655-ae79c964c9d7','photo-1503736334956-4c8f8e92946d'],specs:['2018','Diesel','92 000 km']},
        {id:'iphone',cat:'telephones',title:'iPhone 13 · 128 Go',price:6500,city:'Rabat',desc:'iPhone 13 de 128 Go en très bon état, débloqué et soigneusement entretenu. Remise en main propre possible à Rabat.',alt:'Smartphone présenté sur un fond clair',photos:['photo-1592750475338-74b7b21085ab','photo-1511707171634-5f897ff02aa9','photo-1512499617640-c74ae3a79d37'],specs:['128 Go','Très bon état','Débloqué']},
        {id:'apartment',cat:'immobilier',title:'Appartement · Guéliz',price:1200000,city:'Marrakech',desc:'Bel appartement lumineux et soigneusement entretenu, dans le quartier recherché de Guéliz. Visite sur rendez-vous à Marrakech.',alt:'Salon lumineux d’un appartement',photos:['photo-1600210492486-724fe5c67fb0','photo-1600607687939-ce8a6c25118c','photo-1600566753086-00f18fb6b3ea'],specs:['92 m²','2 chambres','Meublé']},
        {id:'bag',cat:'mode',title:'Sac en cuir camel',price:450,city:'Rabat',desc:'Sac en cuir couleur camel, élégant et en excellent état. Disponible à Rabat pour une remise en main propre.',alt:'Sac à main en cuir couleur camel',photos:['photo-1584917865442-de89df76afd3','photo-1590874103328-eac38a683ce7','photo-1548036328-c9fa89d128fa'],specs:['Cuir','Très bon état','Camel']}
      ];
      await importLegacyTable(db, demo.id);
      for (const a of demos) {
        await db.execute("INSERT IGNORE INTO annonces (id,utilisateur_id,categorie,titre,prix,ville,description,alt_photo) VALUES (?,?,?,?,?,?,?,?)",[a.id,demo.id,a.cat,a.title,a.price,a.city,a.desc,a.alt]);
        for (let i=0;i<a.photos.length;i++) await db.execute('INSERT IGNORE INTO photos_annonces (annonce_id,url,position) VALUES (?,?,?)',[a.id,'https://images.unsplash.com/'+a.photos[i]+'?auto=format&fit=crop&w=1000&q=85',i+1]);
        for (let i=0;i<a.specs.length;i++) await db.execute('INSERT IGNORE INTO caracteristiques (annonce_id,valeur,position) VALUES (?,?,?)',[a.id,a.specs[i],i+1]);
      }
    })().catch(error => { initialized = null; throw error; });
  }
  await initialized;
}
function httpError(message, status=400) { const e = new Error(message); e.status=status; throw e; }
function str(value,max=200) { if(typeof value!=='string') httpError('Données invalides.'); const s=value.trim(); if(s.length>max) httpError('Texte trop long.'); return s; }
function body(req, maxSize = 30000) {
  if (req.method!=='POST') httpError('Méthode non autorisée.',405);
  if (!(req.headers['content-type']||'').includes('application/json')) httpError('JSON requis.',415);
  const origin=req.headers.origin;
  if(origin) {
    let host; try { host=new URL(origin).host; } catch { httpError('Origine invalide.',403); }
    if(host !== req.headers.host) httpError('Origine interdite.',403);
  }
  const data=req.body;
  if(!data || typeof data!=='object' || Array.isArray(data) || JSON.stringify(data).length>maxSize) httpError('Données invalides.',400);
  return data;
}
const secret = () => process.env.SESSION_SECRET || process.env.DB_PASSWORD;
function signature(payload){return createHmac('sha256', secret()).update(payload).digest('base64url');}
function setCookie(res, id){
  const content=String(id)+'.'+String(Date.now()+sessionSeconds*1000);
  const token=content+'.'+signature(content);
  res.setHeader('Set-Cookie',cookieName+'='+token+'; Path=/; Max-Age='+sessionSeconds+'; HttpOnly; Secure; SameSite=Lax');
}
function clearCookie(res){res.setHeader('Set-Cookie',cookieName+'=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');}
function parseSession(req) {
  const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='));
  if(!raw) return null;
  const token=raw.slice(cookieName.length+1);
  const parts=token.split('.');
  if(parts.length!==3) return null;
  const [id,expiry,sig]=parts;
  if(!/^\d+$/.test(id)||!(/^\d+$/.test(expiry))||Number(expiry)<Date.now()) return null;
  const expected=signature(id+'.'+expiry);
  if(sig.length!==expected.length||!timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) return null;
  return Number(id);
}
async function optionalUser(req){
  const id=parseSession(req); if(!id)return null;
  const [[u]]=await database().execute('SELECT id,nom,email,ville FROM utilisateurs WHERE id=? AND actif=1',[id]);
  return u||null;
}
async function user(req){const u=await optionalUser(req);if(!u)httpError('Connectez-vous pour continuer.',401);return u;}
async function listings(where="a.statut='active'",params=[],limit=100){
  const db=database();
  const [items]=await db.execute("SELECT a.id,a.utilisateur_id,a.categorie,a.titre,a.prix,a.ville,a.description,a.alt_photo,a.cree_le,c.nom AS categoryLabel,u.nom AS sellerName,u.actif AS sellerActive,u.cree_le AS sellerCreatedAt FROM annonces a JOIN categories c ON c.slug=a.categorie JOIN utilisateurs u ON u.id=a.utilisateur_id WHERE "+where+" ORDER BY a.cree_le DESC,a.id ASC LIMIT "+Math.min(Math.max(1,limit),100),params);
  if(!items.length)return [];
  const qs=items.map(()=>'?').join(',');
  const [photos]=await db.query('SELECT annonce_id,url FROM photos_annonces WHERE annonce_id IN ('+qs+') ORDER BY position',items.map(x=>x.id));
  const [specs]=await db.query('SELECT annonce_id,valeur FROM caracteristiques WHERE annonce_id IN ('+qs+') ORDER BY position',items.map(x=>x.id));
  const groupedPhotos={};const groupedSpecs={};
  for(const p of photos)(groupedPhotos[p.annonce_id]??=[]).push(p.url);
  for(const s of specs)(groupedSpecs[s.annonce_id]??=[]).push(s.valeur);
  return items.map(r=>({id:r.id,cat:r.categorie,categoryLabel:r.categoryLabel,title:r.titre,price:new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(r.prix)+' MAD',priceNumber:Number(r.prix),city:r.ville,description:r.description,alt:r.alt_photo||r.titre,photos:groupedPhotos[r.id]||[fallbackPhoto],specs:groupedSpecs[r.id]||[],sellerId:r.utilisateur_id,sellerName:r.sellerName,sellerActive:!!r.sellerActive,sellerCreatedAt:r.sellerCreatedAt instanceof Date?r.sellerCreatedAt.toISOString():String(r.sellerCreatedAt),createdAt:r.cree_le instanceof Date?r.cree_le.toISOString():String(r.cree_le)}));
}
function validateListing(d) {
  const title=str(d.titre,180),cat=str(d.categorie,30),city=str(d.ville,100),description=str(d.description,5000);
  const price=Number(d.prix);
  if(title.length<3||city.length<2||description.length<10) httpError('Complétez le titre, la ville et la description.');
  if(!/^[a-z0-9-]{2,30}$/.test(cat)) httpError('Catégorie invalide.');
  if(!Number.isFinite(price)||price<1||price>9999999999) httpError('Prix invalide.');
  const photos=[d.photo1,d.photo2,d.photo3].filter(Boolean).map(url=>{const s=str(url,1500);if(!/^\/api\/index\?action=photo&id=[a-z0-9-]{36}$/.test(s)){
        try{const u=new URL(s);if(!['http:','https:'].includes(u.protocol))httpError('Lien de photo invalide.');}
        catch{httpError('Lien de photo invalide.');}
      }return s;});
  const specs=str(d.specs||'',1000).split(',').map(s=>s.trim()).filter(Boolean).slice(0,3);
  if(specs.some(s=>s.length>100))httpError('Caractéristique trop longue.');
  return {title,cat,city,description,price,photos,specs};
}
async function replaceDetails(conn,id,item){
  await conn.execute('DELETE FROM photos_annonces WHERE annonce_id=?',[id]);
  await conn.execute('DELETE FROM caracteristiques WHERE annonce_id=?',[id]);
  for(let i=0;i<item.photos.length;i++)await conn.execute('INSERT INTO photos_annonces (annonce_id,url,position) VALUES (?,?,?)',[id,item.photos[i],i+1]);
  for(let i=0;i<item.specs.length;i++)await conn.execute('INSERT INTO caracteristiques (annonce_id,valeur,position) VALUES (?,?,?)',[id,item.specs[i],i+1]);
}
function passwordHash(password){const salt=randomBytes(16).toString('hex');return 'scrypt$'+salt+'$'+scryptSync(password,salt,64).toString('hex');}
function passwordValid(password,hash){
  const parts=String(hash).split('$');if(parts.length!==3||parts[0]!=='scrypt')return false;
  const a=scryptSync(password,parts[1],64),b=Buffer.from(parts[2],'hex');
  return b.length===a.length && timingSafeEqual(a,b);
}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  try {
    const action=String(req.query.action||'');
    if(!action) httpError('Action manquante.',404);
    if(req.method!=='GET'&&req.method!=='POST')httpError('Méthode non autorisée.',405);
    await setup();const db=database();
    if(action==='photo'){
      if(req.method!=='GET')httpError('Méthode non autorisée.',405);
      const id=String(req.query.id||'');
      if(!/^[0-9a-f-]{36}$/i.test(id))httpError('Image introuvable.',404);
      const [[img]]=await db.execute('SELECT format,image_data FROM images_upload WHERE id=?',[id]);
      if(!img)httpError('Image introuvable.',404);
      res.setHeader('Content-Type',img.format);
      res.setHeader('Cache-Control','public,max-age=86400');
      return res.end(img.image_data);
    }
    if(action==='upload'){
      const u=await user(req),d=body(req,3000000);
      if(typeof d.dataUrl!=='string'||d.dataUrl.length>2800000)httpError('Image trop grande (2 Mo maximum).',413);
      const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(d.dataUrl);
      if(!match)httpError('Format accepté : JPG, PNG ou WebP.');
      const format='image/'+match[1],bytes=Buffer.from(match[2],'base64');
      if(bytes.length===0||bytes.length>2*1024*1024)httpError('Image trop grande (2 Mo maximum).',413);
      const valid=(format==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)
       ||(format==='image/png'&&bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))
       ||(format==='image/webp'&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP');
      if(!valid)httpError('Le fichier ne correspond pas au format image indiqué.');
      const photo=await uploadToCloudinary(d.dataUrl);
      return res.json({ok:true,url:photo.url,storage:'cloudinary'});
    }
    if(action==='media-health'){
      const cfg=cloudinaryConfig();
      try{
        const response=await fetch('https://api.cloudinary.com/v1_1/'+encodeURIComponent(cfg.cloudName)+'/resources/image?max_results=1',{
          headers:{Authorization:cloudinaryAuth(cfg)},
          signal:AbortSignal.timeout(10000)
        });
        if(!response.ok){
          console.error('Cloudinary admin HTTP:',response.status);
          return res.status(503).json({ok:false,cloudinary:'unavailable'});
        }
        return res.json({ok:true,cloudinary:'connected'});
      }catch(err){
        console.error('Cloudinary admin request:',err?.name||'error');
        return res.status(503).json({ok:false,cloudinary:'unavailable'});
      }
    }
    if(action==='health'){const [[n]]=await db.execute('SELECT COUNT(*) AS n FROM annonces');return res.json({ok:true,database:'connected',annonces:Number(n.n)});}
    if(action==='categories'){
      const [rows]=await db.query('SELECT slug,nom FROM categories ORDER BY nom');
      return res.json({ok:true,categories:rows});
    }
    if(action==='list'){
      const cat=str(req.query.category||'all',30),q=str(req.query.q||'',120);
      let where="a.statut='active'",params=[];
      if(cat!=='all'){if(!/^[a-z0-9-]{2,30}$/.test(cat))httpError('Catégorie invalide.');where+=' AND a.categorie=?';params.push(cat);}
      if(q){where+=' AND (a.titre LIKE ? OR a.ville LIKE ? OR c.nom LIKE ?)';params.push('%'+q+'%','%'+q+'%','%'+q+'%');}
      return res.json({ok:true,annonces:await listings(where,params)});
    }
    if(action==='detail'){
      const id=str(req.query.id||'',80);
      const result=await listings("a.statut='active' AND a.id=?",[id],1);
      if(!result.length)httpError('Annonce introuvable.',404);
      return res.json({ok:true,annonce:result[0]});
    }
    if(action==='seller'){
      const id=Number(req.query.id);
      if(!Number.isInteger(id)||id<1)httpError('Profil introuvable.',404);
      const [[seller]]=await db.execute('SELECT id,nom,ville,cree_le,actif FROM utilisateurs WHERE id=?',[id]);
      if(!seller)httpError('Profil introuvable.',404);
      const ads=await listings("a.statut='active' AND a.utilisateur_id=?",[id],100);
      return res.json({ok:true,seller,annonces:ads});
    }
    if(action==='session'){
      const u=await optionalUser(req);let favorites=[];
      if(u){const [f]=await db.execute('SELECT annonce_id FROM favoris WHERE utilisateur_id=?',[u.id]);favorites=f.map(r=>r.annonce_id);}
      return res.json({ok:true,user:u,favorites,csrf:''});
    }
    if(action==='signup'){
      const d=body(req);const nom=str(d.nom,100),email=str(d.email,190).toLowerCase(),password=str(d.password,200),ville=str(d.ville||'',100);
      if(nom.length<2||!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||password.length<8)httpError('Nom, e-mail ou mot de passe invalide (8 caractères minimum).');
      const pass=passwordHash(password);
      try{const [result]=await db.execute('INSERT INTO utilisateurs (nom,email,mot_de_passe,ville) VALUES (?,?,?,?)',[nom,email,pass,ville||null]);setCookie(res,result.insertId);return res.json({ok:true});}
      catch(e){if(e.code==='ER_DUP_ENTRY')httpError('Cette adresse e-mail est déjà utilisée.',409);throw e;}
    }
    if(action==='login'){
      const d=body(req);const email=str(d.email,190).toLowerCase(),password=str(d.password,200);
      const [[account]]=await db.execute('SELECT id,mot_de_passe,actif FROM utilisateurs WHERE email=?',[email]);
      if(!account||!account.actif||!passwordValid(password,account.mot_de_passe))httpError('E-mail ou mot de passe incorrect.',401);
      setCookie(res,account.id);return res.json({ok:true});
    }
    if(action==='logout'){body(req);clearCookie(res);return res.json({ok:true});}
    if(action==='favorites'){
      const u=await user(req);
      const ads=await listings("a.statut='active' AND EXISTS (SELECT 1 FROM favoris f WHERE f.annonce_id=a.id AND f.utilisateur_id=?)",[u.id],100);
      return res.json({ok:true,annonces:ads});
    }
    if(action==='profile'){
      const u=await user(req);
      if(req.method==='GET')return res.json({ok:true,user:u});
      const d=body(req),nom=str(d.nom,100),ville=str(d.ville||'',100);
      if(nom.length<2)httpError('Nom trop court.');
      await db.execute('UPDATE utilisateurs SET nom=?,ville=? WHERE id=?',[nom,ville||null,u.id]);
      return res.json({ok:true,user:{...u,nom,ville}});
    }
    if(action==='mine'){
      const u=await user(req);return res.json({ok:true,annonces:await listings("a.statut='active' AND a.utilisateur_id=?",[u.id])});
    }
    if(action==='publish'||action==='update'){
      const d=body(req),u=await user(req),item=validateListing(d);
      const [[existingCategory]]=await db.execute('SELECT slug FROM categories WHERE slug=?',[item.cat]);
      if(!existingCategory)httpError('Catégorie inconnue.');
      let id;
      if(action==='update'){
        id=str(d.id,80);
        const [[owner]]=await db.execute("SELECT utilisateur_id FROM annonces WHERE id=? AND statut='active'",[id]);
        if(!owner||owner.utilisateur_id!==u.id)httpError('Annonce non autorisée.',403);
      }else id=randomUUID();
      const conn=await db.getConnection();
      try{
        await conn.beginTransaction();
        if(action==='publish')await conn.execute('INSERT INTO annonces (id,utilisateur_id,categorie,titre,prix,ville,description,alt_photo) VALUES (?,?,?,?,?,?,?,?)',[id,u.id,item.cat,item.title,item.price,item.city,item.description,item.title]);
        else await conn.execute("UPDATE annonces SET categorie=?,titre=?,prix=?,ville=?,description=? WHERE id=? AND utilisateur_id=? AND statut='active'",[item.cat,item.title,item.price,item.city,item.description,id,u.id]);
        await replaceDetails(conn,id,item);await conn.commit();
      }catch(e){await conn.rollback();throw e;}finally{conn.release();}
      return res.json({ok:true,id});
    }
    if(action==='delete'){
      const d=body(req),u=await user(req),id=str(d.id,80);
      const [result]=await db.execute("UPDATE annonces SET statut='retiree' WHERE id=? AND utilisateur_id=?",[id,u.id]);
      if(!result.affectedRows)httpError('Annonce introuvable.',404);
      return res.json({ok:true});
    }
    if(action==='favorite'){
      const d=body(req),u=await user(req),id=str(d.id,80);
      const [[listing]]=await db.execute("SELECT id FROM annonces WHERE id=? AND statut='active'",[id]);
      if(!listing)httpError('Annonce introuvable.',404);
      if(d.enabled===true)await db.execute('INSERT IGNORE INTO favoris (utilisateur_id,annonce_id) VALUES (?,?)',[u.id,id]);
      else await db.execute('DELETE FROM favoris WHERE utilisateur_id=? AND annonce_id=?',[u.id,id]);
      return res.json({ok:true});
    }
    if(action==='contact'){
      const d=body(req),u=await user(req),id=str(d.id,80),message=str(d.message,2000);
      if(message.length<3)httpError('Message trop court.');
      const [[listing]]=await db.execute("SELECT a.utilisateur_id,u.actif FROM annonces a JOIN utilisateurs u ON u.id=a.utilisateur_id WHERE a.id=? AND a.statut='active'",[id]);
      if(!listing)httpError('Annonce introuvable.',404);
      if(!listing.actif)httpError('Cette annonce de démonstration ne reçoit pas de messages.');
      if(listing.utilisateur_id===u.id)httpError('Vous êtes le vendeur.');
      await db.execute('INSERT INTO messages (annonce_id,expediteur_id,destinataire_id,contenu) VALUES (?,?,?,?)',[id,u.id,listing.utilisateur_id,message]);
      return res.json({ok:true});
    }
    if(action==='reply'){
      const d=body(req),u=await user(req),mid=Number(d.messageId);
      const message=str(d.message,2000);
      if(!Number.isSafeInteger(mid)||mid<1||message.length<3)httpError('Message invalide.');
      const [[original]]=await db.execute('SELECT annonce_id,expediteur_id,destinataire_id FROM messages WHERE id=? AND (expediteur_id=? OR destinataire_id=?)',[mid,u.id,u.id]);
      if(!original)httpError('Conversation inaccessible.',403);
      const partner=Number(original.expediteur_id)===Number(u.id)?original.destinataire_id:original.expediteur_id;
      if(Number(partner)===Number(u.id))httpError('Destinataire invalide.');
      await db.execute('INSERT INTO messages (annonce_id,expediteur_id,destinataire_id,contenu) VALUES (?,?,?,?)',[original.annonce_id,u.id,partner,message]);
      return res.json({ok:true});
    }
    if(action==='messages'){
      const u=await user(req);
      const [rows]=await db.execute(`SELECT m.id,m.contenu,m.cree_le,m.annonce_id,m.expediteur_id,m.destinataire_id, 
       em.nom AS expediteur, dm.nom AS destinataire, a.titre AS annonce
       FROM messages m
       JOIN utilisateurs em ON em.id=m.expediteur_id
       JOIN utilisateurs dm ON dm.id=m.destinataire_id
       JOIN annonces a ON a.id=m.annonce_id
       WHERE m.destinataire_id=? OR m.expediteur_id=?
       ORDER BY m.cree_le DESC LIMIT 100`,[u.id,u.id]);
      return res.json({ok:true,messages:rows});
    }
    httpError('Route introuvable.',404);
  }catch(e){
    if(!e.status)console.error('DEAL API:',e.code||e.message);
    return res.status(e.status||500).json({ok:false,error:e.status?e.message:'Service temporairement indisponible. Vérifiez la base de données.'});
  }
};
