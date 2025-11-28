/**
 * Provider OpenAI DALL-E pour la génération d'images
 */
import fetch from 'node-fetch';
import { ImageProvider } from '../base/ImageProvider.js';

export class OpenAIImageProvider extends ImageProvider {
  name = 'openai';
  defaultModel = 'dall-e-3';

  /**
   * @returns {string|undefined}
   */
  getApiKey() {
    return process.env.OPENAI_API_KEY;
  }

  /**
   * @returns {boolean}
   */
  validateCredentials() {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY non définie dans les variables d\'environnement');
    }
    return true;
  }

  /**
   * Génère une image avec DALL-E
   * @param {Object} options
   * @param {string} options.prompt - Description de l'image
   * @param {string} [options.model='dall-e-3']
   * @param {string} [options.size='1024x1024']
   * @param {string} [options.quality='standard']
   * @returns {Promise<string>} URL temporaire de l'image
   */
  async generateImage(options) {
    this.validateCredentials();

    const {
      prompt,
      model = this.defaultModel,
      size = '1024x1024',
      quality = 'standard',
    } = options;

    console.log(`🎨 [${this.name.toUpperCase()}] Génération d'image avec ${model}...`);

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getApiKey()}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size,
        quality,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Erreur API DALL-E: ${response.status}`);
    }

    const result = await response.json();
    const imageUrl = result.data?.[0]?.url;

    if (!imageUrl) {
      console.error(`❌ [${this.name.toUpperCase()}] Pas d'URL dans la réponse:`, JSON.stringify(result, null, 2));
      throw new Error('Aucune image générée par DALL-E');
    }

    console.log(`✅ [${this.name.toUpperCase()}] Image générée avec succès`);
    return imageUrl;
  }
}
