# Stage 1: Build the Vite app
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build with the API URL pointing to the containerized core-api
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

# Build with the MinIO URL for direct crop image access
ARG VITE_MINIO_URL=http://localhost:9000
ENV VITE_MINIO_URL=$VITE_MINIO_URL

RUN npm run build

# Stage 2: Serve via nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config to support React client-side routing
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
