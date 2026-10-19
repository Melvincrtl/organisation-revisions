// compteur.js
// Affiche le bilan du jour : tâches faites et temps de travail.
// Enregistre aussi les sessions Pomodoro terminées (historique, non affiché).
// Ce fichier est chargé après taches.js : il utilise "taches" et "dateDuJour()"
// qui viennent de taches.js.

const CLE_POMODOROS = "revisions-pomodoros";
const CLE_MINUTES = "revisions-minutes-travail";

// Nombre de sessions par jour, par exemple : { "2026-10-18": 3, "2026-10-19": 5 }
// Garder l'historique de chaque jour servira plus tard au suivi de régularité.
let pomodorosParJour = lireDonnees(CLE_POMODOROS, {});

// Minutes de travail par jour, par exemple : { "2026-10-19": 125 }
let minutesParJour = lireDonnees(CLE_MINUTES, {});
// Données illisibles ou d'une autre forme (nombre, tableau…) : on repart de zéro
if (typeof minutesParJour !== "object" || minutesParJour === null || Array.isArray(minutesParJour)) {
  minutesParJour = {};
}

const affichageCompteurTaches = document.getElementById("compteur-taches");
const affichageCompteurTemps = document.getElementById("compteur-temps");
const libelleTaches = document.getElementById("libelle-taches");

// Minutes travaillées un jour donné (0 si rien ou valeur incorrecte)
function minutesDuJour(jour) {
  const minutes = minutesParJour[jour];
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

// Transforme des minutes en texte : 45 → "45 min", 125 → "2 h 05"
function formaterDureeTravail(minutes) {
  if (minutes < 60) {
    return minutes + " min";
  }
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60; // les minutes au-delà des heures pleines
  return heures + " h " + String(reste).padStart(2, "0");
}

// Appelée par minuteur.js à la fin de chaque période de travail
function ajouterSessionPomodoro() {
  const aujourdhui = dateDuJour();
  // "|| 0" : s'il n'y a encore rien pour aujourd'hui, on part de 0
  pomodorosParJour[aujourdhui] = (pomodorosParJour[aujourdhui] || 0) + 1;
  ecrireDonnees(CLE_POMODOROS, pomodorosParJour);
  afficherCompteur();
}

// Appelée par minuteur.js à la fin de chaque période de travail, avec sa durée
function ajouterMinutesTravail(minutes) {
  const aujourdhui = dateDuJour();
  minutesParJour[aujourdhui] = minutesDuJour(aujourdhui) + minutes;
  ecrireDonnees(CLE_MINUTES, minutesParJour);
  afficherCompteur();
}

function afficherCompteur() {
  const aujourdhui = dateDuJour();

  // On ne garde que les tâches cochées aujourd'hui, puis on les compte
  const tachesFaitesAujourdhui = taches.filter((t) => t.faite && t.faiteLe === aujourdhui);

  // Parmi elles, combien sont des examens
  const examensPasses = tachesFaitesAujourdhui.filter((t) => t.examen === true).length;

  const nombreTaches = tachesFaitesAujourdhui.length;

  affichageCompteurTaches.textContent = nombreTaches;
  affichageCompteurTemps.textContent = formaterDureeTravail(minutesDuJour(aujourdhui));

  // Singulier ou pluriel (en français, 0 et 1 sont au singulier)
  let texteTaches = nombreTaches > 1 ? "tâches faites" : "tâche faite";
  if (examensPasses > 0) {
    // Ex. : "4 tâches faites dont 1 examen passé"
    texteTaches += " dont " + examensPasses + (examensPasses > 1 ? " examens passés" : " examen passé");
  }
  libelleTaches.textContent = texteTaches;
}

// Le compteur repart à zéro tout seul à minuit : comme on compte
// "ce qui a la date d'aujourd'hui", il suffit de réafficher régulièrement.
setInterval(afficherCompteur, 60 * 1000); // toutes les minutes

afficherCompteur();
