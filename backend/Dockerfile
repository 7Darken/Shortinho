# Image de base officielle Node.js
FROM node:20-bullseye-slim

# Définir le dossier de travail
WORKDIR /usr/src/app

# Installer les dépendances système nécessaires
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    wget \
    && pip3 install --no-cache-dir yt-dlp \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Créer le dossier temporaire pour les fichiers audio/vidéo
RUN mkdir -p /usr/src/app/downloads && chmod 755 /usr/src/app/downloads

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances npm en mode production
RUN npm install --production --no-audit --no-fund

# Copier le reste du code
COPY . .

# Exposer le port
EXPOSE 3000

# Variable d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=3000

# Commande de démarrage
CMD ["npm", "start"]

