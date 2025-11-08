/**
 * Service d'analyse de recettes TikTok
 * Fonctions réutilisables pour l'extraction, transcription et analyse
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { RECIPE_CATEGORIES } from '../constants/RecipesCategories.js';
/**
 * Vérifie si yt-dlp est installé
 */
export async function checkYtDlp() {
  return new Promise((resolve, reject) => {
    const check = spawn('yt-dlp', ['--version'], { 
      stdio: 'pipe'
    });
    
    let output = '';
    check.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    check.on('close', (code) => {
      if (code === 0 && output) {
        resolve(output.trim());
      } else {
        reject(new Error('yt-dlp non trouvé'));
      }
    });
    
    check.on('error', () => {
      reject(new Error('yt-dlp non installé'));
    });
  });
}

/**
 * Extrait l'audio d'une vidéo TikTok avec yt-dlp
 * @param {string} tiktokUrl - URL TikTok
 * @param {string} outputDir - Dossier de sortie
 * @returns {Promise<string>} Chemin du fichier audio téléchargé
 */
export async function extractTikTokAudio(tiktokUrl, outputDir) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY non définie dans .env');
  }

  // Vérifier que yt-dlp est installé
  await checkYtDlp();

  // Créer un nom de fichier unique
  const timestamp = Date.now();
  const outputPath = path.join(outputDir, `audio_${timestamp}.%(ext)s`);

  // Configuration yt-dlp
  const ytdlpArgs = [
    '--extract-audio',
    '--audio-format', 'mp3',
    '--audio-quality', '0',
    '--no-playlist',
    '--no-warnings',
    '--progress',
    '--console-title',
    '-o', outputPath,
    tiktokUrl,
  ];

  try {
    const ytdlp = spawn('yt-dlp', ytdlpArgs, { 
      stdio: ['ignore', 'pipe', 'pipe']
    });

    await new Promise((resolve, reject) => {
      ytdlp.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`yt-dlp a échoué avec le code ${code}`));
        }
      });
      
      ytdlp.on('error', (error) => {
        reject(new Error(`Erreur lors de l'exécution de yt-dlp: ${error.message}`));
      });
    });

    // Chercher le fichier créé
    const files = fs.readdirSync(outputDir);
    const audioFile = files.find((file) => file.startsWith(`audio_${timestamp}`));

    if (!audioFile) {
      throw new Error('Fichier audio non créé');
    }

    return path.join(outputDir, audioFile);
  } catch (error) {
    throw error;
  }
}

/**
 * Transcrit un fichier audio avec OpenAI Whisper API
 * @param {string} audioFilePath - Chemin du fichier audio
 * @returns {Promise<string>} Transcription du fichier
 */
export async function transcribeAudio(audioFilePath) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY non définie dans .env');
  }
  
  try {
    // Créer le FormData
    const formData = new FormData();
    
    // Lire le fichier audio et l'ajouter au form
    const audioBuffer = fs.readFileSync(audioFilePath);
    const fileName = path.basename(audioFilePath);
    
    // Déterminer le type MIME
    let mimeType = 'audio/mpeg';
    if (fileName.endsWith('.mp4')) {
      mimeType = 'video/mp4';
    } else if (fileName.endsWith('.m4a')) {
      mimeType = 'audio/m4a';
    } else if (fileName.endsWith('.wav')) {
      mimeType = 'audio/wav';
    }
    
    formData.append('file', audioBuffer, {
      filename: fileName,
      contentType: mimeType,
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'fr');
    formData.append('response_format', 'json');
    
    // Envoyer à Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Erreur API: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.text) {
      throw new Error('Aucune transcription retournée par Whisper');
    }
    
    return result.text;
  } catch (error) {
    throw error;
  }
}

/**
 * Analyse une transcription de recette avec GPT
 * @param {string} transcription - Transcription textuelle de la vidéo
 * @param {string} tiktokDescription - Description TikTok (optionnelle)
 * @returns {Promise<Object>} Recette structurée avec ingrédients, étapes, macros, etc.
 */
