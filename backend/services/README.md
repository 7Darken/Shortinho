# Services - Architecture Modulaire Multi-Plateformes

Cette architecture modulaire permet d'analyser des recettes depuis différentes plateformes vidéo (TikTok, Instagram, YouTube, etc.) de manière extensible et maintenable.

## 📁 Structure

```
services/
├── platforms/                  # Implémentations par plateforme
│   ├── base/
│   │   └── Platform.js        # Classe abstraite de base
│   ├── tiktok/
│   │   └── TikTokPlatform.js  # Implémentation TikTok ✅
│   ├── youtube/
│   │   └── YouTubePlatform.js # Implémentation YouTube/Shorts ✅
│   ├── instagram/
│   │   └── InstagramPlatform.js  # Implémentation Instagram Reels ✅
│   └── PlatformFactory.js     # Factory pour détecter la plateforme
├── ai/                         # Services d'intelligence artificielle
│   ├── transcription.js       # Transcription Whisper
│   └── recipeAnalyzer.js      # Analyse GPT
├── analyzer.js                 # Orchestrateur principal
└── database.js                 # Opérations base de données
```

## 🚀 Utilisation

### Analyse Simple

```javascript
import { analyzeRecipeFromVideo } from './services/analyzer.js';

const result = await analyzeRecipeFromVideo(
  'https://www.tiktok.com/@user/video/123456',
  './downloads',
  { language: 'fr' }
);

console.log(result.recipe);
```

### Détection Manuelle de Plateforme

```javascript
import { detectPlatform } from './services/platforms/PlatformFactory.js';

const platform = detectPlatform('https://www.tiktok.com/@user/video/123456');
console.log(platform.name); // "TikTok"
```

## 🔧 Ajouter une Nouvelle Plateforme

### 1. Créer l'Implémentation

Créez un fichier `services/platforms/youtube/YouTubePlatform.js` :

```javascript
import { Platform } from '../base/Platform.js';

export class YouTubePlatform extends Platform {
  name = 'YouTube';
  urlPattern = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/i;

  async extractAudio(url, outputDir) {
    // Implémentation de l'extraction audio pour YouTube
    // Utiliser yt-dlp, youtube-dl, ou autre
  }

  async fetchMetadata(url) {
    // Récupérer les métadonnées YouTube (titre, description, etc.)
    // Utiliser l'API YouTube ou oEmbed
  }
}
```

### 2. Enregistrer la Plateforme

Ajoutez-la dans `services/platforms/PlatformFactory.js` :

```javascript
import { YouTubePlatform } from './youtube/YouTubePlatform.js';

const PLATFORMS = [
  TikTokPlatform,
  InstagramPlatform,
  YouTubePlatform,  // ← Ajoutez ici
];
```

### 3. C'est Tout ! 🎉

L'orchestrateur `analyzeRecipeFromVideo()` détectera automatiquement la nouvelle plateforme.

## 📝 Contrat de la Classe Platform

Chaque plateforme doit implémenter :

### Propriétés Requises

- **`name`** (string) : Nom de la plateforme (ex: "TikTok")
- **`urlPattern`** (RegExp) : Pattern pour détecter les URLs

### Méthodes Requises

- **`extractAudio(url, outputDir)`** : Extrait l'audio de la vidéo
  - Retourne : `Promise<string>` (chemin du fichier audio)

- **`fetchMetadata(url)`** : Récupère les métadonnées
  - Retourne : `Promise<Object|null>` ({ title, author, description, etc. })

### Méthodes Héritées (Optionnelles)

- **`matches(url)`** : Vérifie si l'URL correspond (auto)
- **`cleanDescription(text)`** : Nettoie la description (auto)
- **`cleanup(filePath)`** : Supprime un fichier temporaire (auto)

## 🧩 Services AI

### Transcription (Whisper)

