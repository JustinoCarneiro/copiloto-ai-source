# Build multi-stage: compila o Vite e serve o resultado estático com nginx.
# Contexto de build é a raiz do repo (ver docker-compose.yml: build.context: ..).

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Vite lê VITE_* do ambiente em tempo de BUILD, não de runtime — por isso viram build args
# aqui em vez de env vars do container final.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}

RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
