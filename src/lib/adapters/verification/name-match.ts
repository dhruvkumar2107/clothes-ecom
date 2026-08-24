/**
 * Name matching for bank-account verification.
 *
 * A penny-drop returns the name the bank has on file. Comparing it to what the
 * customer typed is the actual fraud control — it is what stops someone
 * withdrawing referral commission into an account that isn't theirs. So exact
 * string equality is useless here, and so is naive fuzzy matching. Real Indian
 * bank records routinely differ from user input in ways that are all legitimate:
 *
 *   "RAHUL SHARMA"        vs "Rahul Kumar Sharma"   → extra middle name
 *   "SHARMA RAHUL"        vs "Rahul Sharma"         → reversed word order
 *   "R SHARMA"            vs "Rahul Sharma"         → initial for given name
 *   "MR RAHUL SHARMA"     vs "Rahul Sharma"         → honorific
 *   "PRIYA S"             vs "Priya Subramanian"    → South Indian initial style
 *   "LAKSHMI NARAYAN"     vs "Laxmi Narayan"        → transliteration variance
 *
 * ...while a genuine mismatch ("RAHUL SHARMA" vs "AMIT PATEL") must score low.
 *
 * The approach: normalise, tokenise, then solve an order-independent optimal
 * assignment between token sets using Jaro-Winkler similarity, with explicit
 * handling for initials. Score is coverage-weighted so a missing middle name
 * costs little but a wrong surname costs a lot.
 *
 * Threshold lives in settings (`wallet.nameMatchThreshold`, default 80) rather
 * than being hardcoded, because the right cutoff is a business risk decision.
 */

/** Honorifics and suffixes that carry no identity information. */
const NOISE_TOKENS = new Set([
  'MR', 'MRS', 'MS', 'MISS', 'DR', 'PROF', 'SHRI', 'SHREE', 'SMT', 'SRI',
  'KUMARI', 'MASTER', 'MD', 'THE', 'AND', 'OR',
  'JR', 'SR', 'II', 'III',
]);

/**
 * Transliteration equivalences common in Indian names. Applied after
 * normalisation so "LAXMI" and "LAKSHMI" collapse to the same key.
 */
const TRANSLITERATIONS: [RegExp, string][] = [
  [/KSH/g, 'X'],      // LAKSHMI → LAXMI
  [/CKH?/g, 'K'],     // VIVECK → VIVEK
  [/PH/g, 'F'],       // PHOOL → FOOL
  [/TH/g, 'T'],       // KARTHIK → KARTIK
  [/DH/g, 'D'],       // SIDDHARTH → SIDART
  [/BH/g, 'B'],
  [/GH/g, 'G'],
  [/JH/g, 'J'],
  [/CH/g, 'C'],
  [/SH/g, 'S'],       // SHARMA → SARMA
  [/OO/g, 'U'],       // ANOOP → ANUP
  [/EE/g, 'I'],       // NEETA → NITA
  [/AA/g, 'A'],       // RAAM → RAM
  [/II/g, 'I'],
  [/UU/g, 'U'],
  [/Y$/g, 'I'],       // trailing Y ~ I
  [/W/g, 'V'],        // WIVEK → VIVEK
  [/Z/g, 'J'],        // common in Bengali transliteration
];

export interface NameMatchResult {
  /** 0–100. */
  score: number;
  result: 'exact' | 'partial' | 'mismatch';
  /** Human-readable reason, surfaced in admin verification logs. */
  explanation: string;
  matchedTokens: number;
  totalTokens: number;
}

function normalize(name: string): string {
  return name
    .toUpperCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z\s]/g, ' ')  // drop digits, punctuation, joint-account "&"
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(name: string): string[] {
  return normalize(name)
    .split(' ')
    .filter((t) => t.length > 0 && !NOISE_TOKENS.has(t));
}

/** Phonetic key for transliteration-tolerant comparison. */
function phoneticKey(token: string): string {
  let key = token;
  for (const [pattern, replacement] of TRANSLITERATIONS) {
    key = key.replace(pattern, replacement);
  }
  // Collapse doubled letters produced by the substitutions above.
  return key.replace(/(.)\1+/g, '$1');
}

/**
 * Jaro similarity — good for short strings with transpositions, which is
 * exactly the failure mode in hand-entered names.
 */
function jaro(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched = new Array(a.length).fill(false);
  const bMatched = new Array(b.length).fill(false);

  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatched[j] || a[i] !== b[j]) continue;
      aMatched[i] = true;
      bMatched[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }

  const t = transpositions / 2;
  return (matches / a.length + matches / b.length + (matches - t) / matches) / 3;
}

