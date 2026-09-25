import { useEffect, useState } from 'react';
import { Database, Link2, Plus, Search, Sparkles, Trash2, X } from 'lucide-react';
import { fetchJiraFields } from '../services/api';
import type { ColumnType, CustomColumn, JiraFieldInfo, JiraFilter, SelectOption } from '../types';
import { COLOR_OPTIONS } from '../utils/colors';
import type { Language } from '../utils/i18n';
import { FormulaEditor } from './FormulaEditor';
import { validateFormula } from '../utils/formulaEvaluator';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAddColumn: (col: Partial<CustomColumn>) => Promise<void>;
  existingColumns?: CustomColumn[];
  tables?: JiraFilter[];
  activeTableId?: string;
  lang?: Language;
}

export const AddColumnModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onAddColumn,
  existingColumns = [],
  tables = [],
  activeTableId,
  lang = 'es',
}) => {
  const [columnCategory, setColumnCategory] = useState<'local' | 'jira'>('local');
  const [name, setName] = useState('');
  const [type, setType] = useState<ColumnType>('single_select');
  const [formula, setFormula] = useState('IF({priority} = "High", 1, 0)');
  const [options, setOptions] = useState<SelectOption[]>([
    { id: 'opt-1', label: 'Opción 1', color: 'emerald' },
    { id: 'opt-2', label: 'Opción 2', color: 'amber' },
  ]);

  // Link to table state
  const [targetTableId, setTargetTableId] = useState<string>('');
  const [allowMultipleLinks, setAllowMultipleLinks] = useState(true);

  // Lookup state
  const [linkColumnId, setLinkColumnId] = useState<string>('');
  const [lookupFieldId, setLookupFieldId] = useState<string>('jira_status');

  const [jiraFieldKey, setJiraFieldKey] = useState('');
  const [jiraFields, setJiraFields] = useState<JiraFieldInfo[]>([]);
  const [jiraFieldSearch, setJiraFieldSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchJiraFields()
        .then((f) => setJiraFields(f))
        .catch((e) => console.error('Error fetching Jira fields:', e));

      // Default target table to first available table different from current or first
      const defaultTarget = tables.find((t) => t.id !== activeTableId) || tables[0];
      if (defaultTarget) setTargetTableId(defaultTarget.id);

      const linkCol = existingColumns.find((c) => c.type === 'link_row');
      if (linkCol) setLinkColumnId(linkCol.id);
    }
  }, [isOpen, tables, activeTableId, existingColumns]);

  if (!isOpen) return null;

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

  const handleSelectJiraField = (field: JiraFieldInfo) => {
    setJiraFieldKey(field.id);
    setName(field.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      if (columnCategory === 'jira') {
        await onAddColumn({
          name: name.trim(),
          type: 'jira_field',
          jira_field_key: jiraFieldKey || name.trim().toLowerCase(),
          is_visible: true,
          width: 170,
        });
      } else {
        let finalOptions: any = [];
        let finalFormula: string | undefined = undefined;

        if (type === 'formula') {
          const check = validateFormula(formula);
          if (!check.valid) {
            alert(`Error en la fórmula: ${check.error}`);
            setLoading(false);
            return;
          }
          finalFormula = formula.trim();
          finalOptions = options;
        } else if (type === 'single_select') {
          finalOptions = options;
        } else if (type === 'link_row') {
          const targetTbl = tables.find((t) => t.id === targetTableId) || tables[0];
          finalOptions = {
            target_table_id: targetTbl?.id || '',
            target_table_name: targetTbl?.name || '',
            allow_multiple: allowMultipleLinks,
          };
        } else if (type === 'lookup') {
          const targetLinkCol = existingColumns.find((c) => c.id === linkColumnId) || existingColumns.find((c) => c.type === 'link_row');
          finalOptions = {
            link_column_id: targetLinkCol?.id || '',
            lookup_field_id: lookupFieldId,
          };
        }

        await onAddColumn({
          name: name.trim(),
          type,
          options: finalOptions,
          formula: finalFormula,
          is_visible: true,
          width: type === 'long_text' ? 240 : type === 'formula' ? 140 : type === 'link_row' ? 200 : 170,
        });
      }
      setName('');
      setJiraFieldKey('');
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredJiraFields = jiraFields.filter(
    (f) =>
      f.name.toLowerCase().includes(jiraFieldSearch.toLowerCase()) ||
      f.id.toLowerCase().includes(jiraFieldSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <h3 className="font-semibold text-gray-800 text-base">Añadir Columna a la Tabla</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector: Campo Local vs Campo Nativo de Jira */}
        <div className="flex border-b border-gray-200 bg-gray-50/70 p-1.5 gap-1.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setColumnCategory('local')}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              columnCategory === 'local'
                ? 'bg-white text-blue-700 shadow-xs font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Campo Local (Personalizado)</span>
          </button>
          <button
            type="button"
            onClick={() => setColumnCategory('jira')}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              columnCategory === 'jira'
                ? 'bg-white text-blue-700 shadow-xs font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-blue-600" />
            <span>Campo de Jira (Field Selector)</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {columnCategory === 'jira' ? (
            /* Jira Field Selector Mode */
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                  Selecciona el Campo de Jira a Mostrar
                </label>
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filtrar campos (ej. labels, story points, due date)..."
                    value={jiraFieldSearch}
                    onChange={(e) => setJiraFieldSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 bg-gray-50/50">
                  {filteredJiraFields.length === 0 ? (
                    <div className="p-3 text-center text-xs text-gray-400">
                      No se encontraron campos de Jira.
                    </div>
                  ) : (
                    filteredJiraFields.map((f) => (
                      <div
                        key={f.id}
                        onClick={() => handleSelectJiraField(f)}
                        className={`p-2.5 flex items-center justify-between cursor-pointer hover:bg-blue-50 transition-colors text-xs ${
                          jiraFieldKey === f.id ? 'bg-blue-100/70 text-blue-900 font-semibold' : 'text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="truncate">{f.name}</span>
                          <code className="text-[10px] text-gray-400 font-mono">({f.id})</code>
                        </div>
                        <div className="flex items-center gap-1">
                          {f.custom && (
                            <span className="px-1.5 py-0.2 text-[9px] bg-purple-100 text-purple-700 rounded font-semibold">
                              Custom
                            </span>
                          )}
                          <span className="px-1.5 py-0.2 text-[9px] bg-gray-200 text-gray-600 rounded">
                            {f.type}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                  Nombre de la Columna en la Tabla
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nombre de la columna"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>
          ) : (
            /* Local Field Mode */
            <>
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
                  value={type}
                  onChange={(e) => setType(e.target.value as ColumnType)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="single_select">Selección Única (Color Pills)</option>
                  <option value="formula">Fórmula / Campo Calculado (fx)</option>
                  <option value="link_row">🔗 Registros Vinculados (Link to Table)</option>
                  <option value="lookup">🔍 Lookup (Consultar registro vinculado)</option>
                  <option value="text">Texto Corto</option>
                  <option value="long_text">Texto Largo / Notas (Multi-línea)</option>
                  <option value="number">Número</option>
                  <option value="date">Fecha</option>
                  <option value="archivy_link">Vínculo Archivy Wiki (Markdown Docs)</option>
                </select>
              </div>

              {type === 'link_row' && (
                <div className="space-y-3 border-t border-gray-100 pt-3 bg-blue-50/40 p-3 rounded-lg border border-blue-100">
                  <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <Link2 className="w-4 h-4 text-blue-600" />
                    <span>Configuración de Vínculo entre Tablas</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Tabla o Proyecto a Vincular:
                    </label>
                    <select
                      value={targetTableId}
                      onChange={(e) => setTargetTableId(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {tables.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.type === 'local' ? '📋 ' : '📁 '} {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={allowMultipleLinks}
                      onChange={(e) => setAllowMultipleLinks(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span>Permitir vincular múltiples registros por fila</span>
                  </label>
                </div>
              )}

              {type === 'lookup' && (
                <div className="space-y-3 border-t border-gray-100 pt-3 bg-purple-50/40 p-3 rounded-lg border border-purple-100">
                  <div className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-purple-600" />
                    <span>Configuración de Campo Lookup</span>
                  </div>

                  {existingColumns.filter((c) => c.type === 'link_row').length === 0 ? (
                    <div className="p-2.5 bg-amber-50 text-amber-800 rounded text-xs border border-amber-200">
                      ⚠️ Para usar Lookup, primero debes crear al menos una columna de tipo <strong>Registros Vinculados</strong> en esta tabla.
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          A través de la columna vinculada:
                        </label>
                        <select
                          value={linkColumnId}
                          onChange={(e) => setLinkColumnId(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          {existingColumns
                            .filter((c) => c.type === 'link_row')
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                🔗 {c.name}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Campo a consultar (Lookup):
                        </label>
                        <select
                          value={lookupFieldId}
                          onChange={(e) => setLookupFieldId(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="jira_status">Estado (Status)</option>
                          <option value="summary">Resumen / Título (Summary)</option>
                          <option value="priority">Prioridad (Priority)</option>
                          <option value="assignee_name">Asignado (Assignee)</option>
                          <option value="issue_type">Tipo (Type)</option>
                          <option value="key">Clave / ID</option>
                          {existingColumns
                            .filter((c) => c.type !== 'link_row' && c.type !== 'lookup')
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                🏷️ {c.name} (Campo local)
                              </option>
                            ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>
              )}

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
                  options={options}
                  onChangeOptions={setOptions}
                  existingColumns={existingColumns}
                  lang={lang}
                />
              )}
            </>
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
              {loading ? 'Creando...' : columnCategory === 'jira' ? 'Vincular Campo de Jira' : 'Crear Columna'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
