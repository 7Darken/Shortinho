/**
 * Service d'analyse de recettes avec OpenAI GPT
 */

import fetch from 'node-fetch';
import { RECIPE_CATEGORIES } from '../../constants/RecipesCategories.js';

/**
 * Analyse une transcription de recette avec GPT
 * @param {string} transcription - Transcription textuelle de la vidéo
 * @param {Object} options - Options d'analyse
 * @param {string} options.description - Description supplémentaire (ex: description TikTok)
 * @param {string} options.language - Langue de sortie ('fr' ou 'en', défaut: 'fr')
 * @param {string} options.model - Modèle GPT à utiliser (défaut: 'gpt-4o-mini')
 * @param {number} options.temperature - Température du modèle (défaut: 0.3)
 * @returns {Promise<Object>} Recette structurée avec ingrédients, étapes, macros, etc.
 */
export async function analyzeRecipe(transcription, options = {}) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY non définie dans .env');
  }

  const {
    description = null,
    language = 'fr',
    model = 'gpt-4o-mini',
    temperature = 0.3,
  } = options;

  console.log('🤖 [GPT] Début de l\'analyse de la recette...');
  console.log('🌐 [GPT] Langue demandée:', language);
  console.log('📊 [GPT] Transcription:', transcription.length, 'caractères');
  if (description) {
    console.log('📝 [GPT] Description supplémentaire:', description.substring(0, 100) + '...');
  }

  // Construire le contenu à analyser
  let contentToAnalyze = `TRANSCRIPTION AUDIO :
${transcription}`;

  if (description && description.trim().length > 0) {
    contentToAnalyze += `

DESCRIPTION SUPPLÉMENTAIRE :
${description}`;
  }

  // Listes d'équipements prédéfinis par langue
  const EQUIPMENT_LIST_FR = [
    "four",
    "micro-ondes",
    "air fryer",
    "mixeur",
    "poêle",
    "casserole",
    "blender",
    "robot culinaire",
    "batteur électrique",
  ];

  const EQUIPMENT_LIST_EN = [
    "oven",
    "microwave",
    "air fryer",
    "mixer",
    "pan",
    "pot",
    "blender",
    "food processor",
    "electric mixer",
  ];

  // Sélectionner la liste selon la langue
  const EQUIPMENT_LIST = language === 'en' ? EQUIPMENT_LIST_EN : EQUIPMENT_LIST_FR;
  console.log(language,"la langue")
  // Déterminer la langue de sortie
  const outputLanguage = language === 'en' ? 'English' : 'French';

  const prompt = `Tu es un expert en analyse de recettes culinaires. Analyse cette recette de cuisine et extrait toutes les informations disponibles de manière structurée.

${contentToAnalyze}

⚠️⚠️⚠️ RÈGLE ABSOLUE - LANGUE DE SORTIE ⚠️⚠️⚠️
TOUTES les valeurs textuelles du JSON DOIVENT être écrites en ${outputLanguage}.
Cela inclut:
- title (titre de la recette)
- ingredients[].name (noms des ingrédients)
- ingredients[].unit (unités de mesure)
- steps[].text (texte des étapes)
- steps[].ingredients_used (noms des ingrédients utilisés)
- equipment (noms des équipements)
- cuisine_origin, meal_type, diet_type (classifications)
- Tous les autres textes

Les CLÉS du JSON restent en anglais (title, ingredients, steps, etc.)

Exemple pour ${outputLanguage}:
${language === 'en' ? '{"title": "Chocolate Cake", "ingredients": [{"name": "butter", "quantity": "200", "unit": "g"}]}' : '{"title": "Gâteau au chocolat", "ingredients": [{"name": "beurre", "quantity": "200", "unit": "g"}]}'}

VÉRIFICATION PRÉALABLE :
Si le lien ou la description **n'a rien à voir avec une recette**, renvoie uniquement :
{
  "error": "NOT_RECIPE",
  "message": "${language === 'en' ? 'This link does not contain a recipe or is not a cooking video.' : 'Ce lien ne contient pas de recette ou n\'est pas une vidéo culinaire.'}"
}

EXTRACTIONS DEMANDÉES :
1. **Informations de base** : Titre, nombre de portions, temps (préparation, cuisson, total)
2. **Ingrédients** : Liste complète avec quantités exactes mentionnées (ou estimations visuelles si possible)
3. **Étapes** : Instructions claires, concises, dans l'ordre chronologique
  - Pour chaque étape, inclure **un tableau ingredients_used** qui contient les noms exacts des ingrédients utilisés dans cette étape, correspondant aux noms listés dans la section ingrédients.

4. **Équipements utilisés** : à partir de la liste suivante uniquement (${EQUIPMENT_LIST.join(", ")})
  — Si un équipement n'est pas mentionné ou implicite, ne l'ajoute pas du tout.

5. **Valeurs nutritionnelles estimées (pour toute la recette)** :
   - calories (en kcal)
   - protéines (en g)
   - glucides (en g)
   - lipides (en g)

**Méthode de calcul nutritionnel :**
- Estime les valeurs à partir des ingrédients et leurs quantités (pas au hasard).
- Additionne les valeurs pour obtenir les totaux
- Propose une estimation raisonnable même si certains ingrédients ont des quantités approximatives

6. **Classification avancée** (nouveaux champs) :
   - cuisine_origin : Origine culinaire principale. Valeurs possibles : ${RECIPE_CATEGORIES.cuisine_origin.join(", ")}. Laisser vide si non trouvée.
   - meal_type : Type de repas. Valeurs possibles : ${RECIPE_CATEGORIES.meal_type.join(", ")}. Laisser vide si non trouvée.
   - diet_type : Liste de régimes ou objectifs nutritionnels. Valeurs possibles : ${RECIPE_CATEGORIES.diet_type.join(", ")}. Laisser vide si non trouvée.

IMPORTANT :
- PRIORISER les informations de la transcription audio
- La description supplémentaire peut contenir des informations utiles (titres, ingrédients, astuces, etc.)
- ÉVALUE D'ABORD si la description aide à créer une meilleure recette
- Si la description est pertinente, INTÈGRE ces informations
- Si la description n'est pas pertinente (musique, trends, etc.), IGNORE-la complètement
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
    console.log('📤 [GPT] Envoi à l\'API...');
    console.log('🌐 [GPT] Output language:', outputLanguage);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `Tu es un expert en analyse de recettes culinaires et nutrition. Tu analyses les recettes avec précision et calcules les macronutriments. Tu DOIS répondre avec toutes les valeurs textuelles en ${outputLanguage}.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Erreur API GPT: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;
    console.log(content);

    if (!content) {
      console.error('❌ [GPT] Pas de contenu dans la réponse:', JSON.stringify(result, null, 2));
      throw new Error('Aucune réponse retournée par GPT');
    }

    console.log('📄 [GPT] Réponse reçue, parsing JSON...');

    // Parser le JSON
    try {
      const recipe = JSON.parse(content);

      if (!recipe || typeof recipe !== 'object') {
        throw new Error('Réponse JSON invalide de GPT');
      }

      // Vérifier si GPT a détecté que ce n'est pas une recette
      if (recipe.error === 'NOT_RECIPE') {
        console.warn('⚠️ [GPT] Le contenu n\'est pas une recette culinaire');
        console.log('📝 [GPT] Message:', recipe.message);

        // Créer une erreur spécifique pour ce cas
        const notRecipeError = new Error(recipe.message || 'Ce lien ne contient pas de recette ou n\'est pas une vidéo culinaire.');
        notRecipeError.code = 'NOT_RECIPE';
        notRecipeError.userMessage = recipe.message;
        throw notRecipeError;
      }

      // Normaliser diet_type en tableau
      if (!Array.isArray(recipe.diet_type)) {
        recipe.diet_type = recipe.diet_type
          ? [recipe.diet_type].filter(Boolean)
          : [];
      }

      // S'assurer que les champs optionnels existent
      recipe.cuisine_origin = recipe.cuisine_origin || null;
      recipe.meal_type = recipe.meal_type || null;

      console.log('✅ [GPT] Analyse réussie!');
      console.log('📋 [GPT] Recette:', recipe.title);
      console.log('🥕 [GPT] Ingrédients:', recipe.ingredients?.length || 0);
      console.log('📝 [GPT] Étapes:', recipe.steps?.length || 0);

      return recipe;
    } catch (parseError) {
      // Si c'est notre erreur NOT_RECIPE, la relancer telle quelle
      if (parseError.code === 'NOT_RECIPE') {
        throw parseError;
      }

      // Sinon, c'est une erreur de parsing JSON
      console.error('❌ [GPT] Erreur de parsing JSON:', parseError.message);
      console.error('📄 [GPT] Contenu reçu:', content.substring(0, 500));
      throw new Error('Réponse JSON invalide de GPT');
    }
  } catch (error) {
    console.error('❌ [GPT] Erreur dans l\'analyse:', error.message);
    throw error;
  }
}
