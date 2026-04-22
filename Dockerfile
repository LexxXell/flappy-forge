FROM node:20-bookworm-slim

WORKDIR /app

# Install all workspace dependencies (including dev deps required by theme build tools).
COPY package.json package-lock.json ./
COPY packages/builder/package.json packages/builder/package.json
COPY packages/engine/package.json packages/engine/package.json
COPY packages/web/package.json packages/web/package.json
RUN npm ci

# Copy project sources.
COPY . .

# Build web client once; backend serves this static bundle.
RUN npm run client:build -w packages/web

EXPOSE 3000

# Run backend (serves API + built client).
CMD ["npm", "run", "web:server"]
