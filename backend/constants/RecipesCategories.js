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
  'méditerranéenne',
  'libanaise',
  'marocaine',
  'turque',
  'grecque',
  'brésilienne',
  'portugaise',
  'allemande',
  'britannique',
  'scandinave',
  'africaine',
  'fusion',
  'autre',
]);

export const MEAL_TYPES = Object.freeze([
  'petit-déjeuner',
  'déjeuner',
  'dîner',
  'collation',
  'dessert',
  'boisson',
  'entrée',
  'autre',
]);

export const DIET_TYPES = Object.freeze([
  'omnivore',
  'végétarien',
  'sans gluten',
  'sans lactose',
  'keto',
  'low carb',
  'protéiné',
  'faible en calories',
  'régime anti-inflammatoire',
  'riche en glucides',
  'sans sucre',
  'autre',
]);

export const RECIPE_CATEGORIES = Object.freeze({
  cuisine_origin: CUISINE_ORIGINS,
  meal_type: MEAL_TYPES,
  diet_type: DIET_TYPES,
});

