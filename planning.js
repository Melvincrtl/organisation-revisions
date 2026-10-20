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
const totalSemaine = document.getElementById("total-semaine");

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

// ===== Grille horaire =====
// Sur grand écran, chaque jour est une colonne avec une échelle d'heures : un créneau
// y est placé selon son heure de début et sa hauteur dépend de sa durée.
// planning.js calcule seulement des nombres (minutes depuis le haut de la grille,
// durée, "voie" en cas de chevauchement) ; style.css s'occupe de la disposition.
// Sur téléphone (jours empilés), les mêmes créneaux s'affichent en liste.

const HEURE_DEBUT_GRILLE = 8;  // la grille montre au moins de 8 h…
const HEURE_FIN_GRILLE = 20;   // …à 20 h, et s'élargit si un créneau en sort

// "14:30" → 870 (minutes depuis minuit)
function minutesDepuisMinuit(heure) {
  const [h, m] = heure.split(":").map(Number);
  return h * 60 + m;
}

// Durée d'un créneau, en minutes
function dureeCreneau(creneau) {
  return minutesDepuisMinuit(creneau.fin) - minutesDepuisMinuit(creneau.debut);
}

// Heures de début et de fin de la grille pour les créneaux de la semaine affichée
function bornesGrille(creneauxSemaine) {
  let debut = HEURE_DEBUT_GRILLE;
  let fin = HEURE_FIN_GRILLE;
  for (const c of creneauxSemaine) {
    debut = Math.min(debut, Math.floor(minutesDepuisMinuit(c.debut) / 60));
    fin = Math.max(fin, Math.ceil(minutesDepuisMinuit(c.fin) / 60));
  }
  return { debut: debut, fin: fin };
}

// Créneaux qui se chevauchent : on les met côte à côte, chacun dans sa "voie".
// Renvoie, pour chaque créneau, { voie: sa position, voies: le nombre de voies du groupe }.
function calculerVoies(creneauxDuJour) {
  const resultat = new Map();
  let groupe = [];      // créneaux qui se chevauchent (directement ou en chaîne)
  let finGroupe = "";

  function fermerGroupe() {
    const finsDesVoies = []; // heure de fin du dernier créneau de chaque voie
    for (const c of groupe) {
      let voie = finsDesVoies.findIndex((finVoie) => finVoie <= c.debut);
      if (voie === -1) {
        voie = finsDesVoies.length; // aucune voie libre : on en ouvre une nouvelle
      }
      finsDesVoies[voie] = c.fin;
      resultat.set(c.id, { voie: voie });
    }
    for (const c of groupe) {
      resultat.get(c.id).voies = finsDesVoies.length;
    }
  }

  // Les créneaux arrivent triés par heure de début
  for (const c of creneauxDuJour) {
    if (groupe.length > 0 && c.debut >= finGroupe) {
      fermerGroupe(); // ce créneau commence après la fin de tout le groupe
      groupe = [];
      finGroupe = "";
    }
    groupe.push(c);
    if (c.fin > finGroupe) {
      finGroupe = c.fin;
    }
  }
  if (groupe.length > 0) {
    fermerGroupe();
  }
  return resultat;
}

// Une couleur par matière. Chaque nouvelle matière reçoit la couleur suivante, dans
// l'ordre où elle apparaît pour la première fois dans le planning (ordre de création
// des créneaux) : les 10 premières matières ont toutes une couleur différente, et une
// matière garde sa couleur quand on en ajoute d'autres.
const COULEURS_MATIERES = [
  { fond: "#dbeafe", bord: "#2563eb" }, // bleu
  { fond: "#dcfce7", bord: "#16a34a" }, // vert
  { fond: "#fef3c7", bord: "#d97706" }, // ambre
  { fond: "#fce7f3", bord: "#db2777" }, // rose
  { fond: "#ede9fe", bord: "#7c3aed" }, // violet
  { fond: "#cffafe", bord: "#0891b2" }, // cyan
  { fond: "#ffedd5", bord: "#ea580c" }, // orange
  { fond: "#e0e7ff", bord: "#4f46e5" }, // indigo
  { fond: "#ecfccb", bord: "#65a30d" }, // citron vert
  { fond: "#fee2e2", bord: "#dc2626" }, // rouge
];

let numerosMatieres = new Map(); // "audit" → 0, "fiscalité" → 1…

// "Audit" et " audit " sont la même matière
function cleMatiere(matiere) {
  return matiere.trim().toLowerCase();
}

