const ANNONCES = [
  {
    id: "golf",
    cat: "voitures",
    title: "Volkswagen Golf 7",
    price: "185 000 MAD",
    city: "Casablanca",
    photos: ["photo-1503376780353-7e6692767b70", "photo-1492144534655-ae79c964c9d7", "photo-1503736334956-4c8f8e92946d"],
    alt: "Voiture sportive garée en extérieur",
    description: "Golf 7 en excellent état, entretenue régulièrement. Climatisation, boîte manuelle et carnet d’entretien disponible. Visible à Casablanca.",
    specs: ["2018", "Diesel", "92 000 km"],
    categoryLabel: "Voitures"
  },
  {
    id: "iphone",
    cat: "telephones",
    title: "iPhone 13 · 128 Go",
    price: "6 500 MAD",
    city: "Rabat",
    photos: ["photo-1592750475338-74b7b21085ab", "photo-1511707171634-5f897ff02aa9", "photo-1512499617640-c74ae3a79d37"],
    alt: "Smartphone présenté sur un fond clair",
    description: "iPhone 13 de 128 Go en très bon état, débloqué et soigneusement entretenu. Remise en main propre possible à Rabat.",
    specs: ["128 Go", "Très bon état", "Débloqué"],
    categoryLabel: "Téléphones"
  },
  {
    id: "apartment",
    cat: "immobilier",
    title: "Appartement · Guéliz",
    price: "1 200 000 MAD",
    city: "Marrakech",
    photos: ["photo-1600210492486-724fe5c67fb0", "photo-1600607687939-ce8a6c25118c", "photo-1600566753086-00f18fb6b3ea"],
    alt: "Salon lumineux d’un appartement",
    description: "Bel appartement lumineux et soigneusement entretenu, dans le quartier recherché de Guéliz. Visite sur rendez-vous à Marrakech.",
    specs: ["92 m²", "2 chambres", "Meublé"],
    categoryLabel: "Immobilier"
  },
  {
    id: "bag",
    cat: "mode",
    title: "Sac en cuir camel",
    price: "450 MAD",
    city: "Rabat",
    photos: ["photo-1584917865442-de89df76afd3", "photo-1590874103328-eac38a683ce7", "photo-1548036328-c9fa89d128fa"],
    alt: "Sac à main en cuir couleur camel",
    description: "Sac en cuir couleur camel, élégant et en excellent état. Disponible à Rabat pour une remise en main propre.",
    specs: ["Cuir", "Très bon état", "Camel"],
    categoryLabel: "Mode"
  }
];

const page = document.body.dataset.page;
const toast = document.getElementById("toast");
let toastTimer;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function getFavorites() {
  try {
    return new Set(JSON.parse(localStorage.getItem("deal-favorites") || "[]"));
  } catch {
    return new Set();
  }
}

function saveFavorites(favorites) {
  try {
    localStorage.setItem("deal-favorites", JSON.stringify([...favorites]));
  } catch {
    showToast("Les favoris ne peuvent pas être enregistrés sur cet appareil.");
  }
}

function photoUrl(photo, width = 700) {
  return `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=${width}&q=85`;
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
  favorite.addEventListener("click", () => {
    const nextFavorites = getFavorites();
    const willBeFavorite = !nextFavorites.has(listing.id);
    if (willBeFavorite) nextFavorites.add(listing.id);
    else nextFavorites.delete(listing.id);
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

  favoriteButton.addEventListener("click", () => {
    const favorites = getFavorites();
    if (favorites.has(selectedListing.id)) favorites.delete(selectedListing.id);
    else favorites.add(selectedListing.id);
    saveFavorites(favorites);
    updateFavoriteButton();
    showToast(favorites.has(selectedListing.id) ? "Annonce ajoutée aux favoris." : "Annonce retirée des favoris.");
  });

  document.querySelector(".contact-button").addEventListener("click", () => {
    showToast("Connectez-vous pour contacter le vendeur.");
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

function initLogin() {
  document.querySelector(".password-toggle").addEventListener("click", (event) => {
    const button = event.currentTarget;
    const passwordInput = document.getElementById("password");
    const reveal = passwordInput.type === "password";
    passwordInput.type = reveal ? "text" : "password";
    button.setAttribute("aria-pressed", String(reveal));
    button.setAttribute("aria-label", reveal ? "Masquer le mot de passe" : "Afficher le mot de passe");
  });
  document.getElementById("login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    showToast("La connexion sera bientôt disponible.");
  });
  document.getElementById("forgot-password").addEventListener("click", () => {
    showToast("La réinitialisation du mot de passe sera bientôt disponible.");
  });
  document.getElementById("create-account").addEventListener("click", () => {
    showToast("La création de compte sera bientôt disponible.");
  });
}

if (page === "home") initHome();
if (page === "listings") initListings();
if (page === "product") initProduct();
if (page === "login") initLogin();
