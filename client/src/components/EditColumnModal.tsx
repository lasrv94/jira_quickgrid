import { useEffect, useState } from 'react';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import type { ColumnType, CustomColumn, SelectOption } from '../types';
import { COLOR_OPTIONS } from '../utils/colors';
import type { Language } from '../utils/i18n';
import { FormulaEditor } from './FormulaEditor';
import { validateFormula } from '../utils/formulaEvaluator';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  column: CustomColumn | null;
  onUpdateColumn: (colId: string, col: Partial<CustomColumn>) => Promise<void>;
  existingColumns?: CustomColumn[];
  lang?: Language;
}

export const EditColumnModal: React.FC<Props> = ({
  isOpen,
  onClose,
  column,
  onUpdateColumn,
  existingColumns = [],
  lang = 'es',
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<ColumnType>('single_select');
  const [formula, setFormula] = useState('');
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && column) {
      setName(column.name || '');
      setType(column.type || 'single_select');
      setFormula(column.formula || '');
      setOptions(column.options || []);
    }
  }, [isOpen, column]);

  if (!isOpen || !column) return null;

  const handleAddOption = () => {
    const newId = `opt-${Date.now()}`;
    const nextColor = COLOR_OPTIONS[options.length % COLOR_OPTIONS.length].id;
    setOptions([...options, { id: newId, label: `Opción ${options.length + 1}`, color: nextColor }]);
  };

  const handleUpdateOption = (index: number, field: 'label' | 'color', val: string) => {
    const next = [...options];
    next[index] = { ...next[index], [field]: val };
    setOptions(next);
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !column) return;
    if (type === 'formula') {
      const check = validateFormula(formula);
      if (!check.valid) {
        alert(`Error en la fórmula: ${check.error}`);
        return;
      }
    }
    setLoading(true);
    try {
      await onUpdateColumn(column.id, {
        name: name.trim(),
        type,
        options: type === 'single_select' ? options : [],
        formula: type === 'formula' ? formula.trim() : undefined,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-800 text-base">Editar Campo: {column.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                  Nombre de la Columna
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Estado Interno, Comentarios QA, Release Target"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                  Tipo de Campo
                </label>
                <select
                  disabled
                  value={type}
                  onChange={(e) => setType(e.target.value as ColumnType)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 text-gray-500 cursor-not-allowed"
                >
                  <option value="single_select">Selección Única (Color Pills)</option>
                  <option value="formula">Fórmula / Campo Calculado (fx)</option>
                  <option value="text">Texto Corto</option>
                  <option value="long_text">Texto Largo / Notas (Multi-línea)</option>
                  <option value="number">Número</option>
                  <option value="date">Fecha</option>
                  <option value="archivy_link">Vínculo Archivy Wiki (Markdown Docs)</option>
                </select>
              </div>

              {type === 'single_select' && (
                <div className="space-y-2 border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Opciones Configurables
                    </label>
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" /> Añadir Opción
                    </button>
                  </div>

                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {options.map((opt, idx) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <select
                          value={opt.color}
                          onChange={(e) => handleUpdateOption(idx, 'color', e.target.value)}
                          className="text-xs py-1.5 px-2 rounded border border-gray-200 bg-gray-50 focus:outline-none"
                        >
                          {COLOR_OPTIONS.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={opt.label}
                          onChange={(e) => handleUpdateOption(idx, 'label', e.target.value)}
                          className="flex-1 px-2.5 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {options.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(idx)}
                            className="text-gray-400 hover:text-rose-500 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {type === 'formula' && (
                <FormulaEditor
                  formula={formula}
                  onChangeFormula={setFormula}
                  existingColumns={existingColumns}
                  lang={lang}
                />
              )}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
            >
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
