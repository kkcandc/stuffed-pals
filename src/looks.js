export const NAME_IDEAS = ["Mallow", "Pip", "Button", "Nib", "Lumen", "Pebble"];

export const SNACKS = [
  {
    id: "cookie",
    name: "Crumb cookie",
    line: "Crumb cookie! I got sugar on my nose.",
  },
  {
    id: "berry",
    name: "Berry cup",
    line: "Berry cup! The purple one is my favorite.",
  },
  {
    id: "milk",
    name: "Milk sip",
    line: "Milk sip. I have a tiny mustache now.",
  },
  {
    id: "honey",
    name: "Honey bite",
    line: "Honey bite. Sticky paws, happy heart.",
  },
];

export const OUTFITS = [
  { id: "none", name: "Just me", line: "Back to just me. Still snuggly." },
  { id: "bow", name: "Sunny bow", line: "Sunny bow! I feel like a parade." },
  { id: "scarf", name: "Cozy scarf", line: "Cozy scarf. I am a warm little loaf." },
  { id: "glasses", name: "Star glasses", line: "Star glasses! I can see every crumb." },
  { id: "hat", name: "Party hat", line: "Party hat on. Someone hum a song." },
];

export const MAKEUP = [
  { id: "none", name: "Bare face", line: "Bare face. I still look like me, which is nice." },
  { id: "rosy", name: "Rosy cheeks", line: "Rosy cheeks. I look wind-kissed." },
  { id: "berry", name: "Berry lips", line: "Berry lips. No real berries were harmed." },
  { id: "sparkle", name: "Sparkle freckles", line: "Sparkle freckles! I am a night light." },
];

export function byId(list, id) {
  return list.find((item) => item.id === id) || list[0];
}

export const SHELF_LIMIT = 12;
