let ANNONCES = [];
let session = {user:null,favorites:[]};
const page = document.body.dataset.page;
async function api(action,data=null){
 const options={credentials:'same-origin'};
 if(data!==null){options.method='POST';options.headers={'Content-Type':'application/json'};options.body=JSON.stringify(data);}
 const response=await fetch('/api/index?action='+encodeURIComponent(action),options);
 const result=await response.json();
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
function requireLogin(){if(session.user)return true;showToast('Connectez-vous pour continuer.');return false;}
function photoUrl(photo, width = 700) {
  return photo?.startsWith('https://') ? photo : `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=${width}&q=85`;
}

function createListingCard(listing, favorites) {
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
    if(!requireLogin())return;
    const nextFavorites = getFavorites();
    const willBeFavorite = !nextFavorites.has(listing.id);
    if (willBeFavorite) nextFavorites.add(listing.id);
    else nextFavorites.delete(listing.id);
    try{await api("favorite",{id:listing.id,enabled:willBeFavorite});}catch(error){showToast(error.message);return;}
    saveFavorites(nextFavorites);
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

function initHome() {
  renderListingGrid(document.getElementById("listings"), ANNONCES);
}

function initListings() {
  const searchInput = document.getElementById("search");
  const categoryButtons = [...document.querySelectorAll(".category-chip")];
  const resultsCount = document.getElementById("results-count");
  const emptyState = document.getElementById("empty-state");
  const grid = document.getElementById("listings");
  const queryParams = new URLSearchParams(window.location.search);
  let selectedCategory = queryParams.get("category") || "all";

  searchInput.value = queryParams.get("q") || "";

  function updateListings() {
    const query = searchInput.value.trim().toLocaleLowerCase("fr");
    const filtered = ANNONCES.filter((listing) => {
      const matchesCategory = selectedCategory === "all" || listing.cat === selectedCategory;
      const searchableText = `${listing.title} ${listing.city} ${listing.categoryLabel}`.toLocaleLowerCase("fr");
      return matchesCategory && (!query || searchableText.includes(query));
    });
    renderListingGrid(grid, filtered);
    resultsCount.textContent = `${filtered.length} annonce${filtered.length > 1 ? "s" : ""}`;
    emptyState.hidden = filtered.length > 0;
    categoryButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.category === selectedCategory);
    });
  }

  categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedCategory = button.dataset.category;
      const params = new URLSearchParams(window.location.search);
      if (selectedCategory === "all") params.delete("category");
      else params.set("category", selectedCategory);
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
      updateListings();
    });
  });

  searchInput.addEventListener("input", updateListings);
  document.querySelector(".listing-search").addEventListener("submit", (event) => {
    event.preventDefault();
    updateListings();
  });
  updateListings();
}

function initProduct() {
  const params = new URLSearchParams(window.location.search);
  const selectedListing = ANNONCES.find((listing) => listing.id === params.get("id")) || ANNONCES[0];
  if(!selectedListing){showToast("Annonce indisponible.");return;}
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
      thumbnail.classList.toggle("is-selected", thumbnailIndex === currentPhoto);
      thumbnail.querySelector("img").src = photoUrl(selectedListing.photos[thumbnailIndex], 200);
    });
  }

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
  document.querySelector('.verified')?.remove();
  document.querySelector('.product-tag')?.remove();
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
    showToast("Connectez-vous pour consulter le profil du vendeur.");
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


