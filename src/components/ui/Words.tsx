// Preserve spaces while letting a scroll timeline reveal words in reading order.
export function Words({ text }: { text: string }) {
  return text.split(/(\s+)/).map((part, i) =>
    /^\s+$/.test(part) || !part ? part : <span key={i} className="word">{part}</span>,
  );
}
