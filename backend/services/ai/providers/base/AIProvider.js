/**
 * Classe de base abstraite pour les providers AI
 * Tous les providers doivent hériter de cette classe et implémenter les méthodes abstraites
 */
export class AIProvider {
  /**
   * Nom du provider (ex: 'openai', 'gemini')
   * @type {string}
   */
  name = 'base';

  /**
   * Modèle par défaut pour ce provider
   * @type {string}
   */
  defaultModel = '';

  /**
   * Génère une complétion à partir d'un prompt avec mécanisme de retry
   * @param {Object} options - Options de génération
   * @param {string} options.systemPrompt - Prompt système
   * @param {string} options.userPrompt - Prompt utilisateur
   * @param {string} [options.model] - Modèle à utiliser (défaut: defaultModel du provider)
   * @param {number} [options.temperature=0.3] - Température du modèle
   * @param {boolean} [options.jsonMode=true] - Mode JSON pour la réponse
   * @returns {Promise<Object>} Réponse parsée en JSON
   */
  async generateCompletion(options) {
    const maxRetries = 3;
    const baseDelay = 2000; // 2s initiaux

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this._generateCompletion(options);
      } catch (error) {
        const isRetryable = this._isRetryableError(error);

        if (!isRetryable || attempt === maxRetries) {
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.warn(`⚠️ [${this.name.toUpperCase()}] Erreur temporaire (${error.message}). Nouvelle tentative ${attempt}/${maxRetries} dans ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * À implémenter par les classes enfants (appel proprement dit à l'API)
   */
  async _generateCompletion(options) {
    throw new Error(`_generateCompletion() doit être implémenté par ${this.name}`);
  }

  /**
   * Détermine si une erreur peut être réessayée
   * @param {Error} error
   * @returns {boolean}
   */
  _isRetryableError(error) {
    const errorMsg = error.message?.toLowerCase() || '';
    return errorMsg.includes('high demand') ||
      errorMsg.includes('overloaded') ||
      errorMsg.includes('rate limit') ||
      errorMsg.includes('too many requests') ||
      errorMsg.includes('service unavailable') ||
      errorMsg.includes('temporarily overloaded') ||
      errorMsg.includes('503') ||
      errorMsg.includes('429');
  }

  /**
   * Vérifie que les credentials du provider sont configurés
   * @returns {boolean}
   */
  validateCredentials() {
    throw new Error(`validateCredentials() doit être implémenté par ${this.name}`);
  }

  /**
   * Retourne la clé API du provider depuis les variables d'environnement
   * @returns {string|undefined}
   */
  getApiKey() {
    throw new Error(`getApiKey() doit être implémenté par ${this.name}`);
  }

  /**
   * Parse la réponse JSON du provider
   * @param {string} content - Contenu de la réponse
   * @returns {Object} Objet JSON parsé
   */
  parseJsonResponse(content) {
    if (!content) {
      throw new Error('Aucun contenu dans la réponse');
    }

    try {
      return JSON.parse(content);
    } catch (error) {
      // Essayer de nettoyer le contenu (certains modèles ajoutent des backticks)
      const cleanedContent = content
        .replace(/^```json\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim();

      return JSON.parse(cleanedContent);
    }
  }
}