/** Jaro-Winkler: boosts pairs sharing a prefix, which surnames usually do. */
function jaroWinkler(a: string, b: string): number {
  const j = jaro(a, b);
  if (j < 0.7) return j; // standard threshold — don't boost weak matches

  let prefix = 0;
  const max = Math.min(4, a.length, b.length);
  while (prefix < max && a[prefix] === b[prefix]) prefix++;

  return j + prefix * 0.1 * (1 - j);
}

/**
 * Similarity between two name tokens, 0–1.
 *
 * Initials are handled explicitly rather than left to edit distance: "R" vs
 * "RAHUL" has terrible character overlap but is a perfectly ordinary match, and
 * conversely "R" vs "AMIT" must score zero rather than "one char out of four".
 */
function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;

  const aInitial = a.length === 1;
  const bInitial = b.length === 1;

  if (aInitial || bInitial) {
    const initial = aInitial ? a : b;
    const full = aInitial ? b : a;
    // An initial matching the right first letter is strong but not conclusive:
    // it carries far less information than a full-token match, so cap it.
    return full.startsWith(initial) ? 0.85 : 0;
  }

  const direct = jaroWinkler(a, b);

  // Retry through the phonetic key to absorb transliteration differences.
  const phonetic = jaroWinkler(phoneticKey(a), phoneticKey(b));

  return Math.max(direct, phonetic * 0.97); // slight discount for the fuzzier path
}

/**
 * Greedy optimal assignment between token sets.
 *
 * Full Hungarian algorithm would be exact, but names are 2–4 tokens; greedy
 * best-first over all pairs gives the same answer at this size and is far easier
 * to reason about when a verification dispute needs explaining.
 */
function assignTokens(
  source: string[],
  target: string[],
): { pairs: { a: string; b: string; score: number }[]; unmatchedA: string[]; unmatchedB: string[] } {
  const candidates: { i: number; j: number; score: number }[] = [];

  for (let i = 0; i < source.length; i++) {
    for (let j = 0; j < target.length; j++) {
      const score = tokenSimilarity(source[i], target[j]);
      if (score > 0.5) candidates.push({ i, j, score });
    }
  }

  candidates.sort((x, y) => y.score - x.score);

  const usedA = new Set<number>();
  const usedB = new Set<number>();
  const pairs: { a: string; b: string; score: number }[] = [];

  for (const c of candidates) {
    if (usedA.has(c.i) || usedB.has(c.j)) continue;
    usedA.add(c.i);
    usedB.add(c.j);
    pairs.push({ a: source[c.i], b: target[c.j], score: c.score });
  }

  return {
    pairs,
    unmatchedA: source.filter((_, i) => !usedA.has(i)),
    unmatchedB: target.filter((_, j) => !usedB.has(j)),
  };
}

/**
 * Compare the name the customer entered against the name the bank returned.
 *
 * @param claimed  what the user typed as account holder name
 * @param onRecord what the bank/penny-drop returned
 */
export function matchNames(claimed: string, onRecord: string): NameMatchResult {
  const claimedTokens = tokenize(claimed);
  const recordTokens = tokenize(onRecord);

  if (claimedTokens.length === 0 || recordTokens.length === 0) {
    return {
      score: 0,
      result: 'mismatch',
      explanation: 'One of the names was empty after normalisation.',
      matchedTokens: 0,
      totalTokens: Math.max(claimedTokens.length, recordTokens.length),
    };
  }

  // Fast path: identical after normalisation.
  if (claimedTokens.join(' ') === recordTokens.join(' ')) {
    return {
      score: 100,
      result: 'exact',
      explanation: 'Names are identical.',
      matchedTokens: claimedTokens.length,
      totalTokens: claimedTokens.length,
    };
  }

  const { pairs, unmatchedA, unmatchedB } = assignTokens(claimedTokens, recordTokens);

  if (pairs.length === 0) {
    return {
      score: 0,
      result: 'mismatch',
      explanation: `No tokens in common ("${claimedTokens.join(' ')}" vs "${recordTokens.join(' ')}").`,
      matchedTokens: 0,
      totalTokens: Math.max(claimedTokens.length, recordTokens.length),
    };
  }

  const matchQuality = pairs.reduce((sum, p) => sum + p.score, 0) / pairs.length;

  /**
   * Coverage penalty. An unmatched token in *either* name is evidence against a
   * match, but a missing middle name is far more benign than a missing surname,
   * so short unmatched tokens (initials) are discounted.
   *
   * Denominator uses the longer name so "RAHUL" vs "RAHUL KUMAR SHARMA" cannot
   * score 100 just because every token it has did match.
   */
  const weigh = (tokens: string[]) =>
    tokens.reduce((sum, t) => sum + (t.length <= 2 ? 0.3 : 1), 0);

  const unmatchedWeight = weigh(unmatchedA) + weigh(unmatchedB);
  const totalWeight = weigh(claimedTokens) + weigh(recordTokens);
  const coverage = totalWeight > 0 ? 1 - unmatchedWeight / totalWeight : 0;

  // 70% match quality / 30% coverage: a right-but-partial name should clear a
  // typical 80 threshold, while a name with an extra wrong surname should not.
  const raw = matchQuality * 0.7 + coverage * 0.3;
  const score = Math.round(Math.max(0, Math.min(1, raw)) * 100);

  let result: NameMatchResult['result'];
  if (score >= 95) result = 'exact';
  else if (score >= 70) result = 'partial';
  else result = 'mismatch';

  const parts: string[] = [
    `${pairs.length} of ${Math.max(claimedTokens.length, recordTokens.length)} name parts matched`,
  ];
  if (unmatchedA.length) parts.push(`not on bank record: ${unmatchedA.join(', ')}`);
  if (unmatchedB.length) parts.push(`extra on bank record: ${unmatchedB.join(', ')}`);
  const initialMatches = pairs.filter((p) => p.a.length === 1 || p.b.length === 1);
  if (initialMatches.length) parts.push(`${initialMatches.length} matched by initial only`);

  return {
    score,
    result,
    explanation: `${parts.join('; ')}.`,
    matchedTokens: pairs.length,
    totalTokens: Math.max(claimedTokens.length, recordTokens.length),
  };
}

