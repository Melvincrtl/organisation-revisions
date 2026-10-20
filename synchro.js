// synchro.js
// Synchronise les tâches, les sessions et les minutes de travail entre appareils,
// grâce à Supabase. Le localStorage reste la copie locale : l'application marche
// toujours sans connexion et sans compte.
//
// Ce fichier est chargé AVANT taches.js, compteur.js et minuteur.js : ceux-ci appellent
// signalerModificationLocale() dès qu'ils écrivent des données (parfois dès le
// chargement de la page). La synchronisation, elle, ne démarre qu'une fois la page
// entièrement chargée (DOMContentLoaded), quand "taches", "pomodorosParJour" et
// "minutesParJour" existent.
//
// Ne sont PAS synchronisés : l'état du minuteur et la durée de travail (propres à chaque appareil).

const CLE_SYNCHRO_VERSION = "revisions-synchro-version"; // mis_a_jour de la dernière version synchronisée
const CLE_SYNCHRO_MODIFIE = "revisions-synchro-modifie"; // true = modifications locales pas encore envoyées
const DELAI_ENVOI = 1000; // 1 s : regroupe les modifications rapprochées en un seul envoi

let clientSupabase = null;   // reste null si la bibliothèque n'a pas pu être chargée
let utilisateur = null;      // l'utilisateur connecté (null = non connecté)
let minuterieEnvoi = null;   // l'envoi programmé après une modification
let echangeEnCours = false;  // un seul échange avec Supabase à la fois
let echangeEnAttente = null; // échange demandé pendant un autre, fait juste après
let conflit = null;          // version en ligne en attente de ton choix (null = pas de conflit)

const formConnexion = document.getElementById("form-connexion");
const champEmail = document.getElementById("champ-email");
const boutonLien = document.getElementById("bouton-lien");
const zoneConnecte = document.getElementById("zone-connecte");
const adresseConnectee = document.getElementById("adresse-connectee");
const boutonSynchroniser = document.getElementById("bouton-synchroniser");
const boutonDeconnexion = document.getElementById("bouton-deconnexion");
const zoneConflit = document.getElementById("zone-conflit");
const texteConflit = document.getElementById("texte-conflit");
const boutonGarderAppareil = document.getElementById("bouton-garder-appareil");
const boutonGarderEnLigne = document.getElementById("bouton-garder-en-ligne");
const statutSynchro = document.getElementById("statut-synchro");

// ===== Appelée par taches.js et compteur.js à chaque écriture de données =====

function signalerModificationLocale() {
  ecrireDonnees(CLE_SYNCHRO_MODIFIE, true);
  if (utilisateur === null) {
    return; // pas connecté : ce sera envoyé à la prochaine synchronisation
  }
  // On repousse l'envoi à chaque modification : plusieurs clics rapprochés = un seul envoi
  clearTimeout(minuterieEnvoi);
  minuterieEnvoi = setTimeout(() => lancer(envoyerModifications), DELAI_ENVOI);
}

// ===== Données locales =====

// Les données synchronisées, dans un seul objet
function donneesLocales() {
  return {
    version: 1,
    taches: taches,
    pomodorosParJour: pomodorosParJour,
    minutesParJour: minutesParJour,
  };
}

function aDesDonneesLocales() {
  return taches.length > 0 ||
    Object.keys(pomodorosParJour).length > 0 ||
    Object.keys(minutesParJour).length > 0;
}

// mis_a_jour de la dernière version synchronisée (null = jamais synchronisé)
function versionLocale() {
  const version = lireDonnees(CLE_SYNCHRO_VERSION, null);
  return typeof version === "string" ? version : null;
}

function estModifie() {
  return lireDonnees(CLE_SYNCHRO_MODIFIE, false) === true;
}

// Vérifie que les données reçues ont la bonne forme avant de les utiliser
function donneesValides(donnees) {
  const estObjet = (x) => typeof x === "object" && x !== null && !Array.isArray(x);
  if (!estObjet(donnees) || donnees.version !== 1) {
    return false;
  }
  if (!Array.isArray(donnees.taches) || !estObjet(donnees.pomodorosParJour) || !estObjet(donnees.minutesParJour)) {
    return false;
  }
  // Chaque tâche doit avoir ce dont afficherTaches() a besoin
  return donnees.taches.every((t) =>
    estObjet(t) &&
    Number.isFinite(t.id) &&
    typeof t.titre === "string" &&
    typeof t.matiere === "string" &&
    (t.echeance === null || typeof t.echeance === "string") &&
    typeof t.faite === "boolean"
  );
}