// Recalcule l'ordre des matières à partir des créneaux (du plus ancien au plus récent)
function numeroterMatieres() {
  numerosMatieres = new Map();
  const parAnciennete = [...planning].sort((a, b) => a.id - b.id);
  for (const creneau of parAnciennete) {
    const tache = tacheDuCreneau(creneau);
    const cle = cleMatiere(tache ? tache.matiere : creneau.matiere);
    if (!numerosMatieres.has(cle)) {
      numerosMatieres.set(cle, numerosMatieres.size);
    }
  }
}

function couleurMatiere(matiere) {
  const cle = cleMatiere(matiere);
  if (!numerosMatieres.has(cle)) {
    numerosMatieres.set(cle, numerosMatieres.size); // matière pas encore vue
  }
  return COULEURS_MATIERES[numerosMatieres.get(cle) % COULEURS_MATIERES.length];
}

// ===== Affichage de la semaine =====

function afficherPlanning() {
  const dimanche = ajouterJours(lundiAffiche, 6);
  titreSemaine.textContent = "Semaine du " + jourMois(lundiAffiche) + " au " + jourMois(dimanche);

  conteneurSemaine.innerHTML = ""; // on vide avant de reconstruire (aucun texte saisi ici)
  const aujourdhui = dateDuJour(); // taches.js
  numeroterMatieres(); // couleurs des matières

  // Bornes de la grille horaire pour toute la semaine (les 7 colonnes sont alignées)
  const joursSemaine = [];
  for (let i = 0; i < 7; i++) {
    joursSemaine.push(texteDepuisDate(ajouterJours(lundiAffiche, i)));
  }
  const bornes = bornesGrille(planning.filter((c) => joursSemaine.includes(c.jour)));
  const minutesGrille = (bornes.fin - bornes.debut) * 60;
  // Des nombres seulement (pas de texte saisi) : utilisés par style.css pour placer les créneaux
  conteneurSemaine.style.setProperty("--heures", bornes.fin - bornes.debut);
  conteneurSemaine.style.setProperty("--total", minutesGrille);

  // L'échelle des heures (à gauche des colonnes, sur grand écran seulement)
  const axe = document.createElement("div");
  axe.className = "axe-heures";
  axe.setAttribute("aria-hidden", "true"); // décoratif : les heures sont écrites dans chaque créneau
  for (let h = bornes.debut; h <= bornes.fin; h++) {
    const repere = document.createElement("span");
    repere.className = "repere-heure";
    repere.style.setProperty("--position", h - bornes.debut);
    repere.textContent = String(h).padStart(2, "0") + " h";
    axe.append(repere);
  }
  conteneurSemaine.append(axe);

  // Largeur des colonnes : un jour où des créneaux se chevauchent est un peu plus large
  // (×1,4 pour 2 créneaux côte à côte, ×1,8 pour 3 ou plus), sans trop rétrécir les autres jours
  const largeurs = [];
  let minutesSemaine = 0; // total planifié de la semaine

  for (let i = 0; i < 7; i++) {
    const date = ajouterJours(lundiAffiche, i);
    const jour = joursSemaine[i];

    const blocJour = document.createElement("div");
    blocJour.className = "jour";
    if (jour === aujourdhui) {
      blocJour.classList.add("aujourdhui"); // mis en évidence
    }

    // En-tête du jour : son nom, puis les échéances de tâches (sans heure)
    const entete = document.createElement("div");
    entete.className = "jour-entete";

    const titreJour = document.createElement("h3");
    titreJour.className = "jour-titre";
    titreJour.textContent = NOMS_JOURS[i] + " " + jourMois(date);
    entete.append(titreJour);

    // Les tâches dont l'échéance tombe ce jour-là (à faire d'abord, puis faites)
    const echeances = taches
      .filter((t) => t.echeance === jour)
      .sort((a, b) => Number(a.faite) - Number(b.faite));
    if (echeances.length > 0) {
      const listeEcheances = document.createElement("ul");
      listeEcheances.className = "liste-echeances";
      for (const tache of echeances) {
        listeEcheances.append(elementEcheance(tache));
      }
      entete.append(listeEcheances);
    }

    // Les créneaux de ce jour, triés par heure de début (puis de fin)
    const creneauxDuJour = planning
      .filter((c) => c.jour === jour)
      .sort((a, b) => a.debut.localeCompare(b.debut) || a.fin.localeCompare(b.fin));

    // Total planifié du jour (les échéances, sans heure, ne comptent pas)
    const minutesDuJourPlanifiees = creneauxDuJour.reduce((total, c) => total + dureeCreneau(c), 0);
    minutesSemaine += minutesDuJourPlanifiees;
    if (minutesDuJourPlanifiees > 0) {
      const total = document.createElement("p");
      total.className = "jour-total";
      total.textContent = formaterDureeTravail(minutesDuJourPlanifiees) + " prévues"; // compteur.js
      titreJour.after(total); // juste sous le nom du jour
    }

    if (creneauxDuJour.length === 0 && echeances.length === 0) {
      const vide = document.createElement("p");
      vide.className = "jour-vide discret";
      vide.textContent = "Rien de prévu";
      entete.append(vide);
    }

    // La zone horaire du jour (une liste : sur téléphone, les créneaux s'y suivent)
    const horaire = document.createElement("ul");
    horaire.className = "jour-horaire";
    const voies = calculerVoies(creneauxDuJour);
    let voiesMax = 1;
    for (const creneau of creneauxDuJour) {
      const voie = voies.get(creneau.id);
      voiesMax = Math.max(voiesMax, voie.voies);
      horaire.append(elementCreneau(creneau, bornes.debut, voie));
    }
    largeurs.push(1 + 0.4 * (Math.min(voiesMax, 3) - 1));

    blocJour.append(entete, horaire);
    conteneurSemaine.append(blocJour);
  }

  totalSemaine.textContent = minutesSemaine > 0
    ? "Total planifié : " + formaterDureeTravail(minutesSemaine) // compteur.js
    : "Rien de planifié cette semaine";

  // Ex. : "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 2fr) …" (des nombres seulement), lu par style.css
  conteneurSemaine.style.setProperty(
    "--colonnes-jours",
    largeurs.map((parts) => "minmax(0, " + parts + "fr)").join(" ")
  );
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

// Un créneau : une zone de couleur (celle de sa matière), placée selon ses horaires.
// heureDebutGrille : l'heure en haut de la grille ; voie : sa place s'il en chevauche d'autres.
function elementCreneau(creneau, heureDebutGrille, voie) {
  const ligne = document.createElement("li");
  ligne.className = "creneau";

  // Créneau relié à une tâche : on affiche la tâche telle qu'elle est maintenant
  const tache = tacheDuCreneau(creneau);
  const titre = tache ? tache.titre : creneau.titre;
  const matiere = tache ? tache.matiere : creneau.matiere;
  if (tache && tache.faite) {
    ligne.classList.add("fait"); // la tâche est faite : créneau barré
  }

  // Position et taille dans la grille (des nombres, lus par style.css)
  const debut = minutesDepuisMinuit(creneau.debut);
  const fin = minutesDepuisMinuit(creneau.fin);
  ligne.style.setProperty("--debut", debut - heureDebutGrille * 60);
  ligne.style.setProperty("--duree", fin - debut);
  ligne.style.setProperty("--voie", voie.voie);
  ligne.style.setProperty("--voies", voie.voies);

  // Couleur de la matière
  const couleur = couleurMatiere(matiere);
  ligne.style.setProperty("--couleur-fond", couleur.fond);
  ligne.style.setProperty("--couleur-bord", couleur.bord);

  // Texte complet au survol (utile pour un créneau court dont le texte est coupé)
  ligne.title = creneau.debut + "–" + creneau.fin + " · " + matiere + " · " + titre + " (cliquer pour modifier)";

  // Tout le créneau est un bouton : un clic (ou Entrée au clavier) ouvre sa modification
  const bouton = document.createElement("button");
  bouton.type = "button";
  bouton.className = "creneau-bouton";
  bouton.addEventListener("click", () => commencerModificationCreneau(creneau.id));

  // Les heures en deux morceaux ("14:30" et "–15:30") : dans un créneau étroit,
  // la fin passe à la ligne au lieu d'être coupée
  const heures = document.createElement("span");
  heures.className = "creneau-heures";
  const heureDebut = document.createElement("span");
  heureDebut.className = "heure-morceau";
  heureDebut.textContent = creneau.debut;
  const heureFin = document.createElement("span");
  heureFin.className = "heure-morceau";
  heureFin.textContent = "–" + creneau.fin;
  heures.append(heureDebut, heureFin);

  const texte = document.createElement("span");
  texte.className = "creneau-texte";
  // textContent : le titre et la matière restent du texte, jamais du HTML
  // (le " · " après les heures est ajouté par style.css, selon la disposition)
  texte.textContent = matiere + " · " + titre;

  bouton.append(heures);
  if (tache && tache.examen === true) {
    bouton.append(badgeExamen());
  }
  bouton.append(texte);
  ligne.append(bouton);
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
// Comme pour les tâches, le formulaire a deux modes : "ajout" (idCreneauEnEdition = null)
// et "modification" (idCreneauEnEdition = numéro du créneau modifié).

let idCreneauEnEdition = null;

const boutonValiderCreneau = document.getElementById("bouton-ajouter-creneau");
const boutonSupprimerCreneau = document.getElementById("bouton-supprimer-creneau");
const boutonFermerCreneau = document.getElementById("bouton-fermer-creneau");

function ouvrirFormulaireCreneau() {
  formCreneau.hidden = false;
  boutonOuvrirCreneau.hidden = true;
}

// Boutons et textes du mode "ajout"
function passerEnModeAjout() {
  idCreneauEnEdition = null;
  boutonValiderCreneau.textContent = "Ajouter le créneau";
  boutonFermerCreneau.textContent = "Fermer";
  boutonSupprimerCreneau.hidden = true;
}

// Vide le formulaire, revient au mode "ajout" et le replie
function fermerFormulaireCreneau() {
  formCreneau.reset();
  appliquerTacheChoisie(); // champs titre et matière de nouveau modifiables
  afficherMessageCreneau("");
  passerEnModeAjout();
  champCreneauJour.value = jourParDefaut();
  formCreneau.hidden = true;
  boutonOuvrirCreneau.hidden = false;
}

boutonOuvrirCreneau.addEventListener("click", () => {
  ouvrirFormulaireCreneau();
  champCreneauTache.focus();
});
boutonFermerCreneau.addEventListener("click", fermerFormulaireCreneau); // "Fermer" ou "Annuler"

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
  fermerFormulaireCreneau(); // repart d'un formulaire vide, en mode "ajout"
  ouvrirFormulaireCreneau();
  champCreneauTache.value = String(id);
  appliquerTacheChoisie();
  // Sur téléphone, le planning est plus haut que la liste des tâches : on y remonte
  formCreneau.scrollIntoView({ behavior: "smooth", block: "center" });
  champCreneauDebut.focus();
}

// Appelée par taches.js quand les tâches changent : échéances, titres et liste à jour
function rafraichirPlanning() {
  remplirListeTaches();
  afficherPlanning();
}

// ===== Modifier un créneau (clic sur le créneau) =====

function commencerModificationCreneau(id) {
  const creneau = planning.find((c) => c.id === id);
  if (creneau === undefined) {
    return;
  }
  fermerFormulaireCreneau(); // repart d'un formulaire propre
  ouvrirFormulaireCreneau();
  idCreneauEnEdition = id;

  // Relié à une tâche qui existe encore : on la choisit dans la liste
  const tache = tacheDuCreneau(creneau);
  champCreneauTache.value = tache ? String(tache.id) : "";
  appliquerTacheChoisie();
  if (!tache) {
    champCreneauTitre.value = creneau.titre;     // créneau libre (ou tâche supprimée) :
    champCreneauMatiere.value = creneau.matiere; // ses propres titre et matière
  }
  champCreneauJour.value = creneau.jour;
  champCreneauDebut.value = creneau.debut;
  champCreneauFin.value = creneau.fin;

  boutonValiderCreneau.textContent = "Enregistrer les modifications";
  boutonFermerCreneau.textContent = "Annuler";
  boutonSupprimerCreneau.hidden = false;
  formCreneau.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ===== Supprimer un créneau =====

boutonSupprimerCreneau.addEventListener("click", () => {
  if (idCreneauEnEdition === null || !confirm("Supprimer ce créneau ?")) {
    return;
  }
  planning = planning.filter((c) => c.id !== idCreneauEnEdition);
  enregistrerPlanning();
  fermerFormulaireCreneau();
  afficherPlanning();
});

// ===== Ajouter ou enregistrer un créneau =====

function afficherMessageCreneau(texte) {
  messageCreneau.textContent = texte;
  messageCreneau.hidden = texte === "";
}

formCreneau.addEventListener("submit", (evenement) => {
  evenement.preventDefault(); // pas de rechargement de la page

  const tache = taches.find((t) => String(t.id) === champCreneauTache.value);
  const creneau = {
    // En modification, le créneau garde son numéro
    id: idCreneauEnEdition !== null ? idCreneauEnEdition : nouvelIdCreneau(),
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

  if (idCreneauEnEdition !== null) {
    // Modification : on remplace l'ancien créneau par le nouveau, à la même place
    const position = planning.findIndex((c) => c.id === idCreneauEnEdition);
    if (position === -1) {
      afficherMessageCreneau("Ce créneau n'existe plus.");
      return;
    }
    planning[position] = creneau;
  } else {
    planning.push(creneau);
  }
  enregistrerPlanning();

  // On affiche la semaine du créneau (même si c'est une autre semaine),
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