/** Does this match clear the configured threshold? */
export function passesNameMatch(score: number | null | undefined, threshold: number): boolean {
  return typeof score === 'number' && score >= threshold;
}

// ── IFSC validation ─────────────────────────────────────────────────────────

/**
 * IFSC format: 4 letters (bank) + '0' (reserved) + 6 alphanumerics (branch).
 * Validating the shape locally saves a network round-trip on obvious typos and
 * gives the customer an instant error instead of a spinner.
 */
export function isValidIfscFormat(ifsc: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase().trim());
}

/**
 * Indian bank account numbers run 9–18 digits depending on the bank. We can
 * only check the shape; the penny-drop is what proves it exists.
 */
export function isValidAccountNumberFormat(accountNumber: string): boolean {
  const digits = accountNumber.replace(/\s/g, '');
  return /^\d{9,18}$/.test(digits);
}

/** UPI VPA: `handle@psp`. */
export function isValidVpaFormat(vpa: string): boolean {
  return /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.]{1,63}$/.test(vpa.trim());
}

/** Bank name from the IFSC prefix — instant feedback before the API lookup. */
const IFSC_BANK_PREFIXES: Record<string, string> = {
  HDFC: 'HDFC Bank',
  ICIC: 'ICICI Bank',
  SBIN: 'State Bank of India',
  UTIB: 'Axis Bank',
  KKBK: 'Kotak Mahindra Bank',
  PUNB: 'Punjab National Bank',
  BARB: 'Bank of Baroda',
  CNRB: 'Canara Bank',
  IDIB: 'Indian Bank',
  UBIN: 'Union Bank of India',
  YESB: 'Yes Bank',
  INDB: 'IndusInd Bank',
  IDFB: 'IDFC First Bank',
  FDRL: 'Federal Bank',
  RATN: 'RBL Bank',
  BKID: 'Bank of India',
  CBIN: 'Central Bank of India',
  IOBA: 'Indian Overseas Bank',
  MAHB: 'Bank of Maharashtra',
  PSIB: 'Punjab & Sind Bank',
  UCBA: 'UCO Bank',
  AUBL: 'AU Small Finance Bank',
  ESFB: 'Equitas Small Finance Bank',
  SIBL: 'South Indian Bank',
  KARB: 'Karnataka Bank',
  TMBL: 'Tamilnad Mercantile Bank',
  CIUB: 'City Union Bank',
  DBSS: 'DBS Bank India',
  SCBL: 'Standard Chartered Bank',
  CITI: 'Citibank',
  HSBC: 'HSBC India',
  AIRP: 'Airtel Payments Bank',
  PYTM: 'Paytm Payments Bank',
  FINO: 'Fino Payments Bank',
  JIOP: 'Jio Payments Bank',
};

export function bankFromIfsc(ifsc: string): string | null {
  const prefix = ifsc.toUpperCase().slice(0, 4);
  return IFSC_BANK_PREFIXES[prefix] ?? null;
}

export const KNOWN_IFSC_PREFIXES = IFSC_BANK_PREFIXES;
