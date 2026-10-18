import "server-only";

/**
 * Feedback sentiment in [-1, 1]. Runs on the server so no API key reaches the
 * browser and the score cannot be spoofed by the client.
 *
 * With GOOGLE_NL_API_KEY set, Google Cloud Natural Language is used; otherwise
 * (and whenever that call fails) a small hospitality-tuned lexicon scores the
 * text, normalised the way VADER normalises its compound score.
 */

const LEXICON: Record<string, number> = {
  // positive
  amazing: 4, awesome: 4, excellent: 4, outstanding: 4, perfect: 4, fantastic: 4, incredible: 4, superb: 4, wonderful: 4,
  best: 3, brilliant: 3, delicious: 3, love: 3, loved: 3, lovely: 3, great: 3, gorgeous: 3, beautiful: 3, stunning: 3, yummy: 3, tasty: 3,
  friendly: 2, good: 2, nice: 2, happy: 2, welcoming: 2, cosy: 2, cozy: 2, fresh: 2, recommend: 2, enjoyed: 2, enjoy: 2, helpful: 2,
  quick: 1, fast: 1, clean: 1, warm: 1, attentive: 2, polite: 2, relaxing: 2, pleasant: 2, thanks: 1, thank: 1, fine: 1, ok: 1, okay: 1,
  decent: 1, cute: 1, charming: 2, favourite: 3, favorite: 3, impressed: 2, generous: 2, reasonable: 1, smooth: 1, perfectly: 3,
  // negative
  awful: -4, terrible: -4, horrible: -4, disgusting: -4, worst: -4, inedible: -4, rude: -3, dirty: -3, filthy: -4,
  bad: -2, poor: -2, slow: -2, cold: -1, stale: -2, bland: -2, burnt: -2, overpriced: -2, expensive: -1, noisy: -1, loud: -1,
  disappointing: -3, disappointed: -3, unfriendly: -2, wrong: -2, waited: -1, waiting: -1, wait: -1, ignored: -3, mistake: -2,
  forgot: -2, forgotten: -2, sticky: -1, soggy: -2, greasy: -2, undercooked: -3, overcooked: -2, raw: -1, broken: -2, hate: -3,
  hated: -3, meh: -1, mediocre: -2, sad: -2, angry: -3, unhappy: -2, crowded: -1, cramped: -1, smelly: -3, unacceptable: -3,
  never: -1, complaint: -2, complain: -2, lukewarm: -1, watery: -2, tasteless: -2, sour: -1, bitter: -1,
};

const NEGATORS = new Set(["not", "no", "never", "isn't", "wasn't", "aren't", "weren't", "don't", "didn't", "doesn't", "won't", "can't", "couldn't", "hardly"]);
const BOOSTERS: Record<string, number> = { very: 1.5, really: 1.5, so: 1.4, super: 1.5, extremely: 1.8, incredibly: 1.8, absolutely: 1.6, quite: 1.2, bit: 0.6, slightly: 0.6 };

export function lexiconSentiment(text: string): number {
  const words = text.toLowerCase().replace(/[’]/g, "'").match(/[a-z']+/g) ?? [];
  let sum = 0;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let value = LEXICON[word];
    if (value === undefined || NEGATORS.has(word)) continue;
    const prev = words[i - 1];
    if (prev && BOOSTERS[prev]) value *= BOOSTERS[prev];
    // A negator within the three preceding words flips and dampens.
    for (let j = Math.max(0, i - 3); j < i; j++) {
      if (NEGATORS.has(words[j])) {
        value *= -0.7;
        break;
      }
    }
    sum += value;
  }
  // Exclamation marks amplify whatever direction the text already has.
  const bangs = Math.min((text.match(/!/g) ?? []).length, 3);
  if (sum !== 0) sum += Math.sign(sum) * bangs * 0.3;
  const score = sum / Math.sqrt(sum * sum + 15);
  return Math.round(score * 1000) / 1000;
}

async function googleSentiment(text: string, apiKey: string): Promise<number | null> {
  try {
    const response = await fetch(`https://language.googleapis.com/v1/documents:analyzeSentiment?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: { type: "PLAIN_TEXT", content: text }, encodingType: "UTF8" }),
      // The guest's thank-you waits on this; past 1.5 s the word list answers instead.
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { documentSentiment?: { score?: number } };
    const score = json.documentSentiment?.score;
    return typeof score === "number" ? score : null;
  } catch {
    return null;
  }
}

export async function analyzeSentiment(text: string): Promise<number> {
  const apiKey = process.env.GOOGLE_NL_API_KEY;
  if (apiKey) {
    const score = await googleSentiment(text, apiKey);
    if (score !== null) return score;
  }
  return lexiconSentiment(text);
}
