# Android — construire l'APK / l'AAB

Sahtek est un Next.js rendu côté serveur, embarqué dans une WebView native
(Capacitor). Voir [capacitor.config.ts](capacitor.config.ts) pour le pourquoi de
ce choix (`server.url` : l'APK charge le site de production, donc cookies,
session, Supabase et OAuth fonctionnent sans code supplémentaire).

---

## 1. Prérequis (une seule fois)

| Outil | Version | Notes |
| --- | --- | --- |
| Node.js | ≥ 22.5.0 | `engines` du package.json |
| JDK | **21 obligatoire** | Voir ci-dessous : 17 ne suffit pas |
| Android Studio | optionnel | Fournit une interface ; les outils en ligne de commande suffisent |
| SDK Android | **API 36** | `compileSdk`/`targetSdk` (voir `android/variables.gradle`) |

**JDK 21, pas 17.** Les plugins Capacitor (`local-notifications`, `splash-screen`,
`status-bar`) demandent un toolchain Java 21 : avec un JDK 17 seul, la
configuration échoue sur « Cannot find a Java installation matching:
{languageVersion=21} ». Gradle détecte le JDK 21 dès qu'il est installé à
l'emplacement standard (`C:\Program Files\Microsoft\jdk-21…`) et que `JAVA_HOME`
pointe dessus. Si ton installation est ailleurs, indique-la à Gradle dans
`%USERPROFILE%\.gradle\gradle.properties` — fichier **personnel**, à ne pas
committer, contrairement à `android/gradle.properties` :

```properties
org.gradle.java.installations.paths=C\:\\Program Files\\Microsoft\\jdk-21.0.12.101-hotspot
```

