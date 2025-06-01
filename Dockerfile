# Use official Node.js 20 slim image
FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Install dependencies first (for better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app source
COPY . .

# Set environment variables
ENV NODE_ENV=production

# Use a non-root user for security
RUN useradd -m shoutbin
USER shoutbin

# Expose the app port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"] 