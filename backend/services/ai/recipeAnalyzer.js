/**
 * Service d'analyse de recettes avec AI (multi-provider)
 * Supporte OpenAI, Gemini, et autres providers via l'architecture modulaire
 */

import { getProvider, getModel } from './providers/AIProviderFactory.js';
import { RECIPE_CATEGORIES } from '../../constants/RecipesCategories.js';

/**
 * Construit le prompt pour l'analyse de recettes
 * @param {string} transcription - Transcription audio
 * @param {string|null} description - Description supplémentaire
 * @param {string} language - Langue de sortie ('fr' ou 'en')
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildRecipePrompt(transcription, description, language) {
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

  const EQUIPMENT_LIST = language === 'en' ? EQUIPMENT_LIST_EN : EQUIPMENT_LIST_FR;
  const outputLanguage = language === 'en' ? 'English' : 'French';

  // Construire le contenu à analyser
  let contentToAnalyze = `TRANSCRIPTION AUDIO :
${transcription}`;

  if (description && description.trim().length > 0) {
    contentToAnalyze += `

DESCRIPTION SUPPLÉMENTAIRE :
${description}`;
  }

  const systemPrompt = `Tu es un expert en analyse de recettes culinaires et nutrition. Tu analyses les recettes avec précision et calcules les macronutriments. Tu DOIS répondre avec toutes les valeurs textuelles en ${outputLanguage}.`;

  const userPrompt = `Tu es un expert en analyse de recettes culinaires. Analyse cette recette de cuisine et extrait toutes les informations disponibles de manière structurée.

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

  return { systemPrompt, userPrompt };
}

/**
 * Normalise et valide la recette retournée par l'AI
 * @param {Object} recipe - Recette brute
 * @param {string} language - Langue de sortie
 * @returns {Object} Recette normalisée
 */
function normalizeRecipe(recipe, language) {
  if (!recipe || typeof recipe !== 'object') {
    throw new Error('Réponse JSON invalide');
  }

  // Vérifier si l'AI a détecté que ce n'est pas une recette
  if (recipe.error === 'NOT_RECIPE') {
    console.warn('⚠️ [AI] Le contenu n\'est pas une recette culinaire');
    console.log('📝 [AI] Message:', recipe.message);

    const notRecipeError = new Error(
      recipe.message ||
        (language === 'en'
          ? 'This link does not contain a recipe or is not a cooking video.'
          : 'Ce lien ne contient pas de recette ou n\'est pas une vidéo culinaire.')
    );
    notRecipeError.code = 'NOT_RECIPE';
    notRecipeError.userMessage = recipe.message;
    throw notRecipeError;
  }

  // Normaliser diet_type en tableau
  if (!Array.isArray(recipe.diet_type)) {
    recipe.diet_type = recipe.diet_type ? [recipe.diet_type].filter(Boolean) : [];
  }

  // S'assurer que les champs optionnels existent
  recipe.cuisine_origin = recipe.cuisine_origin || null;
  recipe.meal_type = recipe.meal_type || null;

  return recipe;
}

/**
 * Analyse une transcription de recette avec AI
 * @param {string} transcription - Transcription textuelle de la vidéo
 * @param {Object} options - Options d'analyse
 * @param {string} options.description - Description supplémentaire (ex: description TikTok)
 * @param {string} options.language - Langue de sortie ('fr' ou 'en', défaut: 'fr')
 * @param {number} options.temperature - Température du modèle (défaut: 0.3)
 * @returns {Promise<Object>} Recette structurée avec ingrédients, étapes, macros, etc.
 */
export async function analyzeRecipe(transcription, options = {}) {
  const {
    description = null,
    language = 'fr',
    temperature = 0.3,
  } = options;

  // Obtenir le provider et le modèle configurés
  const provider = getProvider();
  const model = getModel(provider);

  console.log('🤖 [AI] Début de l\'analyse de la recette...');
  console.log(`🔌 [AI] Provider: ${provider.name}, Modèle: ${model}`);
  console.log('🌐 [AI] Langue demandée:', language);
  console.log('📊 [AI] Transcription:', transcription.length, 'caractères');

  if (description) {
    console.log('📝 [AI] Description supplémentaire:', description.substring(0, 100) + '...');
  }

  // Construire les prompts
  const { systemPrompt, userPrompt } = buildRecipePrompt(transcription, description, language);

  try {
    // Appeler le provider AI
    const recipe = await provider.generateCompletion({
      systemPrompt,
      userPrompt,
      model,
      temperature,
      jsonMode: true,
    });

    console.log('📄 [AI] Réponse reçue, validation...');
    console.log(recipe);

    // Normaliser et valider la recette
    const normalizedRecipe = normalizeRecipe(recipe, language);

    console.log('✅ [AI] Analyse réussie!');
    console.log('📋 [AI] Recette:', normalizedRecipe.title);
    console.log('🥕 [AI] Ingrédients:', normalizedRecipe.ingredients?.length || 0);
    console.log('📝 [AI] Étapes:', normalizedRecipe.steps?.length || 0);

    return normalizedRecipe;
  } catch (error) {
    // Relancer les erreurs NOT_RECIPE telles quelles
    if (error.code === 'NOT_RECIPE') {
      throw error;
    }

    console.error('❌ [AI] Erreur dans l\'analyse:', error.message);
    throw error;
  }
}
