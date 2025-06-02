# Use official Node.js 20 image (full version for development tools)
FROM node:20

# Create app directory
WORKDIR /usr/src/app

# Install dependencies with all dev dependencies included
COPY package*.json ./
RUN npm install

# Copy app source
COPY . .

# Set development environment
ENV NODE_ENV=development
ENV PORT=3000
ENV LOG_LEVEL=debug
ENV FORCE_HTTPS=false

# Expose the app port
EXPOSE 3000

# Start the development server with hot reloading
CMD ["npm", "run", "dev"] 