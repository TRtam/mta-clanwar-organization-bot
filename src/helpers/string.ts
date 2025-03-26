function msToTimeStr(ms: number): string {
  const totalMs = Math.max(0, ms);
  return `${String(Math.floor(totalMs / (1000 * 60))).padStart(
    2,
    "0"
  )}:${String(Math.floor((totalMs % (1000 * 60)) / 1000)).padStart(
    2,
    "0"
  )}:${String(totalMs % 1000).padStart(3, "0")}`;
}

function removeHexColors(input: string): string {
  return input.replace(/#[0-9A-Fa-f]{6}/g, "");
}

export { msToTimeStr, removeHexColors };
