import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Platform logos mapping
const PLATFORM_LOGOS = {
  'TikTok': '🎵',
  'YouTube': '▶️',
  'Instagram': '📷',
  'Unknown': '❓'
};

/**
 * Calculate comprehensive user recipe statistics
 * @param {string} userId - User ID from authentication
 * @returns {Object} User statistics including total recipes, platform breakdown, total cook time, top cuisine, top diets
 */
export async function getUserStats(userId) {
  try {
    console.log(`📊 Fetching statistics for user: ${userId}`);

    // Fetch all user recipes with relevant fields
    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('platform, cook_time, cuisine_origin, diet_type')
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error fetching user recipes:', error);
      throw new Error('Erreur lors de la récupération des recettes');
    }

    if (!recipes || recipes.length === 0) {
      return {
        totalRecipes: 0,
        recipesByPlatform: {},
        totalCookTime: { hours: 0, minutes: 0 },
        topCuisineOrigin: null,
        topDietTypes: []
      };
    }

    console.log(`📊 Found ${recipes.length} recipes for user`);
    console.log('📝 Sample recipe data:', recipes[0]);

    // Calculate total recipes
    const totalRecipes = recipes.length;

    // Calculate recipes by platform
    const recipesByPlatform = calculateRecipesByPlatform(recipes);

    // Calculate total cook time
    const totalCookTime = calculateTotalCookTime(recipes);

    // Find top cuisine origin
    const topCuisineOrigin = findTopCuisineOrigin(recipes);

    // Find top 4 diet types
    const topDietTypes = findTopDietTypes(recipes);

    const stats = {
      totalRecipes,
      recipesByPlatform,
      totalCookTime,
      topCuisineOrigin,
      topDietTypes
    };

    console.log('✅ User statistics calculated successfully:', stats);
    return stats;

  } catch (error) {
    console.error('❌ Error calculating user stats:', error);
    throw error;
  }
}

/**
 * Calculate number of recipes per platform with logos
 * @param {Array} recipes - Array of recipe objects
 * @returns {Array} Array of platform objects with name, count, and logo
 */
function calculateRecipesByPlatform(recipes) {
  const platformCounts = {};

  recipes.forEach(recipe => {
    const platform = recipe.platform || 'Unknown';
    platformCounts[platform] = (platformCounts[platform] || 0) + 1;
  });

  // Convert to array with logo information
  return Object.entries(platformCounts).map(([platform, count]) => ({
    platform,
    count,
  }));
}

/**
 * Calculate total cook time across all recipes
 * @param {Array} recipes - Array of recipe objects
 * @returns {Object} Total cook time in hours and minutes
 */
function calculateTotalCookTime(recipes) {
  let totalMinutes = 0;

  recipes.forEach(recipe => {
    console.log('🕐 Recipe cook_time:', recipe.cook_time, 'Type:', typeof recipe.cook_time);

    // Handle both number and string types
    if (recipe.cook_time) {
      const cookTime = typeof recipe.cook_time === 'string'
        ? parseInt(recipe.cook_time, 10)
        : recipe.cook_time;

      if (!isNaN(cookTime)) {
        totalMinutes += cookTime;
      }
    }
  });

  console.log('📊 Total minutes calculated:', totalMinutes);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return { hours, minutes };
}

/**
 * Find the most common cuisine origin
 * @param {Array} recipes - Array of recipe objects
 * @returns {string|null} Most common cuisine origin or null if none
 */
function findTopCuisineOrigin(recipes) {
  const cuisineCounts = {};

  recipes.forEach(recipe => {
    if (recipe.cuisine_origin && typeof recipe.cuisine_origin === 'string' && recipe.cuisine_origin.trim() !== '') {
      const cuisine = recipe.cuisine_origin.trim().toLowerCase();
      cuisineCounts[cuisine] = (cuisineCounts[cuisine] || 0) + 1;
    }
  });

  console.log('🍳 Cuisine counts:', cuisineCounts);

  if (Object.keys(cuisineCounts).length === 0) {
    return null;
  }

  // Find cuisine with highest count
  const sortedCuisines = Object.entries(cuisineCounts)
    .sort((a, b) => b[1] - a[1]);

  console.log('📊 Sorted cuisines:', sortedCuisines);
  const topCuisine = sortedCuisines[0][0];

  return topCuisine;
}

/**
 * Find the top 4 most common diet types
 * @param {Array} recipes - Array of recipe objects
 * @returns {Array} Array of top 4 diet types with counts
 */
function findTopDietTypes(recipes) {
  const dietCounts = {};

  recipes.forEach(recipe => {
    if (recipe.diet_type) {
      // Handle both string and array types
      const dietTypes = Array.isArray(recipe.diet_type)
        ? recipe.diet_type
        : [recipe.diet_type];

      dietTypes.forEach(diet => {
        if (diet && typeof diet === 'string' && diet.trim() !== '') {
          const normalizedDiet = diet.trim().toLowerCase();
          dietCounts[normalizedDiet] = (dietCounts[normalizedDiet] || 0) + 1;
        }
      });
    }
  });

  if (Object.keys(dietCounts).length === 0) {
    return [];
  }

  // Sort by count (descending) and take top 4
  const topDiets = Object.entries(dietCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([diet, count]) => ({
      diet,
      count
    }));

  return topDiets;
}
