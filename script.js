let ANNONCES = [];
let session = {user:null,favorites:[]};
const page = document.body.dataset.page;
if(!document.querySelector('link[rel="icon"]')){
 const icon=document.createElement('link');icon.rel='icon';icon.type='image/svg+xml';icon.href='favicon.svg';document.head.append(icon);
}

async function api(action,data=null,params={}){
 const options={credentials:'same-origin',headers:{'Accept':'application/json'}};
 if(data!==null){options.method='POST';options.headers['Content-Type']='application/json';options.body=JSON.stringify(data);}
 const query=new URLSearchParams({action,...params});
 const response=await fetch('/api/index?'+query,options);
 let result;
 try{result=await response.json();}catch{throw new Error('Le serveur ne répond pas correctement.');}
 if(!response.ok||!result.ok)throw new Error(result.error||'Erreur du serveur');
 return result;
}

const toast = document.getElementById("toast");
let toastTimer;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function getFavorites(){return new Set(session.favorites);}
function saveFavorites(favs){session.favorites=[...favs];}
function safeNext() {
  const p=new URLSearchParams(location.search).get('next');
  if(!p || p.startsWith('//') || /[\\\\]/.test(p))return 'mes-annonces.html';
  try{
    const url=new URL(p,location.origin);
    if(url.origin!==location.origin || !/^\/(?:index|annonces|produit|publier|mes-annonces|favoris|profil|messages|vendeur)\.html$/.test(url.pathname))
      return 'mes-annonces.html';
    return url.pathname.slice(1)+url.search;
  }catch{return 'mes-annonces.html';}
}
function currentReturnPath(){
 const name=location.pathname.split('/').pop()||'index.html';
 return name+location.search;
}
function authHref(pageName){
 return pageName+'?next='+encodeURIComponent(
   page==='login'||page==='signup'?safeNext():currentReturnPath()
 );
}
function showLoginPrompt(container){
 if(!container || container.querySelector('.deal-auth-inline'))return;
 const n=document.createElement('div');n.className='deal-auth-inline';
 const txt=document.createElement('span');txt.textContent='Pour enregistrer vos favoris, ';
 const a=document.createElement('a');a.href=authHref('connexion.html');a.textContent='connectez-vous';
 const separator=document.createTextNode(' ou ');
 const b=document.createElement('a');b.href=authHref('inscription.html');b.textContent='créez un compte';
 n.append(txt,a,separator,b,document.createTextNode('.'));
 container.append(n);
}
function requireLogin(container=null){
 if(session.user)return true;
 showToast('Connectez-vous pour enregistrer vos favoris.');
 showLoginPrompt(container);
 return false;
}
function photoUrl(photo, width = 700) {
  if(!photo)return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"900\" height=\"600\" viewBox=\"0 0 900 600\"><rect width=\"900\" height=\"600\" fill=\"#f5f1e8\"/><rect x=\"240\" y=\"200\" width=\"420\" height=\"200\" rx=\"28\" fill=\"#dfe9e3\"/><text x=\"450\" y=\"325\" font-family=\"Arial,sans-serif\" font-weight=\"bold\" font-size=\"58\" text-anchor=\"middle\" fill=\"#295b49\">DEAL</text></svg>");
  if(/^https?:\/\//i.test(photo)||photo.startsWith('/api/')||photo.startsWith('data:image/'))return photo;
  return `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=${width}&q=85`;
}

