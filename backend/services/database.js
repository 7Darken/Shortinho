/**
 * Service de base de données Supabase
 * Gestion des recettes, ingrédients et étapes
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
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
 * @param {string} language - Langue pour le matching ('fr' ou 'en', défaut: 'fr')
 * @returns {Promise<Object | null>} - Food item correspondant ou null
 */
async function findMatchingFoodItem(rawName, language = 'fr') {
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

    console.log(`🔍 [Database] Recherche de match pour "${rawName}" parmi ${items.length} food_items (langue: ${language})`);
    const normRawName = normalizeName(rawName);
    console.log(`🔍 [Database] Nom normalisé: "${normRawName}"`);

    // Calculer les scores de similarité pour chaque food_item
    const scoredItems = items.map((item) => {
      // Utiliser name_en si langue anglaise, sinon name
      const itemName = language === 'en' ? (item.name_en || item.name) : item.name;
      const normItemName = normalizeName(itemName);
      const score = similarityScore(normRawName, normItemName);
      return { item, score, name: itemName, normName: normItemName };
    });

    // Trier par score décroissant et prendre le meilleur
    scoredItems.sort((a, b) => b.score - a.score);
    const bestMatch = scoredItems[0];

    // Afficher les 3 meilleurs matchs pour le débogage
    console.log('📊 [Database] Top 3 matchs:');
    scoredItems.slice(0, 3).forEach((item, idx) => {
      console.log(`   ${idx + 1}. "${item.name}" (normalisé: "${item.normName}") - Score: ${item.score.toFixed(2)}`);
    });

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
 * Upload un thumbnail vers Supabase Storage
 * @param {string} thumbnailUrl - URL du thumbnail à télécharger
 * @param {string} platform - Plateforme source (TikTok, YouTube, Instagram)
 * @returns {Promise<string | null>} - URL publique du thumbnail ou null
 */
async function uploadThumbnailToStorage(thumbnailUrl, platform = 'unknown') {
  if (!thumbnailUrl || typeof thumbnailUrl !== 'string') {
    console.warn('⚠️  [Database] URL de thumbnail invalide');
    return null;
  }

  const platformFolder = platform.toLowerCase();
  console.log(`🖼️  [Database] Téléchargement du thumbnail ${platform}...`);

  try {
    console.log('⬇️  [Database] Téléchargement du thumbnail...');
    const imageResponse = await fetch(thumbnailUrl, { timeout: 10_000 });

    if (!imageResponse.ok) {
      console.warn('⚠️  [Database] Téléchargement du thumbnail échoué:', imageResponse.status, imageResponse.statusText);
      return null;
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      console.warn('⚠️  [Database] Réponse inattendue (content-type):', contentType);
      return null;
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    if (!imageBuffer.length) {
      console.warn('⚠️  [Database] Le fichier thumbnail téléchargé est vide');
      return null;
    }

    const extension = (() => {
      const mimeSubtype = contentType.split('/')[1]?.toLowerCase();
      if (!mimeSubtype) return 'jpg';
      if (mimeSubtype === 'jpeg') return 'jpg';
      return mimeSubtype;
    })();

    const fileName = `${platformFolder}-${Date.now()}-${randomUUID()}.${extension}`;
    const storagePath = `${platformFolder}/${fileName}`;

    console.log('☁️  [Database] Upload du thumbnail vers Supabase Storage...', storagePath);
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('recipe-thumbnails')
      .upload(storagePath, imageBuffer, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ [Database] Échec de l\'upload du thumbnail:', uploadError.message);
      return null;
    }

    const { data: publicUrlData } = supabase
      .storage
      .from('recipe-thumbnails')
      .getPublicUrl(uploadData?.path || storagePath);

    const publicUrl = publicUrlData?.publicUrl;

    if (!publicUrl) {
      console.warn('⚠️  [Database] Impossible de récupérer l\'URL publique du thumbnail');
      return null;
    }

    console.log('✅ [Database] Thumbnail stocké et accessible:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error(`❌ [Database] Erreur lors du traitement du thumbnail ${platform}:`, error.message);
    return null;
  }
}

/**
 * Récupère le thumbnail d'une vidéo TikTok via oEmbed
 * @deprecated Utilisez uploadThumbnailToStorage avec metadata.thumbnailUrl
 * @param {string} tiktokUrl - URL de la vidéo TikTok
 * @param {string} platform - Plateforme source (TikTok, YouTube, Instagram)
 * @returns {Promise<string | null>} - URL du thumbnail ou null
 */
async function getTikTokThumbnail(tiktokUrl, platform = 'TikTok') {
  if (!tiktokUrl || typeof tiktokUrl !== 'string') {
    console.warn('⚠️  [Database] URL TikTok invalide pour la récupération du thumbnail');
    return null;
  }

  console.log(`🖼️  [Database] Récupération du thumbnail ${platform} via oEmbed...`);

  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`;
    const oembedRes = await fetch(oembedUrl, { timeout: 10_000 });

    if (!oembedRes.ok) {
      console.warn('⚠️  [Database] Échec de l’oEmbed TikTok:', oembedRes.status, oembedRes.statusText);
      return null;
    }

    const oembedJson = await oembedRes.json();
    const thumbnailUrl = oembedJson?.thumbnail_url;

    if (!thumbnailUrl) {
      console.warn('⚠️  [Database] Pas de thumbnail disponible dans la réponse oEmbed');
      return null;
    }

    console.log('⬇️  [Database] Téléchargement du thumbnail TikTok...');
    const imageResponse = await fetch(thumbnailUrl, { timeout: 10_000 });

    if (!imageResponse.ok) {
      console.warn('⚠️  [Database] Téléchargement du thumbnail échoué:', imageResponse.status, imageResponse.statusText);
      return null;
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      console.warn('⚠️  [Database] Réponse oEmbed inattendue (content-type):', contentType);
      return null;
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    if (!imageBuffer.length) {
      console.warn('⚠️  [Database] Le fichier thumbnail téléchargé est vide');
      return null;
    }

    const extension = (() => {
      const mimeSubtype = contentType.split('/')[1]?.toLowerCase();
      if (!mimeSubtype) return 'jpg';
      if (mimeSubtype === 'jpeg') return 'jpg';
      return mimeSubtype;
    })();

    const platformFolder = platform.toLowerCase();
    const fileName = `${platformFolder}-${Date.now()}-${randomUUID()}.${extension}`;
    const storagePath = `${platformFolder}/${fileName}`;

    console.log('☁️  [Database] Upload du thumbnail vers Supabase Storage...', storagePath);
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('recipe-thumbnails')
      .upload(storagePath, imageBuffer, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ [Database] Échec de l\'upload du thumbnail:', uploadError.message);
      return null;
    }

    const { data: publicUrlData } = supabase
      .storage
      .from('recipe-thumbnails')
      .getPublicUrl(uploadData?.path || storagePath);

    const publicUrl = publicUrlData?.publicUrl;

    if (!publicUrl) {
      console.warn('⚠️  [Database] Impossible de récupérer l\'URL publique du thumbnail');
      return null;
    }

    console.log('✅ [Database] Thumbnail stocké et accessible:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('❌ [Database] Erreur lors du traitement du thumbnail TikTok:', error.message);
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
 * @param {string} recipeData.sourceUrl - URL source
 * @param {string} recipeData.platform - Plateforme source (TikTok, YouTube, Instagram) - utilisé pour organiser les thumbnails par dossier
 * @param {string} recipeData.thumbnailUrl - URL du thumbnail depuis fetchMetadata() de la plateforme
 * @param {Array} recipeData.ingredients - Liste des ingrédients
 * @param {Array} recipeData.steps - Liste des étapes
 * @param {Array} recipeData.equipment - Liste des équipements
 * @param {Object} recipeData.nutrition - Valeurs nutritionnelles
 * @param {string} recipeData.generationMode - Mode de génération ('free' ou 'premium')
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
      platform,
      thumbnailUrl,
      equipment,
      nutrition,
      generationMode,
      cuisine_origin,
      meal_type,
      diet_type,
      language = 'fr', // Langue pour le matching des food_items
    } = recipeData;

    const normalizedDietType = (() => {
      if (diet_type == null) {
        return null;
      }
      const arrayValue = Array.isArray(diet_type) ? diet_type : [diet_type];
      const filtered = arrayValue.filter((value) => Boolean(value));
      return filtered.length > 0 ? filtered : null;
    })();

    // 1. Uploader le thumbnail dans le bon dossier selon la plateforme
    let imageUrl = null;
    if (thumbnailUrl && platform) {
      // Utiliser le thumbnail depuis fetchMetadata() et l'uploader
      imageUrl = await uploadThumbnailToStorage(thumbnailUrl, platform);
    } else if (sourceUrl) {
      // Fallback pour compatibilité (ancienne méthode)
      console.warn('⚠️  [Database] Utilisation de la méthode deprecated getTikTokThumbnail');
      imageUrl = await getTikTokThumbnail(sourceUrl, platform || 'TikTok');
    }

    // 2. Insérer la recette
    console.log('📝 [Database] Création de la recette...');
    console.log('🎯 [Database] Mode de génération:', generationMode || 'free');
    if (platform) {
      console.log('📱 [Database] Plateforme:', platform);
    }
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
    if (cuisine_origin) {
      console.log('🌍 [Database] Origine cuisine:', cuisine_origin);
    }
    if (meal_type) {
      console.log('🍽️  [Database] Type de repas:', meal_type);
    }
    if (normalizedDietType && normalizedDietType.length > 0) {
      console.log('🥗 [Database] Types de régime:', normalizedDietType.join(', '));
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
        platform: platform || null,
        image_url: imageUrl,
        equipment: equipment || null,
        calories: nutrition?.calories || null,
        proteins: nutrition?.proteins || null,
        carbs: nutrition?.carbs || null,
        fats: nutrition?.fats || null,
        generation_mode: generationMode || 'free',
        cuisine_origin: cuisine_origin || null,
        meal_type: meal_type || null,
        diet_type: normalizedDietType,
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
          const matchedFoodItem = await findMatchingFoodItem(ing.name, language);
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
        ingredients_used: step.ingredients_used && Array.isArray(step.ingredients_used) 
          ? step.ingredients_used 
          : [],
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
 * Vérifie si une recette existe déjà pour cet utilisateur avec cette URL source
 * @param {string} userId - ID de l'utilisateur
 * @param {string} sourceUrl - URL source (TikTok)
 * @returns {Promise<Object | null>} - Recette existante ou null
 */
export async function getExistingRecipeByUrl(userId, sourceUrl) {
  try {
    // Normaliser l'URL (enlever les query params qui peuvent varier)
    const normalizedUrl = sourceUrl.split('?')[0]; // Garder seulement l'URL de base

    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('id, title, created_at')
      .eq('user_id', userId)
      .like('source_url', `${normalizedUrl}%`) // Match avec LIKE pour gérer les variations
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ [Database] Erreur lors de la vérification de recette existante:', error);
      return null;
    }

    if (recipes && recipes.length > 0) {
      console.log('✅ [Database] Recette existante trouvée:', recipes[0].id);
      return recipes[0];
    }

    return null;
  } catch (error) {
    console.error('❌ [Database] Erreur lors de la vérification:', error);
    return null;
  }
}

/**
 * Cherche une recette par URL dans toute la base (tous utilisateurs)
 * @param {string} sourceUrl - URL source de la vidéo
 * @returns {Promise<Object | null>} - Recette existante avec user_id ou null
 */
export async function findRecipeByUrlGlobal(sourceUrl) {
  try {
    const normalizedUrl = sourceUrl.split('?')[0];

    console.log('🔍 [Database] Recherche globale de recette pour URL:', normalizedUrl);

    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('id, user_id, title, created_at')
      .like('source_url', `${normalizedUrl}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ [Database] Erreur recherche globale:', error);
      return null;
    }

    if (recipes && recipes.length > 0) {
      console.log('✅ [Database] Recette trouvée globalement:', recipes[0].id, '(user:', recipes[0].user_id.substring(0, 8) + '...)');
      return recipes[0];
    }

    console.log('ℹ️  [Database] Aucune recette trouvée pour cette URL');
    return null;
  } catch (error) {
    console.error('❌ [Database] Erreur recherche globale:', error);
    return null;
  }
}

