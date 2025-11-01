# 🚀 Guide de Démarrage Rapide - Backend API

## 📋 Architecture

```
App React Native → Backend API (Express) → yt-dlp + Whisper + GPT → JSON Recipe
```

## ⚙️ Installation

```bash
cd backend

# Installer les dépendances npm
npm install

# Créer le fichier .env
echo "OPENAI_API_KEY=votre_cle_ici" > .env
```

## 🎯 Utilisation

### 1. Démarrer le serveur API

```bash
npm start
# ou en mode dev avec auto-restart
npm run dev
```

### 2. Tester l'API

```bash
# Health check
curl http://localhost:3000/health

# Analyser une recette
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.tiktok.com/@user/video/1234567890"}'
```

### 3. Dans l'app React Native

```typescript
import { analyzeRecipe } from '@/services/api';

const recipe = await analyzeRecipe(tiktokUrl);
// recipe contient: title, ingredients, steps, servings, prep_time, cook_time, total_time
```

## 📡 Endpoints

### POST /analyze
Analyse une recette TikTok et retourne la recette structurée.

**Request:**
```json
{
  "url": "https://www.tiktok.com/@user/video/1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "recipe": {
    "title": "Nom de la recette",
    "servings": 4,
    "prep_time": "15 min",
    "cook_time": "30 min",
    "total_time": "45 min",
    "ingredients": [
      {
        "name": "Nom de l'ingrédient",
        "quantity": "200",
        "unit": "g"
      }
    ],
    "steps": [
      {
        "order": 1,
        "text": "Instruction...",
        "duration": "10 min",
        "temperature": "180°C"
      }
    ]
  }
}
```

### GET /health
Vérifie que l'API est opérationnelle.

**Response:**
```json
{
  "status": "ok",
  "message": "API Oshii Backend est opérationnelle",
  "timestamp": "2025-11-01T16:00:00.000Z"
}
```

## 🔧 Configuration

### Variables d'environnement (.env)

```env
OPENAI_API_KEY=sk-proj-votre_cle_openai_ici
PORT=3000  # Optionnel, par défaut 3000
```

### Configuration React Native

Dans `app.config.js`:
```js
extra: {
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3000',
}
```

Dans `.env` de l'app:
```env
BACKEND_URL=http://localhost:3000
```

**Pour tester sur un appareil physique:**
- Mac: `http://192.168.x.x:3000` (remplacer par votre IP locale)
- Sur le même réseau WiFi que votre machine

## 🐛 Dépannage

### Backend ne démarre pas
```bash
# Vérifier que les dépendances sont installées
npm install

# Vérifier yt-dlp et ffmpeg
yt-dlp --version
ffmpeg -version
```

### Erreur "Cannot find module"
```bash
# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install
```

### Erreur API OpenAI
- Vérifier que `OPENAI_API_KEY` est définie dans `.env`
- Vérifier que la clé est valide sur https://platform.openai.com/api-keys

### App React Native ne peut pas joindre le backend
- Vérifier que le backend tourne (`curl http://localhost:3000/health`)
- Vérifier que `BACKEND_URL` est correcte dans l'app
- Si sur appareil physique, utiliser l'IP locale du Mac

## 📦 Structure des Fichiers

```
backend/
├── server.js              # Serveur Express principal
├── index.js               # CLI interactif (mode terminal)
├── package.json
├── .env                   # Variables d'environnement
├── services/
│   └── analyzer.js        # Logique d'analyse (extract, transcribe, analyze)
└── downloads/             # Fichiers temporaires (créé automatiquement)
```

## 🎯 Commandes Disponibles

```bash
# Mode API (recommandé pour l'app)
npm start              # Démarre l'API
npm run dev            # Démarre avec auto-restart

# Mode CLI (terminal interactif)
npm run cli            # Interface ligne de commande
```

## ✅ Checklist

- [ ] Node.js >= 18 installé
- [ ] yt-dlp installé (`brew install yt-dlp`)
- [ ] ffmpeg installé (`brew install ffmpeg`)
- [ ] Dépendances npm installées (`npm install`)
- [ ] Fichier `.env` créé avec `OPENAI_API_KEY`
- [ ] Backend démarre sans erreur (`npm start`)
- [ ] Health check fonctionne (`curl http://localhost:3000/health`)

## 🚀 Next Steps

1. Démarrer le backend : `cd backend && npm start`
2. Tester une analyse : `curl -X POST http://localhost:3000/analyze ...`
3. Ouvrir l'app React Native
4. Coller un lien TikTok
5. Profiter ! 🎉
