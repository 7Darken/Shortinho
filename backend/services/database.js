/**
 * Service de base de données Supabase
 * Gestion des recettes, ingrédients et étapes
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variables Supabase manquantes dans le .env');
  throw new Error('SUPABASE_URL et SUPABASE_SERVICE_KEY doivent être définies');
}

// Créer le client Supabase avec la clé service (bypass RLS)
// Note: La clé service a accès complet à la base de données
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Normalise un nom d'ingrédient pour le matching
 * @param {string} name - Nom brut de l'ingrédient
 * @returns {string} - Nom normalisé
 */
function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // supprimer les accents
    .replace(/\s+/g, ' ') // normaliser les espaces multiples
    .trim();
}

/**
 * Calcule le score de similarité entre deux chaînes
 * @param {string} str1 - Première chaîne
 * @param {string} str2 - Deuxième chaîne
 * @returns {number} - Score de similarité (0-1)
 */
function similarityScore(str1, str2) {
  const words1 = str1.split(' ');
  const words2 = str2.split(' ');
  
  // Match exact
  if (str1 === str2) return 1.0;
  
  // Un est une sous-chaîne de l'autre (mais pas trop court)
  const minLen = Math.min(str1.length, str2.length);
  if (minLen >= 3) {
    if (str1.includes(str2) || str2.includes(str1)) {
      return 0.8;
    }
  }
  
  // Score basé sur les mots communs
  const commonWords = words1.filter((word) => words2.includes(word));
  const totalWords = Math.max(words1.length, words2.length);
  const wordScore = commonWords.length / totalWords;
  
  // Si tous les mots de la chaîne la plus courte sont présents dans l'autre
  const shortestWords = words1.length <= words2.length ? words1 : words2;
  const longestWords = words1.length > words2.length ? words1 : words2;
  const allWordsMatched = shortestWords.every((word) => longestWords.includes(word));
  
  return allWordsMatched ? Math.max(wordScore, 0.7) : wordScore;
}

/**
 * Trouve un food_item qui correspond à un nom d'ingrédient
 * @param {string} rawName - Nom brut de l'ingrédient
 * @returns {Promise<Object | null>} - Food item correspondant ou null
 */
async function findMatchingFoodItem(rawName) {
  try {
    const { data: items, error } = await supabase
      .from('food_items')
      .select('*');

    if (error) {
      console.error('❌ [Database] Erreur lors de la récupération des food_items:', error);
      return null;
    }

    if (!items || items.length === 0) {
      console.log('⚠️  [Database] Aucun food_item dans la base');
      return null;
    }

    const normRawName = normalizeName(rawName);

    // Calculer les scores de similarité pour chaque food_item
    const scoredItems = items.map((item) => {
      const normItemName = normalizeName(item.name);
      const score = similarityScore(normRawName, normItemName);
      return { item, score, name: item.name };
    });

    // Trier par score décroissant et prendre le meilleur
    scoredItems.sort((a, b) => b.score - a.score);
    const bestMatch = scoredItems[0];

    // Seuil minimum de 0.5 pour considérer un match
    if (bestMatch && bestMatch.score >= 0.5) {
      console.log(`✅ [Database] Match trouvé (score: ${bestMatch.score.toFixed(2)}): "${rawName}" → "${bestMatch.name}"`);
      return bestMatch.item;
    } else {
      console.log(`⚠️  [Database] Aucun match valide pour: "${rawName}" (meilleur score: ${bestMatch ? bestMatch.score.toFixed(2) : '0.00'})`);
      return null;
    }
  } catch (error) {
    console.error('❌ [Database] Erreur lors de la recherche de food_item:', error.message);
    return null;
  }
}

/**
 * Récupère le thumbnail d'une vidéo TikTok via oEmbed
 * @param {string} tiktokUrl - URL de la vidéo TikTok
 * @returns {Promise<string | null>} - URL du thumbnail ou null
 */
