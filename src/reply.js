// On-device replies. This matches words in the player's line.
// It is not a language model and it does not call a server.

const STOP = new Set(
  `a an the i you me my we us our to and or but if is are was were be been being
it of in on for with that this so just like want can please do did does your
you're i'm it's don't that's you're youre im its at from am as too very really
what how why when where who about tell something some more may have has had
will would should could oh um uh ya yeah yep ok okay not no yes them they
their then than those these into onto over under out up down`.split(/\s+/)
);

const FOOD = [
  "ice cream",
  "breakfast",
  "chocolate",
  "sandwich",
  "cracker",
  "berries",
  "cookie",
  "cookies",
  "snack",
  "pizza",
  "apple",
  "banana",
  "cake",
  "candy",
  "hungry",
  "food",
  "lunch",
  "dinner",
  "berry",
  "milk",
  "juice",
  "cheese",
  "muffin",
  "toast",
  "treat",
  "donut",
  "grape",
  "soup",
  "taco",
  "pie",
  "eat",
  "yum",
  "nom",
];

const CLOTHES = [
  "lipstick",
  "glasses",
  "sweater",
  "costume",
  "makeup",
  "jacket",
  "ribbon",
  "blush",
  "scarf",
  "dress",
  "shirt",
  "shoes",
  "outfit",
  "clothes",
  "skirt",
  "bowtie",
  "socks",
  "crown",
  "tiara",
  "freckles",
  "hat",
  "bow",
  "shoe",
  "cape",
  "tutu",
  "coat",
  "pants",
];

const UNKIND = new Set([
  "hate",
  "kill",
  "die",
  "dead",
  "stupid",
  "dumb",
  "idiot",
  "scary",
  "monster",
  "hurt",
  "blood",
  "gun",
  "punch",
  "fight",
  "ugly",
  "loser",
]);

export function isSoft(text) {
  return !hasUnkind(text);
}

function hasUnkind(text) {
  const lower = String(text || "").toLowerCase();
  if (lower.includes("shut up")) return true;
  const tokens = lower.match(/[a-z0-9']+/g) || [];
  return tokens.some((token) => UNKIND.has(token));
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function choose(seed, options) {
  return options[seed % options.length];
}

function cap(word) {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function matchTerm(text, terms) {
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  for (const term of sorted) {
    const body = term.includes(" ")
      ? term.replace(/\s+/g, "\\s+")
      : `${term}(?:es|s)?`;
    const found = text.match(new RegExp(`\\b${body}\\b`, "i"));
    if (found) return found[0];
  }
  return null;
}

function same(a, b) {
  return String(a || "").toLowerCase() === String(b || "").toLowerCase();
}

function pickEcho(text, used) {
  const tokens = text.match(/[a-z0-9']+/gi) || [];
  const usedSet = new Set(used.filter(Boolean).map((word) => word.toLowerCase()));
  const content = tokens.filter((word) => !STOP.has(word.toLowerCase()) && word.length > 1);
  const extra = content.filter((word) => !usedSet.has(word.toLowerCase()));
  const pool = extra.length ? extra : content.length ? content : tokens;
  return pool[pool.length - 1] || "that";
}

export function makeReply(raw) {
  const text = String(raw || "").trim().replace(/\s+/g, " ").slice(0, 160);
  if (!text) return null;
  if (hasUnkind(text)) {
    return "Let's keep it soft. Tell me a color, a snack, or a silly word.";
  }

  const food = matchTerm(text, FOOD);
  const cloth = matchTerm(text, CLOTHES);
  const echo = pickEcho(text, [food, cloth]);
  const seed = hash(text.toLowerCase());

  if (food && cloth) {
    return choose(seed, [
      `${cap(echo)}! I can nibble ${food} in my ${cloth}.`,
      `You said ${echo}. ${cap(food)} and ${cloth} is a perfect tiny plan.`,
    ]);
  }

  if (food) {
    if (same(echo, food)) {
      return choose(seed, [
        `${cap(food)}! My tummy does a little hop.`,
        `I heard ${food}. That sounds tasty to me.`,
      ]);
    }
    return choose(seed, [
      `${cap(echo)}! My tummy does a little hop for ${food}.`,
      `You said ${echo}. I would share my ${food}.`,
    ]);
  }

  if (cloth) {
    if (same(echo, cloth)) {
      return choose(seed, [
        `${cap(cloth)}! I want to wear it and spin once.`,
        `A ${cloth}? My stitches feel fancy.`,
      ]);
    }
    return choose(seed, [
      `${cap(echo)}! I want to wear ${cloth} and spin once.`,
      `You said ${echo}. A ${cloth} would look so snuggly on me.`,
    ]);
  }

  if (text.includes("?")) {
    return choose(seed, [
      `${cap(echo)}? I think yes, with a tiny bounce.`,
      `You asked about ${echo}. My answer is a squeaky yes.`,
    ]);
  }

  return choose(seed, [
    `${cap(echo)}! I am keeping that word in my pocket.`,
    `You said ${echo}. I bounce once for that.`,
    `${cap(echo)} makes me want to do a little twirl.`,
  ]);
}
