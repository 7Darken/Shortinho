# 🐳 Guide Docker - Backend Oshii

## 📋 Prérequis

- Docker installé et en cours d'exécution
- Fichier `.env` avec votre clé OpenAI

## 🚀 Lancement Local

### 1. Construire l'image Docker

```bash
cd backend
docker build -t oshii-backend .
```

### 2. Lancer le conteneur

```bash
docker run -p 3000:3000 --env-file .env oshii-backend
```

**Ou avec des variables d'environnement directement :**

```bash
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=votre_cle_ici \
  -e PORT=3000 \
  oshii-backend
```

### 3. Tester l'API

```bash
# Health check
curl http://localhost:3000/health

# Analyser une recette
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.tiktok.com/@user/video/1234567890"}'
```

## 🔄 Développement avec Hot Reload

Pour un redémarrage automatique lors des modifications :

```bash
docker run -p 3000:3000 \
  --env-file .env \
  -v $(pwd):/usr/src/app \
  -v /usr/src/app/node_modules \
  oshii-backend npm run dev
```

## 🧹 Nettoyage

```bash
# Arrêter tous les conteneurs
docker stop $(docker ps -q --filter ancestor=oshii-backend)

# Supprimer l'image
docker rmi oshii-backend

# Nettoyer complètement
docker system prune -a
```

## 📊 Voir les Logs

```bash
# Logs en temps réel
docker logs -f oshii-backend

# Derniers logs
docker logs --tail 100 oshii-backend
```

## ⚙️ Configuration

### Variables d'environnement

Créez un fichier `.env` dans le dossier `backend/` :

```env
OPENAI_API_KEY=sk-proj-votre_cle_ici
PORT=3000
```

### Port personnalisé

Si vous voulez utiliser un autre port local :

```bash
docker run -p 8000:3000 --env-file .env oshii-backend
# API accessible sur http://localhost:8000
```

## 🚂 Déploiement sur Railway

1. Créez un nouveau projet sur Railway
2. Connectez votre dépôt GitHub
3. Ajoutez les variables d'environnement :
   - `OPENAI_API_KEY`
   - `PORT` (optionnel)
4. Railway détecte automatiquement le Dockerfile et déploie

## 🐛 Dépannage

### Le conteneur ne démarre pas

```bash
# Vérifier les logs
docker logs oshii-backend

# Redémarrer
docker restart oshii-backend
```

### Erreur "Permission denied"

```bash
# Donner les permissions au dossier downloads
docker exec oshii-backend chmod -R 755 /usr/src/app/downloads
```

### Port déjà utilisé

```bash
# Changer le port local
docker run -p 8000:3000 --env-file .env oshii-backend
```

## 📝 Commandes Utiles

```bash
# Construire sans cache
docker build --no-cache -t oshii-backend .

# Entrer dans le conteneur
docker exec -it oshii-backend sh

# Voir les processus
docker top oshii-backend

# Statistiques d'utilisation
docker stats oshii-backend
```