export async function analyzeRecipe(transcription, tiktokDescription = null) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY non définie dans .env');
  }
  
  // Construire le prompt avec transcription et description TikTok si disponible
  let contentToAnalyze = `TRANSCRIPTION AUDIO :
${transcription}`;

  if (tiktokDescription && tiktokDescription.trim().length > 0) {
    contentToAnalyze += `

DESCRIPTION TIKTOK :
${tiktokDescription}`;
  }
  const EQUIPMENT_LIST = [
    "four",
    "micro-ondes",
    "air fryer",
    "mixeur",
    "poêle",
  ];

  const prompt = `Tu es un expert en analyse de recettes culinaires. Analyse cette recette de cuisine et extrait toutes les informations disponibles de manière structurée.

${contentToAnalyze}
 Si le lien ou la description **n’a rien à voir avec une recette**, renvoie uniquement :
{
  "error": "NOT_RECIPE",
  "message": "Ce lien TikTok ne contient pas de recette ou n'est pas une vidéo culinaire."
}
EXTRACTIONS DEMANDÉES :
1. **Informations de base** : Titre, nombre de portions, temps (préparation, cuisson, total)
2. **Ingrédients** : Liste complète avec quantités exactes mentionnées (ou estimations visuelles si possible)
3. **Étapes** : Instructions claires, concises, dans l'ordre chronologique
  - Pour chaque étape, inclure **un tableau ingredients_used** qui contient les noms exacts des ingrédients utilisés dans cette étape, correspondant aux noms listés dans la section ingrédients.

4. **Équipements utilisés** : à partir de la liste suivante uniquement (${EQUIPMENT_LIST.join(", ")})
  — Si un équipement n’est pas mentionné ou implicite, ne l’ajoute pas du tout.
5. **Valeurs nutritionnelles estimées (pour toute la recette)** :
   - calories (en kcal)
   - protéines (en g)
   - glucides (en g)
   - lipides (en g)
**Méthode de calcul nutritionnel :**
- Estime les valeurs à partir des ingrédients et leurs quantités (pas au hasard). 
- Additionne les valeurs pour obtenir les totaux
- Propose une estimation raisonnable même si certains ingrédients ont des quantités approximatives
6. Classification avancée (nouveaux champs) :
   - cuisine_origin : Origine culinaire principale. Valeurs possibles : ${RECIPE_CATEGORIES.cuisine_origin.join(", ")}. Laisser vide si non trouvée.
   - meal_type : Type de repas. Valeurs possibles : ${RECIPE_CATEGORIES.meal_type.join(", ")}. Laisser vide si non trouvée.
   - diet_type : Liste de régimes ou objectifs nutritionnels. Valeurs possibles : ${RECIPE_CATEGORIES.diet_type.join(", ")}. Laisser vide si non trouvée.
IMPORTANT :
- PRIORISER les informations de la transcription audio
- La description TikTok peut contenir des informations supplémentaires utiles (titres, ingrédients, astuces, etc.)
- ÉVALUE D'ABORD si la description TikTok aide à créer une meilleure recette
- Si la description TikTok est pertinente et ajoute de la valeur, INTÈGRE ces informations
- Si la description TikTok n'est pas pertinente (musique, trends, etc.), IGNORE-la complètement
- Format JSON strict, sans texte avant ou après
- Structure claire et lisible
- Quantités en unités standard (g, ml, c.à.s, etc.)
- Ne retourne QUE les champs demandés, rien d'autre

Réponds UNIQUEMENT avec un objet JSON valide au format suivant :
{
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
      "text": "Instruction claire et concise",
      "duration": "10 min",
      "temperature": "180°C",
      "ingredients_used": ["beurre", "sucre"]

    }
  ],
  "equipment": ["four", "mixeur"],
  "nutrition": {
    "calories": 1200,
    "proteins": 45,
    "carbs": 130,
    "fats": 60
  },
  "cuisine_origin": "japonaise",
  "meal_type": "déjeuner",
  "diet_type": ["protéiné", "sans sucre"]
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert en analyse de recettes culinaires et nutrition. Tu analyses les recettes avec précision et calcules les macronutriments.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Erreur API: ${response.status}`);
    }
    
    const result = await response.json();
    const content = result.choices[0]?.message?.content;
    console.log(content);
    
    if (!content) {
      console.error('❌ Pas de contenu dans la réponse GPT:', JSON.stringify(result, null, 2));
      throw new Error('Aucune réponse retournée par GPT');
    }
    
    // Parser le JSON
    try {
      const recipe = JSON.parse(content);
      
      if (!recipe || typeof recipe !== 'object') {
        throw new Error('Réponse JSON invalide de GPT');
      }

      // Vérifier si GPT a détecté que ce n'est pas une recette
      if (recipe.error === 'NOT_RECIPE') {
        console.warn('⚠️ [GPT] Le contenu TikTok n\'est pas une recette culinaire');
        console.log('📝 [GPT] Message:', recipe.message);
        
        // Créer une erreur spécifique pour ce cas
        const notRecipeError = new Error(recipe.message || 'Ce lien TikTok ne contient pas de recette ou n\'est pas une vidéo culinaire.');
        notRecipeError.code = 'NOT_RECIPE';
        notRecipeError.userMessage = recipe.message;
        throw notRecipeError;
      }
      
      if (!Array.isArray(recipe.diet_type)) {
        recipe.diet_type = recipe.diet_type
          ? [recipe.diet_type].filter(Boolean)
          : [];
      }

      recipe.cuisine_origin = recipe.cuisine_origin || null;
      recipe.meal_type = recipe.meal_type || null;

      // Si c'est une vraie recette, la retourner
      return recipe;
    } catch (parseError) {
      // Si c'est notre erreur NOT_RECIPE, la relancer telle quelle
      if (parseError.code === 'NOT_RECIPE') {
        throw parseError;
      }
      
      // Sinon, c'est une erreur de parsing JSON
      console.error('❌ Erreur de parsing JSON:', parseError.message);
      console.error('📄 Contenu reçu:', content.substring(0, 500));
      throw new Error('Réponse JSON invalide de GPT');
    }
  } catch (error) {
    console.error('❌ Erreur dans analyzeRecipe:', error.message);
    throw error;
  }
}