```javascript
import { transcribeAudio } from './services/ai/transcription.js';

const text = await transcribeAudio('./audio.mp3', {
  language: 'fr',  // 'fr', 'en', 'auto', etc.
  model: 'whisper-1'
});
```

### Analyse de Recette (GPT)

```javascript
import { analyzeRecipe } from './services/ai/recipeAnalyzer.js';

const recipe = await analyzeRecipe(transcription, {
  description: 'Description optionnelle de la vidéo',
  model: 'gpt-4o-mini',
  temperature: 0.3
});

console.log(recipe.ingredients);
console.log(recipe.steps);
console.log(recipe.nutrition);
```

## 🔄 Flux d'Analyse Complet

1. **Détection** : `PlatformFactory` détecte la plateforme via l'URL
2. **Métadonnées** : La plateforme récupère titre, description, auteur
3. **Extraction** : La plateforme extrait l'audio de la vidéo
4. **Transcription** : Whisper transcrit l'audio en texte
5. **Analyse** : GPT analyse la transcription et extrait la recette structurée
6. **Nettoyage** : Les fichiers temporaires sont supprimés automatiquement

## ⚙️ Configuration

Variables d'environnement requises dans `.env` :

```env
OPENAI_API_KEY=sk-...           # Clé API OpenAI (Whisper + GPT)
```

Variables optionnelles par plateforme :
- TikTok : aucune (utilise yt-dlp)
- Instagram : à définir (API Instagram, etc.)
- YouTube : à définir (API YouTube, etc.)

## 🧪 Tests

Pour tester une nouvelle plateforme :

```javascript
// Test de détection
import { isSupported } from './services/platforms/PlatformFactory.js';
console.log(isSupported('https://youtube.com/watch?v=...')); // true/false

// Test d'extraction
const platform = new YouTubePlatform();
const audioPath = await platform.extractAudio(url, './downloads');
console.log('Audio extrait:', audioPath);

// Test de métadonnées
const metadata = await platform.fetchMetadata(url);
console.log('Métadonnées:', metadata);
```

## 📚 Plateformes Supportées

### ✅ Implémentées et Actives
- **TikTok** : tiktok.com, vm.tiktok.com (Reels & Posts)
- **YouTube** : youtube.com/shorts, youtube.com/watch, youtu.be (Shorts & Videos)
- **Instagram** : instagram.com/reel, instagram.com/p, instagram.com/tv (Reels, Posts & IGTV)

### 💡 À Ajouter
- **Facebook** : facebook.com/watch
- **Snapchat** : snapchat.com/spotlight
- **Pinterest** : pinterest.com (vidéos)
- **Reddit** : reddit.com (vidéos)
- **Twitch Clips** : twitch.tv

## 🛠️ Dépannage

### Erreur "Plateforme non supportée"
- Vérifiez que le pattern `urlPattern` correspond bien à l'URL
- Vérifiez que la plateforme est ajoutée dans `PlatformFactory.PLATFORMS`

### Erreur lors de l'extraction audio
- Vérifiez que yt-dlp est installé : `yt-dlp --version`
- Vérifiez que ffmpeg est installé : `ffmpeg -version`
- Pour Instagram/autres : implémentez votre propre méthode d'extraction

### Erreur de transcription
- Vérifiez `OPENAI_API_KEY` dans `.env`
- Vérifiez que le fichier audio est valide (format supporté : mp3, mp4, m4a, wav, webm)

## 📖 Migration depuis l'Ancien Code

L'ancien code (`analyzer.old.js`) est conservé pour référence. Les anciennes fonctions sont deprecated mais toujours exportées pour compatibilité :

- ❌ `extractTikTokAudio()` → ✅ `TikTokPlatform.extractAudio()`
- ❌ `fetchTikTokMeta()` → ✅ `TikTokPlatform.fetchMetadata()`
- ❌ Appels directs → ✅ `analyzeRecipeFromVideo()`

Mettez à jour votre code pour utiliser la nouvelle architecture modulaire !
