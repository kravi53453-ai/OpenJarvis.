const P: Record<string, string> = {
  menu: 'M4 6h16M4 12h16M4 18h16', send: 'M5 12l14-7-5 14-2-6-7-1z', mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4',
  plus: 'M12 5v14M5 12h14', camera: 'M4 8h3l2-2h6l2 2h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5h.01',
  x: 'M6 6l12 12M18 6L6 18', check: 'M5 13l4 4L19 7', stop: 'M7 7h10v10H7z', back: 'M15 5l-7 7 7 7', key: 'M14 10a4 4 0 1 0-3 3.9L13 16h2v2h2v2h3v-3l-6-6.1',
  chip: 'M8 8h8v8H8zM4 9h2M4 15h2M18 9h2M18 15h2M9 4v2M15 4v2M9 18v2M15 18v2', shield: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z', brain: 'M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 3 4 3 3 0 0 0 5 1V5a2 2 0 0 0-3-1zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-3 4 3 3 0 0 1-5 1',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-2-4-2 1-2-1V5h-4v2l-2 1-2-1-2 4 2 1v2l-2 1 2 4 2-1 2 1v2h4v-2l2-1 2 1 2-4-2-1z',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13', cloud: 'M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 11a3.5 3.5 0 0 1-.5 7z', phone: 'M6 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14', pause: 'M8 6v12M16 6v12', play: 'M8 5l11 7-11 7z', refresh: 'M20 12a8 8 0 1 1-3-6.2M20 4v5h-5',
};
export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[name] || P.x} /></svg>;
}
