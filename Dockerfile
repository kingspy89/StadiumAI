FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ARG VITE_GEMINI_API_KEY
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY

RUN npm run build

ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "--loader", "tsx", "server.ts"]
