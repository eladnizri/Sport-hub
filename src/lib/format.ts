const timeFmt = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' });

export function clockTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'לילה טוב';
  if (h < 12) return 'בוקר טוב';
  if (h < 17) return 'צהריים טובים';
  if (h < 21) return 'ערב טוב';
  return 'לילה טוב';
}

export function relativeTime(iso: string, now = new Date()): string {
  const diff = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'עכשיו';
  if (diff < 60) return `לפני ${diff} דק׳`;
  const hours = Math.round(diff / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  return `לפני ${Math.round(hours / 24)} ימים`;
}

export function countdown(iso: string, now = new Date()): string {
  const diff = Math.round((new Date(iso).getTime() - now.getTime()) / 60000);
  if (diff <= 0) return 'מתחיל';
  if (diff < 60) return `בעוד ${diff} דק׳`;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return mins ? `בעוד ${hours}:${String(mins).padStart(2, '0')} שע׳` : `בעוד ${hours} שע׳`;
}