**Ce qui est installé sur ce poste** (aucun Android Studio, uniquement les outils
de ligne de commande — largement suffisant pour construire l'APK) :

- JDK 21 → `C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot`
- JDK 17 → `C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot` (inutile au build)
- SDK → `C:\Users\alimb\AppData\Local\Android\Sdk` (platform 36, build-tools
  36.0.0 et 36.1.0, platform-tools)
- `android/local.properties` contient le `sdk.dir` (fichier local, jamais committé)

Chaque commande ci-dessous suppose `JAVA_HOME` positionné :

```bash
export JAVA_HOME='C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot'   # Git Bash
```

Gradle télécharge ses dépendances au premier build — la première compilation
demande donc du réseau (et quelques minutes).

---

## 2. Construire

Depuis la racine du projet :

```bash
npm install                 # une seule fois
npm run build:android       # = npm run build && npx cap sync android
```

`build:android` fait deux choses : il compile le site Next.js, puis il copie la
config et enregistre les plugins natifs dans le projet `android/`.

Il n'est **pas** nécessaire de relancer `cap sync` après un simple changement de
code web : l'APK charge la prod, donc chaque déploiement Vercel est
immédiatement en ligne dans l'app. On relance `cap sync` uniquement après avoir
touché à `capacitor.config.ts`, ajouté/retiré un plugin, ou modifié un fichier
dans `android/`.

### APK de test (debug) — installable tout de suite

```bash
cd android
./gradlew assembleDebug          # Windows : gradlew.bat assembleDebug
```

Résultat : `android/app/build/outputs/apk/debug/app-debug.apk`

Installer sur un téléphone branché en USB (débogage USB activé) :

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### APK / AAB de publication (release)

Un build release doit être **signé**, sinon ni installation ni Play Store. C'est
**déjà en place sur ce poste** :

- Clé de signature : `android/sahtek-upload.keystore` (alias `sahtek`, valide
  jusqu'en 2054, RSA 2048, SHA-256
  `47:82:F0:A9:C4:6E:E8:54:63:7F:02:35:5A:74:7B:55:77:F3:50:BF:C9:1C:61:54:2B:75:5A:56:0A:94:A0:26`)
- Identifiants : `android/keystore.properties` (mot de passe inclus — c'est ce
  fichier qu'il faut sauvegarder **avec** la clé)
- Lecture et branchement : `android/app/build.gradle`, qui teste la présence du
  fichier. Sans lui (autre poste, intégration continue), le build release
  fonctionne toujours mais produit un APK non signé, au lieu d'échouer.

Les deux fichiers sont hors de git (`*.keystore` et `android/keystore.properties`).

> ⚠️ Perdre la clé **ou** son mot de passe interdit **définitivement** toute mise
> à jour de l'app déjà installée : Android refuse un APK signé avec une autre clé,
> et les utilisateurs devraient désinstaller puis réinstaller. Sauvegarde les
> deux fichiers hors de ce disque, dans un endroit chiffré.
>
> ⚠️ Ne publie **jamais** un APK debug à des utilisateurs : sa clé de debug est
> jetable, donc il ne pourra jamais être mis à jour par un APK release.

Pour changer de mot de passe plus tard : `keytool -storepasswd` (et
`-keypasswd` sur l'alias) puis mets à jour `keystore.properties`.

**Générer :**

```bash
cd android
./gradlew assembleRelease      # → app/build/outputs/apk/release/app-release.apk
./gradlew bundleRelease        # → app/build/outputs/bundle/release/app-release.aab
```

Le **Play Store exige un `.aab`** (le `.apk` sert à installer à la main / au
partage direct). Pour distribuer l'APK depuis l'app elle-même, voir le §6.

Une fois l'APK construit, `npm run publish:apk` le copie vers
`public/downloads/sahtek.apk` : c'est le fichier que sert le bouton
« Télécharger l'APK ».

---

## 3. Tester un autre environnement

`capacitor.config.ts` lit `CAP_SERVER_URL` : utile pour faire pointer un build de
test vers une préproduction sans toucher à la prod.

```bash
CAP_SERVER_URL=https://mon-deploiement-preview.vercel.app npm run build:android
```

---

## 4. Vérifier sur l'appareil

Débogage USB activé, puis dans Chrome sur le PC : `chrome://inspect` → l'app
Sahtek apparaît → `inspect`.

- **Service worker / hors ligne** : onglet *Application* → *Service Workers*
  (statut `activated`) et *Cache Storage* → `sahtek-v18` doit contenir les
  fichiers `_next/static`. Test réel : activer le mode avion, puis relancer
  l'app — elle doit s'ouvrir normalement.
- **Notifications** : *Réglages > Applications > Sahtek > Notifications* doit
  être autorisé (Android 13+ demande la permission au premier lancement). Les
  rappels planifiés — qui doivent se déclencher **app fermée** — se contrôlent
  en ligne de commande : `adb shell dumpsys alarm | grep sahtek`.

---

## 5. Ce qui est natif dans cet APK

| Brique | État |
| --- | --- |
| Écran de démarrage (`@capacitor/splash-screen`) | ✅ aux couleurs de l'app |
| Barre de statut suivant le thème clair/sombre (`@capacitor/status-bar`) | ✅ |
| Icône de lanceur + icône ronde + splash (`npm run assets:android`) | ✅ |
| Caméra (permission `CAMERA`, scan de code-barres et de plat) | ✅ |
| Rappels de repas et récap calories (`@capacitor/local-notifications`) | ✅ planifiés 7 jours à l'avance |
| Hors ligne (service worker + `server.errorPath`) | ✅ |
| Web Push « app fermée » via serveur (VAPID + cron) | ❌ **web uniquement** — un WebView n'a pas de service worker de push. Les rappels natifs ci-dessus couvrent le besoin. |

---

## 6. Publier l'APK aux utilisateurs (bouton dans l'app)

Un bouton **App Android (.apk)** apparaît dans *Profil → Installer* — et
**uniquement** sur Android dans un navigateur : jamais sur iPhone (le fichier
n'existe pas), jamais sur ordinateur, jamais à l'intérieur de l'APK ni dans la
PWA déjà installée (l'app y est déjà). Il est suivi d'un pas-à-pas qui explique
la seule étape vraiment bloquante : Android demande d'abord l'autorisation
d'installer une app hors Play Store.

### Hébergement par le site (le plus simple)

```bash
# 1. Construire l'APK release (voir § 2) — JAVA_HOME sur le JDK 21
cd android && ./gradlew assembleRelease && cd ..

# 2. Le copier là où le site le sert (nom imposé : c'est le href du bouton)
npm run publish:apk

# 3. Committer puis déployer — le fichier DOIT être versionné, sinon Vercel ne
#    peut pas le servir. `.gitignore` ignore tous les *.apk, mais
#    `public/downloads/*.apk` est explicitement ré-autorisé pour ça.
git add public/downloads/sahtek.apk
git commit -m "Publier l'APK Android" && git push
```

Deux détails sont déjà réglés par [next.config.mjs](next.config.mjs) et
[public/sw.js](public/sw.js) :

- **Type MIME** `application/vnd.android.package-archive` + `Content-Disposition:
  attachment`. Sans eux, Chrome sert le fichier comme un blob sans nom et
  Android ne propose pas « Installer ».
- **Jamais dans le cache** : le service worker n'intercepte pas `/downloads/`.
  Un APK mis en cache serait sinon servi indéfiniment à sa première version.

Tant que le fichier n'est pas là, le bouton affiche « APK introuvable pour le
moment » au lieu de mener à une 404 — la carte sonde une fois en `HEAD`.

### Variante : GitHub Releases (dépôt léger)

Utile si tu ne veux pas versionner un binaire de plusieurs Mo à chaque version :

```bash
gh release create v2.0.0 android/app/build/outputs/apk/release/app-release.apk
```

Puis, dans `.env.local` **et** dans les variables d'environnement Vercel :

```bash
NEXT_PUBLIC_APK_URL=https://github.com/AlimChico/nourish/releases/latest/download/app-release.apk
```

Avec une URL externe, aucune sonde de disponibilité n'est tentée (le CORS la
bloquerait) : le bouton s'affiche d'office.

### Mises à jour

Grâce à `server.url`, **le code de l'app se met à jour tout seul** à chaque
déploiement Vercel : tu ne republies un APK que quand le natif change (plugins,
icônes, permissions, config Capacitor). ⚠️ **Sauvegarde ta clé de signature**
(`*.keystore`, volontairement hors de git) : Android refuse de mettre à jour une
app signée avec une autre clé — perdue, tu ne peux plus publier de mise à jour
sous ce nom de paquet.

> Google Play n'accepte pas une app qui n'est qu'une coquille de site web : pour
> une publication sur le store, ajoute une brique réellement native (push via
> FCM, caméra native, ou widget) en plus du wrapper.
