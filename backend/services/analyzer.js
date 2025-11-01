/**
 * Service d'analyse de recettes TikTok
 * Fonctions réutilisables pour l'extraction, transcription et analyse
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import FormData from 'form-data';
import fetch from 'node-fetch';

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
 * @returns {Promise<Object>} Recette structurée avec ingrédients, étapes, macros, etc.
 */
export async function analyzeRecipe(transcription) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY non définie dans .env');
  }
  
  const prompt = `Tu es un expert en analyse de recettes culinaires. Analyse cette transcription de recette de cuisine et extrait toutes les informations disponibles de manière structurée.

TRANSCRIPTION :
${transcription}

EXTRACTIONS DEMANDÉES :
1. **Informations de base** : Titre, nombre de portions, temps (préparation, cuisson, total)
2. **Ingrédients** : Liste complète avec quantités exactes mentionnées (ou estimations visuelles si possible)
3. **Étapes** : Instructions claires, concises, dans l'ordre chronologique

IMPORTANT :
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
      "temperature": "180°C"
    }
  ]
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
    
    if (!content) {
      console.error('❌ Pas de contenu dans la réponse GPT:', JSON.stringify(result, null, 2));
      throw new Error('Aucune réponse retournée par GPT');
    }
    
    // Parser le JSON
    try {
      const recipe = JSON.parse(content);
      return recipe;
    } catch (parseError) {
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

