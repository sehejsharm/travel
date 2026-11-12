import type { DivertIcon } from "@/lib/divert/types";
import { LineIcon } from "../line-icon";

/** Divert's interests draw from the app's one line-icon set. */
export function DivertIconGlyph({ icon, size = 22 }: { icon: DivertIcon; size?: number }) {
  return <LineIcon name={icon} size={size} />;
}