function createListingCard(listing, favorites = getFavorites()) {
  const card = document.createElement("article");
  card.className = "listing-card";

  const openLink = document.createElement("a");
  openLink.className = "listing-open";
  openLink.href = `produit.html?id=${encodeURIComponent(listing.id)}`;
  openLink.setAttribute("aria-label", `${listing.title}, ${listing.price}, ${listing.city}. Voir le détail.`);

  const imageWrap = document.createElement("span");
  imageWrap.className = "listing-image-wrap";
  const image = document.createElement("img");
  image.className = "listing-image";
  image.src = photoUrl(listing.photos[0]);
  image.alt = listing.alt;
  image.loading = "lazy";
  imageWrap.append(image);

  const copy = document.createElement("span");
  copy.className = "listing-card-copy";
  const category = document.createElement("span");
  category.className = "listing-card-category";
  category.textContent = listing.categoryLabel;
  const title = document.createElement("span");
  title.className = "listing-title";
  title.textContent = listing.title;
  const price = document.createElement("strong");
  price.className = "listing-price";
  price.textContent = listing.price;
  const city = document.createElement("span");
  city.className = "listing-city";
  city.textContent = `⌖ ${listing.city}`;
  copy.append(category, title, price, city);
  openLink.append(imageWrap, copy);

  const favorite = document.createElement("button");
  const isFavorite = favorites.has(listing.id);
  favorite.className = `listing-favorite${isFavorite ? " is-favorite" : ""}`;
  favorite.type = "button";
  favorite.setAttribute("aria-label", isFavorite ? "Retirer des favoris" : "Ajouter aux favoris");
  favorite.setAttribute("aria-pressed", String(isFavorite));
  favorite.textContent = isFavorite ? "♥" : "♡";
  favorite.addEventListener("click", async () => {
    if(!requireLogin(card))return;
    const nextFavorites = getFavorites();
    const willBeFavorite = !nextFavorites.has(listing.id);
    if (willBeFavorite) nextFavorites.add(listing.id);
    else nextFavorites.delete(listing.id);
    try{await api("favorite",{id:listing.id,enabled:willBeFavorite});}catch(error){showToast(error.message);return;}
    saveFavorites(nextFavorites);
    if(page==='favorites' && !willBeFavorite){
      card.remove();
      const empty=document.getElementById('favorites-empty');
      if(empty)empty.hidden=document.querySelectorAll('#favorite-listings .listing-card').length>0;
      const counter=document.getElementById('favorite-count');
      if(counter)counter.textContent=document.querySelectorAll('#favorite-listings .listing-card').length+' annonce(s) favorite(s)';
    }
    favorite.setAttribute("aria-label", willBeFavorite ? "Retirer des favoris" : "Ajouter aux favoris");
    favorite.setAttribute("aria-pressed", String(willBeFavorite));
    favorite.classList.toggle("is-favorite", willBeFavorite);
    favorite.textContent = willBeFavorite ? "♥" : "♡";
    showToast(willBeFavorite ? "Annonce ajoutée aux favoris." : "Annonce retirée des favoris.");
  });

  card.append(openLink, favorite);
  return card;
}

function renderListingGrid(container, listings) {
  if (!container) return;
  const favorites = getFavorites();
  container.replaceChildren(...listings.map((listing) => createListingCard(listing, favorites)));
}

async function initHome() {
 renderListingGrid(document.getElementById('listings'),ANNONCES);
 try{
  const categories=(await api('categories')).categories;
  const holder=document.querySelector('.category-cards');
  const existing=[...holder.children];
  const cards=categories.map(row=>{
   let card=existing.find(e=>e.getAttribute('href')==='annonces.html?category='+row.slug);
   if(card)card=card.cloneNode(true);
   else {
    card=document.createElement('a');card.className='category-card category-phone';
    card.innerHTML='<span class="category-icon">◇</span><span><strong></strong><small></small></span><span class="category-arrow">→</span>';
   }
   card.href='annonces.html?category='+encodeURIComponent(row.slug);
   card.querySelector('strong').textContent=row.nom;
   const count=ANNONCES.filter(a=>a.cat===row.slug).length;
   card.querySelector('small').textContent=count+' annonce(s)';
   return card;
  });
  holder.replaceChildren(...cards);
 }catch(e){showToast(e.message);}
}

async function initListings() {
 const searchInput=document.getElementById('search');
 const categoryList=document.querySelector('.category-list');
 let categoryButtons=[...document.querySelectorAll('.category-chip')];
 const resultsCount=document.getElementById('results-count');
 const emptyState=document.getElementById('empty-state');
 const grid=document.getElementById('listings');
 const queryParams=new URLSearchParams(location.search);
 let selectedCategory=queryParams.get('category')||'all';
 let serial=0,timer;
 searchInput.value=queryParams.get('q')||'';
 async function updateListings(){
  const current=++serial;
  const q=searchInput.value.trim();
  resultsCount.textContent='Recherche...';
  try{
   const result=await api('list',null,{category:selectedCategory,q});
   if(current!==serial)return;
   renderListingGrid(grid,result.annonces);
   resultsCount.textContent=result.annonces.length+' annonce(s)';
   emptyState.hidden=result.annonces.length>0;
   const urlParams=new URLSearchParams();
   if(selectedCategory!=='all')urlParams.set('category',selectedCategory);
   if(q)urlParams.set('q',q);
   const suffix=urlParams.toString();
   history.replaceState(null,'',location.pathname+(suffix?'?'+suffix:''));
  }catch(e){if(current===serial){resultsCount.textContent='Recherche indisponible';showToast(e.message);}}
  categoryButtons.forEach(button=>button.classList.toggle('is-active',button.dataset.category===selectedCategory));
 }
 try{
  const categories=(await api('categories')).categories;
  categoryList.replaceChildren();
  for(const item of [{slug:'all',nom:'Tout'},...categories]){
   const button=document.createElement('button');button.className='category-chip';
   button.type='button';button.dataset.category=item.slug;button.textContent=item.nom;categoryList.append(button);
  }
  categoryButtons=[...categoryList.querySelectorAll('.category-chip')];
 }catch(e){showToast(e.message);}
 categoryButtons.forEach(button=>button.addEventListener('click',()=>{
  selectedCategory=button.dataset.category;updateListings();
 }));
 searchInput.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(updateListings,250);});
 document.querySelector('.listing-search').addEventListener('submit',e=>{
  e.preventDefault();clearTimeout(timer);updateListings();
 });
 updateListings();
}

