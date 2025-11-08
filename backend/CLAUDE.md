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
5. **Platform Detection**: Automatically detect platform (TikTok, Instagram, etc.) via PlatformFactory
6. **Metadata Extraction**: Platform-specific metadata retrieval (title, description, author)
7. **Audio Extraction**: Platform-specific audio extraction (yt-dlp for TikTok, custom for others)
8. **Transcription**: OpenAI Whisper API transcribes audio to text
9. **Recipe Analysis**: GPT-4o-mini analyzes transcription + metadata to extract structured recipe
10. **Database Persistence**: Save recipe, ingredients, steps with intelligent food_items matching
11. **Cleanup**: Automatic cleanup of temporary files
12. **Lock Release**: Remove user from activeAnalyses Map

### Key Services

**Modular Multi-Platform Architecture:**

- **services/platforms/** - Platform-specific implementations
  - **base/Platform.js**: Abstract base class defining platform interface
  - **tiktok/TikTokPlatform.js**: TikTok implementation (yt-dlp extraction, oEmbed metadata) ✅
  - **youtube/YouTubePlatform.js**: YouTube/Shorts implementation (yt-dlp extraction, oEmbed metadata) ✅
  - **instagram/InstagramPlatform.js**: Instagram Reels implementation (yt-dlp extraction, oEmbed metadata) ✅
  - **PlatformFactory.js**: Auto-detection and instantiation of correct platform

- **services/ai/** - AI services (platform-agnostic)
  - **transcription.js**: Whisper API transcription service
  - **recipeAnalyzer.js**: GPT-4o-mini recipe analysis service

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
- `OPENAI_API_KEY`: OpenAI API key for Whisper + GPT
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_JWT_SECRET`: For JWT token verification
- `SUPABASE_SERVICE_KEY`: Service role key (bypasses RLS)
- `SUPABASE_ANON_KEY`: Anonymous key (optional, for client use)
- `PORT`: Server port (default: 3000)

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

- `POST /analyze` (protected): Analyze TikTok recipe, returns structured recipe data
- `DELETE /account` (protected): Delete user account and all associated data
- `GET /health` (public): Server health check

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