// Compare deux objets en ignorant l'ordre de leurs clés
// (Supabase range les clés dans son propre ordre : on les trie avant de comparer)
function trierCles(valeur) {
  if (Array.isArray(valeur)) {
    return valeur.map(trierCles);
  }
  if (typeof valeur === "object" && valeur !== null) {
    const triee = {};
    for (const cle of Object.keys(valeur).sort()) {
      triee[cle] = trierCles(valeur[cle]);
    }
    return triee;
  }
  return valeur;
}

function memesDonnees(a, b) {
  return JSON.stringify(trierCles(a)) === JSON.stringify(trierCles(b));
}

// Applique en local une version reçue : mémoire, localStorage, affichage
function appliquerVersionEnLigne(ligne) {
  clearTimeout(minuterieEnvoi); // un envoi programmé n'a plus lieu d'être
  remplacerTaches(ligne.donnees.taches);                                            // taches.js
  remplacerHistorique(ligne.donnees.pomodorosParJour, ligne.donnees.minutesParJour); // compteur.js
  ecrireDonnees(CLE_SYNCHRO_VERSION, ligne.mis_a_jour);
  ecrireDonnees(CLE_SYNCHRO_MODIFIE, false);
  afficherSynchronise();
}

// ===== Échanges avec Supabase =====

// Lance un échange ("synchroniser" ou "envoyerModifications"), un seul à la fois
async function lancer(echange) {
  if (clientSupabase === null || utilisateur === null) {
    return;
  }
  if (echangeEnCours) {
    // On le fera juste après. La récupération est prioritaire : elle envoie aussi
    // les modifications en attente quand c'est possible.
    if (echangeEnAttente !== synchroniser) {
      echangeEnAttente = echange;
    }
    return;
  }
  if (!navigator.onLine) {
    afficherStatut("Hors connexion");
    return;
  }
  echangeEnCours = true;
  try {
    await echange();
  } catch (erreur) {
    signalerErreur(erreur);
  } finally {
    echangeEnCours = false;
    if (echangeEnAttente !== null) {
      const suivant = echangeEnAttente;
      echangeEnAttente = null;
      lancer(suivant);
    }
  }
}

// Récupération : compare la version en ligne à la version locale (cas a à e)
async function synchroniser() {
  const { data: ligne, error } = await clientSupabase
    .from("sauvegardes")
    .select("donnees, mis_a_jour")
    .eq("user_id", utilisateur.id)
    .maybeSingle(); // une ligne ou null
  if (error) {
    throw error;
  }

  // a) Rien en ligne : on envoie les données de cet appareil
  if (ligne === null) {
    await envoyerPremiereFois();
    return;
  }

  if (!donneesValides(ligne.donnees)) {
    afficherStatut("Erreur : les données en ligne sont illisibles, rien n'a été modifié.", true);
    return;
  }

  const version = versionLocale();

  // b) Cet appareil n'a jamais été synchronisé
  if (version === null) {
    if (!aDesDonneesLocales() || memesDonnees(donneesLocales(), ligne.donnees)) {
      appliquerVersionEnLigne(ligne); // rien à perdre ici
    } else {
      proposerChoix(ligne);           // aucun écrasement sans ton choix
    }
    return;
  }

  // e) Rien n'a changé en ligne : on envoie nos modifications s'il y en a
  if (ligne.mis_a_jour === version) {
    if (estModifie()) {
      await envoyerAvecComparaison(version);
    } else {
      afficherSynchronise();
    }
    return;
  }

  // La version en ligne a changé depuis la dernière synchronisation
  if (!estModifie() || memesDonnees(donneesLocales(), ligne.donnees)) {
    appliquerVersionEnLigne(ligne); // c) pas de modification locale (ou les mêmes données)
  } else {
    proposerChoix(ligne);           // d) modifications des deux côtés : conflit
  }
}

// Envoi après une modification locale
async function envoyerModifications() {
  if (conflit !== null || !estModifie()) {
    return; // conflit en attente de ton choix, ou rien à envoyer
  }
  const version = versionLocale();
  if (version === null) {
    await synchroniser(); // jamais synchronisé : la récupération décide (cas a ou b)
  } else {
    await envoyerAvecComparaison(version);
  }
}

// Tout premier envoi : il n'y a pas encore de ligne en ligne
async function envoyerPremiereFois() {
  ecrireDonnees(CLE_SYNCHRO_MODIFIE, false);
  const { data, error } = await clientSupabase
    .from("sauvegardes")
    .insert({ user_id: utilisateur.id, donnees: donneesLocales(), mis_a_jour: new Date().toISOString() })
    .select("mis_a_jour");
  if (error) {
    ecrireDonnees(CLE_SYNCHRO_MODIFIE, true); // pas envoyé : on réessaiera
    if (error.code === "23505") {
      // "Doublon" : un autre appareil a créé la ligne entre-temps. On la récupère.
      await synchroniser();
      return;
    }
    throw error;
  }
  ecrireDonnees(CLE_SYNCHRO_VERSION, data[0].mis_a_jour);
  afficherSynchronise();
}

