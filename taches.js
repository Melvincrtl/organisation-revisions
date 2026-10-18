// taches.js
// Gère la liste de tâches : ajout, modification, case "fait", suppression, affichage.

const CLE_TACHES = "revisions-taches";

// Chaque tâche est un objet de cette forme :
// {
//   id: 3,                      // numéro unique de la tâche
//   titre: "Exercice 3",
//   matiere: "Comptabilité",
//   echeance: "2026-10-25",     // format AAAA-MM-JJ
//   faite: false,
//   faiteLe: null               // date où elle a été cochée (servira au compteur)
// }
let taches = lireDonnees(CLE_TACHES, []);

// On récupère les éléments de la page dont on a besoin
const formulaire = document.getElementById("form-tache");
const champTitre = document.getElementById("champ-titre");
const champMatiere = document.getElementById("champ-matiere");
const champJour = document.getElementById("champ-jour");
const champMois = document.getElementById("champ-mois");
const champAnnee = document.getElementById("champ-annee");
const listeTaches = document.getElementById("liste-taches");
const messageVide = document.getElementById("message-vide");
const boutonAjouter = document.getElementById("bouton-ajouter");
const boutonAnnuler = document.getElementById("bouton-annuler");

// Numéro de la tâche en cours de modification (null = on ajoute une nouvelle tâche)
let idEnEdition = null;

