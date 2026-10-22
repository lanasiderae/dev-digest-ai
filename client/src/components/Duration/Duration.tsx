/* Duration — compact human-readable rendering of a millisecond span
   (e.g. review run time), reused anywhere a raw ms number needs display. */
import prettyMilliseconds from "pretty-ms";
import { s } from "./styles";

export function Duration({ ms }: { ms: number }) {
  return <span style={s.text}>{prettyMilliseconds(ms)}</span>;
}
