# Transio

Change de sport, garde tes acquis. Transio construit un plan d'entraînement qui part de ton
ancien sport, protège les points faibles propres à la transition (tendons, impacts) et
s'ajuste chaque semaine selon tes ressentis.

V1 : un seul parcours, **vélo → course à pied, avec muscu**.

## Démarrer

Prérequis : Node.js 20.9 ou plus récent.

```bash
npm install
npm run dev        # http://localhost:3000
```

| Commande            | Rôle                             |
| ------------------- | -------------------------------- |
| `npm run dev`       | Serveur de développement         |
| `npm run build`     | Build de production              |
| `npm start`         | Lance le build de production     |
| `npm test`          | Tests du moteur de plan (Vitest) |
| `npm run lint`      | ESLint                           |
| `npm run typecheck` | Vérification TypeScript          |
| `npm run format`    | Formate le code avec Prettier    |

## Organisation

```
src/
  app/          pages Next.js (App Router), manifest et icônes de la web app
  components/   composants d'interface et écrans
  lib/          dates, état de l'app (plan, retours, bilans) et sauvegarde locale
  engine/       moteur de plan, en TypeScript pur, sans dépendance à l'interface
public/         icônes et service worker (sw.js)
video/          vidéo de présentation et ses sources
```

## Les écrans de la V1

L'app a une navigation permanente : barre latérale sur ordinateur, onglets en bas sur mobile.

| Écran         | Route            | Rôle                                                                                       |
| ------------- | ---------------- | ------------------------------------------------------------------------------------------ |
| Accueil       | `/`              | Présentation ; renvoie vers l'app si un plan existe                                        |
| Questionnaire | `/questionnaire` | 4 étapes : sport d'origine, blessures, objectif et date de début, semaine type             |
| Aujourd'hui   | `/aujourdhui`    | Séance du jour et son retour (faite, durée, difficulté 1–10, gêne ou douleur, commentaire) |
| Calendrier    | `/calendrier`    | Frise des semaines, semaine jour par jour, retours, bilan de semaine                       |
| Analyses      | `/analyses`      | Séances faites, minutes de course faites et prévues, charge sRPE, ratio aigu / chronique   |
| Journal       | `/journal`       | Historique des séances notées, journal muscu et records                                    |
| Profil        | `/profil`        | Réponses au questionnaire, refaire le plan, effacer les données                            |

Le bilan d'une semaine terminée applique `adjustPlan` au reste du plan. Pour l'instant, le plan
et les retours sont enregistrés dans le navigateur (`src/lib/store.ts`), en attendant la base
de données.

## Le moteur de plan (`src/engine`)

Tout est fait de **règles codées**, sans IA : les conditions de l'API Strava interdisent
d'utiliser ses données dans des modèles d'IA. Les seuils sont regroupés dans
`src/engine/rules.ts` pour pouvoir les faire valider et les ajuster facilement.

- **Profil de départ** (`startMinutes`) : le volume de course de la première semaine dépend
  du sport d'origine, des blessures passées au membre inférieur et du volume habituel.
- **Plan par phases** (`generatePlan`) : base, rythme, spécifique, puis une semaine de test.
- **Garde-fous de transition** : hausse du volume de course plafonnée à 10 % par semaine
  (entre 5 et 15 min), une semaine allégée toutes les 4 semaines, course-marche les
  2 premières semaines quand on n'a pas l'habitude des impacts.
- **Double sport** : une séance du sport d'origine et du renforcement restent dans la semaine.
- **Ajustement hebdo** (`adjustPlan`) : à partir du retour sur chaque séance (faite ou non,
  difficulté ressentie de 1 à 10, gêne ou douleur), le plan progresse, garde le même volume,
  ou allège la semaine suivante.
- **Charge** (`load.ts`) : charge sRPE (durée × ressenti), ratio aigu / chronique, monotonie.

Transio parle d'entraînement et de progressivité, jamais de diagnostic : en cas de douleur,
l'app allège le plan et invite à consulter un professionnel de santé.

## Web app installable

L'app est une PWA : `src/app/manifest.ts` décrit l'app installée, `public/sw.js` garde les
pages déjà vues accessibles hors connexion. Le service worker n'est enregistré qu'en
production (`npm run build && npm start`).