async function initProduct() {
  const params = new URLSearchParams(window.location.search);
  const id=params.get('id');
  if(!id){showToast('Annonce introuvable.');return;}
  let selectedListing;
  try{selectedListing=(await api('detail',null,{id})).annonce;}
  catch(error){showToast(error.message);document.querySelector('.product-layout').textContent='Cette annonce est indisponible.';return;}
  const detailImage = document.getElementById("detail-image");
  const detailName = document.getElementById("detail-name");
  const detailPrice = document.getElementById("detail-price");
  const detailCity = document.getElementById("detail-city");
  const detailDescription = document.getElementById("detail-description");
  const detailSpecifications = document.getElementById("detail-specifications");
  const detailCategory = document.querySelector(".detail-category");
  const thumbnails = [...document.querySelectorAll(".thumbnail")];
  const favoriteButton = document.querySelector(".favorite-button");
  let currentPhoto = 0;

  document.title = `DEAL — ${selectedListing.title}`;
  detailName.textContent = selectedListing.title;
  detailPrice.textContent = selectedListing.price;
  detailCity.textContent = selectedListing.city;
  detailDescription.textContent = selectedListing.description;
  detailCategory.textContent = selectedListing.categoryLabel;
  detailSpecifications.replaceChildren(...selectedListing.specs.map((specification) => {
    const chip = document.createElement("span");
    chip.textContent = specification;
    return chip;
  }));

  function renderPhoto(index) {
    currentPhoto = (index + selectedListing.photos.length) % selectedListing.photos.length;
    detailImage.src = photoUrl(selectedListing.photos[currentPhoto], 1200);
    detailImage.alt = selectedListing.alt;
    document.getElementById("photo-index").textContent = String(currentPhoto + 1);
    thumbnails.forEach((thumbnail, thumbnailIndex) => {
      const available=selectedListing.photos.length>1 && thumbnailIndex<selectedListing.photos.length;
      thumbnail.hidden=!available;
      if(!available)return;
      thumbnail.classList.toggle("is-selected", thumbnailIndex === currentPhoto);
      thumbnail.querySelector("img").src = photoUrl(selectedListing.photos[thumbnailIndex], 200);
    });
    const total=document.getElementById('photo-total');
    if(total)total.textContent=' / '+selectedListing.photos.length;
  }

  const galleryPrev=document.querySelector('.gallery-prev');
  const galleryNext=document.querySelector('.gallery-next');
  galleryPrev.hidden=galleryNext.hidden=selectedListing.photos.length<=1;
  renderPhoto(0);
  document.querySelector(".gallery-prev").addEventListener("click", () => renderPhoto(currentPhoto - 1));
  document.querySelector(".gallery-next").addEventListener("click", () => renderPhoto(currentPhoto + 1));
  thumbnails.forEach((thumbnail, index) => {
    thumbnail.addEventListener("click", () => renderPhoto(index));
  });

  function updateFavoriteButton() {
    const isFavorite = getFavorites().has(selectedListing.id);
    favoriteButton.setAttribute("aria-pressed", String(isFavorite));
    favoriteButton.classList.toggle("is-favorite", isFavorite);
    favoriteButton.querySelector("span").textContent = isFavorite ? "♥" : "♡";
  }
  updateFavoriteButton();

  favoriteButton.addEventListener("click", async () => {
    if(!requireLogin(document.querySelector('.detail-actions')||document.querySelector('.product-info')))return;
    const favorites = getFavorites();
    if (favorites.has(selectedListing.id)) favorites.delete(selectedListing.id);
    else favorites.add(selectedListing.id);
    try{await api("favorite",{id:selectedListing.id,enabled:favorites.has(selectedListing.id)});}catch(error){showToast(error.message);return;}
    saveFavorites(favorites);
    updateFavoriteButton();
    showToast(favorites.has(selectedListing.id) ? "Annonce ajoutée aux favoris." : "Annonce retirée des favoris.");
  });

  const sellerName=document.querySelector('.seller-info strong');
  if(sellerName)sellerName.textContent=selectedListing.sellerName||'Vendeur DEAL';
  const since=document.querySelector('.seller-info small');
  if(since&&selectedListing.sellerCreatedAt)since.textContent='Membre depuis '+new Date(selectedListing.sellerCreatedAt).toLocaleDateString('fr-FR',{year:'numeric',month:'long'});
  document.querySelector('.verified')?.remove();
  document.querySelector('.product-tag')?.remove();
  const sellerPicture=document.querySelector('.seller-card > img');
  if(sellerPicture){sellerPicture.alt='';sellerPicture.hidden=true;}
  const sellerInitials=document.createElement('span');sellerInitials.className='seller-avatar';
  sellerInitials.textContent=(selectedListing.sellerName||'D').trim()[0].toUpperCase();
  document.querySelector('.seller-card').prepend(sellerInitials);
  const published=document.getElementById('published-date');
  if(published&&selectedListing.createdAt)published.textContent=' · Publiée le '+new Date(selectedListing.createdAt).toLocaleDateString('fr-FR');
  document.querySelector(".contact-button").addEventListener("click",async()=>{
   if(!requireLogin())return;
   if(!selectedListing.sellerActive){showToast('Vendeur de démonstration indisponible.');return;}
   if(selectedListing.sellerId===session.user.id){showToast('Votre propre annonce.');return;}
   const message=prompt('Votre message au vendeur :');
   if(!message)return;
   try{await api('contact',{id:selectedListing.id,message});showToast('Message envoyé.');}
   catch(error){showToast(error.message);}
  });
  document.querySelector(".seller-card").addEventListener("click", () => {
    location.href='vendeur.html?id='+encodeURIComponent(selectedListing.sellerId);
  });
  document.querySelector(".share-button").addEventListener("click", async () => {
    const shareData = {
      title: selectedListing.title,
      text: `${selectedListing.title} · ${selectedListing.price}`,
      url: window.location.href
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        if (error.name !== "AbortError") showToast("Impossible de partager cette annonce.");
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Lien de l’annonce copié.");
    } catch {
      showToast("Le partage n’est pas disponible sur cet appareil.");
    }
  });
  renderListingGrid(
    document.getElementById("related-listings"),
    ANNONCES.filter((listing) => listing.id !== selectedListing.id).slice(0, 3)
  );
}


