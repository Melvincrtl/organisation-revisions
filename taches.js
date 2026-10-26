// taches.js
// Gère la liste de tâches : ajout, modification, case "fait", suppression, affichage.
// Une tâche cochée (faite) quitte la liste et va dans la corbeille, d'où on peut
// la restaurer ou la supprimer définitivement.

const CLE_TACHES = "revisions-taches";

// Chaque tâche est un objet de cette forme :
// {
//   id: 3,                      // numéro unique de la tâche
//   titre: "Exercice 3",
//   matiere: "Comptabilité",
//   echeance: "2026-10-25",     // format AAAA-MM-JJ, ou null si pas d'échéance
//   faite: false,
//   faiteLe: null,              // date où elle a été cochée (servira au compteur)
//   examen: false               // true = examen, mis en surbrillance (absent sur les anciennes tâches)
// }
let taches = lireDonnees(CLE_TACHES, []);

// On récupère les éléments de la page dont on a besoin
const formulaire = document.getElementById("form-tache");
const champTitre = document.getElementById("champ-titre");
const champMatiere = document.getElementById("champ-matiere");
const champEcheance = document.getElementById("champ-echeance");
const caseEcheance = document.getElementById("case-echeance");
const caseExamen = document.getElementById("case-examen");
const blocEcheance = document.getElementById("bloc-echeance");
const listeTaches = document.getElementById("liste-taches");
const messageVide = document.getElementById("message-vide");
const boutonCorbeille = document.getElementById("bouton-corbeille");
const corbeille = document.getElementById("corbeille");
const listeCorbeille = document.getElementById("liste-corbeille");
const corbeilleVide = document.getElementById("corbeille-vide");
const boutonViderCorbeille = document.getElementById("bouton-vider-corbeille");
const boutonAjouter = document.getElementById("bouton-ajouter");
const boutonAnnuler = document.getElementById("bouton-annuler");
const boutonOuvrirTache = document.getElementById("bouton-ouvrir-tache");

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

// Nombre de jours entre aujourd'hui et une date "AAAA-MM-JJ"
// (positif = dans le futur, 0 = aujourd'hui, négatif = dépassée)
function joursRestants(dateTexte) {
  const [annee, mois, jour] = dateTexte.split("-").map(Number);
  const echeance = new Date(annee, mois - 1, jour); // à minuit, heure locale
  const maintenant = new Date();
  const aujourdhui = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const UN_JOUR = 24 * 60 * 60 * 1000; // en millisecondes
  // Math.round : au changement d'heure, une journée dure 23 ou 25 heures
  return Math.round((echeance - aujourdhui) / UN_JOUR);
}

// Transforme un nombre de jours en texte lisible
function texteJoursRestants(jours) {
  if (jours === 0) {
    return "aujourd'hui";
  }
  if (jours === 1) {
    return "demain";
  }
  if (jours > 1) {
    return "dans " + jours + " jours";
  }
  // Négatif : la date est dépassée
  const retard = -jours;
  return "en retard de " + retard + (retard === 1 ? " jour" : " jours");
}

function enregistrerTaches() {
  ecrireDonnees(CLE_TACHES, taches);
  afficherCompteur(); // les tâches ont changé : le compteur du jour aussi (compteur.js)
  signalerModificationLocale(); // à envoyer aux autres appareils (synchro.js)
  rafraichirPlanning(); // échéances et titres des tâches affichés dans le planning (planning.js)
}

// Remplace toute la liste par celle reçue d'un autre appareil (appelée par synchro.js).
// On n'appelle pas enregistrerTaches() : ce n'est pas une modification à renvoyer.
function remplacerTaches(nouvellesTaches) {
  taches = nouvellesTaches;
  ecrireDonnees(CLE_TACHES, taches);
  // La tâche qu'on était en train de modifier n'existe plus : on revient au mode ajout
  if (idEnEdition !== null && !taches.some((t) => t.id === idEnEdition)) {
    quitterModification();
  }
  afficherTaches();
  rafraichirPlanning(); // planning.js
}

