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
  toast.classList.remove('deal-toast-action');
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

function showAuthToast(message='Connectez-vous pour enregistrer vos favoris.') {
 if(!toast)return;
 toast.replaceChildren();
 const span=document.createElement('span');span.textContent=message+' ';
 const link=document.createElement('a');link.href=authHref('connexion.html');link.textContent='Se connecter';
 toast.append(span,link);
 toast.classList.add('is-visible','deal-toast-action');
 window.clearTimeout(toastTimer);
 toastTimer=window.setTimeout(()=>toast.classList.remove('is-visible','deal-toast-action'),7000);
}
function requireLogin(){
 if(session.user)return true;
 showAuthToast();
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
  category.textContent = listing.categoryLabel+(listing.type?' · '+listing.type:'');
  const title = document.createElement("span");
  title.className = "listing-title";
  title.textContent = listing.title;
  const price = document.createElement("strong");
  price.className = "listing-price";
  price.textContent = listing.price;
  const city = document.createElement("span");
  city.className = "listing-city";
  city.textContent = `⌖ ${listing.city}${listing.country&&listing.country!=='Maroc'?', '+listing.country:''}`;
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
    if(!requireLogin())return;
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

async 
let cachedLocations=null,cachedCategories=null;
async function getLocations(){
 if(!cachedLocations)cachedLocations=api('locations').catch(e=>{cachedLocations=null;throw e;});
 return cachedLocations;
}
async function getCategories(){
 if(!cachedCategories)cachedCategories=api('categories').catch(e=>{cachedCategories=null;throw e;});
 return cachedCategories;
}
function fillCountries(select,countries,initial,anyLabel='Tous les pays'){
 if(!select)return;
 const options=[{value:'',label:anyLabel},...countries.map(c=>({value:c,label:c}))];
 select.replaceChildren(...options.map(item=>{
  const o=document.createElement('option');o.value=item.value;o.textContent=item.label;return o;
 }));
 select.value=options.some(o=>o.value===initial)?initial:'';
}
function fillCities(datalist,cities){
 if(!datalist)return;
 datalist.replaceChildren(...cities.map(city=>{
  const item=document.createElement('option');item.value=city;return item;
 }));
}
function fillTypes(select,types,category,previous='',allLabel='Tous les types'){
 if(!select)return;
 const choices=category==='all'?'':category;
 const vals=choices?(types[choices]||[]):[];
 select.replaceChildren(...[{value:'',label:allLabel},...vals.map(t=>({value:t,label:t}))].map(item=>{
  const option=document.createElement('option');option.value=item.value;option.textContent=item.label;return option;
 }));
 if(vals.includes(previous))select.value=previous;
}
async function initHome(){
 renderListingGrid(document.getElementById('listings'),ANNONCES);
 try{
  const [{categories},locationData]=await Promise.all([getCategories(),getLocations()]);
  const holder=document.querySelector('.category-cards');
  const existing=[...holder.children];
  const cards=categories.map((row,index)=>{
   let card=existing.find(e=>e.getAttribute('href')==='annonces.html?category='+row.slug);
   if(card)card=card.cloneNode(true);
   else{
    card=document.createElement('a');card.className='category-card';
    const ico=document.createElement('span');ico.className='category-icon';ico.setAttribute('aria-hidden','true');
    ico.textContent=['♧','◇','⌂','▯','▣','◈','◉','✦','◌','⚙'][index%10];
    const body=document.createElement('span'),title=document.createElement('strong'),small=document.createElement('small');
    body.append(title,small);const arrow=document.createElement('span');arrow.className='category-arrow';arrow.textContent='→';
    card.append(ico,body,arrow);
   }
   card.href='annonces.html?category='+encodeURIComponent(row.slug);
   card.querySelector('strong').textContent=row.nom;
   const count=ANNONCES.filter(a=>a.cat===row.slug).length;
   card.querySelector('small').textContent=count+' annonce'+(count!==1?'s':'');
   return card;
  });
  holder.replaceChildren(...cards);
  const country=document.getElementById('home-country'),city=document.getElementById('home-city');
  fillCountries(country,locationData.countries,'Maroc');
  const sync=()=>{fillCities(document.getElementById('home-cities'),locationData.cities[country.value]||[]);city.value='';};
  fillCities(document.getElementById('home-cities'),locationData.cities[country.value]||[]);
  country.addEventListener('change',sync);
 }catch(e){showToast(e.message);}
}


async function initListings() {
 const searchInput=document.getElementById('search'),country=document.getElementById('filter-country'),
 city=document.getElementById('filter-city'),type=document.getElementById('filter-type'),
 categoryList=document.querySelector('.category-list');
 const resultsCount=document.getElementById('results-count');
 const emptyState=document.getElementById('empty-state');
 const grid=document.getElementById('listings');
 const queryParams=new URLSearchParams(location.search);
 let selectedCategory=queryParams.get('category')||'all';
 let serial=0,timer,types={},locs={countries:['Maroc'],cities:{}};
 searchInput.value=queryParams.get('q')||'';
 city.value=queryParams.get('ville')||'';
 let buttons=[];
 try{
  const [cats,locations]=await Promise.all([getCategories(),getLocations()]);
  types=cats.types||{};locs=locations;
  categoryList.replaceChildren();
  for(const item of [{slug:'all',nom:'Tout'},...cats.categories]){
   const btn=document.createElement('button');btn.className='category-chip';btn.type='button';
   btn.dataset.category=item.slug;btn.textContent=item.nom;categoryList.append(btn);
  }
  fillCountries(country,locs.countries,queryParams.get('pays')||'');
  fillCities(document.getElementById('filter-cities'),locs.cities[country.value]||[]);
 }catch(error){showToast(error.message);}
 buttons=[...categoryList.querySelectorAll('.category-chip')];
 if(!buttons.some(b=>b.dataset.category===selectedCategory))selectedCategory='all';
 const updateType=old=>fillTypes(type,types,selectedCategory,old,'Tous les types');
 updateType(queryParams.get('type')||'');
 async function updateListings(){
  const current=++serial;
  const q=searchInput.value.trim(),pays=country.value,ville=city.value.trim(),kind=type.value;
  resultsCount.textContent='Recherche...';
  try{
   const result=await api('list',null,{category:selectedCategory,q,pays,ville,type:kind});
   if(current!==serial)return;
   renderListingGrid(grid,result.annonces);
   resultsCount.textContent=result.annonces.length+' annonce'+(result.annonces.length!==1?'s':'');
   emptyState.hidden=result.annonces.length>0;
   const next=new URLSearchParams();
   if(selectedCategory!=='all')next.set('category',selectedCategory);
   if(q)next.set('q',q);
   if(pays)next.set('pays',pays);
   if(ville)next.set('ville',ville);
   if(kind)next.set('type',kind);
   history.replaceState(null,'',location.pathname+(next.size?'?'+next:''));
  }catch(error){if(current===serial){resultsCount.textContent='Recherche indisponible';showToast(error.message);}}
  buttons.forEach(btn=>btn.classList.toggle('is-active',btn.dataset.category===selectedCategory));
 }
 buttons.forEach(btn=>btn.addEventListener('click',()=>{
  selectedCategory=btn.dataset.category;updateType('');updateListings();
 }));
 country.addEventListener('change',()=>{
  city.value='';fillCities(document.getElementById('filter-cities'),locs.cities[country.value]||[]);updateListings();
 });
 type.addEventListener('change',updateListings);
 city.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(updateListings,280);});
 searchInput.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(updateListings,280);});
 document.querySelector('.listing-search').addEventListener('submit',event=>{
  event.preventDefault();clearTimeout(timer);updateListings();
 });
 document.getElementById('clear-filters').addEventListener('click',()=>{
  searchInput.value='';country.value='';city.value='';selectedCategory='all';updateType('');
  fillCities(document.getElementById('filter-cities'),[]);updateListings();
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
  const thumbnailRow=document.querySelector('.thumbnail-row');
  const thumbnailCategory=thumbnailRow.querySelector('.detail-category');
  const favoriteButton = document.querySelector(".favorite-button");
  let currentPhoto = 0;

  document.title = `DEAL — ${selectedListing.title}`;
  detailName.textContent = selectedListing.title;
  detailPrice.textContent = selectedListing.price;
  detailCity.textContent = selectedListing.city+(selectedListing.country&&selectedListing.country!=='Maroc'?', '+selectedListing.country:'');
  detailDescription.textContent = selectedListing.description;
  detailCategory.textContent = selectedListing.categoryLabel+(selectedListing.type?' · '+selectedListing.type:'');
  detailSpecifications.replaceChildren(...selectedListing.specs.map((specification) => {
    const chip = document.createElement("span");
    chip.textContent = specification;
    return chip;
  }));


  const images=selectedListing.photos?.length?selectedListing.photos:[null];
  let thumbnails=[];
  thumbnailRow.replaceChildren();
  for(let i=0;i<images.length;i++){
    if(images.length===1)break;
    const btn=document.createElement('button');btn.type='button';
    btn.className='thumbnail';btn.setAttribute('aria-label','Photo '+(i+1));
    const img=document.createElement('img');img.src=photoUrl(images[i],200);img.alt='';
    btn.append(img);btn.addEventListener('click',()=>renderPhoto(i));thumbnailRow.append(btn);
    thumbnails.push(btn);
  }
  thumbnailRow.append(thumbnailCategory);
  function renderPhoto(index){
    currentPhoto=(index+images.length)%images.length;
    detailImage.src=photoUrl(images[currentPhoto],1200);
    detailImage.alt=selectedListing.alt;
    document.getElementById('photo-index').textContent=String(currentPhoto+1);
    document.getElementById('photo-total').textContent=' / '+images.length;
    thumbnails.forEach((button,i)=>button.classList.toggle('is-selected',i===currentPhoto));
  }
  const prev=document.querySelector('.gallery-prev'),next=document.querySelector('.gallery-next');
  prev.hidden=next.hidden=images.length<=1;
  prev.addEventListener('click',()=>renderPhoto(currentPhoto-1));
  next.addEventListener('click',()=>renderPhoto(currentPhoto+1));
  renderPhoto(0);
  function updateFavoriteButton() {
    const isFavorite = getFavorites().has(selectedListing.id);
    favoriteButton.setAttribute("aria-pressed", String(isFavorite));
    favoriteButton.classList.toggle("is-favorite", isFavorite);
    favoriteButton.querySelector("span").textContent = isFavorite ? "♥" : "♡";
  }
  updateFavoriteButton();

  favoriteButton.addEventListener("click", async () => {
    if(!requireLogin())return;
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
  if(sellerPicture && selectedListing.sellerAvatar){
    sellerPicture.src=selectedListing.sellerAvatar;
    sellerPicture.alt='Photo du vendeur';
    sellerPicture.hidden=false;
  }else{
    if(sellerPicture)sellerPicture.hidden=true;
    const initials=document.createElement('span');initials.className='seller-avatar';
    initials.textContent=(selectedListing.sellerName||'D').trim().charAt(0).toUpperCase();
    document.querySelector('.seller-card').prepend(initials);
  }
  const published=document.getElementById('published-date');
  if(published&&selectedListing.createdAt)published.textContent=' · Publiée le '+new Date(selectedListing.createdAt).toLocaleDateString('fr-FR');
  document.querySelector(".contact-button").addEventListener("click",async()=>{
   if(!session.user){showAuthToast('Connectez-vous pour contacter ce vendeur.');return;}
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
 if(locationLabel){
   const link=document.createElement('a');
   link.href='annonces.html#location-filters';
   link.className='deal-location-link';
   link.title='Choisir un pays et une ville';
   link.textContent='⌖ Pays / ville ▾';
   locationLabel.replaceChildren(link);
 }
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
  const form=document.getElementById('publish-form');
  if(!form)return;
  const photo=form.elements.photo,notice=document.getElementById('message');
  const preview=document.getElementById('photo-preview');
  const id=new URLSearchParams(location.search).get('id');
  const draftKey='deal-publish-draft-v2';
  const fields=['titre','prix','pays','ville','categorie','type_annonce','description'];
  let existingPhotos=[],urls=[],categories=[],locations={countries:['Maroc'],cities:{Maroc:[]}},types={};
  photo.required=false;

  function message(text,error=false){
    notice.replaceChildren();notice.classList.toggle('is-error',error);notice.textContent=text;
  }
  function clearObjectUrls(){
    urls.forEach(url=>URL.revokeObjectURL(url));urls=[];
  }
  function showPhotos(){
    clearObjectUrls();
    preview.replaceChildren();
    const files=[...photo.files||[]];
    for(const [i,src] of existingPhotos.entries()){
      const card=document.createElement('div');card.className='deal-photo-item';
      const img=document.createElement('img');img.src=photoUrl(src);img.alt='Photo actuelle '+(i+1);
      const remove=document.createElement('button');remove.type='button';remove.textContent='×';
      remove.setAttribute('aria-label','Supprimer cette photo');
      remove.addEventListener('click',()=>{existingPhotos.splice(i,1);showPhotos();});
      card.append(img,remove);preview.append(card);
    }
    for(const [i,file] of files.entries()){
      const blob=URL.createObjectURL(file);urls.push(blob);
      const card=document.createElement('div');card.className='deal-photo-item';
      const img=document.createElement('img');img.src=blob;img.alt='Nouvelle photo '+(i+1);
      const text=document.createElement('span');text.textContent=file.name;
      card.append(img,text);preview.append(card);
    }
    preview.hidden=!existingPhotos.length&&!files.length;
  }
  photo.addEventListener('change',()=>{
    const files=[...photo.files||[]];
    if(files.length+existingPhotos.length>5){
      photo.value='';showPhotos();showToast('Vous pouvez ajouter 5 photos maximum.');return;
    }
    if(files.some(file=>file.size>2*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))){
      photo.value='';showPhotos();showToast('Chaque photo doit être JPG, PNG ou WebP, et ne pas dépasser 2 Mo.');return;
    }
    showPhotos();
  });
  function saveDraft(){
    if(id)return;
    const draft={};
    fields.forEach(field=>draft[field]=form.elements[field]?.value||'');
    try{sessionStorage.setItem(draftKey,JSON.stringify(draft));}catch{}
  }
  form.addEventListener('input',saveDraft);
  form.addEventListener('change',saveDraft);
  try{
    const [catResult,locResult]=await Promise.all([getCategories(),getLocations()]);
    categories=catResult.categories;types=catResult.types||{};locations=locResult;
    const select=form.elements.categorie,initial=select.value;
    select.replaceChildren(...categories.map(c=>{const o=document.createElement('option');o.value=c.slug;o.textContent=c.nom;return o;}));
    if(categories.some(c=>c.slug===initial))select.value=initial;
    fillCountries(form.elements.pays,locations.countries,'Maroc','Choisir un pays');
    const onCountry=()=>fillCities(document.getElementById('publish-cities'),locations.cities[form.elements.pays.value]||[]);
    const onCategory=previous=>fillTypes(form.elements.type_annonce,types,select.value,previous,'Choisir un type (facultatif)');
    form.elements.pays.addEventListener('change',()=>{form.elements.ville.value='';onCountry();});
    select.addEventListener('change',()=>onCategory(''));
    onCountry();onCategory('');
    if(!id){
      try{
        const saved=JSON.parse(sessionStorage.getItem(draftKey)||'null');
        if(saved&&typeof saved==='object'){
          for(const field of fields){
            if(typeof saved[field]==='string'&&form.elements[field])form.elements[field].value=saved[field];
          }
          onCountry();onCategory(saved.type_annonce||'');
        }
      }catch{}
    }
  }catch(error){showToast(error.message);}
  if(id){
    if(!session.user){showAuthToast('Connectez-vous pour modifier votre annonce.');return;}
    let listing;
    try{listing=(await api('detail',null,{id})).annonce;}
    catch(error){message(error.message,true);return;}
    if(Number(listing.sellerId)!==Number(session.user.id)){
      message('Vous ne pouvez modifier que vos propres annonces.',true);return;
    }
    const data={titre:listing.title,prix:String(listing.priceNumber),pays:listing.country||'Maroc',
      ville:listing.city,categorie:listing.cat,type_annonce:listing.type||'',description:listing.description};
    for(const [name,value] of Object.entries(data)){
      if(form.elements[name])form.elements[name].value=value;
    }
    fillCities(document.getElementById('publish-cities'),locations.cities[form.elements.pays.value]||[]);
    fillTypes(form.elements.type_annonce,types,form.elements.categorie.value,listing.type||'','Choisir un type (facultatif)');
    existingPhotos=(listing.photos||[]).slice(0,5);
    showPhotos();
    document.getElementById('publish-title').textContent="Modifier mon annonce";
    form.querySelector('[type="submit"]').textContent='Enregistrer les modifications';
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!session.user){saveDraft();showAuthToast('Connectez-vous pour publier votre annonce.');return;}
    const button=form.querySelector('[type="submit"]');
    const original=button.textContent;
    button.disabled=true;
    message('Enregistrement en cours...');
    try{
      const selected=[...photo.files||[]];
      if(selected.length+existingPhotos.length<1)throw Error('Choisissez au moins une photo.');
      if(selected.length+existingPhotos.length>5)throw Error('5 photos maximum.');
      if(selected.some(file=>file.size>2*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)))
        throw Error('Vérifiez les photos : JPG, PNG, WebP, 2 Mo par photo.');
      const photos=[...existingPhotos];
      for(let i=0;i<selected.length;i++){
        button.textContent='Envoi photo '+(i+1)+' / '+selected.length+'...';
        const dataUrl=await new Promise((resolve,reject)=>{
          const reader=new FileReader();
          reader.onload=()=>resolve(reader.result);
          reader.onerror=()=>reject(Error('Lecture impossible de la photo.'));
          reader.readAsDataURL(selected[i]);
        });
        const uploaded=await api('upload',{dataUrl});
        photos.push(uploaded.url);
      }
      const data={
        titre:form.elements.titre.value,prix:form.elements.prix.value,
        pays:form.elements.pays.value||'Maroc',ville:form.elements.ville.value,
        categorie:form.elements.categorie.value,type_annonce:form.elements.type_annonce.value,
        description:form.elements.description.value,specs:'',
        id
      };
      for(let i=0;i<5;i++)data['photo'+(i+1)]=photos[i]||'';
      button.textContent='Enregistrement...';
      const saved=await api(id?'update':'publish',data);
      if(!id){
        form.reset();existingPhotos=[];photo.value='';showPhotos();
        try{sessionStorage.removeItem(draftKey);}catch{}
      }
      notice.replaceChildren();
      notice.classList.remove('is-error');
      notice.append(document.createTextNode(id?'Annonce modifiée avec succès. ':'Annonce publiée avec succès. '));
      const link=document.createElement('a');link.href='produit.html?id='+encodeURIComponent(saved.id);link.textContent="Voir l'annonce";notice.append(link);
    }catch(error){message(error.message,true);showToast(error.message);}
    finally{button.disabled=false;button.textContent=original;}
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


function displayMemberPhoto(node,name,url){
 if(!node)return;
 node.replaceChildren();
 const fallback=()=>{
  node.replaceChildren();
  const initials=document.createElement('span');
  initials.textContent=(name||'D').trim().charAt(0).toUpperCase()||'D';
  node.append(initials);
 };
 if(!url || !/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url)){fallback();return;}
 const img=document.createElement('img');img.src=url;img.alt='Photo de profil';img.loading='lazy';
 img.onerror=fallback;
 node.append(img);
}
function formatMemberSince(value){
 if(!value)return '';
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return '';
 return 'Membre depuis '+date.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
}
async function initSeller(){
 const id=new URLSearchParams(location.search).get('id');
 const name=document.getElementById('seller-name');
 if(!id){if(name)name.textContent='Vendeur introuvable';return;}
 try{
  const result=await api('seller',null,{id});
  const user=result.seller;
  if(name)name.textContent=user.nom||'Vendeur DEAL';
  displayMemberPhoto(document.getElementById('seller-avatar'),user.nom,user.avatar_url);
  document.getElementById('seller-location').textContent='⌖ '+(user.ville||'Maroc');
  document.getElementById('seller-since').textContent=formatMemberSince(user.cree_le);
  document.getElementById('seller-count').textContent=result.annonces.length+' annonce'+(result.annonces.length!==1?'s':'');
  const total=document.getElementById('seller-ads-total');if(total)total.textContent=String(result.annonces.length);
  renderListingGrid(document.getElementById('seller-listings'),result.annonces);
  const empty=document.getElementById('seller-empty');
  if(empty)empty.hidden=result.annonces.length>0;
 }catch(error){if(name)name.textContent='Profil indisponible';showToast(error.message);}
}
async function initProfile(){
 if(!session.user){
  const heading=document.getElementById('profile-name');
  if(heading)heading.textContent='Mon profil';
  const section=document.querySelector('.deal-member-content');if(section)section.hidden=true;
  showAuthNotice();return;
 }
 const form=document.getElementById('profile-form'),status=document.getElementById('profile-save-status');
 const fileInput=document.getElementById('profile-avatar-file');
 const photo=document.getElementById('profile-photo');
 function updateHeader(){
  const u=session.user;
  document.getElementById('profile-name').textContent=u.nom;
  document.getElementById('profile-location').textContent='⌖ '+(u.ville||'Maroc');
  document.getElementById('profile-since').textContent=formatMemberSince(u.cree_le);
  displayMemberPhoto(photo,u.nom,u.avatar_url);
 }
 updateHeader();
 form.elements.nom.value=session.user.nom;
 form.elements.ville.value=session.user.ville||'';
 document.getElementById('profile-email').textContent=session.user.email;
 try{
  const mine=(await api('mine')).annonces;
  document.getElementById('profile-listings-count').textContent=String(mine.length);
  document.getElementById('profile-ads-count').textContent=mine.length+' annonce'+(mine.length!==1?'s':'')+' publiée'+(mine.length!==1?'s':'');
  renderListingGrid(document.getElementById('profile-listings'),mine);
  document.getElementById('profile-ads-empty').hidden=mine.length>0;
 }catch(error){document.getElementById('profile-ads-count').textContent='Chargement indisponible';showToast(error.message);}
 fileInput.addEventListener('change',()=>{
  const file=fileInput.files?.[0];
  if(!file){updateHeader();return;}
  if(file.size>2*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(file.type)){
   fileInput.value='';status.textContent='Choisissez une photo JPG, PNG ou WebP de 2 Mo maximum.';return;
  }
  const preview=URL.createObjectURL(file);
  const image=document.createElement('img');image.src=preview;image.alt='Aperçu de votre photo';
  image.onload=()=>URL.revokeObjectURL(preview);
  image.onerror=()=>{URL.revokeObjectURL(preview);updateHeader();};
  photo.replaceChildren(image);
  status.textContent='Aperçu prêt. Enregistrez le profil pour conserver cette photo.';
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const btn=form.querySelector('[type=submit]');btn.disabled=true;
  status.textContent='Enregistrement en cours...';
  try{
   const u=(await api('profile',{nom:form.elements.nom.value,ville:form.elements.ville.value})).user;
   session.user=u;
   updateHeader();
   const file=fileInput.files?.[0];
   if(file){
    if(file.size>2*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Photo invalide (2 Mo maximum).');
    status.textContent='Envoi de la photo vers Cloudinary...';
    const dataUrl=await new Promise((resolve,reject)=>{
     const reader=new FileReader();reader.onload=()=>resolve(reader.result);
     reader.onerror=()=>reject(Error('Lecture de la photo impossible.'));
     reader.readAsDataURL(file);
    });
    session.user=(await api('avatar',{dataUrl})).user;
    fileInput.value='';
   }
   updateHeader();
   status.textContent='Profil enregistré avec succès.';
   showToast('Votre profil a été mis à jour.');
  }catch(error){status.textContent=error.message;showToast(error.message);}
  finally{btn.disabled=false;}
 });
}

(async()=>{
 try{
  const state=await api('session');
  session={user:state.user,favorites:state.favorites||[]};
  initNavigation();

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
