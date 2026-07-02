# TaskList — Backend

API REST de gestion de tâches (TaskList), avec chaîne CI/CD Jenkins complète : tests automatisés, analyse qualité (SonarQube), analyse de sécurité (Trivy), génération de SBOM (SPDX) et publication d'image Docker sur Docker Hub.

## Stack technique

| Élément | Technologie |
|---------|-------------|
| Runtime | Node.js 22 |
| Langage | TypeScript |
| Framework | Express 5 |
| ORM | Prisma (MySQL en production, SQLite en test) |
| Tests | Vitest + supertest (unitaires + E2E) |
| Qualité | SonarQube |
| Sécurité | Trivy (scan + SBOM SPDX) |
| Conteneur | Docker (multi-stage) |
| CI/CD | Jenkins (pipeline déclaratif) |

## Architecture du dépôt

```
src/
  controllers/    # logique des endpoints
  services/       # accès aux données (Prisma)
  routes/         # définition des routes Express
  lib/            # client Prisma
  __tests__/      # tests unitaires + E2E
prisma/           # schéma Prisma (prod + test)
Dockerfile              # build multi-stage
Jenkinsfile             # pipeline CI/CD
sonar-project.properties  # configuration SonarQube
```

## Prérequis

- Node.js 22, npm
- Docker
- (CI) Jenkins avec outil NodeJS `NodeJS-22`, credential `dockerhub-credentials`, serveur SonarQube `SonarQube`, Trivy accessible via image Docker.

## Installation locale

```bash
npm ci
npx prisma generate
cp .env.example .env   # renseigner DATABASE_URL et PORT
```

## Commandes utiles

```bash
npm run dev            # démarrage en développement
npm run build          # compilation TypeScript
npm test               # tests unitaires
npm run test:coverage  # tests unitaires + couverture
npm run test:e2e       # tests E2E
npm start              # démarrage production (dist/)
```

## Pipeline CI/CD (Jenkinsfile)

Le pipeline déclaratif exécute, à chaque build :

1. **Install** — `npm ci` + `npx prisma generate`
2. **Build** — compilation TypeScript
3. **Unit Tests** — tests + couverture (rapport JUnit + HTML publiés)
4. **E2E Tests** — tests d'intégration de l'API
5. **SonarQube Analysis** — analyse qualité de code
6. **Docker Build** — construction de l'image multi-stage
7. **SBOM (SPDX)** — génération du SBOM au format SPDX (Trivy)
8. **Trivy Scan** — analyse de vulnérabilités HIGH/CRITICAL
9. **Docker Push** — publication de l'image sur Docker Hub

## Stratégie de tests

- **Unitaires** : services et contrôleurs (validations, cas d'erreur 400/404/500 via mock Prisma).
- **E2E** : parcours complet de l'API (CRUD) sur une base SQLite de test.
- Couverture V8, rapport `lcov` importé dans SonarQube.

## Sécurité (DevSecOps)

- Aucun secret en clair : identifiants Docker Hub et token SonarQube gérés par les **credentials Jenkins**.
- `.env` ignoré par Git.
- Scan **Trivy** de l'image (OS + dépendances) à chaque build.
- **SBOM SPDX** (`sbom-spdx.json`) archivé pour la traçabilité de la chaîne d'approvisionnement.

## Docker

Image multi-stage (`builder` → `production`) basée sur `node:22-alpine`. L'image finale ne contient que `dist/` et les dépendances de production.

```bash
docker build -t tasklist-backend .
docker run --rm -p 3001:3001 tasklist-backend
```

## Documentation

La documentation technique complète (architecture, configuration Jenkins/SonarQube/Docker, stratégies de test et de sécurité, runbook) est versionnée dans ce dépôt et maintenue de façon collaborative via Git (README + historique des commits).
