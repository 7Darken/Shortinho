/**
 * Service de génération de recettes basé sur les préférences utilisateur
 * Utilise l'architecture modulaire des providers AI
 */

import { getProvider, getModel } from './providers/AIProviderFactory.js';
import { RECIPE_CATEGORIES } from '../../constants/RecipesCategories.js';

/**
 * Construit le prompt pour la génération de recettes
 * @param {Object} preferences - Préférences de l'utilisateur
 * @param {string} preferences.mealType - Type de repas
 * @param {string[]} preferences.dietTypes - Régimes alimentaires
 * @param {string[]} preferences.equipment - Équipements disponibles
 * @param {string[]} preferences.ingredients - Ingrédients disponibles
 * @param {string} language - Langue de sortie ('fr' ou 'en')
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildGenerationPrompt(preferences, language) {
  const { mealType, dietTypes = [], equipment = [], ingredients = [] } = preferences;

  const outputLanguage = language === 'en' ? 'English' : 'French';

  // Listes d'équipements pour validation
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

  const systemPrompt = `Tu es un chef cuisinier expert et créatif. Tu génères des recettes RÉELLES et FAISABLES basées sur les préférences de l'utilisateur. Tu ne dois JAMAIS inventer de recettes fictives. Tu DOIS répondre avec toutes les valeurs textuelles en ${outputLanguage}.`;

  const userPrompt = `Génère une recette de cuisine RÉELLE et EXISTANTE basée sur les préférences suivantes.

📋 PRÉFÉRENCES DE L'UTILISATEUR :
- Type de repas : ${mealType || 'non spécifié'}
- Régimes alimentaires : ${dietTypes.length > 0 ? dietTypes.join(', ') : 'aucun'}
- Équipements disponibles : ${equipment.length > 0 ? equipment.join(', ') : 'équipement de base (poêle, casserole)'}
- Ingrédients disponibles : ${ingredients.length > 0 ? ingredients.join(', ') : 'ingrédients courants'}

⚠️⚠️⚠️ RÈGLES ABSOLUES ⚠️⚠️⚠️

1. **RECETTE RÉELLE UNIQUEMENT** :
   - La recette DOIT être une vraie recette qui existe (traditionnelle, classique ou moderne connue)
   - NE PAS inventer de recettes fictives ou de combinaisons improbables
   - Privilégier les recettes populaires et éprouvées

2. **COMPATIBILITÉ DES INGRÉDIENTS** :
   - Si certains ingrédients fournis ne sont PAS compatibles entre eux, IGNORE-les
   - Utilise uniquement les ingrédients qui font sens ensemble
   - Tu PEUX ajouter des ingrédients de base manquants (sel, poivre, huile, etc.)
   - Tu PEUX suggérer des ingrédients complémentaires essentiels à la recette

3. **RESPECT DES CONTRAINTES** :
   - Respecte STRICTEMENT les régimes alimentaires demandés
   - N'utilise QUE les équipements listés (ou équipement de base si non spécifié)
   - Adapte la recette au type de repas demandé

4. **LANGUE DE SORTIE** :
   TOUTES les valeurs textuelles du JSON DOIVENT être écrites en ${outputLanguage}.
   Cela inclut: title, ingredients[].name, ingredients[].unit, steps[].text, steps[].ingredients_used, equipment, cuisine_origin, meal_type, diet_type

EXTRACTIONS DEMANDÉES :
1. **Informations de base** : Titre, nombre de portions, temps (préparation, cuisson, total)
2. **Ingrédients** : Liste complète avec quantités exactes
   - Inclure les ingrédients fournis par l'utilisateur qui sont pertinents
   - Ajouter les ingrédients complémentaires nécessaires
3. **Étapes** : Instructions claires, concises, dans l'ordre chronologique
   - Pour chaque étape, inclure **un tableau ingredients_used** avec les noms des ingrédients utilisés
4. **Équipements utilisés** : uniquement parmi (${EQUIPMENT_LIST.join(", ")})
5. **Valeurs nutritionnelles estimées (pour toute la recette)** :
   - calories (en kcal), protéines (en g), glucides (en g), lipides (en g)
6. **Classification** :
   - cuisine_origin : parmi ${RECIPE_CATEGORIES.cuisine_origin.join(", ")}
   - meal_type : parmi ${RECIPE_CATEGORIES.meal_type.join(", ")}
   - diet_type : liste parmi ${RECIPE_CATEGORIES.diet_type.join(", ")}

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
  "cuisine_origin": "française",
  "meal_type": "${mealType || 'déjeuner'}",
  "diet_type": ${JSON.stringify(dietTypes.length > 0 ? dietTypes : [])}
}`;

  return { systemPrompt, userPrompt };
}

/**
 * Normalise et valide la recette générée par l'AI
 * @param {Object} recipe - Recette brute
 * @returns {Object} Recette normalisée
 */
