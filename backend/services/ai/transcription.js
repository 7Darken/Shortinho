/**
 * Service de transcription audio avec OpenAI Whisper API
 */

import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';

/**
 * Transcrit un fichier audio avec OpenAI Whisper API
 * @param {string} audioFilePath - Chemin du fichier audio
 * @param {Object} options - Options de transcription
 * @param {string} options.language - Code de langue (ex: 'fr', 'en', 'auto')
 * @param {string} options.model - Modèle Whisper à utiliser (défaut: 'whisper-1')
 * @returns {Promise<string>} Transcription du fichier
 */
export async function transcribeAudio(audioFilePath, options = {}) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY non définie dans .env');
  }

  const {
    language = options.language,
    model = 'whisper-1',
  } = options;

  console.log('🎤 [Whisper] Début de la transcription...');
  console.log('📂 [Whisper] Fichier:', path.basename(audioFilePath));
  console.log('🌍 [Whisper] Langue:', language);

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
    } else if (fileName.endsWith('.webm')) {
      mimeType = 'audio/webm';
    }

    formData.append('file', audioBuffer, {
      filename: fileName,
      contentType: mimeType,
    });
    formData.append('model', model);

    // Ajouter la langue uniquement si ce n'est pas 'auto'
    if (language && language !== 'auto') {
      formData.append('language', language);
    }

    formData.append('response_format', 'json');

    console.log('📤 [Whisper] Envoi à l\'API...');

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
      throw new Error(errorData.error?.message || `Erreur API Whisper: ${response.status}`);
    }

    const result = await response.json();

    if (!result.text) {
      throw new Error('Aucune transcription retournée par Whisper');
    }

    console.log('✅ [Whisper] Transcription réussie!');
    console.log('📊 [Whisper] Longueur:', result.text.length, 'caractères');

    return result.text;
  } catch (error) {
    console.error('❌ [Whisper] Erreur lors de la transcription:', error.message);
    throw error;
  }
}
