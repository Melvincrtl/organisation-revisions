// taches.js
// Gère la liste de tâches : ajout, case "fait", suppression, affichage.

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
const champEcheance = document.getElementById("champ-echeance");
const listeTaches = document.getElementById("liste-taches");
const messageVide = document.getElementById("message-vide");

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

function enregistrerTaches() {
  ecrireDonnees(CLE_TACHES, taches);
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

    // Bouton supprimer
    const boutonSupprimer = document.createElement("button");
    boutonSupprimer.className = "bouton-supprimer";
    boutonSupprimer.textContent = "Supprimer";
    boutonSupprimer.addEventListener("click", () => supprimerTache(tache.id));

    ligne.append(caseFaite, infos, boutonSupprimer);
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
  enregistrerTaches();
  afficherTaches();
}

// Quand on valide le formulaire
formulaire.addEventListener("submit", (evenement) => {
  evenement.preventDefault(); // empêche le navigateur de recharger la page

  const titre = champTitre.value.trim(); // trim() enlève les espaces au début et à la fin
  const matiere = champMatiere.value.trim();
  if (titre === "" || matiere === "") {
    return; // on refuse un titre ou une matière fait uniquement d'espaces
  }

  ajouterTache(titre, matiere, champEcheance.value);
  formulaire.reset();
  champEcheance.value = dateDuJour(); // reset() a vidé la date : on remet aujourd'hui
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
