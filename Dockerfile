FROM node:25.8.1-alpine3.23 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.29.8-alpine3.23

ENV BACKEND_BASE_URL=http://localhost:8080/api/v1

RUN apk add --no-cache --upgrade libexpat zlib

COPY docker/nginx/admin.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx/security-headers.inc /etc/nginx/conf.d/security-headers.inc
COPY docker/nginx/entrypoint.sh /entrypoint.sh
COPY --from=build /app/dist /usr/share/nginx/html

RUN chmod +x /entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
