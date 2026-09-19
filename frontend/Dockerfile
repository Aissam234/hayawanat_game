FROM node:22-alpine

WORKDIR /app

# Declare build-time args for Vite (baked into the JS bundle at npm install / dev server start)
ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source (overridden by volume in dev)
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