// Envoi qui ne remplace la ligne en ligne QUE si elle est encore à la version "versionAttendue".
// Sinon, un autre appareil a écrit entre-temps : aucune ligne n'est modifiée.
async function envoyerAvecComparaison(versionAttendue) {
  // Remis à false AVANT l'envoi : une modification faite pendant l'envoi le remettra à true
  ecrireDonnees(CLE_SYNCHRO_MODIFIE, false);
  const { data, error } = await clientSupabase
    .from("sauvegardes")
    .update({ donnees: donneesLocales(), mis_a_jour: new Date().toISOString() })
    .eq("user_id", utilisateur.id)
    .eq("mis_a_jour", versionAttendue) // égalité seulement, jamais d'ordre entre des dates
    .select("mis_a_jour");
  if (error) {
    ecrireDonnees(CLE_SYNCHRO_MODIFIE, true); // pas envoyé : on réessaiera
    throw error;
  }
  if (data.length === 0) {
    // Un autre appareil a écrit entre-temps : on récupère sa version (→ conflit ou application)
    ecrireDonnees(CLE_SYNCHRO_MODIFIE, true);
    await synchroniser();
    return;
  }
  // On garde la valeur renvoyée par Supabase : c'est exactement celle qui est stockée
  ecrireDonnees(CLE_SYNCHRO_VERSION, data[0].mis_a_jour);
  afficherSynchronise();
}

// ===== Conflit : c'est toi qui choisis =====

function nombreDeTaches(n) {
  return n + (n > 1 ? " tâches" : " tâche");
}

// Ex. : "5 tâches, 1 h 15 de travail aujourd'hui"
function resumeVersion(nombreTaches, minutes) {
  return nombreDeTaches(nombreTaches) + ", " + formaterDureeTravail(minutes) + " de travail aujourd'hui"; // compteur.js
}

// mis_a_jour → " (modifiée le 20/10 à 22:41)", en heure de cet appareil ("" si illisible)
function formaterDateModification(misAJour) {
  const date = new Date(misAJour);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const deuxChiffres = (n) => String(n).padStart(2, "0");
  return " (modifiée le " + deuxChiffres(date.getDate()) + "/" + deuxChiffres(date.getMonth() + 1) +
    " à " + deuxChiffres(date.getHours()) + ":" + deuxChiffres(date.getMinutes()) + ")";
}

function proposerChoix(ligne) {
  conflit = ligne;
  const aujourdhui = dateDuJour();
  texteConflit.textContent =
    "Deux versions différentes existent. Cet appareil : " +
    resumeVersion(taches.length, minutesDuJour(aujourdhui)) +
    ". En ligne : " +
    resumeVersion(ligne.donnees.taches.length, minutesDansHistorique(ligne.donnees.minutesParJour, aujourdhui)) +
    formaterDateModification(ligne.mis_a_jour) +
    ". Celle que tu gardes remplacera l'autre.";
  zoneConflit.hidden = false;
  afficherStatut("En attente de ton choix");
}

function fermerConflit() {
  conflit = null;
  zoneConflit.hidden = true;
}

// Cette version remplace celle en ligne
boutonGarderAppareil.addEventListener("click", () => {
  const ligne = conflit;
  if (ligne === null) {
    return;
  }
  fermerConflit();
  ecrireDonnees(CLE_SYNCHRO_MODIFIE, true);
  // Comparaison avec la version en ligne qu'on vient de lire : si elle a encore
  // changé entre-temps, on récupère la nouvelle et tu choisiras de nouveau.
  lancer(() => envoyerAvecComparaison(ligne.mis_a_jour));
});

// La version en ligne remplace celle de cet appareil
boutonGarderEnLigne.addEventListener("click", () => {
  const ligne = conflit;
  if (ligne === null) {
    return;
  }
  fermerConflit();
  appliquerVersionEnLigne(ligne);
});

// ===== Affichage du bloc =====

function afficherStatut(texte, estErreur = false) {
  statutSynchro.textContent = texte; // textContent : un message venu de l'extérieur reste du texte
  statutSynchro.classList.toggle("erreur", estErreur);
}

function afficherSynchronise() {
  const maintenant = new Date();
  const heure = String(maintenant.getHours()).padStart(2, "0") + ":" + String(maintenant.getMinutes()).padStart(2, "0");
  afficherStatut("Synchronisé à " + heure);
}

