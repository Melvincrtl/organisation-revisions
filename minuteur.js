// minuteur.js
// Minuteur Pomodoro : 25 min de travail, puis 5 min de pause, et ainsi de suite.

const DUREE_TRAVAIL = 25 * 60 * 1000; // en millisecondes (25 min)
const DUREE_PAUSE = 5 * 60 * 1000;    // 5 min

// L'état du minuteur tient en trois variables :
let phase = "travail";               // "travail" ou "pause"
let tempsRestant = DUREE_TRAVAIL;    // temps qu'il reste, en millisecondes
let heureDeFin = null;               // quand la période se termine (null = minuteur arrêté)
let intervalle = null;               // la "boucle" qui met l'affichage à jour

const blocMinuteur = document.getElementById("bloc-minuteur");
const affichagePhase = document.getElementById("minuteur-phase");
const affichageTemps = document.getElementById("minuteur-temps");
const affichageMessage = document.getElementById("minuteur-message");
const boutonDemarrer = document.getElementById("bouton-demarrer");
const boutonReinitialiser = document.getElementById("bouton-reinitialiser");

const TITRE_PAGE = document.title; // "Mes révisions", pour le remettre ensuite

// Transforme un nombre de millisecondes en "mm:ss" (ex. : 83000 → "01:23")
function formaterTemps(millisecondes) {
  const totalSecondes = Math.ceil(millisecondes / 1000);
  const minutes = Math.floor(totalSecondes / 60);
  const secondes = totalSecondes % 60;
  return String(minutes).padStart(2, "0") + ":" + String(secondes).padStart(2, "0");
}

function estEnMarche() {
  return heureDeFin !== null;
}

// Durée complète d'une phase ("travail" ou "pause")
function dureeDe(laPhase) {
  return laPhase === "travail" ? DUREE_TRAVAIL : DUREE_PAUSE;
}

// ===== Sauvegarde dans le navigateur =====
// Pour que le minuteur survive à un rechargement de la page.

const CLE_MINUTEUR = "revisions-minuteur";

function enregistrerMinuteur() {
  ecrireDonnees(CLE_MINUTEUR, {
    phase: phase,
    tempsRestant: tempsRestant,
    heureDeFin: heureDeFin,
  });
}

// Vérifie que les données relues ont un sens (sinon : on les ignore)
function etatValide(etat) {
  if (etat === null || typeof etat !== "object") {
    return false;
  }
  if (etat.phase !== "travail" && etat.phase !== "pause") {
    return false;
  }
  const duree = dureeDe(etat.phase);
  // Number.isFinite : vrai seulement pour un vrai nombre (pas du texte, pas "NaN")
  if (!Number.isFinite(etat.tempsRestant) || etat.tempsRestant < 0 || etat.tempsRestant > duree) {
    return false;
  }
  if (etat.heureDeFin !== null) {
    if (!Number.isFinite(etat.heureDeFin) || etat.heureDeFin - Date.now() > duree) {
      return false; // une fin plus lointaine que la durée de la phase : impossible
    }
  }
  return true;
}

// Au chargement de la page : on reprend là où on s'était arrêté
function restaurerMinuteur() {
  const etat = lireDonnees(CLE_MINUTEUR, null);
  if (!etatValide(etat)) {
    return; // rien d'enregistré ou données abîmées : on garde 25:00, travail
  }

  phase = etat.phase;
  tempsRestant = etat.tempsRestant;
  heureDeFin = etat.heureDeFin;

  if (estEnMarche()) {
    if (heureDeFin <= Date.now()) {
      // La période s'est terminée pendant que la page était fermée.
      // finDePeriode() enregistre aussitôt le minuteur comme arrêté :
      // au rechargement suivant, la session ne sera donc pas recomptée.
      finDePeriode();
    } else {
      // Toujours en cours : on relance la boucle d'affichage
      intervalle = setInterval(mettreAJour, 250);
      mettreAJour();
    }
  }
}

// Met à jour tout ce qui s'affiche selon l'état actuel
function afficherMinuteur() {
  affichageTemps.textContent = formaterTemps(tempsRestant);
  affichagePhase.textContent = phase === "travail" ? "Travail" : "Pause";
  blocMinuteur.classList.toggle("phase-pause", phase === "pause");
  if (estEnMarche()) {
    boutonDemarrer.textContent = "Pause";
  } else if (tempsRestant < dureeDe(phase)) {
    boutonDemarrer.textContent = "Reprendre"; // arrêté en cours de route
  } else {
    boutonDemarrer.textContent = "Démarrer";
  }

  // Le temps apparaît aussi dans l'onglet du navigateur
  if (estEnMarche()) {
    document.title = formaterTemps(tempsRestant) + " · " + affichagePhase.textContent;
  }
}