/**
 * Duplique une recette existante pour un nouvel utilisateur
 * Copie la recette, les ingrédients et les étapes
 * @param {string} originalRecipeId - ID de la recette originale
 * @param {string} newUserId - ID du nouvel utilisateur
 * @returns {Promise<Object>} - Nouvelle recette dupliquée
 */
export async function duplicateRecipeForUser(originalRecipeId, newUserId) {
  console.log('📋 [Database] Duplication de recette', originalRecipeId, 'pour user', newUserId.substring(0, 8) + '...');

  try {
    // 1. Récupérer la recette originale complète
    const originalRecipe = await getRecipeFromDatabase(originalRecipeId);

    if (!originalRecipe) {
      throw new Error('Recette originale introuvable');
    }

    // 2. Créer la nouvelle recette (sans id, created_at, updated_at)
    const {
      id: _id,
      created_at: _createdAt,
      updated_at: _updatedAt,
      user_id: _originalUserId,
      ingredients: originalIngredients,
      steps: originalSteps,
      ...recipeData
    } = originalRecipe;

    const { data: newRecipe, error: recipeError } = await supabase
      .from('recipes')
      .insert({
        ...recipeData,
        user_id: newUserId,
      })
      .select()
      .single();

    if (recipeError) {
      console.error('❌ [Database] Erreur création recette dupliquée:', recipeError);
      throw new Error(`Erreur duplication recette: ${recipeError.message}`);
    }

    console.log('✅ [Database] Recette dupliquée créée:', newRecipe.id);

    // 3. Dupliquer les ingrédients
    if (originalIngredients && originalIngredients.length > 0) {
      const newIngredients = originalIngredients.map(({ id: _ingId, recipe_id: _recipeId, created_at: _ca, ...ing }) => ({
        ...ing,
        recipe_id: newRecipe.id,
      }));

      const { error: ingredientsError } = await supabase
        .from('ingredients')
        .insert(newIngredients);

      if (ingredientsError) {
        console.error('❌ [Database] Erreur duplication ingrédients:', ingredientsError);
        // Ne pas échouer complètement, la recette est créée
      } else {
        console.log('✅ [Database]', newIngredients.length, 'ingrédients dupliqués');
      }
    }

    // 4. Dupliquer les étapes
    if (originalSteps && originalSteps.length > 0) {
      const newSteps = originalSteps.map(({ id: _stepId, recipe_id: _recipeId, created_at: _ca, ...step }) => ({
        ...step,
        recipe_id: newRecipe.id,
      }));

      const { error: stepsError } = await supabase
        .from('steps')
        .insert(newSteps);

      if (stepsError) {
        console.error('❌ [Database] Erreur duplication étapes:', stepsError);
        // Ne pas échouer complètement, la recette est créée
      } else {
        console.log('✅ [Database]', newSteps.length, 'étapes dupliquées');
      }
    }

    console.log('✅ [Database] Duplication complète réussie!');

    // Retourner la recette complète avec ingrédients et étapes
    return await getRecipeFromDatabase(newRecipe.id);

  } catch (error) {
    console.error('❌ [Database] Erreur lors de la duplication:', error);
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
 * Vérifie si l'utilisateur peut générer une recette (Premium ou générations gratuites restantes)
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<{ canGenerate: boolean, isPremium: boolean, freeGenerationsRemaining: number }>}
 */
export async function checkUserCanGenerateRecipe(userId) {
  console.log('🔍 [Database] Vérification des droits de génération pour:', userId);

  try {
    // Récupérer le profil de l'utilisateur
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_premium, free_generations_remaining, premium_expiry')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('❌ [Database] Erreur lors de la récupération du profil:', error);
      throw new Error(`Erreur lors de la récupération du profil: ${error.message}`);
    }

    if (!profile) {
      console.error('❌ [Database] Profil introuvable pour:', userId);
      throw new Error('Profil utilisateur introuvable');
    }

    let isPremium = profile.is_premium === true;
    const freeGenerationsRemaining = profile.free_generations_remaining || 0;

    // Vérifier si l'abonnement premium a expiré
    if (isPremium && profile.premium_expiry) {
      const expiryDate = new Date(profile.premium_expiry);
      if (expiryDate < new Date()) {
        console.warn('⚠️  [Database] Abonnement premium expiré le:', profile.premium_expiry);
        isPremium = false;

        // Mettre à jour le profil en base pour désactiver le premium
        await supabase
          .from('profiles')
          .update({
            is_premium: false,
            subscription_name: null,
          })
          .eq('id', userId);

        console.log('🔄 [Database] Premium désactivé automatiquement (expiry dépassée)');
      }
    }

    console.log('💎 [Database] isPremium:', isPremium);
    console.log('📊 [Database] free_generations_remaining:', freeGenerationsRemaining);

    // L'utilisateur peut générer s'il est premium OU s'il a des générations gratuites
    const canGenerate = isPremium || freeGenerationsRemaining > 0;

    console.log(canGenerate ? '✅ [Database] Génération autorisée' : '⛔ [Database] Génération refusée - Limite atteinte');

    return {
      canGenerate,
      isPremium,
      freeGenerationsRemaining,
    };
  } catch (error) {
    console.error('❌ [Database] Erreur lors de la vérification:', error);
    throw error;
  }
}