function showFormError(form,message){
 let node=form.querySelector('.deal-form-error');
 if(!node){node=document.createElement('p');node.className='deal-form-error';node.setAttribute('role','alert');form.append(node);}
 node.textContent=message;
}
function initLogin(){
 const form=document.getElementById('login-form');
 document.querySelector('.password-toggle')?.addEventListener('click',()=>{
  const input=document.getElementById('password');
  const reveal=input.type==='password';
  input.type=reveal?'text':'password';
  document.querySelector('.password-toggle')?.setAttribute('aria-pressed',String(reveal));
 });
 const signup=document.getElementById('create-account');
 if(signup)signup.addEventListener('click',()=>location.href=authHref('inscription.html'));
 form?.addEventListener('submit',async e=>{
  e.preventDefault();const btn=form.querySelector('[type=submit]');btn.disabled=true;
  try{
   await api('login',{email:form.elements.email.value,password:form.elements.password.value});
   const state=await api('session');
   if(!state.user)throw Error('La session n’a pas pu être ouverte.');
   location.href=safeNext();
  }catch(err){showFormError(form,err.message);btn.disabled=false;}
 });
}
function initSignup(){
 const form=document.getElementById('signup-form');
 const loginLink=document.querySelector('.deal-panel a[href="connexion.html"]');
 if(loginLink)loginLink.href=authHref('connexion.html');
 form?.addEventListener('submit',async e=>{
  e.preventDefault();const btn=form.querySelector('[type=submit]');btn.disabled=true;
  try{
   await api('signup',Object.fromEntries(new FormData(form)));
   const state=await api('session');
   if(!state.user)throw Error('Le compte a été créé, mais la session ne s’est pas ouverte.');
   location.href=safeNext();
  }catch(err){showFormError(form,err.message);btn.disabled=false;}
 });
}
function initNavigation(){
 const nav=document.querySelector('.main-nav');
 const loginLink=document.querySelector('.header-login');
 const actions=document.querySelector('.header-actions');
 const locationLabel=document.querySelector('.header-location');
 if(locationLabel)locationLabel.textContent='⌖ '+(session.user?.ville||'Maroc');
 const currentPage=location.pathname.split('/').pop()||'index.html';
 if(nav){
  nav.querySelectorAll('a').forEach(a=>{
   a.classList.toggle('is-active',a.getAttribute('href')===currentPage);
   if(a.getAttribute('href')===currentPage)a.setAttribute('aria-current','page');
   else a.removeAttribute('aria-current');
  });
 }
 if(!session.user){
  if(loginLink){
   if(page==='login'){loginLink.href=authHref('inscription.html');loginLink.textContent='Créer un compte';}
   else{loginLink.href=authHref('connexion.html');loginLink.textContent='Se connecter';}
  }
  return;
 }
 if(loginLink)loginLink.hidden=true;
 if(!actions||actions.querySelector('.deal-account-menu'))return;
 const menu=document.createElement('details');menu.className='deal-account-menu';
 const summary=document.createElement('summary');
 const initial=document.createElement('span');initial.className='deal-account-initial';
 initial.textContent=(session.user.nom||'D').trim().charAt(0).toUpperCase()||'D';
 const name=document.createElement('span');name.textContent='Mon espace';
 const arrow=document.createElement('span');arrow.className='deal-account-arrow';arrow.textContent='▾';
 summary.append(initial,name,arrow);
 const panel=document.createElement('nav');panel.className='deal-account-dropdown';panel.setAttribute('aria-label','Navigation du compte');
 const pages=[['mes-annonces.html','Mes annonces'],['favoris.html','Mes favoris'],['messages.html','Messages'],['profil.html','Mon profil']];
 for(const [href,label] of pages){
  const link=document.createElement('a');link.href=href;link.textContent=label;
  if(currentPage===href)link.setAttribute('aria-current','page');
  panel.append(link);
 }
 const logout=document.createElement('button');logout.type='button';logout.textContent='Se déconnecter';
 logout.addEventListener('click',async()=>{
  logout.disabled=true;
  try{await api('logout',{});location.href='index.html';}
  catch(error){showToast(error.message);logout.disabled=false;}
 });
 panel.append(logout);menu.append(summary,panel);actions.append(menu);
 document.addEventListener('click',event=>{if(!menu.contains(event.target))menu.open=false;});
}

