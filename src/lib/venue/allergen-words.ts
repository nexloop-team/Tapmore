import { ALLERGENS } from "./constants";

type Allergen = (typeof ALLERGENS)[number];

/**
 * Words that put an allergen in a dish when they appear in its name or
 * description. AI suggestions are only kept when one of these backs them up,
 * so a model can't add peanuts to a coffee on a hunch.
 */
const WORDS: Record<Allergen, RegExp> = {
  celery: /\b(celery|celeriac)\b/i,
  gluten: /\b(gluten|wheat|barley|rye|spelt|flour|bread|breaded|toast|sourdough|bun|brioche|bagel|croissant|pastry|pie|pasta|spaghetti|noodles?|pizza|naan|roti|paratha|kulcha|puri|bhatura|samosa|pancakes?|waffles?|muffin|cake|cookie|biscuit|crumble|couscous|batter|tempura|seitan)\b/i,
  crustaceans: /\b(crustaceans?|prawns?|shrimps?|crab|lobster|langoustines?|crayfish|scampi)\b/i,
  eggs: /\b(eggs?|omelett?e|frittata|mayo|mayonnaise|aioli|hollandaise|meringue|custard|quiche|benedict|florentine|shakshuka|carbonara)\b/i,
  fish: /\b(fish|salmon|tuna|cod|haddock|mackerel|sardines?|anchov(y|ies)|trout|sea ?bass|pomfret|surmai|basa|kipper)\b/i,
  lupin: /\blupin\b/i,
  milk: /\b(milk|milky|dairy|cheese|cheesy|cream|creamy|butter|buttery|ghee|yogh?urt|curd|dahi|paneer|khoya|malai|lassi|raita|kheer|latte|cappuccino|flat white|mocha|macchiato|cortado|milkshake|shake|ice cream|gelato|mozzarella|parmesan|halloumi|feta|cheddar|brie|ricotta|mascarpone|bechamel|alfredo)\b/i,
  molluscs: /\b(molluscs?|mussels?|oysters?|clams?|squid|calamari|octopus|scallops?|cockles?|whelks?)\b/i,
  mustard: /\b(mustard|dijon|sarson)\b/i,
  nuts: /\b(nuts?|almonds?|badam|cashews?|kaju|walnuts?|hazelnuts?|pecans?|pistachios?|pista|macadamias?|brazil nuts?|praline|marzipan|frangipane|nutella)\b/i,
  peanuts: /\b(peanuts?|groundnuts?|monkey nuts?|satay|peanut butter)\b/i,
  sesame: /\b(sesame|tahini|til|hummus|houmous)\b/i,
  soya: /\b(soy|soya|soybeans?|tofu|edamame|miso|tempeh)\b/i,
  sulphites: /\b(sulphites?|sulfites?|wine|vinegar|dried fruit|raisins?|sultanas?)\b/i,
};

/** Keeps only the allergens the dish's own words back up. */
export function backedAllergens(allergens: readonly string[], text: string): Allergen[] {
  return allergens.filter((allergen): allergen is Allergen => allergen in WORDS && WORDS[allergen as Allergen].test(text));
}
