function isToysDeal(title: string) {
  const lower = title.toLowerCase();
  const regex = /\b(toys?|dolls?|barbie|play-?doh|action figures?|rattles?|teethers?|baby walkers?|soft toys?|plushies?|stuffed animals?|stuffed toys?|slime kits?|nerf guns?)\b/i;
  return regex.test(lower);
}

const testCases = [
  { title: "Lego building blocks set for kids", expected: false }, // lego is not in the list yet
  { title: "Barbie Dreamhouse Playset with Doll", expected: true },
  { title: "Samsung Galaxy Tab S10 Lite with AI", expected: false },
  { title: "Baby Teether and Rattle Set", expected: true },
  { title: "Hot Wheels Toy Car for Boys", expected: true },
  { title: "Toyota Fortuner Car Accessories", expected: false }, // Should not trigger 'toy' inside 'toyota'
  { title: "Dollar Club Polo T-Shirt", expected: false }, // Should not trigger 'doll' inside 'dollar'
  { title: "Detox Green Tea Pack", expected: false }, // Should not trigger 'toy' inside 'detox'
  { title: "Super Mario Action Figure toy", expected: true },
];

testCases.forEach(tc => {
  const result = isToysDeal(tc.title);
  console.log(`Title: "${tc.title}" | Result: ${result} | Expected: ${tc.expected} | ${result === tc.expected ? "✅ PASS" : "❌ FAIL"}`);
});