function showAuthNotice() {
  const panel = document.querySelector('.deal-panel') || document.querySelector('.page-shell');
  if (!panel || panel.querySelector('.deal-auth-notice')) return;
  const note = document.createElement('p');
  note.className = 'deal-auth-notice';
  note.append(document.createTextNode('Pour accéder à cette fonctionnalité, '));
  const login = document.createElement('a');
  login.href = authHref('connexion.html');
  login.textContent = 'connectez-vous';
  note.append(login, document.createTextNode(' ou '));
  const signup = document.createElement('a');
  signup.href = authHref('inscription.html');
  signup.textContent = 'créez un compte';
  note.append(signup, document.createTextNode('.'));
  panel.append(note);
}
async function initPublish(){
  const form = document.getElementById('publish-form');
  if(!form)return;
  const notice = document.getElementById('message');
  const photo = form.elements.photo;
  const id = new URLSearchParams(location.search).get('id');
  const preview=document.getElementById('photo-preview');
  let currentPreviewUrl=null;
  function showPreview(src,name){
    if(!preview)return;
    preview.replaceChildren();
    if(!src){preview.hidden=true;return;}
    const image=document.createElement('img');image.src=src;image.alt='Aperçu de la photo';
    const label=document.createElement('span');label.textContent=name||'Photo actuelle de l’annonce';
    preview.append(image,label);preview.hidden=false;
  }
  photo?.addEventListener('change',()=>{
    const file=photo.files?.[0];
    if(!file){showPreview('','');return;}
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024){
      showPreview('','');showToast('Photo JPG, PNG ou WebP de 2 Mo maximum.');return;
    }
    if(currentPreviewUrl){URL.revokeObjectURL(currentPreviewUrl);currentPreviewUrl=null;}
    currentPreviewUrl=URL.createObjectURL(file);
    showPreview(currentPreviewUrl,file.name);
  });

  const draftKey='deal-publish-draft-v1';
  const draftFields=['titre','prix','ville','categorie','description'];
  if(!id){
    try{
      const saved=JSON.parse(sessionStorage.getItem(draftKey)||'null');
      if(saved&&typeof saved==='object'){
        for(const field of draftFields){
          if(typeof saved[field]==='string'&&form.elements[field])form.elements[field].value=saved[field];
        }
      }
    }catch{}
    const saveDraft=()=>{
      const obj={};
      for(const field of draftFields)obj[field]=form.elements[field]?.value||'';
      try{sessionStorage.setItem(draftKey,JSON.stringify(obj));}catch{}
    };
    form.addEventListener('input',saveDraft);
    form.addEventListener('change',saveDraft);
  }

  function showMessage(message, isError=true){
    notice.replaceChildren();
    notice.textContent=message;
    notice.classList.toggle('is-error',isError);
  }
  if(!session.user){
    notice.replaceChildren();
    notice.append(document.createTextNode('Pour publier, '));
    const link=document.createElement('a');
    link.href=authHref('connexion.html');link.textContent='connectez-vous';
    notice.append(link,document.createTextNode(' ou '));
    const signup=document.createElement('a');
    signup.href=authHref('inscription.html');signup.textContent='créez un compte';
    notice.append(signup,document.createTextNode('.'));
    if(sessionStorage.getItem(draftKey)){
      notice.append(document.createTextNode(' Votre brouillon texte est conservé sur cet appareil. Après connexion, sélectionnez à nouveau la photo.'));
    }
  }

  try{
    const categories=(await api('categories')).categories;
    const select=form.elements.categorie;
    if(categories.length){
      select.replaceChildren(...categories.map(cat=>{
        const option=document.createElement('option');option.value=cat.slug;option.textContent=cat.nom;return option;
      }));
    }
  }catch(error){showToast(error.message);}

  if(id){
    if(!session.user){
      showMessage('Connectez-vous pour modifier cette annonce.');
      return;
    }
    let listing;
    try{listing=(await api('detail',null,{id})).annonce;}
    catch(error){showMessage(error.message);return;}
    if(Number(listing.sellerId)!==Number(session.user.id)){
      showMessage('Vous ne pouvez modifier que vos propres annonces.');
      return;
    }
    for(const [name,value] of Object.entries({
      titre:listing.title,prix:listing.priceNumber,ville:listing.city,
      categorie:listing.cat,description:listing.description,
      photo1:listing.photos[0]||'',specs:listing.specs.join(', ')
    })){
      if(form.elements[name])form.elements[name].value=value;
    }
    photo.required=false;
    if(listing.photos[0])showPreview(photoUrl(listing.photos[0]),'Photo actuelle');
    document.getElementById('publish-title').textContent='Modifier mon annonce';
    form.querySelector('[type="submit"]').textContent='Enregistrer les modifications';
  }

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!session.user){
      showMessage('Connectez-vous pour publier votre annonce. La page ne change pas automatiquement.');
      return;
    }
    const button=form.querySelector('[type="submit"]');
    const initialLabel=button.textContent;
    button.disabled=true;
    showMessage('Enregistrement en cours...',false);
    try{
      const values={
        titre:form.elements.titre.value,
        prix:form.elements.prix.value,
        ville:form.elements.ville.value,
        categorie:form.elements.categorie.value,
        description:form.elements.description.value,
        photo1:form.elements.photo1.value,
        specs:form.elements.specs.value,
        photo2:'',photo3:''
      };
      const file=photo.files?.[0];
      if(file){
        if(file.size>2*1024*1024)throw new Error('La photo ne doit pas dépasser 2 Mo.');
        if(!['image/jpeg','image/png','image/webp'].includes(file.type))
          throw new Error('Formats acceptés : JPG, PNG ou WebP.');
        button.textContent='Envoi de la photo...';
        const dataUrl=await new Promise((resolve,reject)=>{
          const reader=new FileReader();
          reader.onload=()=>resolve(reader.result);
          reader.onerror=()=>reject(new Error('Impossible de lire la photo.'));
          reader.readAsDataURL(file);
        });
        const upload=await api('upload',{dataUrl});
        values.photo1=upload.url;
      }
      if(!values.photo1)throw new Error('Veuillez choisir une photo.');
      button.textContent='Enregistrement...';
      const saved=await api(id?'update':'publish',{...values,id});
      if(!id){
        form.reset();
        if(currentPreviewUrl){URL.revokeObjectURL(currentPreviewUrl);currentPreviewUrl=null;}
        showPreview('','');
        try{sessionStorage.removeItem(draftKey);}catch{}
      }
      notice.replaceChildren();
      notice.classList.remove('is-error');
      notice.append(document.createTextNode(id?'Annonce modifiée avec succès. ':'Annonce publiée avec succès. '));
      const link=document.createElement('a');
      link.href='produit.html?id='+encodeURIComponent(saved.id);
      link.textContent="Voir l'annonce";
      notice.append(link);
    }catch(error){
      showMessage(error.message);
      showToast(error.message);
    }finally{button.disabled=false;button.textContent=initialLabel;}
  });
}
async function initMyListings(){
 const count=document.getElementById('my-count');
 const container=document.getElementById('my-listings');
 const empty=document.getElementById('my-empty');
 if(!session.user){
  if(count)count.textContent='Connectez-vous pour retrouver vos publications.';
  showAuthNotice();return;
 }
 try{
  const items=(await api('mine')).annonces;
  container.replaceChildren();
  if(count)count.textContent=items.length+' annonce'+(items.length>1?'s':'')+' active'+(items.length>1?'s':'');
  if(empty)empty.hidden=items.length>0;
  for(const listing of items){
   const card=createListingCard(listing),controls=document.createElement('div');controls.className='deal-card-actions';
   const edit=document.createElement('a');edit.href='publier.html?id='+encodeURIComponent(listing.id);edit.textContent='Modifier';edit.className='button button-outline';
   const remove=document.createElement('button');remove.textContent='Retirer';remove.type='button';remove.className='button button-outline';
   remove.addEventListener('click',async()=>{
    if(!confirm('Retirer définitivement cette annonce des résultats publics ?'))return;
    remove.disabled=true;
    try{
     await api('delete',{id:listing.id});card.remove();showToast('Annonce retirée.');
     const left=container.querySelectorAll('.listing-card').length;
     if(count)count.textContent=left+' annonce'+(left>1?'s':'')+' active'+(left>1?'s':'');
     if(empty)empty.hidden=left!==0;
    }catch(error){showToast(error.message);remove.disabled=false;}
   });
   controls.append(edit,remove);card.append(controls);container.append(card);
  }
 }catch(error){if(count)count.textContent='Impossible de charger les annonces.';showToast(error.message);}
}

