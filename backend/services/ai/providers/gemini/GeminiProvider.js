/**
 * Provider Google Gemini pour la génération de texte
 */
import fetch from 'node-fetch';
import { AIProvider } from '../base/AIProvider.js';

export class GeminiProvider extends AIProvider {
  name = 'gemini';
  defaultModel = 'gemini-2.0-flash';

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
   * Génère une complétion avec l'API Gemini
   * @param {Object} options
   * @param {string} options.systemPrompt
   * @param {string} options.userPrompt
   * @param {string} [options.model]
   * @param {number} [options.temperature=0.3]
   * @param {boolean} [options.jsonMode=true]
   * @returns {Promise<Object>}
   */
  async generateCompletion(options) {
    this.validateCredentials();

    const {
      systemPrompt,
      userPrompt,
      model = this.defaultModel,
      temperature = 0.3,
      jsonMode = true,
    } = options;

    console.log(`🤖 [${this.name.toUpperCase()}] Envoi à l'API avec le modèle ${model}...`);

    const apiKey = this.getApiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: `${systemPrompt}\n\n${userPrompt}` }
          ]
        }
      ],
      generationConfig: {
        temperature,
      },
    };

    if (jsonMode) {
      requestBody.generationConfig.responseMimeType = 'application/json';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `Erreur API Gemini: ${response.status}`;
      throw new Error(errorMessage);
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      console.error(`❌ [${this.name.toUpperCase()}] Pas de contenu dans la réponse:`, JSON.stringify(result, null, 2));
      throw new Error('Aucune réponse retournée par Gemini');
    }

    console.log(`✅ [${this.name.toUpperCase()}] Réponse reçue`);

    return this.parseJsonResponse(content);
  }
}