function initLogin(){
 const toggle=document.querySelector('.password-toggle');
 toggle?.addEventListener('click',()=>{const input=document.getElementById('password');input.type=input.type==='password'?'text':'password';});
 document.getElementById('login-form')?.addEventListener('submit',async e=>{
 e.preventDefault();const button=e.currentTarget.querySelector('[type=submit]');button.disabled=true;
 try{await api('login',{email:document.getElementById('email').value,password:document.getElementById('password').value});location.href='mes-annonces.html';}
 catch(err){showToast(err.message);button.disabled=false;}
 });
 document.getElementById('create-account')?.addEventListener('click',()=>location.href='inscription.html');
 document.getElementById('forgot-password')?.addEventListener('click',()=>showToast('Réinitialisation non disponible.'));
}
function initSignup(){
 document.getElementById('signup-form')?.addEventListener('submit',async e=>{
 e.preventDefault();const btn=e.currentTarget.querySelector('[type=submit]');btn.disabled=true;
 try{await api('signup',Object.fromEntries(new FormData(e.currentTarget)));location.href='mes-annonces.html';}
 catch(err){showToast(err.message);btn.disabled=false;}
 });
}
function initNavigation(){
 const nav=document.querySelector('.main-nav');
 if(session.user){
  for(const [href,label] of [['publier.html','Publier'],['mes-annonces.html','Mes annonces'],['messages.html','Messages']]){
   const link=document.createElement('a');link.href=href;link.textContent=label;nav?.append(link);
  }
  const link=document.querySelector('.header-login');if(link){link.href='mes-annonces.html';link.textContent='Mon compte';}
  const actions=document.querySelector('.header-actions');
  if(actions){const button=document.createElement('button');button.className='button button-outline';button.textContent='Déconnexion';button.addEventListener('click',async()=>{await api('logout',{});location.href='index.html';});actions.append(button);}
 }else if(nav&&!['login','signup'].includes(page)){const link=document.createElement('a');link.href='publier.html';link.textContent='Publier';nav.append(link);}
}
async function initPublish(){
 if(!session.user){location.href='connexion.html';return;}
 const form=document.getElementById('publish-form');
 const id=new URLSearchParams(location.search).get('id');
 if(id){
  const listing=ANNONCES.find(a=>a.id===id);
  if(!listing||Number(listing.sellerId)!==Number(session.user.id)){showToast('Annonce non autorisée.');return;}
  const fields={titre:listing.title,categorie:listing.cat,prix:listing.priceNumber,ville:listing.city,description:listing.description,specs:listing.specs.join(', ')};
  for(const [key,val] of Object.entries(fields))if(form.elements[key])form.elements[key].value=val;
  for(let i=0;i<3;i++)form.elements['photo'+(i+1)].value=listing.photos[i]||'';
  document.getElementById('publish-title').textContent='Modifier mon annonce';
 }
 form.addEventListener('submit',async e=>{
  e.preventDefault();const btn=form.querySelector('[type=submit]');btn.disabled=true;
  try{const result=await api(id?'update':'publish',{...Object.fromEntries(new FormData(form)),id});location.href='produit.html?id='+encodeURIComponent(result.id);}
  catch(err){showToast(err.message);btn.disabled=false;}
 });
}
async function initMyListings(){
 if(!session.user){location.href='connexion.html';return;}
 try{
  const items=(await api('mine')).annonces,container=document.getElementById('my-listings');
  for(const listing of items){
   const card=createListingCard(listing),controls=document.createElement('div');controls.className='deal-card-actions';
   const edit=document.createElement('a');edit.href='publier.html?id='+encodeURIComponent(listing.id);edit.textContent='Modifier';edit.className='button button-outline';
   const remove=document.createElement('button');remove.textContent='Retirer';remove.className='button button-outline';
   remove.addEventListener('click',async()=>{if(!confirm('Retirer cette annonce ?'))return;try{await api('delete',{id:listing.id});card.remove();showToast('Annonce retirée.');}catch(e){showToast(e.message);}});
   controls.append(edit,remove);card.append(controls);container.append(card);
  }
  document.getElementById('my-count').textContent=items.length+' annonce(s)';
 }catch(e){showToast(e.message);}
}
async function initMessages(){
 if(!session.user){location.href='connexion.html';return;}
 try{
  const items=(await api('messages')).messages,container=document.getElementById('messages-list');
  if(!items.length)container.textContent='Aucun message reçu.';
  for(const item of items){
   const card=document.createElement('article');card.className='deal-message';
   const title=document.createElement('strong');title.textContent=item.expediteur+' · '+item.annonce;
   const message=document.createElement('p');message.textContent=item.contenu;
   const date=document.createElement('small');date.textContent=item.cree_le;
   card.append(title,message,date);container.append(card);
  }
 }catch(e){showToast(e.message);}
}
(async()=>{
 try{
  const state=await api('session');
  session={user:state.user,favorites:state.favorites||[]};
  initNavigation();
  ANNONCES=(await api('list')).annonces;
  if(page==='home')initHome();
  if(page==='listings')initListings();
  if(page==='product')initProduct();
  if(page==='login')initLogin();
  if(page==='signup')initSignup();
  if(page==='publish')await initPublish();
  if(page==='my-listings')await initMyListings();
  if(page==='messages')await initMessages();
 }catch(err){showToast(err.message);const container=document.getElementById('listings');if(container)container.textContent='Service indisponible. Rechargez la page.';}
})();
