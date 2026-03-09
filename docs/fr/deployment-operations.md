# Deploiement et operations

## Vue d ensemble

Le repo fournit:

- un `Dockerfile` multi-stage,
- une configuration Nginx runtime,
- un entrypoint qui genere `runtime-config.js`.

Il n y a pas de `docker-compose.yml` dans ce repo. Le deploiement standard repose sur `docker build` puis `docker run`.

## Dockerfile production

Etapes:

1. image build `node:25-alpine`,
2. `npm ci`,
3. `npm run build`,
4. image runtime `nginx:1.29-alpine`,
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

Build image:

```bash
docker build -t demeter-admin-panel .
```

Run local:

```bash
docker run --rm -p 4173:8080 \
  -e BACKEND_BASE_URL=http://localhost:8080/api/v1 \
  demeter-admin-panel
```

## Smoke checks minimaux

```bash
curl -I http://localhost:4173/index.html
curl -I http://localhost:4173/runtime-config.js
curl -I http://localhost:4173/users
curl http://localhost:4173/runtime-config.js
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
