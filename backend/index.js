#!/usr/bin/env node

/**
 * Backend complet pour analyser les recettes de cuisine TikTok
 * 
 * Flow:
 * 1. Extraction audio avec yt-dlp
 * 2. Transcription avec Whisper API
 * 3. Analyse structurée avec GPT-4o-mini
 * 4. Calcul automatique des macros
 * 5. Affichage élégant dans le terminal
 * 
 * Usage: node index.js
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import readline from 'readline';
import dotenv from 'dotenv';
import FormData from 'form-data';
import fetch from 'node-fetch';

// Charger les variables d'environnement
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const AUDIO_DIR = path.join(__dirname, 'downloads');

/**
 * Initialise le dossier de téléchargement
 */
function initAudioDir() {
  if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
    console.log('✅ Dossier de téléchargement créé:', AUDIO_DIR);
  }
}

/**
 * Demande un lien TikTok à l'utilisateur
 */
function askForTikTokUrl() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('\n🔗 Entrez un lien TikTok : ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Vérifie si yt-dlp est installé
 */
async function checkYtDlp() {
  return new Promise((resolve, reject) => {
    const check = spawn('yt-dlp', ['--version'], { 
      stdio: 'pipe',
      shell: true 
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
 * @returns {Promise<string>} Chemin du fichier audio téléchargé
 */
async function extractTikTokAudio(tiktokUrl) {
  console.log('\n🎬 Début de l\'extraction audio...');
  console.log('📹 URL TikTok:', tiktokUrl);

  // Vérifier que yt-dlp est installé
  let version = null;
  try {
    version = await checkYtDlp();
    console.log('✅ yt-dlp trouvé, version:', version);
  } catch {
    console.log('\n⚠️  yt-dlp n\'est pas installé.');
    console.log('\n💡 Pour installer yt-dlp, exécutez:');
    console.log('   macOS: brew install yt-dlp');
    console.log('   Linux: sudo apt install yt-dlp');
    console.log('   Python: pip install yt-dlp');
    console.log('\nVoir https://github.com/yt-dlp/yt-dlp pour plus d\'informations.');
    throw new Error('yt-dlp est requis pour extraire l\'audio');
  }

  // Créer un nom de fichier unique
  const timestamp = Date.now();
  const outputPath = path.join(AUDIO_DIR, `audio_${timestamp}.%(ext)s`);

  console.log('📂 Dossier de sortie:', AUDIO_DIR);

  // Configuration yt-dlp pour extraire seulement l'audio
  // Important: passer les arguments séparément, ne pas utiliser join()
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

  console.log('⚙️  Extraction de l\'audio en cours...');
  console.log('📝 URL:', tiktokUrl);

  try {
    // Exécuter yt-dlp
    console.log('⚙️  Lancement de yt-dlp...');
    
    // Ne PAS utiliser shell: true car cela provoque des problèmes avec les caractères spéciaux
    const ytdlp = spawn('yt-dlp', ytdlpArgs, { 
      stdio: 'inherit'
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
    const files = fs.readdirSync(AUDIO_DIR);
    const audioFile = files.find((file) => file.startsWith(`audio_${timestamp}`));

    if (!audioFile) {
      throw new Error('Fichier audio non créé');
    }

    const fullPath = path.join(AUDIO_DIR, audioFile);
    const stats = fs.statSync(fullPath);

    console.log('✅ Audio extrait avec succès!');
    console.log('📄 Fichier:', audioFile);
    console.log('💾 Taille:', formatBytes(stats.size));
    console.log('📂 Chemin complet:', fullPath);

    return fullPath;
  } catch (error) {
    console.error('❌ Erreur lors de l\'extraction:', error.message);
    throw error;
  }
}

/**
 * Transcrit un fichier audio avec OpenAI Whisper API
 * @param {string} audioFilePath - Chemin du fichier audio
 * @returns {Promise<string>} Transcription du fichier
 */
async function transcribeAudio(audioFilePath) {
  console.log('\n🎤 Début de la transcription avec Whisper...');
  
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY non définie dans .env');
  }
  
  console.log('📂 Fichier audio:', path.basename(audioFilePath));
  
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
    
    console.log('📤 Envoi à Whisper API...');
    
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
    
    console.log('✅ Transcription réussie!');
    
    return result.text;
  } catch (error) {
    console.error('❌ Erreur lors de la transcription:', error.message);
    throw error;
  }
}

/**
 * Analyse une transcription de recette avec GPT pour extraire les informations structurées
 * @param {string} transcription - Transcription textuelle de la vidéo
 * @returns {Promise<Object>} Recette structurée avec ingrédients, étapes, macros, etc.
 */
async function analyzeRecipe(transcription) {
  console.log('\n🤖 Début de l\'analyse avec GPT...');
  
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
3. **Équipements/Machines** : Tous les outils, appareils, machines mentionnés (ex: four, mixeur, poêle, etc.)
4. **Étapes** : Instructions claires, concises, dans l'ordre chronologique
5. **Macronutriments** : Calcul approximatif des macros (calories, protéines, glucides, lipides) pour UNE portion

CALCUL DES MACROS :
- Fais des estimations intelligentes pour chaque ingrédient selon les quantités mentionnées
- Additionne les valeurs pour obtenir les totaux
- Propose une estimation raisonnable même si certains ingrédients ont des quantités approximatives

RESTITUTION :
- Format JSON strict, sans texte avant ou après
- Structure claire et lisible
- Quantités en unités standard (g, ml, c.à.s, etc.)
- Macros arrondis au gramme près

Réponds UNIQUEMENT avec un objet JSON valide au format suivant :
{
  "title": "Nom de la recette",
  "servings": 4,
  "prep_time": "15 min",
  "cook_time": "30 min",
  "total_time": "45 min",
  "equipment": ["nom de l'équipement"],
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
  ],
  "macros": {
    "calories": 450,
    "proteins": 25,
    "carbs": 40,
    "fats": 20,
    "fiber": 5,
    "sugar": 10,
    "per_serving": true,
    "notes": "Estimation basée sur les quantités mentionnées"
  }
}`;

  try {
    console.log('📤 Envoi à GPT-4o-mini...');
    
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
      throw new Error('Aucune réponse retournée par GPT');
    }
    
    // Parser le JSON
    const recipe = JSON.parse(content);
    
    console.log('✅ Analyse réussie!');
    
    return recipe;
  } catch (error) {
    console.error('❌ Erreur lors de l\'analyse:', error.message);
    throw error;
  }
}

/**
 * Formate une taille en bytes en format lisible
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Boucle principale
 */
async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Oshii Backend - Recettes TikTok     ║');
  console.log('║   yt-dlp + Whisper + GPT-4o-mini      ║');
  console.log('╚════════════════════════════════════════╝');

  // Initialiser le dossier de téléchargement
  initAudioDir();

  try {
    // Demander le lien TikTok
    const tiktokUrl = await askForTikTokUrl();

    if (!tiktokUrl || tiktokUrl.trim().length === 0) {
      console.log('❌ Lien TikTok invalide');
      process.exit(1);
    }

    // Extraire l'audio
    const audioPath = await extractTikTokAudio(tiktokUrl);

    console.log('\n🎉 Extraction terminée!');
    console.log('📂 Fichier sauvegardé dans:', audioPath);

    // Transcrire l'audio avec Whisper
    const transcription = await transcribeAudio(audioPath);

    console.log(`\n📊 Transcription: ${transcription.length} caractères`);

    // Analyser avec GPT pour extraire la recette structurée
    const recipe = await analyzeRecipe(transcription);

    // Afficher la recette structurée de manière élégante
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                    RECETTE ANALYSÉE                          ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    
    // Titre et infos générales
    console.log('\n📋 ' + recipe.title.toUpperCase());
    console.log('─'.repeat(60));
    
    if (recipe.servings) {
      console.log(`👥 Portions: ${recipe.servings}`);
    }
    if (recipe.prep_time) {
      console.log(`⏱️  Préparation: ${recipe.prep_time}`);
    }
    if (recipe.cook_time) {
      console.log(`🔥 Cuisson: ${recipe.cook_time}`);
    }
    if (recipe.total_time) {
      console.log(`⏰ Total: ${recipe.total_time}`);
    }
    
    // Équipements
    if (recipe.equipment && recipe.equipment.length > 0) {
      console.log(`\n🛠️  ÉQUIPEMENTS :`);
      recipe.equipment.forEach((eq, idx) => {
        console.log(`   ${idx + 1}. ${eq}`);
      });
    }
    
    // Ingrédients
    if (recipe.ingredients && recipe.ingredients.length > 0) {
      console.log(`\n🥘 INGRÉDIENTS (${recipe.ingredients.length}) :`);
      recipe.ingredients.forEach((ing, idx) => {
        const qty = ing.quantity || '';
        const unit = ing.unit || '';
        const qtyStr = (qty && unit) ? ` ${qty}${unit}` : qty ? ` ${qty}` : '';
        console.log(`   ${idx + 1}. ${ing.name}${qtyStr}`);
      });
    }
    
    // Étapes
    if (recipe.steps && recipe.steps.length > 0) {
      console.log(`\n📝 ÉTAPES (${recipe.steps.length}) :`);
      recipe.steps.forEach((step) => {
        console.log(`\n   Étape ${step.order}: ${step.text}`);
        if (step.duration) {
          console.log(`   ⏱️  Durée: ${step.duration}`);
        }
        if (step.temperature) {
          console.log(`   🌡️  Température: ${step.temperature}`);
        }
      });
    }
    
    // Macros
    if (recipe.macros) {
      console.log('\n╔═══════════════════════════════════════════════════════════════╗');
      console.log('║                    MACRONUTRIMENTS                           ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝');
      const macro = recipe.macros;
      const perServing = macro.per_serving ? ' (par portion)' : ' (total)';
      console.log(`\n📊 Valeurs nutritionnelles${perServing} :`);
      console.log('─'.repeat(60));
      if (macro.calories) {
        console.log(`   🔥 Calories: ${macro.calories} kcal`);
      }
      if (macro.proteins) {
        console.log(`   💪 Protéines: ${macro.proteins}g`);
      }
      if (macro.carbs) {
        console.log(`   🍞 Glucides: ${macro.carbs}g`);
      }
      if (macro.fats) {
        console.log(`   🥑 Lipides: ${macro.fats}g`);
      }
      if (macro.fiber) {
        console.log(`   🌾 Fibres: ${macro.fiber}g`);
      }
      if (macro.sugar) {
        console.log(`   🍬 Sucres: ${macro.sugar}g`);
      }
      if (macro.notes) {
        console.log(`\n   ℹ️  ${macro.notes}`);
      }
    }
    
    console.log('\n─'.repeat(60));

    // Proposer de recommencer
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('\n❓ Voulez-vous traiter une autre vidéo ? (o/n) ', (answer) => {
      rl.close();
      if (answer.toLowerCase() === 'o' || answer.toLowerCase() === 'oui') {
        main();
      } else {
        console.log('👋 Au revoir!');
        process.exit(0);
      }
    });
  } catch (error) {
    console.error('\n💥 Erreur fatale:', error.message);
    process.exit(1);
  }
}

// Démarrer l'application
main().catch((error) => {
  console.error('💥 Erreur non gérée:', error);
  process.exit(1);
});
