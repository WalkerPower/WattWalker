

# Stage 1: Build the React Application
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Accept API key as build argument and set as environment variable for Vite
ARG GEMINI_API_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY

# Build the application (Vite will inject the API key)
RUN npm run build


# Stage 2: Serve with Python (FastAPI)
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if needed (e.g. for Pillow)
# pillow-heif often requires libheif headers if compiling, 
# but binary wheels usually work on slim.
# We'll install minimal build tools just in case.
# RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Copy built frontend assets from Stage 1
# We allow "backend/static" to be the destination in the container
COPY --from=build /app/dist ./static

# Expose port (Cloud Run uses 8080 by default)
ENV PORT=8080
EXPOSE 8080

# Run the application
# We use uvicorn to run the 'main' module's 'app' object
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
