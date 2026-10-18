// stockage.js
// Petites fonctions pour enregistrer et relire des données dans le navigateur.
// Le localStorage ne sait stocker que du texte : on transforme donc nos
// données (tableaux, objets) en texte JSON avant d'écrire, et inversement.

function lireDonnees(cle, valeurParDefaut) {
  try {
    const texte = localStorage.getItem(cle);
    if (texte === null) {
      return valeurParDefaut; // rien d'enregistré pour l'instant
    }
    return JSON.parse(texte);
  } catch (erreur) {
    // Données illisibles ou localStorage bloqué : on repart de zéro
    return valeurParDefaut;
  }
}

function ecrireDonnees(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch (erreur) {
    alert("Impossible d'enregistrer les données dans ce navigateur.");
  }
}