// Redessine la liste des tâches à faire et la corbeille (tâches faites)
// à partir du tableau "taches"
function afficherTaches() {
  listeTaches.innerHTML = "";   // on vide les deux listes avant de les reconstruire
  listeCorbeille.innerHTML = "";

  // Liste principale : seulement les tâches à faire, par échéance la plus proche,
  // et les tâches sans échéance après celles qui en ont une
  const aFaire = taches.filter((t) => !t.faite).sort((a, b) => {
    if (a.echeance === null || b.echeance === null) {
      if (a.echeance === b.echeance) {
        return 0; // toutes les deux sans échéance
      }
      return a.echeance === null ? 1 : -1;
    }
    return a.echeance.localeCompare(b.echeance);
  });
  for (const tache of aFaire) {
    listeTaches.append(elementTache(tache, false));
  }

  // Corbeille : les tâches faites, de la plus récemment faite à la plus ancienne
  const faites = taches.filter((t) => t.faite).sort((a, b) => (b.faiteLe || "").localeCompare(a.faiteLe || ""));
  for (const tache of faites) {
    listeCorbeille.append(elementTache(tache, true));
  }

  // Messages et bouton de la corbeille
  messageVide.hidden = aFaire.length > 0;
  messageVide.textContent = taches.length === 0 ? "Aucune tâche pour l'instant." : "Aucune tâche à faire.";
  boutonCorbeille.textContent = "Corbeille (" + faites.length + ")";
  corbeilleVide.hidden = faites.length > 0;
  boutonViderCorbeille.hidden = faites.length === 0;
}

// Une tâche affichée. "dansCorbeille" : tâche faite, avec les boutons Restaurer et Supprimer.
function elementTache(tache, dansCorbeille) {
  const ligne = document.createElement("li");
  ligne.className = "tache";
  const aujourdhui = dateDuJour();
  // Une tâche sans échéance n'est jamais en retard
  const enRetard = !tache.faite && tache.echeance !== null && tache.echeance < aujourdhui;
  if (tache.faite) {
    ligne.classList.add("faite");
  } else if (enRetard) {
    ligne.classList.add("en-retard");
  }
  // "=== true" : les anciennes tâches n'ont pas de champ "examen", elles ne sont donc pas des examens
  if (tache.examen === true) {
    ligne.classList.add("examen");
  }

  // Case à cocher "fait" (dans la corbeille, la décocher remet la tâche à faire)
  const caseFaite = document.createElement("input");
  caseFaite.type = "checkbox";
  caseFaite.checked = tache.faite;
  // Le titre dans le libellé : un lecteur d'écran sait de quelle tâche il s'agit
  caseFaite.setAttribute("aria-label", (tache.faite ? "Remettre à faire : " : "Marquer comme faite : ") + tache.titre);
  caseFaite.addEventListener("change", () => basculerFaite(tache.id));

  // Titre + détails
  const infos = document.createElement("div");
  infos.className = "tache-infos";

  const titre = document.createElement("div");
  titre.className = "tache-titre";
  titre.textContent = tache.titre; // textContent : le texte est affiché tel quel, sans être interprété comme du HTML
  if (tache.examen === true) {
    // Étiquette "EXAM" placée devant le titre
    const badge = document.createElement("span");
    badge.className = "badge-examen";
    badge.textContent = "EXAM";
    titre.prepend(badge);
  }

  const details = document.createElement("div");
  details.className = "tache-details";
  if (dansCorbeille) {
    // Dans la corbeille : la date à laquelle la tâche a été faite
    const quand = tache.faiteLe ? "Faite le " + formaterDate(tache.faiteLe) : "Faite";
    details.textContent = tache.matiere + " · " + quand;
  } else if (tache.echeance === null) {
    details.textContent = tache.matiere + " · Sans échéance";
  } else {
    // Le compte à rebours ne sert que pour les tâches encore à faire
    details.textContent = tache.matiere + " · Pour le " + formaterDate(tache.echeance) +
      " — " + texteJoursRestants(joursRestants(tache.echeance));
  }

  infos.append(titre, details);

  // Boutons, côte à côte sous le texte
  const actions = document.createElement("div");
  actions.className = "tache-actions";

  const boutonSupprimer = document.createElement("button");
  boutonSupprimer.className = "bouton-supprimer";
  boutonSupprimer.textContent = "Supprimer";
  boutonSupprimer.addEventListener("click", () => supprimerTache(tache.id));

  if (dansCorbeille) {
    // Restaurer : la tâche redevient "à faire" et revient dans la liste
    const boutonRestaurer = document.createElement("button");
    boutonRestaurer.className = "bouton-modifier";
    boutonRestaurer.textContent = "Restaurer";
    boutonRestaurer.addEventListener("click", () => basculerFaite(tache.id));
    actions.append(boutonRestaurer, boutonSupprimer);
  } else {
    const boutonModifier = document.createElement("button");
    boutonModifier.className = "bouton-modifier";
    boutonModifier.textContent = "Modifier";
    boutonModifier.addEventListener("click", () => commencerModification(tache.id));

    // Planifier : ouvre le formulaire du planning, déjà rempli avec cette tâche (planning.js)
    const boutonPlanifier = document.createElement("button");
    boutonPlanifier.className = "bouton-modifier";
    boutonPlanifier.textContent = "Planifier";
    boutonPlanifier.addEventListener("click", () => planifierTache(tache.id));

    actions.append(boutonModifier, boutonPlanifier, boutonSupprimer);
  }

  ligne.append(caseFaite, infos, actions);
  return ligne;
}