async function initMessages(){
 const container=document.getElementById('messages-list');
 const empty=document.getElementById('messages-empty');
 if(!session.user){container.replaceChildren();showAuthNotice();return;}
 try{
  const items=(await api('messages')).messages;
  container.replaceChildren();
  if(empty)empty.hidden=items.length>0;
  for(const item of items){
   const card=document.createElement('article');card.className='deal-message';
   const sent=Number(item.expediteur_id)===Number(session.user.id);
   const header=document.createElement('div');header.className='deal-message-head';
   const title=document.createElement('strong');title.textContent=(sent?'À '+item.destinataire:'De '+item.expediteur)+' · '+item.annonce;
   const timestamp=document.createElement('small');
   timestamp.textContent=new Date(item.cree_le).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'});
   header.append(title,timestamp);
   const content=document.createElement('p');content.textContent=item.contenu;
   const actions=document.createElement('div');actions.className='deal-message-actions';
   const link=document.createElement('a');link.href='produit.html?id='+encodeURIComponent(item.annonce_id);link.textContent="Voir l'annonce";link.className='text-link';
   const reply=document.createElement('button');reply.type='button';reply.className='button button-outline';reply.textContent='Répondre';
   const editor=document.createElement('form');editor.className='deal-reply-form';editor.hidden=true;
   const field=document.createElement('textarea');field.placeholder='Écrivez votre réponse...';field.rows=3;field.maxLength=2000;field.minLength=3;field.required=true;field.setAttribute('aria-label','Votre réponse');
   const send=document.createElement('button');send.type='submit';send.className='button button-primary';send.textContent='Envoyer la réponse';
   const cancel=document.createElement('button');cancel.type='button';cancel.className='button button-outline';cancel.textContent='Annuler';
   cancel.addEventListener('click',()=>{editor.hidden=true;reply.hidden=false;});
   reply.addEventListener('click',()=>{editor.hidden=false;reply.hidden=true;field.focus();});
   editor.append(field,send,cancel);
   editor.addEventListener('submit',async event=>{
    event.preventDefault();send.disabled=true;
    try{await api('reply',{messageId:item.id,message:field.value.trim()});showToast('Réponse envoyée.');await initMessages();}
    catch(error){showToast(error.message);send.disabled=false;}
   });
   actions.append(link,reply);card.append(header,content,actions,editor);container.append(card);
  }
 }catch(error){container.replaceChildren();showToast(error.message);}
}

