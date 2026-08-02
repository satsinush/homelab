# Build context: services/dashboard (so ./shared is available next to ./frontend)
FROM node:20-alpine

WORKDIR /app

COPY shared ./shared
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm install

COPY frontend ./

CMD ["npm", "run", "dev"]

EXPOSE 5173
