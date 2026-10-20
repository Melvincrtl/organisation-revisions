-- supabase.sql
-- Recrée tout ce dont l'application a besoin côté Supabase pour la synchronisation.
-- À exécuter dans le SQL Editor d'un projet Supabase (voir README, « Configurer Supabase »).
-- Le script peut être relancé sans erreur : il ne crée que ce qui manque et
-- remplace les règles existantes par les mêmes.
--
-- 1. La table : une seule ligne par utilisateur, avec toutes ses données synchronisées
--    (tâches, sessions et minutes par jour) dans la colonne "donnees" (format JSON).
--    "mis_a_jour" sert à l'application à vérifier qu'aucun autre appareil n'a écrit
--    entre-temps. Si un compte est supprimé, sa ligne l'est aussi (on delete cascade).
-- 2. La sécurité par ligne (RLS) : sans règle, personne ne peut rien lire ni écrire.
--    C'est elle qui protège les données : NE PAS LA DÉSACTIVER.
-- 3. Les règles : chaque utilisateur connecté ne lit, ne crée et ne modifie que SA ligne
--    (celle dont le user_id est le sien). Aucune règle de suppression : l'application
--    n'en a pas besoin.
-- 4. Les droits : on retire d'abord tous les droits donnés par défaut, puis on ne
--    redonne aux utilisateurs connectés (authenticated) que lire, créer et modifier.
--    Les visiteurs non connectés (anon) n'ont aucun droit sur la table.
-- 5. Si l'option « Enable automatic RLS » a créé la fonction rls_auto_enable(),
--    on empêche qu'elle soit appelée depuis l'API (elle ne sert qu'en interne).


-- ===== 1. La table =====

create table if not exists public.sauvegardes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  donnees jsonb not null,
  mis_a_jour timestamptz not null default now()
);


-- ===== 2. La sécurité par ligne (RLS) =====

alter table public.sauvegardes enable row level security;


-- ===== 3. Les règles : chacun ne voit et ne modifie que sa propre ligne =====

-- On supprime d'abord les règles si elles existent, pour pouvoir relancer le script
drop policy if exists "Lire sa propre sauvegarde" on public.sauvegardes;
drop policy if exists "Créer sa propre sauvegarde" on public.sauvegardes;
drop policy if exists "Modifier sa propre sauvegarde" on public.sauvegardes;

-- auth.uid() = l'identifiant de l'utilisateur connecté qui fait la demande
create policy "Lire sa propre sauvegarde"
  on public.sauvegardes for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Créer sa propre sauvegarde"
  on public.sauvegardes for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Modifier sa propre sauvegarde"
  on public.sauvegardes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);


-- ===== 4. Les droits : le strict nécessaire =====

-- Supabase donne par défaut des droits inutiles ici (TRUNCATE, REFERENCES, TRIGGER…) :
-- on les retire tous, puis on redonne seulement ce dont l'application a besoin.
revoke all on table public.sauvegardes from anon, authenticated;
grant select, insert, update on table public.sauvegardes to authenticated;


-- ===== 5. Fonction rls_auto_enable() : pas d'appel depuis l'API =====

-- Seulement si la fonction existe (sinon on ne fait rien : le script reste relançable)
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
  end if;
end $$;
