/**
 * Provider Google Gemini Imagen pour la génération d'images
 */
import fetch from 'node-fetch';
import { ImageProvider } from '../base/ImageProvider.js';

export class GeminiImageProvider extends ImageProvider {
  name = 'gemini';
  defaultModel = 'imagen-3.0-generate-002';

  /**
   * @returns {string|undefined}
   */
  getApiKey() {
    return process.env.GEMINI_API_KEY;
  }

  /**
   * @returns {boolean}
   */
  validateCredentials() {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY non définie dans les variables d\'environnement');
    }
    return true;
  }

  /**
   * Génère une image avec Imagen (Google)
   * @param {Object} options
   * @param {string} options.prompt - Description de l'image
   * @param {string} [options.model='imagen-3.0-generate-002']
   * @param {string} [options.size='1024x1024'] - Non utilisé pour Imagen (ratio à la place)
   * @param {string} [options.quality='standard'] - Non utilisé pour Imagen
   * @returns {Promise<string>} Image en base64 data URL
   */
  async generateImage(options) {
    this.validateCredentials();

    const {
      prompt,
      model = this.defaultModel,
    } = options;

    console.log(`🎨 [${this.name.toUpperCase()}] Génération d'image avec ${model}...`);

    const apiKey = this.getApiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [
          { prompt }
        ],
        parameters: {
          sampleCount: 1,
          aspectRatio: '1:1',
          personGeneration: 'dont_allow',
          safetySetting: 'block_low_and_above',
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `Erreur API Imagen: ${response.status}`;
      throw new Error(errorMessage);
    }

    const result = await response.json();
    const imageBase64 = result.predictions?.[0]?.bytesBase64Encoded;

    if (!imageBase64) {
      console.error(`❌ [${this.name.toUpperCase()}] Pas d'image dans la réponse:`, JSON.stringify(result, null, 2));
      throw new Error('Aucune image générée par Imagen');
    }

    console.log(`✅ [${this.name.toUpperCase()}] Image générée avec succès`);

    // Retourner en format data URL pour faciliter l'upload
    return `data:image/png;base64,${imageBase64}`;
  }
}
