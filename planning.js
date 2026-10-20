// planning.js
// Planning hebdomadaire : des créneaux de révision placés à une date et à une heure.
// Chargé après taches.js (dateDuJour) et compteur.js (formaterDureeTravail).
// Les créneaux ne sont pas liés aux tâches.

const CLE_PLANNING = "revisions-planning";
const NOMS_JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

// Chaque créneau est un objet de cette forme :
// {
//   id: 3,                  // numéro unique du créneau
//   jour: "2026-10-22",     // format AAAA-MM-JJ
//   debut: "14:00",         // format HH:MM
//   fin: "15:30",           // après le début, le même jour
//   titre: "Relire le cours",
//   matiere: "Audit"
// }

// ===== Dates, en heure locale =====
// On ne calcule jamais avec des durées de 24 h en millisecondes : au changement
// d'heure, une journée dure 23 ou 25 h. On construit les dates avec
// new Date(année, mois, jour), qui gère tout seul les fins de mois et d'année.

// "2026-10-22" → date locale (à minuit)
function dateDepuisTexte(texte) {
  const [annee, mois, jour] = texte.split("-").map(Number);
  return new Date(annee, mois - 1, jour); // les mois commencent à 0
}

// Date locale → "2026-10-22"
function texteDepuisDate(date) {
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return date.getFullYear() + "-" + mois + "-" + jour;
}

// La même date, décalée de "nombre" jours (négatif pour reculer)
function ajouterJours(date, nombre) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + nombre);
}

// Le lundi de la semaine d'une date
function lundiDe(date) {
  // getDay() : 0 = dimanche, 1 = lundi… On compte les jours écoulés depuis lundi.
  const joursDepuisLundi = (date.getDay() + 6) % 7;
  return ajouterJours(date, -joursDepuisLundi);
}

// Date locale → "22/10"
function jourMois(date) {
  return String(date.getDate()).padStart(2, "0") + "/" + String(date.getMonth() + 1).padStart(2, "0");
}

// ===== Validation =====

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;           // AAAA-MM-JJ
const FORMAT_HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;    // de 00:00 à 23:59

// Une vraie date (refuse par exemple "2026-02-30")
function jourValide(texte) {
  return typeof texte === "string" && FORMAT_JOUR.test(texte) &&
    texteDepuisDate(dateDepuisTexte(texte)) === texte;
}

function heureValide(texte) {
  return typeof texte === "string" && FORMAT_HEURE.test(texte);
}

function texteNonVide(texte) {
  return typeof texte === "string" && texte.trim() !== "";
}

// Un créneau lu dans le stockage (ou reçu d'un autre appareil) est-il utilisable ?
function creneauValide(c) {
  return typeof c === "object" && c !== null &&
    Number.isFinite(c.id) &&
    jourValide(c.jour) &&
    heureValide(c.debut) &&
    heureValide(c.fin) &&
    c.fin > c.debut && // même format "HH:MM" : la comparaison de textes suffit
    texteNonVide(c.titre) &&
    texteNonVide(c.matiere);
}

// Garde seulement les créneaux valides (les autres sont ignorés, sans planter)
function nettoyerPlanning(liste) {
  return Array.isArray(liste) ? liste.filter(creneauValide) : [];
}

// ===== Données =====

let planning = nettoyerPlanning(lireDonnees(CLE_PLANNING, []));
let lundiAffiche = lundiDe(new Date()); // la semaine affichée

function enregistrerPlanning() {
  ecrireDonnees(CLE_PLANNING, planning);
}

// Un numéro jamais utilisé : le plus grand numéro existant + 1
function nouvelIdCreneau() {
  let plusGrand = 0;
  for (const creneau of planning) {
    if (creneau.id > plusGrand) {
      plusGrand = creneau.id;
    }
  }
  return plusGrand + 1;
}

// ===== Éléments de la page =====

const formCreneau = document.getElementById("form-creneau");
const champCreneauTitre = document.getElementById("champ-creneau-titre");
const champCreneauMatiere = document.getElementById("champ-creneau-matiere");
const champCreneauJour = document.getElementById("champ-creneau-jour");
const champCreneauDebut = document.getElementById("champ-creneau-debut");
const champCreneauFin = document.getElementById("champ-creneau-fin");
const messageCreneau = document.getElementById("message-creneau");
const titreSemaine = document.getElementById("titre-semaine");
const conteneurSemaine = document.getElementById("semaine");

// ===== Affichage de la semaine =====