// ===== Corbeille =====

// Ouvre ou ferme la corbeille
boutonCorbeille.addEventListener("click", () => {
  const ouverte = corbeille.hidden; // elle était fermée : on l'ouvre
  corbeille.hidden = !ouverte;
  boutonCorbeille.setAttribute("aria-expanded", String(ouverte));
});

// Supprime définitivement toutes les tâches faites
boutonViderCorbeille.addEventListener("click", () => {
  const nombre = taches.filter((t) => t.faite).length;
  if (nombre === 0 || !confirm("Supprimer définitivement " + (nombre > 1 ? "les " + nombre + " tâches faites" : "la tâche faite") + " ?")) {
    return;
  }
  taches = taches.filter((t) => !t.faite);
  if (idEnEdition !== null && !taches.some((t) => t.id === idEnEdition)) {
    quitterModification(); // la tâche qu'on modifiait n'existe plus
  }
  enregistrerTaches();
  afficherTaches();
});

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

function ajouterTache(titre, matiere, echeance, examen) {
  taches.push({
    id: nouvelId(),
    titre: titre,
    matiere: matiere,
    echeance: echeance,
    faite: false,
    faiteLe: null,
    examen: examen,
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

// ===== Formulaire replié derrière le bouton "+ Ajouter une tâche" =====

function ouvrirFormulaireTache() {
  formulaire.hidden = false;
  boutonOuvrirTache.hidden = true;
}

boutonOuvrirTache.addEventListener("click", () => {
  ouvrirFormulaireTache();
  champTitre.focus();
});

// ===== Modification d'une tâche =====

// Remplit le formulaire avec la tâche choisie et passe en mode "modification"
function commencerModification(id) {
  const tache = taches.find((t) => t.id === id);
  ouvrirFormulaireTache(); // le formulaire est replié par défaut
  idEnEdition = id;
  champTitre.value = tache.titre;
  champMatiere.value = tache.matiere;
  caseExamen.checked = tache.examen === true;
  if (tache.echeance === null) {
    caseEcheance.checked = false;
    champEcheance.value = dateDuJour(); // proposée si on recoche la case
  } else {
    caseEcheance.checked = true;
    champEcheance.value = tache.echeance; // le calendrier accepte directement "AAAA-MM-JJ"
  }
  afficherChampEcheance();
  boutonAjouter.textContent = "Enregistrer les modifications";
  boutonAnnuler.textContent = "Annuler";
  // Sur téléphone, le formulaire peut être plus haut : on remonte jusqu'à lui
  formulaire.scrollIntoView({ behavior: "smooth" });
  champTitre.focus();
}

// Met à jour la tâche : même id, et on ne touche pas à "faite" ni à "faiteLe"
function modifierTache(id, titre, matiere, echeance, examen) {
  const tache = taches.find((t) => t.id === id);
  if (tache === undefined) {
    return; // tâche introuvable (par sécurité) : on ne fait rien
  }
  tache.titre = titre;
  tache.matiere = matiere;
  tache.echeance = echeance;
  tache.examen = examen;
  enregistrerTaches();
  afficherTaches();
}

// Revient au formulaire d'ajout normal et le replie
// (après un ajout, un enregistrement, "Fermer" ou "Annuler")
function quitterModification() {
  idEnEdition = null;
  formulaire.reset(); // recoche "Ajouter une échéance" et décoche "C'est un examen"
  champEcheance.value = dateDuJour(); // reset() a vidé la date : on remet aujourd'hui
  afficherChampEcheance();
  boutonAjouter.textContent = "Ajouter la tâche";
  boutonAnnuler.textContent = "Fermer";
  formulaire.hidden = true;
  boutonOuvrirTache.hidden = false;
}

boutonAnnuler.addEventListener("click", quitterModification); // "Fermer" ou "Annuler"

// ===== Échéance facultative =====

// Montre ou cache le champ de date selon la case "Ajouter une échéance"
function afficherChampEcheance() {
  blocEcheance.hidden = !caseEcheance.checked;
  // Un champ désactivé n'est plus "required" : le formulaire accepte une date vide
  champEcheance.disabled = !caseEcheance.checked;
}

// L'échéance choisie, ou null si la case est décochée
function lireEcheance() {
  return caseEcheance.checked ? champEcheance.value : null;
}

caseEcheance.addEventListener("change", afficherChampEcheance);

// Quand on valide le formulaire
formulaire.addEventListener("submit", (evenement) => {
  evenement.preventDefault(); // empêche le navigateur de recharger la page

  const titre = champTitre.value.trim(); // trim() enlève les espaces au début et à la fin
  const matiere = champMatiere.value.trim();
  if (titre === "" || matiere === "") {
    return; // on refuse un titre ou une matière fait uniquement d'espaces
  }

  if (idEnEdition === null) {
    ajouterTache(titre, matiere, lireEcheance(), caseExamen.checked);
  } else {
    modifierTache(idEnEdition, titre, matiere, lireEcheance(), caseExamen.checked);
  }
  quitterModification(); // vide le formulaire, remet le mode ajout et le replie
  boutonOuvrirTache.focus(); // au clavier, on peut enchaîner une nouvelle tâche
});

// Un clic n'importe où sur le champ de date ouvre le calendrier
// (sans ça, il faut viser la petite icône)
champEcheance.addEventListener("click", () => {
  if (champEcheance.showPicker) { // les navigateurs anciens n'ont pas cette fonction
    try {
      champEcheance.showPicker();
    } catch (erreur) {
      // certains navigateurs refusent : le champ reste utilisable normalement
    }
  }
});

// Au chargement : échéance proposée = aujourd'hui, puis premier affichage
champEcheance.value = dateDuJour();
afficherTaches();

// Si la page reste ouverte après minuit, on réaffiche la liste pour mettre
// à jour les jours restants et les retards. On vérifie toutes les minutes.
let jourAffiche = dateDuJour();
setInterval(() => {
  if (dateDuJour() !== jourAffiche) {
    jourAffiche = dateDuJour();
    afficherTaches();
  }
}, 60 * 1000);
