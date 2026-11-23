FROM node:20-alpine AS runner

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Expose API port
EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

# Default command starts combined cluster (API + Worker)
# Can be overridden in docker-compose for dedicated worker service
CMD ["node", "src/combined.js"]