async function initFavorites(){
 const count=document.getElementById('favorite-count');
 const empty=document.getElementById('favorites-empty');
 if(!session.user){
  if(count)count.textContent='Connectez-vous pour consulter votre sélection.';
  showAuthNotice();return;
 }
 try{
  const listings=(await api('favorites')).annonces;
  renderListingGrid(document.getElementById('favorite-listings'),listings);
  if(count)count.textContent=listings.length+' annonce'+(listings.length>1?'s':'')+' enregistrée'+(listings.length>1?'s':'');
  if(empty)empty.hidden=listings.length>0;
 }catch(error){if(count)count.textContent='Chargement impossible.';showToast(error.message);}
}

async function initSeller(){
 const id=new URLSearchParams(location.search).get('id');
 const name=document.getElementById('seller-name');
 if(!id){if(name)name.textContent='Vendeur introuvable';return;}
 try{
  const result=await api('seller',null,{id});
  if(name)name.textContent=result.seller.nom;
  const avatar=document.getElementById('seller-avatar');
  if(avatar)avatar.textContent=(result.seller.nom||'D').trim().charAt(0).toUpperCase()||'D';
  document.getElementById('seller-location').textContent='⌖ '+(result.seller.ville||'Maroc');
  document.getElementById('seller-since').textContent='Membre depuis '+new Date(result.seller.cree_le).toLocaleDateString('fr-FR',{year:'numeric',month:'long'});
  document.getElementById('seller-count').textContent=result.annonces.length+' annonce'+(result.annonces.length>1?'s':'');
  renderListingGrid(document.getElementById('seller-listings'),result.annonces);
  const empty=document.getElementById('seller-empty');
  if(empty)empty.hidden=result.annonces.length>0;
 }catch(error){if(name)name.textContent='Profil indisponible';showToast(error.message);}
}