/**
 * Décrémente le compteur de générations gratuites d'un utilisateur non-premium
 * Version simplifiée : SELECT puis UPDATE (on utilise la Service Role Key)
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<void>}
 */
export async function decrementFreeGenerations(userId) {
  console.log('📉 [Database] Décrémentation des générations gratuites pour:', userId);

  try {
    // 1. Récupérer la valeur actuelle
    const { data: profile, error: selectError } = await supabase
      .from('profiles')
      .select('free_generations_remaining, is_premium')
      .eq('id', userId)
      .single();

    if (selectError) {
      throw new Error(`Erreur lors de la récupération: ${selectError.message}`);
    }

    // 2. Vérifier si on doit décrémenter
    if (profile.is_premium) {
      console.log('💎 [Database] Utilisateur premium - Pas de décrémentation nécessaire');
      return;
    }

    if (profile.free_generations_remaining <= 0) {
      console.log('⚠️  [Database] Aucune génération restante - Pas de décrémentation');
      return;
    }

    // 3. Décrémenter (sans updated_at car cette colonne n'existe pas dans profiles)
    const newValue = Math.max(profile.free_generations_remaining - 1, 0);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        free_generations_remaining: newValue,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ [Database] Erreur UPDATE:', updateError);
      throw new Error(`Erreur lors de la mise à jour: ${updateError.message}`);
    }

    console.log(`✅ [Database] Décrémentation réussie: ${profile.free_generations_remaining} → ${newValue}`);
  } catch (error) {
    console.error('❌ [Database] Erreur lors de la décrémentation:', error);
    // Ne pas throw ici pour ne pas bloquer l'analyse
    // Mais logger clairement pour debug
    console.warn('⚠️  [Database] La décrémentation a échoué mais l\'analyse continue');
  }
}