async function getTikTokThumbnail(tiktokUrl) {
  try {
    console.log('🖼️  [Database] Récupération du thumbnail TikTok...');
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`;
    
    const oembedRes = await fetch(oembedUrl);
    
    if (!oembedRes.ok) {
      console.warn('⚠️  [Database] Impossible de récupérer le thumbnail:', oembedRes.status);
      return null;
    }
    
    const oembedJson = await oembedRes.json();
    const thumbnailUrl = oembedJson.thumbnail_url;
    
    if (thumbnailUrl) {
      console.log('✅ [Database] Thumbnail récupéré:', thumbnailUrl);
      return thumbnailUrl;
    }
    
    console.warn('⚠️  [Database] Pas de thumbnail dans la réponse oEmbed');
    return null;
  } catch (error) {
    console.error('⚠️  [Database] Erreur lors de la récupération du thumbnail:', error.message);
    return null;
  }
}

/**
 * Sauvegarde une recette complète dans Supabase
 * @param {Object} recipeData - Données de la recette
 * @param {string} recipeData.userId - ID de l'utilisateur
 * @param {string} recipeData.title - Titre de la recette
 * @param {number} recipeData.servings - Nombre de portions
 * @param {string} recipeData.prepTime - Temps de préparation
 * @param {string} recipeData.cookTime - Temps de cuisson
 * @param {string} recipeData.totalTime - Temps total
 * @param {string} recipeData.sourceUrl - URL source (TikTok)
 * @param {Array} recipeData.ingredients - Liste des ingrédients
 * @param {Array} recipeData.steps - Liste des étapes
 * @param {Array} recipeData.equipment - Liste des équipements
 * @param {Object} recipeData.nutrition - Valeurs nutritionnelles
 * @returns {Promise<Object>} - Recette créée avec son ID
 */
export async function saveRecipeToDatabase(recipeData) {
  console.log('💾 [Database] Sauvegarde de la recette dans Supabase...');

  try {
    const { 
      userId, 
      title, 
      servings, 
      prepTime, 
      cookTime, 
      totalTime, 
      sourceUrl,
      equipment,
      nutrition,
    } = recipeData;

    // 1. Récupérer le thumbnail de la vidéo TikTok
    const imageUrl = await getTikTokThumbnail(sourceUrl);

    // 2. Insérer la recette
    console.log('📝 [Database] Création de la recette...');
    if (equipment && equipment.length > 0) {
      console.log('🔧 [Database] Équipements:', equipment.join(', '));
    }
    if (nutrition) {
      console.log('🥗 [Database] Nutrition:', {
        calories: nutrition.calories,
        proteins: nutrition.proteins,
        carbs: nutrition.carbs,
        fats: nutrition.fats,
      });
    }
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .insert({
        user_id: userId,
        title,
        servings,
        prep_time: prepTime,
        cook_time: cookTime,
        total_time: totalTime,
        source_url: sourceUrl,
        image_url: imageUrl,
        equipment: equipment || null,
        calories: nutrition?.calories || null,
        proteins: nutrition?.proteins || null,
        carbs: nutrition?.carbs || null,
        fats: nutrition?.fats || null,
      })
      .select()
      .single();

    if (recipeError) {
      console.error('❌ [Database] Erreur lors de la création de la recette:', recipeError);
      throw new Error(`Erreur lors de la sauvegarde de la recette: ${recipeError.message}`);
    }

    console.log('✅ [Database] Recette créée avec ID:', recipe.id);

    // 3. Insérer les ingrédients avec matching food_items
    if (recipeData.ingredients && recipeData.ingredients.length > 0) {
      console.log('🥕 [Database] Création des ingrédients avec matching food_items...');
      
      const ingredientsToInsert = await Promise.all(
        recipeData.ingredients.map(async (ing) => {
          const matchedFoodItem = await findMatchingFoodItem(ing.name);
          return {
            recipe_id: recipe.id,
            name: ing.name,
            quantity: ing.quantity || null,
            unit: ing.unit || null,
            food_item_id: matchedFoodItem ? matchedFoodItem.id : null,
          };
        })
      );

      const { error: ingredientsError } = await supabase
        .from('ingredients')
        .insert(ingredientsToInsert);

      if (ingredientsError) {
        console.error('❌ [Database] Erreur lors de la création des ingrédients:', ingredientsError);
        // Ne pas throw, car la recette est déjà créée
      } else {
        console.log('✅ [Database]', ingredientsToInsert.length, 'ingrédients créés');
      }
    }

    // 4. Insérer les étapes
    if (recipeData.steps && recipeData.steps.length > 0) {
      console.log('📋 [Database] Création des étapes...');
      const stepsToInsert = recipeData.steps.map((step) => ({
        recipe_id: recipe.id,
        order: step.order,
        text: step.text,
        duration: step.duration || null,
        temperature: step.temperature || null,
      }));

      const { error: stepsError } = await supabase
        .from('steps')
        .insert(stepsToInsert);

      if (stepsError) {
        console.error('❌ [Database] Erreur lors de la création des étapes:', stepsError);
        // Ne pas throw, car la recette est déjà créée
      } else {
        console.log('✅ [Database]', stepsToInsert.length, 'étapes créées');
      }
    }

    console.log('🎉 [Database] Recette sauvegardée avec succès!');
    return recipe;
  } catch (error) {
    console.error('❌ [Database] Erreur lors de la sauvegarde:', error);
    throw error;
  }
}

/**
 * Récupère une recette avec ses ingrédients et étapes
 * @param {string} recipeId - ID de la recette
 * @returns {Promise<Object>} - Recette complète
 */
export async function getRecipeFromDatabase(recipeId) {
  console.log('📖 [Database] Récupération de la recette:', recipeId);

  try {
    // Récupérer la recette
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .single();

    if (recipeError) {
      console.error('❌ [Database] Erreur lors de la récupération:', recipeError);
      throw new Error(`Recette introuvable: ${recipeError.message}`);
    }

    // Récupérer les ingrédients
    const { data: ingredients } = await supabase
      .from('ingredients')
      .select('*')
      .eq('recipe_id', recipeId)
      .order('name');

    // Récupérer les étapes
    const { data: steps } = await supabase
      .from('steps')
      .select('*')
      .eq('recipe_id', recipeId)
      .order('order');

    console.log('✅ [Database] Recette récupérée avec succès');
    return {
      ...recipe,
      ingredients: ingredients || [],
      steps: steps || [],
    };
  } catch (error) {
    console.error('❌ [Database] Erreur lors de la récupération:', error);
    throw error;
  }
}

/**
 * Récupère toutes les recettes d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Array>} - Liste des recettes
 */
export async function getUserRecipes(userId) {
  console.log('📖 [Database] Récupération des recettes de l\'utilisateur:', userId);

  try {
    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [Database] Erreur lors de la récupération:', error);
      throw new Error(`Erreur lors de la récupération: ${error.message}`);
    }

    console.log('✅ [Database]', recipes.length, 'recettes récupérées');
    return recipes || [];
  } catch (error) {
    console.error('❌ [Database] Erreur lors de la récupération:', error);
    throw error;
  }
}

/**
 * Supprimer le compte utilisateur (toutes les données associées seront supprimées via CASCADE)
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<boolean>} - true si succès, false sinon
 */
export async function deleteUserAccount(userId) {
  console.log('🗑️  [Database] Suppression du compte utilisateur...');

  try {
    // Supprimer l'utilisateur depuis auth.users (service role)
    // Les données associées seront supprimées automatiquement via CASCADE
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('❌ [Database] Erreur lors de la suppression:', deleteError);
      throw new Error(`Erreur lors de la suppression: ${deleteError.message}`);
    }

    console.log('✅ [Database] Compte supprimé avec succès');
    return true;
  } catch (error) {
    console.error('❌ [Database] Erreur lors de la suppression:', error);
    throw error;
  }
}

