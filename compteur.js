// compteur.js
// Affiche le bilan du jour : tâches faites et sessions Pomodoro terminées.
// Ce fichier est chargé en dernier : il utilise "taches" et "dateDuJour()"
// qui viennent de taches.js.

const CLE_POMODOROS = "revisions-pomodoros";

// Nombre de sessions par jour, par exemple : { "2026-10-18": 3, "2026-10-19": 5 }
// Garder l'historique de chaque jour servira plus tard au suivi de régularité.
let pomodorosParJour = lireDonnees(CLE_POMODOROS, {});

const affichageCompteurTaches = document.getElementById("compteur-taches");
const affichageCompteurPomodoros = document.getElementById("compteur-pomodoros");
const libelleTaches = document.getElementById("libelle-taches");
const libellePomodoros = document.getElementById("libelle-pomodoros");

// Appelée par minuteur.js à la fin de chaque période de travail
function ajouterSessionPomodoro() {
  const aujourdhui = dateDuJour();
  // "|| 0" : s'il n'y a encore rien pour aujourd'hui, on part de 0
  pomodorosParJour[aujourdhui] = (pomodorosParJour[aujourdhui] || 0) + 1;
  ecrireDonnees(CLE_POMODOROS, pomodorosParJour);
  afficherCompteur();
}

function afficherCompteur() {
  const aujourdhui = dateDuJour();

  // On ne garde que les tâches cochées aujourd'hui, puis on les compte
  const tachesFaitesAujourdhui = taches.filter((t) => t.faite && t.faiteLe === aujourdhui);

  const nombreTaches = tachesFaitesAujourdhui.length;
  const nombrePomodoros = pomodorosParJour[aujourdhui] || 0;

  affichageCompteurTaches.textContent = nombreTaches;
  affichageCompteurPomodoros.textContent = nombrePomodoros;

  // Singulier ou pluriel (en français, 0 et 1 sont au singulier)
  libelleTaches.textContent = nombreTaches > 1 ? "tâches faites" : "tâche faite";
  libellePomodoros.textContent = nombrePomodoros > 1 ? "sessions Pomodoro" : "session Pomodoro";
}

// Le compteur repart à zéro tout seul à minuit : comme on compte
// "ce qui a la date d'aujourd'hui", il suffit de réafficher régulièrement.
setInterval(afficherCompteur, 60 * 1000); // toutes les minutes

afficherCompteur();
