# Mes révisions

Application web personnelle pour organiser mes révisions (L3 CCA).
HTML, CSS et JavaScript simples, sans framework ni étape de build. Les données sont
enregistrées dans le navigateur (localStorage) et, si je suis connecté, synchronisées
entre mes appareils avec Supabase.

## Ouvrir l'application

- **Le site hébergé** (à utiliser au quotidien, sur ordinateur et téléphone) :
  https://melvincrtl.github.io/organisation-revisions/
- **Sans synchronisation** : double-cliquer sur `index.html`. Tout fonctionne, sauf la
  connexion (Supabase n'accepte pas de revenir vers un fichier local).
- **Pour tester la connexion en local** (par exemple avant de publier une modification) :
  1. lancer un petit serveur dans le dossier du projet :
     ```bash
     python3 -m http.server 8000
     ```
  2. ajouter `http://localhost:8000` dans Supabase : Authentication → URL Configuration →
     Redirect URLs ;
  3. ouvrir `http://localhost:8000/` dans le navigateur.

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
| `supabase.sql` | Script qui recrée la table, la sécurité par ligne, les règles et les droits dans Supabase |

## Synchronisation

Facultative : sans connexion ni compte, tout reste dans le navigateur comme avant.
Une fois connecté (bloc « Synchronisation » en bas de page), les tâches, les sessions
et les minutes de travail sont partagées entre appareils. L'état du minuteur et la
durée de travail restent propres à chaque appareil. Si deux versions différentes
existent, l'application demande laquelle garder (nombre de tâches, temps de travail
du jour et date de modification de chaque côté).

## Configurer Supabase

À suivre pour recréer le projet (par exemple si je perds l'accès à l'ancien) :

1. **Créer le projet** sur supabase.com :
   - région en Europe ;
   - Data API activée ;
   - « Automatically expose new tables » **désactivée** ;
   - « Enable automatic RLS » **cochée**.
2. **Créer la table et sa sécurité** : SQL Editor → coller le contenu de `supabase.sql`
   → Run. Le script peut être relancé sans risque.
3. **Adresses autorisées** : Authentication → URL Configuration →
   - Site URL : l'adresse du site (https://melvincrtl.github.io/organisation-revisions/) ;
   - Redirect URLs : la même adresse (et `http://localhost:8000` pour les tests en local).
4. **Récupérer l'URL du projet et la clé publiable** (elle commence par `sb_publishable_`) :
   Settings → API Keys.
5. **Les mettre dans `synchro-config.js`** (`SUPABASE_URL` et `SUPABASE_CLE_PUBLIABLE`),
   puis publier le site.

### Sécurité

- **Seule la clé publiable** va dans le code. Elle est faite pour être visible dans une
  page web.
- **Jamais** la clé secrète (`sb_secret_…`) ni la clé `service_role` : elles donnent
  tous les droits sur la base, sans aucune règle.
- La protection des données repose sur les **règles RLS** de la table `sauvegardes` :
  une ligne par utilisateur, et chacun ne peut lire et modifier que la sienne.
  **Ne pas désactiver ces règles.**

### Inscriptions fermées

Après ma première connexion, j'ai désactivé « Allow new users to sign up »
(Authentication → Sign In / Providers) pour que personne d'autre ne puisse créer de
compte. Si quelqu'un demande un lien avec une autre adresse, l'application affiche une
erreur de Supabase dans la ligne de statut : c'est normal.
Pour connecter une nouvelle adresse, réactiver temporairement cette option, se connecter,
puis la désactiver de nouveau.

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
- [x] Synchronisation Mac / téléphone avec Supabase (connexion par lien envoyé par mail)
- [x] Message de conflit détaillé (tâches, temps de travail du jour, date de modification)
- [x] Script `supabase.sql` et instructions pour recréer la configuration Supabase
