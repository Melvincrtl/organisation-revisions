# Mes révisions

Application web personnelle pour organiser mes révisions (L3 CCA).
HTML, CSS et JavaScript simples, sans framework ni serveur. Les données sont
enregistrées dans le navigateur (localStorage).

## Ouvrir l'application

Double-cliquer sur `index.html` : la page s'ouvre dans le navigateur.

## Fichiers

| Fichier       | Rôle                                                  |
|---------------|-------------------------------------------------------|
| `index.html`  | Structure de la page                                  |
| `style.css`   | Apparence (adaptée au téléphone)                      |
| `stockage.js` | Lire / écrire les données dans le localStorage        |
| `taches.js`   | Liste de tâches (ajout, modification, fait / à faire, suppression), échéance facultative avec compte à rebours en jours, examens avec badge EXAM |
| `minuteur.js` | Minuteur Pomodoro (travail de 20 min à 2 h, pause adaptée) avec alerte |
| `compteur.js` | Bilan du jour : tâches faites (dont examens passés) et temps de travail (sessions enregistrées) |
| `synchro-config.js` | Adresse du projet Supabase et clé publiable (jamais de clé secrète) |
| `synchro.js`  | Synchronisation entre appareils avec Supabase (connexion par lien envoyé par mail) |

## Synchronisation

Facultative : sans connexion ni compte, tout reste dans le navigateur comme avant.
Une fois connecté (bloc « Synchronisation » en bas de page), les tâches, les sessions
et les minutes de travail sont partagées entre appareils. L'état du minuteur et la
durée de travail restent propres à chaque appareil. Si deux versions différentes
existent, l'application demande laquelle garder.

Pour tester en local (avant publication), ajouter l'adresse locale (par exemple
`http://localhost:8000`) dans Supabase : Authentication → URL Configuration → Redirect URLs.

## Avancement

- [x] Étape 1 : liste de tâches
- [x] Étape 2 : minuteur Pomodoro
- [x] Étape 3 : compteur du jour
- [x] Amélioration 1 : le minuteur survit à un rechargement de la page
- [x] Amélioration 2 : modifier une tâche
- [x] Échéance facultative (case « Ajouter une échéance »)
- [x] Compte à rebours en jours avant l'échéance (« dans 6 jours », « en retard de 2 jours »…)
- [x] Examens : badge EXAM en surbrillance, et « dont N examen(s) passé(s) » dans le compteur
- [x] Durée de travail réglable de 20 min à 2 h (boutons − / +), pause adaptée : 5, 10 ou 20 min
- [x] Compteur du jour : temps de travail réel en minutes (« 2 h 05 ») à la place du nombre de sessions
- [x] Session abandonnée (fin depuis plus de 30 min : page fermée, onglet ou appareil en veille) : pas comptée, retour au travail
- [x] Synchronisation Mac / téléphone avec Supabase (branche `synchro`, à tester avant publication)