// Une erreur réseau devient "Hors connexion" ; les autres sont affichées telles quelles
function signalerErreur(erreur) {
  const message = (erreur && erreur.message) ? String(erreur.message) : "erreur inconnue";
  // Textes des erreurs réseau selon le navigateur (Chrome, Safari, Firefox)
  const erreurReseau = !navigator.onLine || /Failed to fetch|Load failed|NetworkError/i.test(message);
  if (erreurReseau) {
    afficherStatut("Hors connexion");
  } else {
    afficherStatut("Erreur : " + message, true);
  }
}

// Montre le formulaire de connexion ou la zone "connecté"
function afficherConnexion() {
  const connecte = utilisateur !== null;
  formConnexion.hidden = connecte;
  zoneConnecte.hidden = !connecte;
  adresseConnectee.textContent = connecte ? (utilisateur.email || "") : "";
}

// ===== Connexion par lien envoyé par mail =====

// Appelée quand l'utilisateur connecté change (connexion, déconnexion, ouverture de la page)
function changerUtilisateur(nouvelUtilisateur) {
  const ancienId = utilisateur ? utilisateur.id : null;
  const nouvelId = nouvelUtilisateur ? nouvelUtilisateur.id : null;
  utilisateur = nouvelUtilisateur;
  afficherConnexion();
  if (nouvelId === ancienId) {
    return; // même utilisateur (par exemple un simple renouvellement de session)
  }
  if (utilisateur === null) {
    // Déconnexion : on garde les données locales et on arrête la synchronisation
    clearTimeout(minuterieEnvoi);
    fermerConflit();
    afficherStatut("Non connecté");
  } else {
    afficherStatut("Connecté");
    lancer(synchroniser);
  }
}

formConnexion.addEventListener("submit", async (evenement) => {
  evenement.preventDefault(); // pas de rechargement de la page
  const email = champEmail.value.trim();
  if (email === "" || clientSupabase === null) {
    return;
  }
  if (!navigator.onLine) {
    afficherStatut("Hors connexion");
    return;
  }
  boutonLien.disabled = true;
  const { error } = await clientSupabase.auth.signInWithOtp({
    email: email,
    // Retour sur cette page, sans fragment (#…) ni paramètres (?…)
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  boutonLien.disabled = false;
  if (error) {
    signalerErreur(error);
  } else {
    afficherStatut("Lien envoyé à " + email + ". Ouvre-le sur l'appareil à connecter.");
  }
});

boutonDeconnexion.addEventListener("click", async () => {
  clearTimeout(minuterieEnvoi);
  // On oublie la version synchronisée : à la prochaine connexion, si les versions
  // diffèrent, tu choisiras (au lieu d'un écrasement sans prévenir)
  ecrireDonnees(CLE_SYNCHRO_VERSION, null);
  // "local" : déconnecte seulement cet appareil (fonctionne aussi hors connexion)
  await clientSupabase.auth.signOut({ scope: "local" });
  changerUtilisateur(null);
});

boutonSynchroniser.addEventListener("click", () => lancer(synchroniser));

// ===== Démarrage, une fois toute la page chargée =====

function demarrerSynchro() {
  afficherConnexion();
  if (window.supabase === undefined) {
    // La bibliothèque n'a pas pu être téléchargée (par exemple hors connexion) :
    // l'application marche normalement, seule la synchronisation est indisponible
    boutonLien.disabled = true;
    afficherStatut("Hors connexion : synchronisation indisponible");
    return;
  }

  // Lien de connexion invalide ou expiré : Supabase renvoie l'erreur dans l'adresse
  const parametres = new URLSearchParams(location.hash.slice(1));
  if (parametres.has("error_description")) {
    afficherStatut("Erreur : " + parametres.get("error_description"), true);
    history.replaceState(null, "", location.pathname); // on nettoie l'adresse
  }

  clientSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_CLE_PUBLIABLE, {
    // "implicit" : le lien connecte l'appareil sur lequel on l'ouvre,
    // même s'il a été demandé depuis un autre appareil
    auth: { flowType: "implicit" },
  });

  // Prévient à l'ouverture (session déjà enregistrée ou lien du mail), à la connexion
  // et à la déconnexion. setTimeout : Supabase déconseille d'appeler ses fonctions
  // directement depuis cet événement.
  clientSupabase.auth.onAuthStateChange((evenement, session) => {
    setTimeout(() => changerUtilisateur(session ? session.user : null), 0);
  });

  // Récupération quand l'onglet redevient visible, et quand le réseau revient
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      lancer(synchroniser);
    }
  });
  window.addEventListener("online", () => lancer(synchroniser));
  window.addEventListener("offline", () => {
    if (utilisateur !== null) {
      afficherStatut("Hors connexion");
    }
  });
}

document.addEventListener("DOMContentLoaded", demarrerSynchro);
