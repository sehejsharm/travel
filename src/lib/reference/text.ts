/**
 * Place names compared the way people type them: lower case, accents gone,
 * punctuation as spaces. "Málaga-Costa del Sol" and "malaga costa del sol"
 * are the same words; so are "Tuđman" and "tudman".
 */

// Letters that carry no separable accent, so NFD leaves them alone.
const PLAIN: Record<string, string> = {
  đ: "d", ð: "d", ł: "l", ø: "o", æ: "ae", œ: "oe", ß: "ss", ı: "i", þ: "th",
};

export function fold(value: string): string {
  const spaced = value
    .toLowerCase()
    .replace(/[đðłøæœßıþ]/g, (letter) => PLAIN[letter] ?? letter)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // An apostrophe joins: "O'Hare" is "ohare", "Int'l" is "intl".
    .replace(/['`\u00b4\u2018\u2019\u02bb\u02bc]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  // Initials run together however they were dotted or spaced: "U.K.", "U. K."
  // and "UK" are "uk"; "O.R. Tambo" and "O. R. Tambo" are "or tambo".
  return spaced.replace(/\b[a-z](?: [a-z]\b)+/g, (run) => run.replace(/ /g, ""));
}

/** Whether `phrase` appears in `text` as whole words: "agra" is not in "sagrada familia". */
export function hasWords(text: string, phrase: string): boolean {
  return phrase !== "" && ` ${text} `.includes(` ${phrase} `);
}
