FROM node:20-bookworm-slim

WORKDIR /app

COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

RUN npm install --prefix backend --omit=dev \
 && npm install --prefix frontend

COPY backend ./backend
COPY frontend ./frontend

RUN npm run build --prefix frontend

ENV NODE_ENV=production
ENV PORT=7860
ENV FRONTEND_BASE_PATH=/
ENV USE_MEMORY_DB=true

EXPOSE 7860

CMD ["node", "backend/server.js"]
