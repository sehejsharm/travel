import { BRAND, CHECK_PATH, STUB_PATH } from "@/lib/brand";

/**
 * The wordmark's icon, in the DOM. Colours come from the theme so the mark
 * works on either background without a second asset.
 */
export function Mark({
  size = 22,
  fill = "var(--accent)",
  cut = "var(--bg)",
}: {
  size?: number;
  fill?: string;
  cut?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d={STUB_PATH} fill={fill} />
      <path
        d={CHECK_PATH}
        fill="none"
        stroke={cut}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export { BRAND };