/**
 * Nettoie les fichiers temporaires
 * @param {string} filePath - Chemin du fichier à supprimer
 */
export async function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️  Fichier temporaire supprimé: ${path.basename(filePath)}`);
    }
  } catch (error) {
    console.error('⚠️  Erreur lors du nettoyage:', error.message);
  }
}

/**
 * Récupère les métadonnées TikTok via l'API oEmbed
 * @param {string} tiktokUrl - URL de la vidéo TikTok
 * @returns {Promise<Object | null>} - Métadonnées TikTok ou null
 */
export async function fetchTikTokMeta(tiktokUrl) {
  try {
    console.log('🔍 [TikTok] Récupération métadonnées via oEmbed...');
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`;
    
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      console.warn('⚠️  [TikTok] Impossible de récupérer les métadonnées:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    return {
      title: data.title || '',
      author: data.author_name || '',
      authorUrl: data.author_url || '',
      thumbnailUrl: data.thumbnail_url || '',
    };
  } catch (error) {
    console.error('❌ [TikTok] Erreur lors de la récupération:', error.message);
    return null;
  }
}

/**
 * Nettoie la description TikTok (supprime hashtags, espaces multiples)
 * @param {string} rawText - Texte brut de la description
 * @returns {string} - Texte nettoyé
 */
export function cleanDescription(rawText) {
  return rawText
    .replace(/\s+/g, ' ') // supprimer les multiples espaces
    .replace(/#\w+/g, '') // supprimer les hashtags
    .trim();
}

