// planning.js
// Planning hebdomadaire : des créneaux de révision placés à une date et à une heure.
// Chargé après taches.js (taches, dateDuJour) et compteur.js (formaterDureeTravail).
// Le planning montre aussi les échéances des tâches, et un créneau peut être relié
// à une tâche existante (pour se donner un moment où la faire).

const CLE_PLANNING = "revisions-planning";
const NOMS_JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

// Chaque créneau est un objet de cette forme :
// {
//   id: 3,                  // numéro unique du créneau
//   jour: "2026-10-22",     // format AAAA-MM-JJ
//   debut: "14:00",         // format HH:MM
//   fin: "15:30",           // après le début, le même jour
//   titre: "Relire le cours",
//   matiere: "Audit",
//   tacheId: 7              // facultatif : numéro de la tâche planifiée (null = créneau libre)
// }
// Pour un créneau relié à une tâche, titre et matière sont une copie : on affiche
// ceux de la tâche tant qu'elle existe, et la copie si elle a été supprimée.

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
    texteNonVide(c.matiere) &&
    (c.tacheId === undefined || c.tacheId === null || Number.isFinite(c.tacheId));
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

const boutonOuvrirCreneau = document.getElementById("bouton-ouvrir-creneau");
const formCreneau = document.getElementById("form-creneau");
const champCreneauTache = document.getElementById("champ-creneau-tache");
const champCreneauTitre = document.getElementById("champ-creneau-titre");
const champCreneauMatiere = document.getElementById("champ-creneau-matiere");
const champCreneauJour = document.getElementById("champ-creneau-jour");
const champCreneauDebut = document.getElementById("champ-creneau-debut");
const champCreneauFin = document.getElementById("champ-creneau-fin");
const messageCreneau = document.getElementById("message-creneau");
const titreSemaine = document.getElementById("titre-semaine");
const conteneurSemaine = document.getElementById("semaine");

// La tâche reliée à un créneau (undefined si aucune, ou si elle a été supprimée)
function tacheDuCreneau(creneau) {
  if (creneau.tacheId === undefined || creneau.tacheId === null) {
    return undefined;
  }
  return taches.find((t) => t.id === creneau.tacheId); // taches.js
}

// Petite étiquette "EXAM" (même style que dans la liste des tâches)
function badgeExamen() {
  const badge = document.createElement("span");
  badge.className = "badge-examen";
  badge.textContent = "EXAM";
  return badge;
}

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

    // 1. Les tâches dont l'échéance tombe ce jour-là (à faire d'abord, puis faites)
    const echeances = taches
      .filter((t) => t.echeance === jour)
      .sort((a, b) => Number(a.faite) - Number(b.faite));
    if (echeances.length > 0) {
      const listeEcheances = document.createElement("ul");
      listeEcheances.className = "liste-echeances";
      for (const tache of echeances) {
        listeEcheances.append(elementEcheance(tache));
      }
      blocJour.append(listeEcheances);
    }

    // 2. Les créneaux de ce jour, triés par heure de début
    const creneauxDuJour = planning
      .filter((c) => c.jour === jour)
      .sort((a, b) => a.debut.localeCompare(b.debut));

    if (creneauxDuJour.length > 0) {
      const liste = document.createElement("ul");
      liste.className = "liste-creneaux";
      for (const creneau of creneauxDuJour) {
        liste.append(elementCreneau(creneau));
      }
      blocJour.append(liste);
    } else if (echeances.length === 0) {
      const vide = document.createElement("p");
      vide.className = "jour-vide discret";
      vide.textContent = "Rien de prévu";
      blocJour.append(vide);
    }

    conteneurSemaine.append(blocJour);
  }
}

// Une échéance de tâche : "ÉCHÉANCE [EXAM]" puis "Audit · Rendre le dossier"
function elementEcheance(tache) {
  const ligne = document.createElement("li");
  ligne.className = "echeance";
  if (tache.faite) {
    ligne.classList.add("fait"); // barrée et grisée
  }

  const etiquette = document.createElement("span");
  etiquette.className = "echeance-etiquette";
  etiquette.textContent = "Échéance ";
  if (tache.examen === true) {
    etiquette.append(badgeExamen());
  }

  const texte = document.createElement("span");
  texte.textContent = tache.matiere + " · " + tache.titre; // textContent : du texte, jamais du HTML

  ligne.append(etiquette, texte);
  return ligne;
}

