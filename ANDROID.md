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
| JDK | **17 ou 21** | Livré avec Android Studio ; AGP 8.13 / Gradle 8.14 |
| Android Studio | dernière | Fournit le SDK et le JDK |
| SDK Android | **API 36** | `compileSdk`/`targetSdk` (voir `android/variables.gradle`) |
| `ANDROID_HOME` | — | Ex. `C:\Users\<toi>\AppData\Local\Android\Sdk` |

Utilise le JDK fourni par Android Studio (`File > Settings > Build Tools >
Gradle > Gradle JDK > 17`). Gradle télécharge des dépendances au premier build —
la première compilation demande donc du réseau.

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

Un build release doit être **signé**, sinon ni installation ni Play Store.

**a. Créer la clé de signature (une seule fois, à conserver précieusement) :**

```bash
keytool -genkey -v -keystore sahtek-upload.keystore -alias sahtek \
  -keyalg RSA -keysize 2048 -validity 10000
```

> ⚠️ Perdre ce fichier interdit **définitivement** toute mise à jour de l'app
> publiée. Sauvegarde-le hors du dépôt (il est déjà couvert par le
> `.gitignore` via `*.keystore`).

**b. Déclarer la signature** — créer `android/keystore.properties` (à ne pas
committer) :

```properties
storeFile=../sahtek-upload.keystore
storePassword=motdepasse
keyAlias=sahtek
keyPassword=motdepasse
```

puis dans `android/app/build.gradle`, avant `android { }` :

```gradle
def keystoreProps = new Properties()
file("../keystore.properties").withInputStream { keystoreProps.load(it) }
```

et dans le bloc `android { }` :

```gradle
signingConfigs {
    release {
        storeFile file(keystoreProps['storeFile'])
        storePassword keystoreProps['storePassword']
        keyAlias keystoreProps['keyAlias']
        keyPassword keystoreProps['keyPassword']
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
    }
}
```

**c. Générer :**

```bash
cd android
./gradlew assembleRelease      # → app/build/outputs/apk/release/app-release.apk
./gradlew bundleRelease        # → app/build/outputs/bundle/release/app-release.aab
```

Le **Play Store exige un `.aab`** (le `.apk` sert à installer à la main / au
partage direct).

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
# 1. Construire l'APK release (voir § 2)
cd android && ./gradlew assembleRelease && cd ..

# 2. Le copier là où le site le sert (nom imposé : c'est le href du bouton)
cp android/app/build/outputs/apk/release/app-release.apk public/downloads/sahtek.apk

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
