/**
 * Provider OpenAI pour la génération de texte
 */
import fetch from 'node-fetch';
import { AIProvider } from '../base/AIProvider.js';

export class OpenAIProvider extends AIProvider {
  name = 'openai';
  defaultModel = 'gpt-4o-mini';

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
   * Génère une complétion avec l'API OpenAI
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

    const requestBody = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
    };

    if (jsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getApiKey()}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Erreur API OpenAI: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    if (!content) {
      console.error(`❌ [${this.name.toUpperCase()}] Pas de contenu dans la réponse:`, JSON.stringify(result, null, 2));
      throw new Error('Aucune réponse retournée par OpenAI');
    }

    console.log(`✅ [${this.name.toUpperCase()}] Réponse reçue`);

    return this.parseJsonResponse(content);
  }
}