async function initProfile(){
 if(!session.user){showAuthNotice();return;}
 const form=document.getElementById('profile-form');
 form.elements.nom.value=session.user.nom;
 form.elements.ville.value=session.user.ville||'';
 document.getElementById('profile-email').textContent=session.user.email;
 const message=document.createElement('p');message.className='deal-profile-message';message.setAttribute('role','status');form.append(message);
 form.addEventListener('submit',async event=>{
  event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;
  message.textContent='';
  try{
   const response=await api('profile',Object.fromEntries(new FormData(form)));
   session.user=response.user;
   message.textContent='Vos informations ont bien été enregistrées.';
   const locationLabel=document.querySelector('.header-location');
   if(locationLabel)locationLabel.textContent='⌖ '+(response.user.ville||'Maroc');
  }catch(error){message.textContent=error.message;showToast(error.message);}
  finally{button.disabled=false;}
 });
}

(async()=>{
 try{
  const state=await api('session');
  session={user:state.user,favorites:state.favorites||[]};
  initNavigation();
  const headerLocation=document.querySelector('.header-location');
  if(headerLocation)headerLocation.textContent='⌖ '+(session.user?.ville||'Maroc');
  if(page==='login'){initLogin();return;}
  if(page==='signup'){initSignup();return;}
  if(page==='publish'){await initPublish();return;}
  ANNONCES=(await api('list')).annonces;
  if(page==='home')await initHome();
  if(page==='listings')await initListings();
  if(page==='product')await initProduct();
  if(page==='my-listings')await initMyListings();
  if(page==='messages')await initMessages();
   if(page==='favorites')await initFavorites();
   if(page==='seller')await initSeller();
   if(page==='profile')await initProfile();
 }catch(err){showToast(err.message);const container=document.getElementById('listings');if(container)container.textContent='Service indisponible. Rechargez la page.';}
})();