/**
 * Met à jour le statut premium d'un utilisateur
 * @param {string} appUserId - ID Supabase de l'utilisateur
 * @param {Object} options - Options de mise à jour
 * @param {boolean} options.isPremium - Nouveau statut premium
 * @param {string|null} options.premiumExpiry - Date d'expiration (ISO string) ou null
 * @param {string|null} options.subscriptionName - Nom de l'abonnement ou null
 * @returns {Promise<boolean>} - true si succès
 */
export async function updateUserPremiumStatus(appUserId, { isPremium, premiumExpiry = null, subscriptionName = null }) {
  console.log('🔄 [Database] Mise à jour du statut premium pour:', appUserId);
  console.log('💎 [Database] isPremium:', isPremium, '| expiry:', premiumExpiry, '| subscription:', subscriptionName);

  try {
    const updateData = {
      is_premium: isPremium,
      premium_expiry: premiumExpiry,
      subscription_name: subscriptionName,
    };

    // Ajouter premium_since si activation
    if (isPremium) {
      updateData.premium_since = new Date().toISOString();
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', appUserId);

    if (error) {
      console.error('❌ [Database] Erreur mise à jour premium:', error);
      throw new Error(`Erreur mise à jour premium: ${error.message}`);
    }

    console.log('✅ [Database] Statut premium mis à jour avec succès');
    return true;
  } catch (error) {
    console.error('❌ [Database] Erreur lors de la mise à jour du statut premium:', error);
    throw error;
  }
}

/**
 * Récupère l'email d'un utilisateur via Supabase Auth
 * @param {string} userId - UUID de l'utilisateur
 * @returns {Promise<string|null>} - Email ou null
 */
export async function getUserEmail(userId) {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !data?.user?.email) {
      console.warn('⚠️  [Database] Email non trouvé pour:', userId);
      return null;
    }
    return data.user.email;
  } catch (error) {
    console.error('❌ [Database] Erreur récupération email:', error.message);
    return null;
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