// Un créneau affiché : "14:00–15:30 · Audit · Relire le cours"
function elementCreneau(creneau) {
  const ligne = document.createElement("li");
  ligne.className = "creneau";

  // Créneau relié à une tâche : on affiche la tâche telle qu'elle est maintenant
  const tache = tacheDuCreneau(creneau);
  const titre = tache ? tache.titre : creneau.titre;
  const matiere = tache ? tache.matiere : creneau.matiere;
  if (tache && tache.faite) {
    ligne.classList.add("fait"); // la tâche est faite : créneau barré
  }

  const heures = document.createElement("span");
  heures.className = "creneau-heures";
  heures.textContent = creneau.debut + "–" + creneau.fin;

  const texte = document.createElement("span");
  texte.className = "creneau-texte";
  // textContent : le titre et la matière restent du texte, jamais du HTML
  // (le " · " après les heures est ajouté par style.css, selon la disposition)
  texte.textContent = matiere + " · " + titre;

  ligne.append(heures);
  if (tache && tache.examen === true) {
    ligne.append(badgeExamen());
  }
  ligne.append(texte);
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

// ===== Formulaire : ouvrir, fermer, choisir une tâche =====

function ouvrirFormulaireCreneau() {
  formCreneau.hidden = false;
  boutonOuvrirCreneau.hidden = true;
}

function fermerFormulaireCreneau() {
  formCreneau.reset();
  appliquerTacheChoisie(); // champs titre et matière de nouveau modifiables
  afficherMessageCreneau("");
  champCreneauJour.value = jourParDefaut();
  formCreneau.hidden = true;
  boutonOuvrirCreneau.hidden = false;
}

boutonOuvrirCreneau.addEventListener("click", () => {
  ouvrirFormulaireCreneau();
  champCreneauTache.focus();
});
document.getElementById("bouton-fermer-creneau").addEventListener("click", fermerFormulaireCreneau);

// Remplit la liste "Tâche existante" (tâches à faire d'abord)
function remplirListeTaches() {
  const choixActuel = champCreneauTache.value;
  champCreneauTache.innerHTML = ""; // on vide (les textes ajoutés ensuite passent par textContent)

  const aucune = document.createElement("option");
  aucune.value = "";
  aucune.textContent = "— Aucune (créneau libre) —";
  champCreneauTache.append(aucune);

  const triees = [...taches].sort((a, b) => Number(a.faite) - Number(b.faite));
  for (const tache of triees) {
    const option = document.createElement("option");
    option.value = String(tache.id);
    let texte = tache.matiere + " · " + tache.titre;
    if (tache.examen === true) {
      texte = "EXAM · " + texte;
    }
    if (tache.faite) {
      texte += " (faite)";
    }
    option.textContent = texte;
    champCreneauTache.append(option);
  }

  // On garde le choix en cours s'il existe encore
  champCreneauTache.value = taches.some((t) => String(t.id) === choixActuel) ? choixActuel : "";
  appliquerTacheChoisie();
}

// Une tâche est choisie : titre et matière viennent d'elle (non modifiables)
function appliquerTacheChoisie() {
  const tache = taches.find((t) => String(t.id) === champCreneauTache.value);
  if (tache) {
    champCreneauTitre.value = tache.titre;
    champCreneauMatiere.value = tache.matiere;
  } else if (champCreneauTitre.disabled) {
    // On repasse en créneau libre : on vide les champs remplis par la tâche
    champCreneauTitre.value = "";
    champCreneauMatiere.value = "";
  }
  champCreneauTitre.disabled = Boolean(tache);
  champCreneauMatiere.disabled = Boolean(tache);
}

champCreneauTache.addEventListener("change", appliquerTacheChoisie);

// Appelée par le bouton "Planifier" d'une tâche (taches.js)
function planifierTache(id) {
  ouvrirFormulaireCreneau();
  champCreneauTache.value = String(id);
  appliquerTacheChoisie();
  champCreneauJour.value = jourParDefaut();
  // Sur téléphone, le planning est plus haut que la liste des tâches : on y remonte
  formCreneau.scrollIntoView({ behavior: "smooth", block: "center" });
  champCreneauDebut.focus();
}

// Appelée par taches.js quand les tâches changent : échéances, titres et liste à jour
function rafraichirPlanning() {
  remplirListeTaches();
  afficherPlanning();
}

// ===== Ajout d'un créneau =====

function afficherMessageCreneau(texte) {
  messageCreneau.textContent = texte;
  messageCreneau.hidden = texte === "";
}

formCreneau.addEventListener("submit", (evenement) => {
  evenement.preventDefault(); // pas de rechargement de la page

  const tache = taches.find((t) => String(t.id) === champCreneauTache.value);
  const creneau = {
    id: nouvelIdCreneau(),
    jour: champCreneauJour.value,
    debut: champCreneauDebut.value,
    fin: champCreneauFin.value,
    // Relié à une tâche : on copie son titre et sa matière (utile si elle est supprimée un jour)
    titre: tache ? tache.titre : champCreneauTitre.value.trim(),
    matiere: tache ? tache.matiere : champCreneauMatiere.value.trim(),
    tacheId: tache ? tache.id : null,
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

  planning.push(creneau);
  enregistrerPlanning();

  // On affiche la semaine du créneau ajouté (même si c'est une autre semaine),
  // puis on replie le formulaire pour laisser la place à la semaine
  lundiAffiche = lundiDe(dateDepuisTexte(creneau.jour));
  fermerFormulaireCreneau();
  afficherPlanning();
});

// ===== Démarrage =====

champCreneauJour.value = jourParDefaut();
remplirListeTaches();
afficherPlanning();

// Si la page reste ouverte après minuit, on met à jour le jour mis en évidence
let jourAffichePlanning = dateDuJour();
setInterval(() => {
  if (dateDuJour() !== jourAffichePlanning) {
    jourAffichePlanning = dateDuJour();
    afficherPlanning();
  }
}, 60 * 1000);