// Appelée plusieurs fois par seconde quand le minuteur tourne
function mettreAJour() {
  // On recalcule à partir de l'heure de fin : même si le navigateur
  // ralentit la page en arrière-plan, le temps reste juste.
  tempsRestant = heureDeFin - Date.now();
  if (tempsRestant <= 0) {
    finDePeriode();
  } else {
    afficherMinuteur();
  }
}

function demarrer() {
  preparerSon(); // le navigateur n'autorise le son qu'après un clic
  cacherAlerte();
  heureDeFin = Date.now() + tempsRestant;
  intervalle = setInterval(mettreAJour, 250);
  enregistrerMinuteur();
  afficherMinuteur();
}

function mettreEnPause() {
  clearInterval(intervalle);
  tempsRestant = heureDeFin - Date.now(); // on mémorise ce qu'il reste
  heureDeFin = null;
  document.title = TITRE_PAGE;
  enregistrerMinuteur();
  afficherMinuteur();
}

function reinitialiser() {
  if (estEnMarche()) {
    clearInterval(intervalle);
    heureDeFin = null;
  }
  phase = "travail";
  tempsRestant = DUREE_TRAVAIL;
  document.title = TITRE_PAGE;
  cacherAlerte();
  enregistrerMinuteur();
  afficherMinuteur();
}

// Une période (travail ou pause) vient de se terminer
function finDePeriode() {
  clearInterval(intervalle);
  heureDeFin = null;

  // On passe à la phase suivante, sans la lancer : tu cliques sur Démarrer
  if (phase === "travail") {
    ajouterSessionPomodoro(); // une session de travail complète (compteur.js)
    phase = "pause";
    tempsRestant = DUREE_PAUSE;
    montrerAlerte("Bravo, session terminée ! Place à la pause.", "⏰ Pause !");
  } else {
    phase = "travail";
    tempsRestant = DUREE_TRAVAIL;
    montrerAlerte("Pause terminée. On reprend le travail !", "⏰ Au travail !");
  }

  enregistrerMinuteur();
  jouerBip();
  afficherMinuteur();
}

// ===== Alerte visuelle =====

function montrerAlerte(message, titreOnglet) {
  affichageMessage.textContent = message;
  affichageMessage.hidden = false;
  document.title = titreOnglet;
  // On retire puis remet la classe pour relancer le clignotement
  blocMinuteur.classList.remove("alerte");
  void blocMinuteur.offsetWidth; // force le navigateur à "voir" le retrait
  blocMinuteur.classList.add("alerte");
}

function cacherAlerte() {
  affichageMessage.hidden = true;
  blocMinuteur.classList.remove("alerte");
}

// ===== Alerte sonore =====
// Pas de fichier son : on fabrique un bip avec l'API audio du navigateur.

let contexteAudio = null;

function preparerSon() {
  if (contexteAudio === null) {
    const ClasseAudio = window.AudioContext || window.webkitAudioContext; // webkit = anciens Safari
    if (!ClasseAudio) {
      return; // navigateur sans audio : l'alerte visuelle suffira
    }
    contexteAudio = new ClasseAudio();
  }
  if (contexteAudio.state === "suspended") {
    contexteAudio.resume();
  }
}

// Trois bips courts
function jouerBip() {
  if (contexteAudio === null) {
    return;
  }
  const maintenant = contexteAudio.currentTime;
  for (let i = 0; i < 3; i++) {
    const oscillateur = contexteAudio.createOscillator(); // produit le son
    const volume = contexteAudio.createGain();           // règle le volume
    oscillateur.frequency.value = 880; // note aiguë (un "la")
    volume.gain.value = 0.2;
    oscillateur.connect(volume);
    volume.connect(contexteAudio.destination);           // vers les haut-parleurs
    const debut = maintenant + i * 0.4;
    oscillateur.start(debut);
    oscillateur.stop(debut + 0.2);
  }
}

// ===== Boutons =====

boutonDemarrer.addEventListener("click", () => {
  if (estEnMarche()) {
    mettreEnPause();
  } else {
    demarrer();
  }
});

boutonReinitialiser.addEventListener("click", reinitialiser);

// Si le minuteur a repris tout seul après un rechargement, le son n'est pas
// encore autorisé : on le prépare au premier clic n'importe où sur la page.
document.addEventListener("click", preparerSon, { once: true });

restaurerMinuteur();
afficherMinuteur();
