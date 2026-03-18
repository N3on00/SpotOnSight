FROM node:20-alpine AS builder

WORKDIR /app/frontend

ARG VITE_API_BASE_URL=/api
ARG VITE_SUPPORT_EMAIL=support@example.com

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_SUPPORT_EMAIL=$VITE_SUPPORT_EMAIL

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend .
RUN npm run build

FROM nginx:alpine AS runtime

COPY infrastructure/nginx/frontend.conf /etc/nginx/conf.d/default.conf
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
