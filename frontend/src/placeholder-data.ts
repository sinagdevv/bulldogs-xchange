/* Category silhouettes drawn on a 100x100 grid. Decorative only. */
export const shapes={
  shirt:{body:"M35 18 18 28 8 46l14 6 6-8v40h44V44l6 8 14-6-10-18-17-10q-15 12-30 0Z",detail:"M35 18q15 12 30 0"},
  hoodie:{body:"M36 15q14-9 28 0l3 9 17 10 8 27-12 5-6-12v44H26V54l-6 12-12-5 8-27 17-10Z".replace("v44H26","v32H26"),detail:"M36 15q14 16 28 0M40 66h20l3 14H37Z"},
  jacket:{body:"M34 15q16 8 32 0l16 12 8 32-12 5-6-12v34H28V52l-6 12-12-5 8-32Z",detail:"M50 22v68M34 15l8 14M66 15l-8 14"},
  uniform:{body:"M33 14q17 18 34 0l12 9-7 20 2 45H26l2-45-7-20Z",detail:"M33 14q17 18 34 0M38 58h24M38 68h24"},
  cap:{body:"M20 62C20 38 34 28 50 28s30 10 30 34Zm-3 4h80c0 7-8 11-20 11H17Z",detail:"M50 28v34M34 32q-6 14-6 30"},
  tote:{body:"M22 38h56l7 54H15Z",detail:"M36 38V30a14 14 0 0 1 28 0v8"},
  polo:{body:"M35 18 18 28 8 46l14 6 6-8v40h44V44l6 8 14-6-10-18-17-10-15 12Z",detail:"M35 18l15 14M65 18 50 32M50 32v22M46 40h8M46 48h8"},
  accessory:{body:"M30 30h40l-4 62H34Z",detail:"M30 30q0-8 8-8h24q8 0 8 8M34 50h32M36 66h28"},
} as const;
export type PlaceholderKind=keyof typeof shapes;

/** Maps a category or product title to a silhouette. Falls back to the tee. */
export function placeholderKind(text?:string):PlaceholderKind{
  const t=(text??"").toLowerCase();
  if(/hood|sweat|pullover/.test(t))return "hoodie";
  if(/jacket|windbreaker|coat|varsity jacket/.test(t))return "jacket";
  if(/polo/.test(t))return "polo";
  if(/uniform|jersey|jogger|pants|gown|pe |lab/.test(t))return "uniform";
  if(/cap|hat|beanie/.test(t))return "cap";
  if(/tote|bag/.test(t))return "tote";
  if(/accessor|lanyard|tumbler|mug|pin|sticker|keychain|bottle|cap strap/.test(t))return "accessory";
  return "shirt";
}
export const kindLabel:Record<PlaceholderKind,string>={shirt:"Shirts",hoodie:"Hoodies",jacket:"Jackets",uniform:"Uniforms",cap:"Caps",tote:"Tote bags",polo:"Polo shirts",accessory:"Accessories"};

