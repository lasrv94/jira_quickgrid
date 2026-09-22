export const COLOR_OPTIONS = [
  { id: 'emerald', label: 'Verde Esmeralda', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  { id: 'sky', label: 'Azul Cielo', bg: 'bg-sky-100', text: 'text-sky-800', border: 'border-sky-200', dot: 'bg-sky-500' },
  { id: 'amber', label: 'Ámbar Cálido', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-500' },
  { id: 'rose', label: 'Rosa Coral', bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200', dot: 'bg-rose-500' },
  { id: 'purple', label: 'Violeta Místico', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200', dot: 'bg-purple-500' },
  { id: 'indigo', label: 'Índigo Profundo', bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  { id: 'slate', label: 'Gris Neutro', bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-200', dot: 'bg-slate-500' },
];

export function getColorClasses(colorKey?: string) {
  const match = COLOR_OPTIONS.find((c) => c.id === colorKey);
  if (match) {
    return `${match.bg} ${match.text} ${match.border} border`;
  }
  return 'bg-gray-100 text-gray-800 border border-gray-200';
}
