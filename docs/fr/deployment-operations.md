# Deploiement et operations

## Vue d ensemble

Le repo fournit:

- un `Dockerfile` multi-stage,
- une configuration Nginx runtime,
- un entrypoint qui genere `runtime-config.js`,
- un compose production (`compose.yml`),
- un compose developpement (`compose.dev.yml`).

## Dockerfile production

Etapes:

1. image build `node:25.8.1-alpine3.23`,
2. `npm ci`,
3. `npm run build`,
4. image runtime `nginx:1.29.6-alpine3.23`,
5. copie de `dist/`, de la config Nginx et de l entrypoint.

## Runtime Nginx

Port expose:

- `8080`

Fichiers cle:

- `docker/nginx/admin.conf`
- `docker/nginx/entrypoint.sh`

Fonctions:

- servir `dist/`,
- fallback SPA vers `/index.html`,
- servir `runtime-config.js` en `no-store`,
- servir `/assets/` avec cache immutable,
- appliquer les headers de securite.

## Compose production

Service:

- `admin`: app statique servie par Nginx sur le port `8080`.

L URL backend est fixee explicitement dans `compose.yml` sur `https://trapi.demeter-sante.fr/api/v1`.

Environnement:

- `BACKEND_BASE_URL=https://trapi.demeter-sante.fr/api/v1`

Lancement:

```bash
docker compose up --build -d
```

Arret:

```bash
docker compose down
```

## Compose developpement

Service:

- `admin`: serveur de dev Vite sur le port `4173`.

Le fallback runtime local dans [`public/runtime-config.js`](../public/runtime-config.js) pointe deja vers `http://localhost:8080/api/v1` quand on est sur localhost, donc aucune variable runtime n est necessaire pour la stack dev.

Lancement:

```bash
docker compose -f compose.dev.yml up -d
```

## Injection runtime backend

L entrypoint lit:

- `BACKEND_BASE_URL`

Puis ecrit:

```js
window.__APP_RUNTIME_CONFIG__ = {
  backendBaseUrl: "<value>",
}
```

Valeur par defaut du conteneur:

- `http://localhost:8080/api/v1`

## Commandes utiles

Lancement local prod-like:

```bash
docker compose up --build -d
```

## Smoke checks minimaux

```bash
curl -I http://localhost:8080/index.html
curl -I http://localhost:8080/runtime-config.js
curl -I http://localhost:8080/users
curl http://localhost:8080/runtime-config.js
```

Attendus:

- `index.html` retourne `200`,
- `/users` retourne `200` grace au fallback SPA,
- `runtime-config.js` contient la bonne URL backend,
- les headers securite sont presents.

## Mise a jour et rollback

Mise a jour basique:

1. recuperer le nouveau code,
2. reconstruire l image,
3. redemarrer le conteneur.

Rollback basique:

1. revenir a un commit stable,
2. reconstruire l image precedente,
3. relancer le conteneur avec la meme variable `BACKEND_BASE_URL`.

## Liens

- Securite: [`security-privacy.md`](security-privacy.md)
- Depannage: [`troubleshooting.md`](troubleshooting.md)