function afficherPlanning() {
  const dimanche = ajouterJours(lundiAffiche, 6);
  titreSemaine.textContent = "Semaine du " + jourMois(lundiAffiche) + " au " + jourMois(dimanche);

  conteneurSemaine.innerHTML = ""; // on vide avant de reconstruire (aucun texte saisi ici)
  const aujourdhui = dateDuJour(); // taches.js

  for (let i = 0; i < 7; i++) {
    const date = ajouterJours(lundiAffiche, i);
    const jour = texteDepuisDate(date);

    const blocJour = document.createElement("div");
    blocJour.className = "jour";
    if (jour === aujourdhui) {
      blocJour.classList.add("aujourdhui"); // mis en évidence
    }

    const titreJour = document.createElement("h3");
    titreJour.className = "jour-titre";
    titreJour.textContent = NOMS_JOURS[i] + " " + jourMois(date);
    blocJour.append(titreJour);

    // Les créneaux de ce jour, triés par heure de début
    const creneauxDuJour = planning
      .filter((c) => c.jour === jour)
      .sort((a, b) => a.debut.localeCompare(b.debut));

    if (creneauxDuJour.length === 0) {
      const vide = document.createElement("p");
      vide.className = "jour-vide discret";
      vide.textContent = "Rien de prévu";
      blocJour.append(vide);
    } else {
      const liste = document.createElement("ul");
      liste.className = "liste-creneaux";
      for (const creneau of creneauxDuJour) {
        liste.append(elementCreneau(creneau));
      }
      blocJour.append(liste);
    }

    conteneurSemaine.append(blocJour);
  }
}

// Un créneau affiché : "14:00–15:30 · Audit · Relire le cours"
function elementCreneau(creneau) {
  const ligne = document.createElement("li");
  ligne.className = "creneau";

  const heures = document.createElement("span");
  heures.className = "creneau-heures";
  heures.textContent = creneau.debut + "–" + creneau.fin;

  const texte = document.createElement("span");
  texte.className = "creneau-texte";
  // textContent : le titre et la matière restent du texte, jamais du HTML
  // (le " · " après les heures est ajouté par style.css, selon la disposition)
  texte.textContent = creneau.matiere + " · " + creneau.titre;

  ligne.append(heures, texte);
  return ligne;
}

// ===== Navigation entre les semaines =====

// Jour proposé dans le formulaire : aujourd'hui si on regarde cette semaine,
// sinon le lundi de la semaine affichée
function jourParDefaut() {
  const cetteSemaine = texteDepuisDate(lundiDe(new Date())) === texteDepuisDate(lundiAffiche);
  return cetteSemaine ? dateDuJour() : texteDepuisDate(lundiAffiche);
}

function changerSemaine(lundi) {
  lundiAffiche = lundi;
  champCreneauJour.value = jourParDefaut();
  afficherPlanning();
}

document.getElementById("bouton-semaine-precedente").addEventListener("click", () => {
  changerSemaine(ajouterJours(lundiAffiche, -7));
});
document.getElementById("bouton-semaine-suivante").addEventListener("click", () => {
  changerSemaine(ajouterJours(lundiAffiche, 7));
});
document.getElementById("bouton-cette-semaine").addEventListener("click", () => {
  changerSemaine(lundiDe(new Date()));
});

// ===== Ajout d'un créneau =====

function afficherMessageCreneau(texte) {
  messageCreneau.textContent = texte;
  messageCreneau.hidden = texte === "";
}

formCreneau.addEventListener("submit", (evenement) => {
  evenement.preventDefault(); // pas de rechargement de la page

  const creneau = {
    id: nouvelIdCreneau(),
    jour: champCreneauJour.value,
    debut: champCreneauDebut.value,
    fin: champCreneauFin.value,
    titre: champCreneauTitre.value.trim(),
    matiere: champCreneauMatiere.value.trim(),
  };

  // Messages clairs pour les erreurs les plus probables
  if (!texteNonVide(creneau.titre) || !texteNonVide(creneau.matiere)) {
    afficherMessageCreneau("Le titre et la matière sont obligatoires.");
    return;
  }
  if (heureValide(creneau.debut) && heureValide(creneau.fin) && creneau.fin <= creneau.debut) {
    afficherMessageCreneau("La fin doit être après le début, le même jour.");
    return;
  }
  if (!creneauValide(creneau)) {
    afficherMessageCreneau("Vérifie le jour et les heures du créneau.");
    return;
  }

  afficherMessageCreneau("");
  planning.push(creneau);
  enregistrerPlanning();

  // On affiche la semaine du créneau ajouté (même si c'est une autre semaine)
  lundiAffiche = lundiDe(dateDepuisTexte(creneau.jour));
  afficherPlanning();

  // Formulaire prêt pour le créneau suivant, sur le même jour
  formCreneau.reset();
  champCreneauJour.value = creneau.jour;
  champCreneauTitre.focus();
});

// ===== Démarrage =====

champCreneauJour.value = jourParDefaut();
afficherPlanning();

// Si la page reste ouverte après minuit, on met à jour le jour mis en évidence
let jourAffichePlanning = dateDuJour();
setInterval(() => {
  if (dateDuJour() !== jourAffichePlanning) {
    jourAffichePlanning = dateDuJour();
    afficherPlanning();
  }
}, 60 * 1000);
