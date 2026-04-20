FROM node:20-bookworm-slim

WORKDIR /app

# Increase Node memory to avoid OOM during npm install and build
ENV NODE_OPTIONS=--max_old_space_size=4096

COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

RUN npm install --prefix backend --omit=dev \
 && npm install --prefix frontend

COPY backend ./backend
COPY frontend ./frontend

# Frontend is pre-built, no need to build in Docker

ENV NODE_ENV=production
ENV PORT=7860
ENV FRONTEND_BASE_PATH=/
ENV USE_MEMORY_DB=true
# JWT secret for authentication (demo default - set in Space secrets for production)
ENV JWT_SECRET=hf_space_default_secret_please_set_in_secrets

EXPOSE 7860

CMD ["node", "backend/server.js"]
