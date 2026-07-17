FROM node:20-alpine

WORKDIR /app

# Copy package files from backend
COPY backend/package*.json ./backend/

# Install dependencies
RUN cd backend && npm install --production

# Copy backend source code
COPY backend/ ./backend/

# Set working directory to backend
WORKDIR /app/backend

EXPOSE 4000

ENV NODE_ENV=production

CMD ["node", "bot.js"]
