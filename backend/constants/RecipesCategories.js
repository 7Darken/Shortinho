export const CUISINE_ORIGINS = Object.freeze([
  'japonaise',
  'chinoise',
  'coréenne',
  'thaïlandaise',
  'vietnamienne',
  'indienne',
  'italienne',
  'française',
  'espagnole',
  'mexicaine',
  'américaine',
  'libanaise',
  'marocaine',
  'turque',
  'grecque',
  'brésilienne',
  'portugaise',
  'allemande',
  'britannique',
  'africaine',
  'fusion',
]);

export const MEAL_TYPES = Object.freeze([
  'petit-déjeuner',
  'déjeuner',
  'dîner',
  'collation',
  'dessert',
  'entrée',
  'autre',
]);

export const DIET_TYPES = Object.freeze([
  'végétarien',
  'sans gluten',
  'sans lactose',
  'vegan',
  'sans viande',
  'protéiné',
  'faible en calories',
  'faible en glucides',
  'sans sucre',
  'autre',
]);

export const RECIPE_CATEGORIES = Object.freeze({
  cuisine_origin: CUISINE_ORIGINS,
  meal_type: MEAL_TYPES,
  diet_type: DIET_TYPES,
});



