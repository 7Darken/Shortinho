export const CUISINE_ORIGINS = [
    "japonaise",
    "chinoise",
    "coréenne",
    "thaïlandaise",
    "vietnamienne",
    "indienne",
    "italienne",
    "française",
    "espagnole",
    "mexicaine",
    "américaine",
    "méditerranéenne",
    "libanaise",
    "marocaine",
    "turque",
    "grecque",
    "brésilienne",
    "portugaise",
    "allemande",
    "britannique",
    "scandinave",
    "africaine",
    "fusion",
    "autre",
  ] as const;
  
  export const MEAL_TYPES = [
    "petit-déjeuner",
    "déjeuner",
    "dîner",
    "collation",
    "dessert",
    "boisson",
    "entrée",
    "autre",
  ] as const;
  
  export const DIET_TYPES = [
    "omnivore",
    "végétarien",
    "sans gluten",
    "sans lactose",
    "keto",
    "low carb",
    "protéiné",
    "faible en calories",
    "régime anti-inflammatoire",
    "riche en glucides",
    "sans sucre",
    "autre",
  ] as const;

  export const RECIPE_CATEGORIES = {
    cuisine_origin: CUISINE_ORIGINS,
    meal_type: MEAL_TYPES,
    diet_type: DIET_TYPES,
  };
  