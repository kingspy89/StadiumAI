FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build and tsx)
RUN npm install

# Copy project files
COPY . .

# Build the React/Vite frontend
RUN npm run build

# Expose the port Cloud Run will route traffic to
EXPOSE 3000

# Start the server
ENV NODE_ENV=production
ENV PORT=3000

CMD ["npx", "tsx", "server.ts"]