function normalizeGeneratedRecipe(recipe) {
  if (!recipe || typeof recipe !== 'object') {
    throw new Error('Réponse JSON invalide');
  }

  // Vérifier les champs requis
  if (!recipe.title) {
    throw new Error('La recette générée n\'a pas de titre');
  }

  if (!recipe.ingredients || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    throw new Error('La recette générée n\'a pas d\'ingrédients');
  }

  if (!recipe.steps || !Array.isArray(recipe.steps) || recipe.steps.length === 0) {
    throw new Error('La recette générée n\'a pas d\'étapes');
  }

  // Normaliser diet_type en tableau
  if (!Array.isArray(recipe.diet_type)) {
    recipe.diet_type = recipe.diet_type ? [recipe.diet_type].filter(Boolean) : [];
  }

  // S'assurer que les champs optionnels existent
  recipe.cuisine_origin = recipe.cuisine_origin || null;
  recipe.meal_type = recipe.meal_type || null;
  recipe.equipment = recipe.equipment || [];
  recipe.nutrition = recipe.nutrition || null;

  return recipe;
}

/**
 * Génère une recette basée sur les préférences de l'utilisateur
 * @param {Object} preferences - Préférences de l'utilisateur
 * @param {string} preferences.mealType - Type de repas (petit-déjeuner, déjeuner, etc.)
 * @param {string[]} preferences.dietTypes - Régimes alimentaires (végétarien, sans gluten, etc.)
 * @param {string[]} preferences.equipment - Équipements disponibles
 * @param {string[]} preferences.ingredients - Ingrédients disponibles (food_items)
 * @param {Object} options - Options de génération
 * @param {string} options.language - Langue de sortie ('fr' ou 'en', défaut: 'fr')
 * @param {number} options.temperature - Température du modèle (défaut: 0.7 pour plus de créativité)
 * @returns {Promise<Object>} Recette structurée
 */
export async function generateRecipe(preferences, options = {}) {
  const {
    language = 'fr',
    temperature = 0.7, // Plus élevé pour plus de variété dans les recettes
  } = options;

  // Obtenir le provider et le modèle configurés
  const provider = getProvider();
  const model = getModel(provider);

  console.log('🍳 [Generator] Début de la génération de recette...');
  console.log(`🔌 [Generator] Provider: ${provider.name}, Modèle: ${model}`);
  console.log('🌐 [Generator] Langue demandée:', language);
  console.log('📋 [Generator] Préférences:', JSON.stringify(preferences, null, 2));

  // Construire les prompts
  const { systemPrompt, userPrompt } = buildGenerationPrompt(preferences, language);

  try {
    // Appeler le provider AI
    const recipe = await provider.generateCompletion({
      systemPrompt,
      userPrompt,
      model,
      temperature,
      jsonMode: true,
    });

    console.log('📄 [Generator] Réponse reçue, validation...');

    // Normaliser et valider la recette
    const normalizedRecipe = normalizeGeneratedRecipe(recipe);

    console.log('✅ [Generator] Génération réussie!');
    console.log('📋 [Generator] Recette:', normalizedRecipe.title);
    console.log('🥕 [Generator] Ingrédients:', normalizedRecipe.ingredients?.length || 0);
    console.log('📝 [Generator] Étapes:', normalizedRecipe.steps?.length || 0);

    return normalizedRecipe;
  } catch (error) {
    console.error('❌ [Generator] Erreur dans la génération:', error.message);
    throw error;
  }
}
