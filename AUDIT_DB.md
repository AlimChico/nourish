# Audit base de données — Sahtek

Audit réalisé sur la base de **production** (Postgres Supabase, EU-West-2) le 2026-09-28.
Toutes les requêtes d'audit sont **en lecture seule** (`SELECT` uniquement).

## Comment relancer l'audit

```bash
# 1. Inventaire complet (tables, orphelins, doublons, index, usage réel, FK)
node --env-file=.env.local scripts/audit-db.mjs

# 2. Test d'isolation entre comptes (IDOR) — nécessite le serveur dev sur :3210
#    et crée/supprime un compte jetable (xxx@sahtek.test) dans la base.
bash scripts/isolation-test.sh
```

## État constaté (avant/après : identique, 3 comptes réels)

| Contrôle | Résultat |
|---|---|
| Comptes | 3 (`team@sahtek.app`, `amine@test.tn`, `alim@sahtek.app`) |
| **Orphelins** (lignes dont `user_id` ne pointe sur aucun compte) | **0** sur les 12 tables + `visits.user_id` |
| **Doublons** (email insensible à la casse, `(user_id,date)`, recettes, endpoints push, compte) | **0** |
| JSON invalide dans `day_logs` / `account` | **0** |
| Sessions expirées non purgées | **0** (`purgeExpiredSessions` + index `sessions(expires_at)`) |
| Codes premium sur-consommés (`uses > max_uses`) | **0** |
| Emails non normalisés (casse) | **0** |
| Contraintes `FOREIGN KEY` | présentes sur toutes les tables utilisateur, en `ON DELETE CASCADE` |

## Isolation entre comptes (point critique)

Toutes les routes API dérivent l'utilisateur **de la session**, jamais d'un
identifiant fourni par le client : aucune route n'accepte `user_id` en paramètre.
Vérifié empiriquement avec un compte jetable (24 contrôles, tous conformes) :

- lecture croisée impossible : `GET /api/sync/day|days|account|scans|health` ne
  renvoie jamais les données d'un autre compte ;
- `POST /api/community {kind:"delete-recipe"}` sur la recette d'un autre compte → **403** ;
- `/api/stats` et `/api/premium/create-code` sans clé admin → **401** ;
- sans cookie ou avec un cookie forgé → **401** partout ;
- `delete-account` ne supprime que la session courante (cascade sur les tables liées) ;
- cookie de session : `HttpOnly`, `SameSite=Lax`, `Secure` en production, token
  stocké **haché** (`sessions.token_hash`).

> Remarque : l'app n'utilise pas Supabase Auth (donc pas de RLS PostgreSQL) mais
> une authentification maison (scrypt + sessions en base). La garantie
> d'isolation vient donc de la couche API, testée ci-dessus.

## Index

Index déjà présents : PK de chaque table, `idx_sessions_user`,
`idx_scans_user_date`, `idx_events_user_date`, `idx_recipes_created`,
`idx_push_user`, `users(email)` (contrainte UNIQUE).

Index **ajoutés** (déclarés dans `lib/server/db.ts`, créés en
`IF NOT EXISTS`, donc idempotents) :

| Index | Requête servie |
|---|---|
| `scans(user_id, created_at DESC)` | « derniers scans » (`WHERE user_id ORDER BY created_at DESC`) |
| `sessions(expires_at)` | purge et comptage des sessions actives |
| `users(created_at DESC)` | derniers inscrits (panneau admin) |
| `community_recipes(user_id)` | suppression de compte (cascade) |
| `recipe_likes(user_id)` | suppression de compte (cascade) |
| `challenge_progress(challenge_key, points DESC)` | classement des défis (leaderboard) |

## Sauvegarde

1. **Export JSON immédiat** — `GET /api/backup` (header `x-admin-key: <ADMIN_KEY>`
   ou session `ADMIN_EMAIL`) : dump de toutes les tables, **sans** `users.password`
   ni `sessions.token_hash`. Réponse en pièce jointe `sahtek-backup-<date>.json`.
2. **Sauvegarde automatique** — `.github/workflows/db-backup.yml` : `pg_dump`
   nocturne (02:30 UTC) conservé 30 jours en artefact GitHub.
   Activation : ajouter le secret de dépôt `DATABASE_URL` (Settings → Secrets and
   variables → Actions). Sans ce secret, le workflow se termine sans erreur.

## Points restant à décider (propriétaire)

- `team@sahtek.app` : compte « vitrine » sans ligne `account` (jamais connecté) —
  il détient les 5 recettes publiées de la communauté. À conserver tel quel,
  sa suppression en cascade effacerait ces recettes.
- `amine@test.tn` : compte de test actif (5 jours loggés). À supprimer avant
  publication si vous ne voulez plus le voir dans les statistiques.