// Date du jour au format AAAA-MM-JJ, selon l'heure locale
function dateDuJour() {
  const maintenant = new Date();
  const annee = maintenant.getFullYear();
  const mois = String(maintenant.getMonth() + 1).padStart(2, "0"); // les mois commencent à 0
  const jour = String(maintenant.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

// Transforme "2026-10-25" en "25/10/2026" pour l'affichage
function formaterDate(dateTexte) {
  const [annee, mois, jour] = dateTexte.split("-");
  return `${jour}/${mois}/${annee}`;
}

// ===== Choix de l'échéance : listes jour / mois / année =====

const NOMS_MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

// Ajoute une option (un choix) dans une liste déroulante
function ajouterOption(liste, valeur, texte) {
  const option = document.createElement("option");
  option.value = valeur;
  option.textContent = texte;
  liste.append(option);
}

// Remplit les listes des mois et des années (une seule fois, au chargement)
function remplirMoisEtAnnees() {
  for (let i = 0; i < 12; i++) {
    ajouterOption(champMois, i + 1, NOMS_MOIS[i]);
  }
  const anneeActuelle = new Date().getFullYear();
  for (let annee = anneeActuelle; annee <= anneeActuelle + 2; annee++) {
    ajouterOption(champAnnee, annee, annee);
  }
}

// Remplit la liste des jours selon le mois choisi (28, 29, 30 ou 31 jours)
function mettreAJourJours() {
  const jourChoisi = Number(champJour.value) || 1;
  const annee = Number(champAnnee.value);
  const mois = Number(champMois.value);
  // Astuce : le "jour 0" du mois suivant = le dernier jour du mois choisi
  const nombreDeJours = new Date(annee, mois, 0).getDate();

  champJour.innerHTML = "";
  for (let jour = 1; jour <= nombreDeJours; jour++) {
    ajouterOption(champJour, jour, jour);
  }
  // On garde le jour choisi s'il existe encore (ex. : 31 → 30 en avril)
  champJour.value = Math.min(jourChoisi, nombreDeJours);
}

// Place les trois listes sur la date d'aujourd'hui
function choisirAujourdhui() {
  const maintenant = new Date();
  champAnnee.value = maintenant.getFullYear();
  champMois.value = maintenant.getMonth() + 1;
  mettreAJourJours(); // crée les jours du mois en cours
  champJour.value = maintenant.getDate();
}

// Assemble la date choisie au format AAAA-MM-JJ
function lireEcheance() {
  const mois = String(champMois.value).padStart(2, "0");
  const jour = String(champJour.value).padStart(2, "0");
  return `${champAnnee.value}-${mois}-${jour}`;
}

// L'inverse : place les trois listes sur une date "AAAA-MM-JJ"
function positionnerEcheance(dateTexte) {
  const [annee, mois, jour] = dateTexte.split("-").map(Number); // "05" → 5
  // Une échéance d'une année absente de la liste (ex. : l'an dernier) : on l'ajoute
  if (![...champAnnee.options].some((option) => Number(option.value) === annee)) {
    ajouterOption(champAnnee, annee, annee);
  }
  champAnnee.value = annee;
  champMois.value = mois;
  mettreAJourJours(); // le bon nombre de jours pour ce mois
  champJour.value = jour;
}

function enregistrerTaches() {
  ecrireDonnees(CLE_TACHES, taches);
  afficherCompteur(); // les tâches ont changé : le compteur du jour aussi (compteur.js)
}

// Redessine toute la liste à partir du tableau "taches"
function afficherTaches() {
  listeTaches.innerHTML = ""; // on vide la liste avant de la reconstruire

  // Tri : les tâches à faire d'abord, puis par échéance la plus proche
  const triees = [...taches].sort((a, b) => {
    if (a.faite !== b.faite) {
      return a.faite ? 1 : -1;
    }
    return a.echeance.localeCompare(b.echeance);
  });

  const aujourdhui = dateDuJour();

  for (const tache of triees) {
    const ligne = document.createElement("li");
    ligne.className = "tache";
    if (tache.faite) {
      ligne.classList.add("faite");
    } else if (tache.echeance < aujourdhui) {
      ligne.classList.add("en-retard");
    }

    // Case à cocher "fait"
    const caseFaite = document.createElement("input");
    caseFaite.type = "checkbox";
    caseFaite.checked = tache.faite;
    caseFaite.setAttribute("aria-label", "Marquer comme faite");
    caseFaite.addEventListener("change", () => basculerFaite(tache.id));

    // Titre + détails
    const infos = document.createElement("div");
    infos.className = "tache-infos";

    const titre = document.createElement("div");
    titre.className = "tache-titre";
    titre.textContent = tache.titre; // textContent : le texte est affiché tel quel, sans être interprété comme du HTML

    const details = document.createElement("div");
    details.className = "tache-details";
    let texteEcheance = "Pour le " + formaterDate(tache.echeance);
    if (!tache.faite && tache.echeance < aujourdhui) {
      texteEcheance += " — en retard";
    }
    details.textContent = tache.matiere + " · " + texteEcheance;

    infos.append(titre, details);

    // Boutons modifier et supprimer, regroupés
    const actions = document.createElement("div");
    actions.className = "tache-actions";

    const boutonModifier = document.createElement("button");
    boutonModifier.className = "bouton-modifier";
    boutonModifier.textContent = "Modifier";
    boutonModifier.addEventListener("click", () => commencerModification(tache.id));

    const boutonSupprimer = document.createElement("button");
    boutonSupprimer.className = "bouton-supprimer";
    boutonSupprimer.textContent = "Supprimer";
    boutonSupprimer.addEventListener("click", () => supprimerTache(tache.id));

    actions.append(boutonModifier, boutonSupprimer);
    ligne.append(caseFaite, infos, actions);
    listeTaches.append(ligne);
  }

  // Le message "Aucune tâche" n'apparaît que si la liste est vide
  messageVide.hidden = taches.length > 0;
}

// Donne un numéro jamais utilisé : le plus grand numéro existant + 1
function nouvelId() {
  let plusGrand = 0;
  for (const tache of taches) {
    if (tache.id > plusGrand) {
      plusGrand = tache.id;
    }
  }
  return plusGrand + 1;
}

function ajouterTache(titre, matiere, echeance) {
  taches.push({
    id: nouvelId(),
    titre: titre,
    matiere: matiere,
    echeance: echeance,
    faite: false,
    faiteLe: null,
  });
  enregistrerTaches();
  afficherTaches();
}

function basculerFaite(id) {
  const tache = taches.find((t) => t.id === id);
  tache.faite = !tache.faite;
  tache.faiteLe = tache.faite ? dateDuJour() : null;
  enregistrerTaches();
  afficherTaches();
}

function supprimerTache(id) {
  if (!confirm("Supprimer cette tâche ?")) {
    return;
  }
  taches = taches.filter((t) => t.id !== id);
  if (id === idEnEdition) {
    quitterModification(); // la tâche qu'on modifiait n'existe plus
  }
  enregistrerTaches();
  afficherTaches();
}

// ===== Modification d'une tâche =====

// Remplit le formulaire avec la tâche choisie et passe en mode "modification"
function commencerModification(id) {
  const tache = taches.find((t) => t.id === id);
  idEnEdition = id;
  champTitre.value = tache.titre;
  champMatiere.value = tache.matiere;
  positionnerEcheance(tache.echeance);
  boutonAjouter.textContent = "Enregistrer les modifications";
  boutonAnnuler.hidden = false;
  // Sur téléphone, le formulaire peut être plus haut : on remonte jusqu'à lui
  formulaire.scrollIntoView({ behavior: "smooth" });
  champTitre.focus();
}

// Met à jour la tâche : même id, et on ne touche pas à "faite" ni à "faiteLe"
function modifierTache(id, titre, matiere, echeance) {
  const tache = taches.find((t) => t.id === id);
  if (tache === undefined) {
    return; // tâche introuvable (par sécurité) : on ne fait rien
  }
  tache.titre = titre;
  tache.matiere = matiere;
  tache.echeance = echeance;
  enregistrerTaches();
  afficherTaches();
}

// Revient au formulaire d'ajout normal
function quitterModification() {
  idEnEdition = null;
  formulaire.reset();
  choisirAujourdhui(); // reset() a modifié les listes : on remet aujourd'hui
  boutonAjouter.textContent = "Ajouter la tâche";
  boutonAnnuler.hidden = true;
}

boutonAnnuler.addEventListener("click", quitterModification);

// Quand on valide le formulaire
formulaire.addEventListener("submit", (evenement) => {
  evenement.preventDefault(); // empêche le navigateur de recharger la page

  const titre = champTitre.value.trim(); // trim() enlève les espaces au début et à la fin
  const matiere = champMatiere.value.trim();
  if (titre === "" || matiere === "") {
    return; // on refuse un titre ou une matière fait uniquement d'espaces
  }

  if (idEnEdition === null) {
    ajouterTache(titre, matiere, lireEcheance());
  } else {
    modifierTache(idEnEdition, titre, matiere, lireEcheance());
  }
  quitterModification(); // vide le formulaire et remet le mode ajout
  champTitre.focus();
});

// Quand on change de mois ou d'année, le nombre de jours peut changer
champMois.addEventListener("change", mettreAJourJours);
champAnnee.addEventListener("change", mettreAJourJours);

// Au chargement : on prépare les listes, échéance proposée = aujourd'hui,
// puis premier affichage des tâches
remplirMoisEtAnnees();
choisirAujourdhui();
afficherTaches();
