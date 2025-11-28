# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Oshii Backend** is a Node.js Express API server that analyzes cooking recipes from social media videos (TikTok, YouTube Shorts, Instagram Reels). The system extracts audio from videos using yt-dlp, transcribes the audio with OpenAI Whisper API, and analyzes the content using GPT-4o-mini to extract structured recipe data (ingredients, steps, equipment, nutrition, classification).

## Core Architecture

### Request Flow
1. **Authentication**: JWT token validation via Supabase auth (middlewares/auth.js)
2. **Premium Check**: Verify user can generate recipe (free tier limit or premium subscription)
3. **Duplicate Prevention**: Check if recipe already exists for this URL (normalized, query params removed)
4. **Concurrency Lock**: Prevent duplicate concurrent analyses per user using in-memory Map
5. **Platform Detection**: Automatically detect platform (TikTok, Instagram, YouTube) via PlatformFactory
6. **Metadata Extraction**: Platform-specific metadata retrieval (title, author, thumbnailUrl)
7. **Audio Extraction**: Platform-specific audio extraction (yt-dlp)
8. **Transcription**: OpenAI Whisper API transcribes audio to text
9. **Recipe Analysis**: AI provider (OpenAI/Gemini) analyzes transcription + metadata to extract structured recipe
10. **Thumbnail Upload**: Download thumbnail from metadata.thumbnailUrl and upload to Supabase Storage in platform-specific folder
11. **Database Persistence**: Save recipe, ingredients, steps with intelligent food_items matching
12. **Cleanup**: Automatic cleanup of temporary files
13. **Lock Release**: Remove user from activeAnalyses Map

### Key Services

**Modular Multi-Platform Architecture:**

