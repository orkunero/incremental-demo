// Short number format: 1.2, 999, 1.23K, 45.6M, 7.89B …
export function fmt(n: number): string {
  if (!isFinite(n)) return '∞';
  const neg = n < 0; n = Math.abs(n);
  let out;
  if (n < 10) out = (Math.round(n * 10) / 10).toString();
  else if (n < 1000) out = Math.floor(n).toString();
  else {
    const u = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
    let i = -1;
    while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
    out = n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) + u[i];
  }
  return (neg ? '-' : '') + out;
}
