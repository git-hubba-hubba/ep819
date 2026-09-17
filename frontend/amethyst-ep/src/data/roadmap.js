export const roadmapPhases = [
  { id: '1.0', title: 'Foundation, launch & deploy', color: 'var(--brand-blue)' },
  { id: '2.0', title: 'Expertise & personalized paths', color: 'var(--brand-lime)' },
  { id: '3.0', title: 'Quality CX & AI enablement', color: 'var(--brand-blue-light)' },
]
export const roadmapStatuses = ['Planned', 'In Progress', 'Complete']
export function monthIndex(month) { const [year, number] = month.split('-').map(Number); return year * 12 + number - 1 }
export function monthFromIndex(index) { return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}` }
export function monthEnd(month) { const [year, number] = month.split('-').map(Number); return `${month}-${new Date(Date.UTC(year, number, 0)).getUTCDate()}` }
