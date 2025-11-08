# Oshii Backend - Analyse Multi-Plateformes de Recettes Vidéo

Backend complet en Node.js pour analyser les recettes de cuisine depuis **TikTok**, **YouTube Shorts** et **Instagram Reels** :
- **Multi-plateformes** : Détection automatique de TikTok, YouTube, Instagram
- **Extraction audio** avec yt-dlp
- **Transcription** avec OpenAI Whisper API
- **Analyse structurée** avec GPT-4o-mini
- **Calcul des macros** automatique
- **Architecture modulaire** : Ajoutez facilement de nouvelles plateformes

## 🚀 Installation

### Installation Automatique (Recommandé)

```bash
cd backend
./setup.sh
```

Le script détecte automatiquement votre système et installe **yt-dlp** et **ffmpeg**.

### Installation Manuelle

**1. Installer yt-dlp et ffmpeg**

**macOS:**
```bash
brew install yt-dlp ffmpeg
```

**Linux:**
```bash
sudo apt install yt-dlp ffmpeg
# ou
pip install yt-dlp
sudo apt install ffmpeg
```

**Windows:**
```bash
pip install yt-dlp
# Téléchargez ffmpeg depuis https://ffmpeg.org/download.html
```

**Note:** ffmpeg est requis par yt-dlp pour extraire l'audio des vidéos.

**2. Créer le fichier `.env`**

Créez un fichier `.env` dans le dossier `backend/` :

```env
OPENAI_API_KEY=votre_clé_api_openai_ici
```

**3. Installer les dépendances Node.js**

```bash
cd backend
npm install
```

## 📖 Utilisation

### Mode Serveur (Production)

```bash
# Démarrer le serveur API
npm start

# Ou en mode watch (redémarre automatiquement après modifications)
npm run dev
```

### Mode Test (Développement Local)

Testez une analyse complète sans serveur ni base de données :

```bash
# Tester avec TikTok
npm run test:analyze https://www.tiktok.com/@chef/video/123456

# Tester avec YouTube Shorts
npm run test:analyze https://www.youtube.com/shorts/abc123

# Tester avec Instagram Reel
npm run test:analyze https://www.instagram.com/reel/ABC123/

# Afficher aussi le JSON complet
npm run test:analyze <URL> --json
```

Ce mode test permet de :
- ✅ Tester le workflow complet sans enregistrer dans la base
- ✅ Vérifier la détection de plateforme
- ✅ Voir toutes les étapes d'analyse en détail
- ✅ Débugger rapidement sans polluer les données

**Note:** L'application peut proposer d'installer yt-dlp automatiquement si non détecté.

L'application va :
1. Demander un lien TikTok de recette de cuisine
2. Extraire l'audio avec yt-dlp
3. Transcrire l'audio avec Whisper API
4. Analyser avec GPT-4o-mini pour extraire :
   - Ingrédients avec quantités
   - Étapes de préparation
   - Équipements utilisés
   - Temps de préparation/cuisson
   - Macronutriments (calories, protéines, glucides, lipides, fibres, sucres)
5. Afficher la recette structurée dans le terminal
6. Proposer de traiter une autre vidéo

## 📁 Structure

```
backend/
├── index.js           # Code principal
├── package.json       # Dépendances
├── .env              # Variables d'environnement (à créer)
├── README.md         # Documentation
├── setup.sh          # Script d'installation automatique
└── downloads/        # Dossier des fichiers téléchargés (créé automatiquement)
```

## 📄 Format de Sortie

- Format : MP3
- Qualité : Meilleure qualité disponible
- Emplacement : `backend/downloads/audio_[timestamp].mp3`

## ⚙️ Configuration

Vous pouvez modifier la configuration dans `index.js` :

```javascript
const AUDIO_DIR = path.join(__dirname, 'downloads'); // Dossier de sortie
const YTDLP_BINARY = path.join(__dirname, 'yt-dlp');  // Chemin vers yt-dlp
```

## 🐛 Dépannage

**Erreur : "yt-dlp non installé" ou "ffmpeg non trouvé"**
```bash
# macOS
brew install yt-dlp ffmpeg

# Linux
sudo apt install yt-dlp ffmpeg

# Ou avec Python
pip install yt-dlp
sudo apt install ffmpeg
```

**Erreur : "URL invalide"**
- Vérifiez que le lien TikTok est correct
- Le lien doit être au format : `https://www.tiktok.com/@user/video/1234567890`

**Erreur : "Video unavailable"**
- La vidéo pourrait être privée ou supprimée
- TikTok pourrait bloquer le téléchargement
- Mettez à jour yt-dlp : `yt-dlp -U`

**Erreur : "OPENAI_API_KEY non définie"**
- Vérifiez que le fichier `.env` existe dans le dossier `backend/`
- Vérifiez que la clé API est correcte
- Le fichier `.env` doit contenir : `OPENAI_API_KEY=votre_clé_ici`

**Erreur : "Erreur API: 401"**
- Votre clé API OpenAI est invalide ou expirée
- Vérifiez sur https://platform.openai.com/api-keys

**Options yt-dlp utilisées :**
- `--extract-audio` : Extraire seulement l'audio
- `--audio-format mp3` : Format MP3
- `--audio-quality 0` : Meilleure qualité
- `--no-playlist` : Télécharger seulement la vidéo, pas la playlist

## 📚 Bonnes Pratiques Implémentées

- ✅ Gestion d'erreurs propre
- ✅ Noms de fichiers uniques (timestamp)
- ✅ Interface utilisateur claire avec emojis
- ✅ Formatage de taille lisible
- ✅ Boucle pour traiter plusieurs vidéos
- ✅ Configuration centralisée
- ✅ Documentation claire
- ✅ Transcription automatique avec Whisper
- ✅ Analyse intelligente avec GPT-4o-mini
- ✅ Extraction structurée des ingrédients, étapes, équipements
- ✅ Calcul automatique des macronutriments
- ✅ Affichage élégant et lisible dans le terminal
- ✅ Support des variables d'environnement (.env)
- ✅ Gestion d'erreurs complète

## 🔗 Intégration avec l'App Oshii

Ce backend peut être intégré dans l'app Oshii pour :

1. **Alternative à l'Edge Function** : Utiliser yt-dlp localement
2. **Debugging** : Tester l'extraction audio avant l'intégration
3. **Développement** : Workflow local pendant le développement

### Intégration Future

Vous pouvez modifier ce backend pour :
- Exposer une API REST (Express.js)
- Uploader automatiquement vers Supabase
- Retourner directement l'audio à Whisper API
- Gérer plusieurs téléchargements simultanés
