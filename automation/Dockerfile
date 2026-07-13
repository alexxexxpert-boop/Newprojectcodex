FROM node:20-alpine
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm install tsx

# Copy source
COPY src ./src
COPY tsconfig.json ./

# Create logs directory
RUN mkdir -p logs && chown node:node logs

USER node

CMD ["npx", "tsx", "src/index.ts"]
