# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist

# Cloud Run requires the app to listen on the $PORT environment variable (default 8080)
ENV PORT=8080
EXPOSE 8080

# Serve the static files from the 'dist' directory
CMD ["sh", "-c", "serve -s dist -l tcp://0.0.0.0:${PORT}"]
