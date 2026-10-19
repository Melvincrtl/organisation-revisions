// taches.js
// Gère la liste de tâches : ajout, modification, case "fait", suppression, affichage.

const CLE_TACHES = "revisions-taches";

// Chaque tâche est un objet de cette forme :
// {
//   id: 3,                      // numéro unique de la tâche
//   titre: "Exercice 3",
//   matiere: "Comptabilité",
//   echeance: "2026-10-25",     // format AAAA-MM-JJ, ou null si pas d'échéance
//   faite: false,
//   faiteLe: null               // date où elle a été cochée (servira au compteur)
// }
let taches = lireDonnees(CLE_TACHES, []);

// On récupère les éléments de la page dont on a besoin
const formulaire = document.getElementById("form-tache");
const champTitre = document.getElementById("champ-titre");
const champMatiere = document.getElementById("champ-matiere");
const champEcheance = document.getElementById("champ-echeance");
const caseEcheance = document.getElementById("case-echeance");
const blocEcheance = document.getElementById("bloc-echeance");
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
}

// Redessine toute la liste à partir du tableau "taches"
function afficherTaches() {
  listeTaches.innerHTML = ""; // on vide la liste avant de la reconstruire

  // Tri : les tâches à faire d'abord, puis par échéance la plus proche,
  // et les tâches sans échéance après celles qui en ont une
  const triees = [...taches].sort((a, b) => {
    if (a.faite !== b.faite) {
      return a.faite ? 1 : -1;
    }
    if (a.echeance === null || b.echeance === null) {
      if (a.echeance === b.echeance) {
        return 0; // toutes les deux sans échéance
      }
      return a.echeance === null ? 1 : -1;
    }
    return a.echeance.localeCompare(b.echeance);
  });

  const aujourdhui = dateDuJour();

  for (const tache of triees) {
    const ligne = document.createElement("li");
    ligne.className = "tache";
    // Une tâche sans échéance n'est jamais en retard
    const enRetard = !tache.faite && tache.echeance !== null && tache.echeance < aujourdhui;
    if (tache.faite) {
      ligne.classList.add("faite");
    } else if (enRetard) {
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
    if (tache.echeance === null) {
      details.textContent = tache.matiere + " · Sans échéance";
    } else {
      let texteEcheance = "Pour le " + formaterDate(tache.echeance);
      if (!tache.faite) {
        // Le compte à rebours ne sert que pour les tâches encore à faire
        texteEcheance += " — " + texteJoursRestants(joursRestants(tache.echeance));
      }
      details.textContent = tache.matiere + " · " + texteEcheance;
    }

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
  if (tache.echeance === null) {
    caseEcheance.checked = false;
    champEcheance.value = dateDuJour(); // proposée si on recoche la case
  } else {
    caseEcheance.checked = true;
    champEcheance.value = tache.echeance; // le calendrier accepte directement "AAAA-MM-JJ"
  }
  afficherChampEcheance();
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
  formulaire.reset(); // recoche aussi la case "Ajouter une échéance"
  champEcheance.value = dateDuJour(); // reset() a vidé la date : on remet aujourd'hui
  afficherChampEcheance();
  boutonAjouter.textContent = "Ajouter la tâche";
  boutonAnnuler.hidden = true;
}

boutonAnnuler.addEventListener("click", quitterModification);

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
    ajouterTache(titre, matiere, lireEcheance());
  } else {
    modifierTache(idEnEdition, titre, matiere, lireEcheance());
  }
  quitterModification(); // vide le formulaire et remet le mode ajout
  champTitre.focus();
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