- **services/platforms/** - Platform-specific implementations
  - **base/Platform.js**: Abstract base class defining platform interface
  - **tiktok/TikTokPlatform.js**: TikTok implementation (yt-dlp extraction, oEmbed metadata) ✅
  - **youtube/YouTubePlatform.js**: YouTube Shorts implementation (yt-dlp extraction, oEmbed metadata) ✅
  - **instagram/InstagramPlatform.js**: Instagram Reels implementation (yt-dlp extraction, oEmbed API for metadata/thumbnail) ✅
  - **PlatformFactory.js**: Auto-detection and instantiation of correct platform

- **services/ai/** - AI services (platform-agnostic)
  - **transcription.js**: Whisper API transcription service
  - **recipeAnalyzer.js**: Multi-provider recipe analysis service
  - **recipeGenerator.js**: Recipe generation from user preferences
  - **imageGenerator.js**: AI-powered dish image generation
  - **providers/**: Modular AI provider architecture
    - **base/AIProvider.js**: Abstract base class for text AI providers
    - **base/ImageProvider.js**: Abstract base class for image AI providers
    - **openai/OpenAIProvider.js**: OpenAI GPT implementation
    - **openai/OpenAIImageProvider.js**: OpenAI DALL-E implementation
    - **gemini/GeminiProvider.js**: Google Gemini implementation
    - **gemini/GeminiImageProvider.js**: Google Imagen implementation
    - **AIProviderFactory.js**: Factory for text provider selection via env vars
    - **ImageProviderFactory.js**: Factory for image provider selection via env vars

- **services/analyzer.js**: Main orchestrator - coordinates platform, AI, and cleanup
- **services/database.js**: Supabase operations with intelligent ingredient matching using fuzzy similarity scoring (normalizeName + similarityScore functions)
- **middlewares/auth.js**: JWT authentication, token validation against Supabase issuer

### Database Schema (Supabase)

- **recipes**: Main recipe table with RLS policies (user_id scoped)
  - `platform` (text): Source platform (TikTok, YouTube, Instagram) - automatically saved
  - `generation_mode` (text): 'free' or 'premium'
  - `cuisine_origin`, `meal_type`, `diet_type`: Recipe classification
  - `calories`, `proteins`, `carbs`, `fats`: Nutrition data
  - `equipment`: Array of kitchen tools needed
- **ingredients**: Recipe ingredients with optional food_item_id foreign key
- **steps**: Recipe steps with order, duration, temperature fields
- **food_items**: Master list of food items with nutrition data
- **users**: Supabase auth.users with premium status and free_generations_remaining counter
- **folders**: User recipe organization

The database.js service performs intelligent fuzzy matching between recipe ingredients and the food_items master list using normalized names and similarity scoring (threshold 0.6).

### Important Implementation Details

**Duplicate Prevention Strategy**:
- URL normalization removes query parameters before comparison
- activeAnalyses Map tracks userId -> normalizedUrl during processing
- getExistingRecipeByUrl() checks database before starting new analysis
- Returns existing recipe immediately if found

**Premium/Free Tier Logic**:
- checkUserCanGenerateRecipe() validates before processing starts
- Free users have limited generations (free_generations_remaining counter)
- Premium users bypass generation limits
- decrementFreeGenerations() only called for free users after successful completion
- generation_mode field tracks 'free' vs 'premium' for analytics

**Error Handling**:
- Custom error code 'NOT_RECIPE' when content is non-culinary (status 400)
- Locks always released in finally block
- Temporary audio files cleaned up on both success and error paths

**Environment Variables**:
- `OPENAI_API_KEY` - Required for Whisper transcription and GPT analysis
- `SUPABASE_URL` - Required for database access
- `SUPABASE_SERVICE_KEY` - Required for database operations (bypasses RLS)
- Instagram metadata and thumbnails are retrieved via HTML scraping (Open Graph tags)

## Development Commands

### Local Development
```bash
npm start              # Start server (production mode)
npm run dev            # Start with --watch flag (auto-restart on changes)
npm run cli            # Run CLI version (index.js, interactive terminal mode)
```

### Testing
```bash
npm run test:platforms # Test platform detection (TikTok, YouTube, Instagram)
npm run test:analyze <URL>  # Test full analysis workflow without database
```

The `test:analyze` script is useful for:
- Testing the complete workflow locally without starting the server
- Debugging recipe analysis without polluting database
- Verifying platform detection, audio extraction, transcription, and GPT analysis
- See `TESTING.md` for detailed testing guide

### Docker
```bash
make build             # Build Docker image
make run               # Run container (requires .env file)
make start             # Build + run
make stop              # Stop and remove container
make logs              # View container logs
make test              # Test API health endpoint
make shell             # Open shell in container
```

### Testing
```bash
# Health check
curl http://localhost:3000/health

# Test recipe analysis (requires valid JWT token)
curl -X POST http://localhost:3000/analyze \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.tiktok.com/@user/video/1234567890"}'
```

## Environment Variables

Required in `.env` file:
- `OPENAI_API_KEY`: OpenAI API key for Whisper transcription (always required)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_JWT_SECRET`: For JWT token verification
- `SUPABASE_SERVICE_KEY`: Service role key (bypasses RLS)
- `SUPABASE_ANON_KEY`: Anonymous key (optional, for client use)
- `PORT`: Server port (default: 3000)

**AI Provider Configuration** (for recipe analysis):
- `AI_PROVIDER`: AI provider to use ('openai' or 'gemini', default: 'openai')
- `AI_MODEL`: Model to use (optional, uses provider default if not set)
  - OpenAI default: `gpt-4o-mini`
  - Gemini default: `gemini-2.0-flash`
- `GEMINI_API_KEY`: Required if using Gemini provider

**Image Generation Configuration**:
- `IMAGE_PROVIDER`: Image provider to use ('openai' or 'gemini', default: uses AI_PROVIDER)
- `IMAGE_MODEL`: Image model to use (optional, uses provider default if not set)
  - OpenAI default: `dall-e-3`
  - Gemini default: `imagen-3.0-generate-002`

## System Dependencies

**Required**:
- Node.js >= 18.0.0
- yt-dlp (installed via pip or package manager)
- ffmpeg (required by yt-dlp for audio extraction)

**Installation**:
```bash
# macOS
brew install yt-dlp ffmpeg

# Linux
sudo apt install ffmpeg
pip install yt-dlp

# Docker: Both included in Dockerfile (python3-pip + yt-dlp + ffmpeg)
```

## API Endpoints

- `POST /analyze` (protected): Analyze video recipe (TikTok, YouTube, Instagram), returns structured recipe data
- `POST /generate` (protected): Generate recipe from user preferences (mealType, dietTypes, equipment, ingredients)
- `GET /user/stats` (protected): Get user statistics
- `DELETE /account` (protected): Delete user account and all associated data
- `GET /health` (public): Server health check

### POST /generate - Generate Recipe from Preferences

Generate a real, existing recipe based on user preferences.

**Request Body:**
```json
{
  "mealType": "déjeuner",
  "dietTypes": ["végétarien", "sans gluten"],
  "equipment": ["four", "poêle"],
  "ingredients": ["poulet", "tomates", "oignons"],
  "language": "fr"
}
```

**Parameters:**
- `mealType` (optional): Type of meal from MEAL_TYPES (petit-déjeuner, déjeuner, dîner, collation, dessert, entrée, autre)
- `dietTypes` (optional): Array of dietary restrictions from DIET_TYPES
- `equipment` (optional): Array of available kitchen equipment
- `ingredients` (optional): Array of available ingredients (food_items names)
- `language` (optional): Output language ('fr' or 'en', default: 'fr')

**Response:** Same structure as `/analyze` endpoint with `generated: true` flag

**Notes:**
- The AI generates REAL, EXISTING recipes (not fictional)
- Incompatible ingredients are automatically filtered out
- Missing essential ingredients may be added by the AI
- Respects dietary restrictions strictly
- Platform is set to 'generated' for these recipes
- An AI-generated image of the dish is created and stored in Supabase Storage (`generated/` folder)

## Adding New Platforms

The architecture is designed for easy platform extensibility. To add a new platform (e.g., Instagram, YouTube):

### 1. Create Platform Implementation

Create `services/platforms/[platform]/[Platform]Platform.js`:

```javascript
import { Platform } from '../base/Platform.js';

export class YouTubePlatform extends Platform {
  name = 'YouTube';
  urlPattern = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/i;

  async extractAudio(url, outputDir) {
    // Implement audio extraction for YouTube
  }

  async fetchMetadata(url) {
    // Implement metadata fetching for YouTube
  }
}
```

### 2. Register in PlatformFactory

Add to `services/platforms/PlatformFactory.js`:

```javascript
import { YouTubePlatform } from './youtube/YouTubePlatform.js';

const PLATFORMS = [
  TikTokPlatform,
  InstagramPlatform,
  YouTubePlatform,  // Add here
];
```

### 3. Done!

The orchestrator (`analyzeRecipeFromVideo`) automatically detects and uses the new platform based on URL pattern matching. No changes needed to server.js or analyzer.js.

**See `services/README.md` for detailed platform development guide.**

## Adding New AI Providers

The AI provider architecture is designed for easy extensibility. To add a new provider (e.g., Anthropic Claude, Mistral):

### 1. Create Provider Implementation

Create `services/ai/providers/[provider]/[Provider]Provider.js`:

```javascript
import { AIProvider } from '../base/AIProvider.js';

export class AnthropicProvider extends AIProvider {
  name = 'anthropic';
  defaultModel = 'claude-3-haiku-20240307';

  getApiKey() {
    return process.env.ANTHROPIC_API_KEY;
  }

  validateCredentials() {
    if (!this.getApiKey()) {
      throw new Error('ANTHROPIC_API_KEY non définie');
    }
    return true;
  }

  async generateCompletion(options) {
    // Implement API call to Anthropic
  }
}
```

### 2. Register in AIProviderFactory

Add to `services/ai/providers/AIProviderFactory.js`:

```javascript
import { AnthropicProvider } from './anthropic/AnthropicProvider.js';

const PROVIDERS = {
  openai: OpenAIProvider,
  gemini: GeminiProvider,
  anthropic: AnthropicProvider,  // Add here
};
```

### 3. Done!

Set `AI_PROVIDER=anthropic` in `.env` to use the new provider.

## Important Conventions

### Code Style
- ES modules (type: "module" in package.json)
- Async/await pattern throughout
- Extensive console logging for debugging (with emoji prefixes: ✅ 🚀 ❌ ⚠️ 💎 🔒)
- Error messages in French (user-facing)

### Concurrency Safety
- Never remove items from activeAnalyses Map outside of the /analyze endpoint's finally block
- Always check activeAnalyses.has(userId) before starting analysis
- Use normalized URLs (without query params) for duplicate detection

### Database Operations
- Use SUPABASE_SERVICE_KEY client to bypass RLS when needed
- Ingredient matching uses fuzzy similarity with 0.6 threshold
- All recipe operations scoped to authenticated user_id
- Always handle null food_item_id (ingredients without master data match)

### File Management
- Temporary audio files stored in downloads/ directory
- Always call cleanupFile() in try/catch finally blocks
- Unique filenames using timestamp: `audio_{Date.now()}.mp3`

### Thumbnail Management
- Thumbnails are retrieved via platform's `fetchMetadata()` method (not fetched separately)
- Uploaded to Supabase Storage bucket `recipe-thumbnails` organized by platform folder
- Storage path: `{platform}/{platform}-{timestamp}-{uuid}.{extension}`
  - TikTok: `tiktok/tiktok-1699999999-abc123.jpg`
  - YouTube: `youtube/youtube-1699999999-def456.jpg`
  - Instagram: `instagram/instagram-1699999999-ghi789.jpg`
  - Generated: `generated/generated-recipe-name-1699999999-abc123.png`
- `uploadThumbnailToStorage(thumbnailUrl, platform)` handles download and upload
- `getTikTokThumbnail()` is deprecated - use `uploadThumbnailToStorage()` instead
- For generated recipes, `generateRecipeImage()` creates AI images and uploads to `generated/` folder
