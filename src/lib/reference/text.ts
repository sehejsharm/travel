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
  return value
    .toLowerCase()
    .replace(/[đðłøæœßıþ]/g, (letter) => PLAIN[letter] ?? letter)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Whether `phrase` appears in `text` as whole words: "agra" is not in "sagrada familia". */
export function hasWords(text: string, phrase: string): boolean {
  return phrase !== "" && ` ${text} `.includes(` ${phrase} `);
}

/**
 * Three-letter words written in capitals, as airport codes are. Lower case is
 * left alone: "del" in "Museo del Prado" and "los" in "Los Angeles" are words.
 */
export function capitalCodes(text: string): string[] {
  return [...text.matchAll(/(?<![A-Za-z])[A-Z]{3}(?![A-Za-z])/g)].map((match) => match[0]);
}
