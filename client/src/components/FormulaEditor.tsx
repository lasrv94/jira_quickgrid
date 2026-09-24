import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, Code, HelpCircle, Palette, Plus, Sliders, Sparkles, Trash2 } from 'lucide-react';
import type { CustomColumn, SelectOption } from '../types';
import type { Language } from '../utils/i18n';
import { getTranslation } from '../utils/i18n';
import { buildIfFormula, parseIfFormula, validateFormula } from '../utils/formulaEvaluator';
import { COLOR_OPTIONS, getColorClasses } from '../utils/colors';

interface FormulaEditorProps {
  formula: string;
  onChangeFormula: (newFormula: string) => void;
  options?: SelectOption[];
  onChangeOptions?: (options: SelectOption[]) => void;
  existingColumns?: CustomColumn[];
  lang?: Language;
}

export const FormulaEditor: React.FC<FormulaEditorProps> = ({
  formula,
  onChangeFormula,
  options = [],
  onChangeOptions,
  existingColumns = [],
  lang = 'es',
}) => {
  const t = getTranslation(lang);
  const isEs = lang === 'es';

  // Visual builder state
  const [ifField, setIfField] = useState('priority');
  const [ifOperator, setIfOperator] = useState('=');
  const [ifValue, setIfValue] = useState('High');
  const [ifTrueVal, setIfTrueVal] = useState('1');
  const [ifFalseVal, setIfFalseVal] = useState('0');
  const [trueColor, setTrueColor] = useState('emerald');
  const [falseColor, setFalseColor] = useState('slate');
  const [isManual, setIsManual] = useState(false);
  const [showColorManager, setShowColorManager] = useState(false);

  // Parse existing formula into visual builder fields on mount or when formula changes
  useEffect(() => {
    if (formula && formula.trim()) {
      const parsed = parseIfFormula(formula);
      if (parsed.isSimpleIf) {
        if (parsed.field) setIfField(parsed.field);
        if (parsed.operator) setIfOperator(parsed.operator);
        if (parsed.compareValue !== undefined) setIfValue(parsed.compareValue);
        if (parsed.trueVal !== undefined) setIfTrueVal(parsed.trueVal);
        if (parsed.falseVal !== undefined) setIfFalseVal(parsed.falseVal);
        setIsManual(false);

        // Sync colors from options if available
        if (options && options.length > 0) {
          const matchT = options.find(
            (o) => o.label.toLowerCase() === (parsed.trueVal || '').toLowerCase()
          );
          if (matchT) setTrueColor(matchT.color);

          const matchF = options.find(
            (o) => o.label.toLowerCase() === (parsed.falseVal || '').toLowerCase()
          );
          if (matchF) setFalseColor(matchF.color);
        }
      } else {
        setIsManual(true);
      }
    } else {
      // Default formula if empty
      const initial = buildIfFormula(ifField, ifOperator, ifValue, ifTrueVal, ifFalseVal);
      onChangeFormula(initial);
      syncOptions(ifTrueVal, trueColor, ifFalseVal, falseColor);
    }
  }, [formula]);

  const syncOptions = (tVal: string, tColor: string, fVal: string, fColor: string) => {
    if (!onChangeOptions) return;
    const current = [...options];

    // Update or add True option
    const idxT = current.findIndex(
      (o) => o.id === 'opt-true' || o.label.toLowerCase() === tVal.toLowerCase()
    );
    if (idxT >= 0) {
      current[idxT] = { ...current[idxT], label: tVal, color: tColor };
    } else {
      current.push({ id: 'opt-true', label: tVal, color: tColor });
    }

    // Update or add False option
    const idxF = current.findIndex(
      (o) => o.id === 'opt-false' || (o.id !== 'opt-true' && o.label.toLowerCase() === fVal.toLowerCase())
    );
    if (idxF >= 0) {
      current[idxF] = { ...current[idxF], label: fVal, color: fColor };
    } else {
      current.push({ id: 'opt-false', label: fVal, color: fColor });
    }

    onChangeOptions(current);
  };

  const handleVisualChange = (
    field: string,
    op: string,
    val: string,
    trueV: string,
    falseV: string,
    tColor: string = trueColor,
    fColor: string = falseColor
  ) => {
    setIfField(field);
    setIfOperator(op);
    setIfValue(val);
    setIfTrueVal(trueV);
    setIfFalseVal(falseV);
    setTrueColor(tColor);
    setFalseColor(fColor);

    const generated = buildIfFormula(field, op, val, trueV, falseV);
    onChangeFormula(generated);
    syncOptions(trueV, tColor, falseV, fColor);
  };

  const handleAddCustomColorOption = () => {
    if (!onChangeOptions) return;
    const newId = `opt-${Date.now()}`;
    const nextColor = COLOR_OPTIONS[options.length % COLOR_OPTIONS.length].id;
    onChangeOptions([
      ...options,
      { id: newId, label: isEs ? 'Nuevo Resultado' : 'New Result', color: nextColor },
    ]);
  };

  const handleUpdateOption = (index: number, field: 'label' | 'color', val: string) => {
    if (!onChangeOptions) return;
    const next = [...options];
    next[index] = { ...next[index], [field]: val };
    onChangeOptions(next);
  };

  const handleRemoveOption = (index: number) => {
    if (!onChangeOptions) return;
    onChangeOptions(options.filter((_, i) => i !== index));
  };

  const validation = validateFormula(formula);

  const presets = [
    {
      label: isEs ? 'Prioridad es Alta -> "Urgente", "Normal"' : 'Priority is High -> "Urgent", "Normal"',
      formula: 'IF({priority} = "High", "Urgente", "Normal")',
      trueVal: 'Urgente',
      trueColor: 'rose',
      falseVal: 'Normal',
      falseColor: 'slate',
    },
    {
      label: isEs ? 'Estado es Done -> "Completado", "Pendiente"' : 'Status is Done -> "Completed", "Pending"',
      formula: 'IF({jira_status} = "Done", "Completado", "Pendiente")',
      trueVal: 'Completado',
      trueColor: 'emerald',
      falseVal: 'Pendiente',
      falseColor: 'amber',
    },
    {
      label: isEs ? 'Conteo Binario -> 1, 0' : 'Binary Count -> 1, 0',
      formula: 'IF({priority} = "High", 1, 0)',
      trueVal: '1',
      trueColor: 'emerald',
      falseVal: '0',
      falseColor: 'slate',
    },
    {
      label: isEs ? 'Sin Asignar -> "Alerta", "Asignado"' : 'Unassigned -> "Alert", "Assigned"',
      formula: 'IF(IS_EMPTY({assignee}), "Alerta", "Asignado")',
      trueVal: 'Alerta',
      trueColor: 'rose',
      falseVal: 'Asignado',
      falseColor: 'sky',
    },
  ];

  const standardFields = [
    { id: 'priority', name: isEs ? 'Prioridad (Jira)' : 'Priority (Jira)' },
    { id: 'jira_status', name: isEs ? 'Estado (Jira)' : 'Status (Jira)' },
    { id: 'summary', name: isEs ? 'Título (Jira)' : 'Summary (Jira)' },
    { id: 'assignee', name: isEs ? 'Asignado (Jira)' : 'Assignee (Jira)' },
    { id: 'issue_type', name: isEs ? 'Tipo de ticket (Jira)' : 'Issue Type (Jira)' },
    { id: 'key', name: isEs ? 'Clave (Jira)' : 'Key (Jira)' },
  ];

  const customCols = existingColumns.filter((c) => c.type !== 'formula');

  const operators = [
    { value: '=', label: isEs ? 'es igual a (=)' : 'equals (=)' },
    { value: '!=', label: isEs ? 'no es igual a (!=)' : 'not equal (!=)' },
    { value: 'CONTAINS', label: isEs ? 'contiene texto (CONTAINS)' : 'contains (CONTAINS)' },
    { value: '>', label: isEs ? 'mayor que (>)' : 'greater than (>)' },
    { value: '<', label: isEs ? 'menor que (<)' : 'less than (<)' },
    { value: '>=', label: isEs ? 'mayor o igual (>=)' : 'greater or equal (>=)' },
    { value: '<=', label: isEs ? 'menor o igual (<=)' : 'less or equal (<=)' },
    { value: 'IS_EMPTY', label: isEs ? 'está vacío (IS_EMPTY)' : 'is empty (IS_EMPTY)' },
    { value: 'NOT_EMPTY', label: isEs ? 'no está vacío (NOT_EMPTY)' : 'not empty (NOT_EMPTY)' },
  ];

  const noValueNeeded = ifOperator === 'IS_EMPTY' || ifOperator === 'NOT_EMPTY';

  return (
    <div className="space-y-3.5 border-t border-gray-100 pt-3">
      {/* Header and Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>{t.formula_builder_title}</span>
        </div>
        <button
          type="button"
          onClick={() => setIsManual(!isManual)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
        >
          {isManual ? (
            <>
              <Sliders className="w-3 h-3" />
              <span>{isEs ? 'Cambiar a Constructor Visual' : 'Switch to Visual Builder'}</span>
            </>
          ) : (
            <>
              <Code className="w-3 h-3" />
              <span>{t.formula_manual_edit}</span>
            </>
          )}
        </button>
      </div>

      {/* Visual Condition Builder */}
      {!isManual ? (
        <div className="bg-indigo-50/50 rounded-xl p-3.5 border border-indigo-100 space-y-3 text-xs">
          {/* Row 1: Field and Operator */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-950 mb-1">
                {t.formula_if_field}
              </label>
              <select
                value={ifField}
                onChange={(e) =>
                  handleVisualChange(e.target.value, ifOperator, ifValue, ifTrueVal, ifFalseVal)
                }
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-indigo-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-gray-800"
              >
                <optgroup label={isEs ? 'Campos Estándar de Jira' : 'Standard Jira Fields'}>
                  {standardFields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </optgroup>
                {customCols.length > 0 && (
                  <optgroup label={isEs ? 'Columnas Personalizadas' : 'Custom Columns'}>
                    {customCols.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-950 mb-1">
                {t.formula_operator}
              </label>
              <select
                value={ifOperator}
                onChange={(e) =>
                  handleVisualChange(ifField, e.target.value, ifValue, ifTrueVal, ifFalseVal)
                }
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-indigo-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-gray-800"
              >
                {operators.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Value to compare */}
          {!noValueNeeded && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-950 mb-1">
                {t.formula_compare_val}
              </label>
              <input
                type="text"
                value={ifValue}
                placeholder={isEs ? 'Ej: High, Done, 10, Bug...' : 'e.g. High, Done, 10, Bug...'}
                onChange={(e) =>
                  handleVisualChange(ifField, ifOperator, e.target.value, ifTrueVal, ifFalseVal)
                }
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-indigo-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-800"
              />
            </div>
          )}

          {/* Row 3: Output Values and Interactive Color Pills (True / False) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-indigo-100">
            {/* Card Si es Verdadero */}
            <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>{t.formula_then_val}</span>
                </label>
                {/* Live Badge Preview */}
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shadow-2xs ${getColorClasses(
                    trueColor
                  )}`}
                >
                  {ifTrueVal || '(vacío)'}
                </span>
              </div>

              <input
                type="text"
                value={ifTrueVal}
                placeholder="Ej: Aprobado, 1, Urgente"
                onChange={(e) =>
                  handleVisualChange(
                    ifField,
                    ifOperator,
                    ifValue,
                    e.target.value,
                    ifFalseVal,
                    trueColor,
                    falseColor
                  )
                }
                className="w-full px-2.5 py-1 text-xs font-semibold rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900"
              />

              {/* Color Selector Pills */}
              <div>
                <span className="text-[10px] font-semibold text-gray-500 block mb-1">
                  {isEs ? 'Color de la píldora (Pill):' : 'Pill Badge Color:'}
                </span>
                <div className="flex items-center gap-1 flex-wrap">
                  {COLOR_OPTIONS.map((c) => {
                    const isSelected = trueColor === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setTrueColor(c.id);
                          syncOptions(ifTrueVal, c.id, ifFalseVal, falseColor);
                        }}
                        title={c.label}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? `${c.bg} ${c.text} ${c.border} ring-2 ring-indigo-500 ring-offset-1 font-bold`
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                        <span>{c.label.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Card Si es Falso */}
            <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                  <span>{t.formula_else_val}</span>
                </label>
                {/* Live Badge Preview */}
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shadow-2xs ${getColorClasses(
                    falseColor
                  )}`}
                >
                  {ifFalseVal || '(vacío)'}
                </span>
              </div>

              <input
                type="text"
                value={ifFalseVal}
                placeholder="Ej: Rechazado, 0, Normal"
                onChange={(e) =>
                  handleVisualChange(
                    ifField,
                    ifOperator,
                    ifValue,
                    ifTrueVal,
                    e.target.value,
                    trueColor,
                    falseColor
                  )
                }
                className="w-full px-2.5 py-1 text-xs font-semibold rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900"
              />

              {/* Color Selector Pills */}
              <div>
                <span className="text-[10px] font-semibold text-gray-500 block mb-1">
                  {isEs ? 'Color de la píldora (Pill):' : 'Pill Badge Color:'}
                </span>
                <div className="flex items-center gap-1 flex-wrap">
                  {COLOR_OPTIONS.map((c) => {
                    const isSelected = falseColor === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setFalseColor(c.id);
                          syncOptions(ifTrueVal, trueColor, ifFalseVal, c.id);
                        }}
                        title={c.label}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? `${c.bg} ${c.text} ${c.border} ring-2 ring-indigo-500 ring-offset-1 font-bold`
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                        <span>{c.label.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Manual Formula Editor Mode */
        <div className="space-y-2">
          <div className="relative">
            <textarea
              rows={3}
              value={formula}
              onChange={(e) => onChangeFormula(e.target.value)}
              placeholder='IF({priority} = "High", "Urgente", "Normal")'
              className="w-full p-2.5 font-mono text-xs text-indigo-950 bg-slate-50 border border-indigo-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white resize-none"
            />
          </div>
          <div className="flex items-center gap-1 text-[11px] text-gray-500">
            <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
            <span>
              {isEs
                ? 'Soporta IF(cond, val_si, val_no), IFS(), SWITCH(), IS_EMPTY(), CONCAT(), =, !=, >, <, +, -, *, /'
                : 'Supports IF(cond, true_val, false_val), IFS(), SWITCH(), IS_EMPTY(), CONCAT(), =, !=, >, <, +, -, *, /'}
            </span>
          </div>
        </div>
      )}

      {/* Advanced Result Colors Palette / Manager */}
      {onChangeOptions && (
        <div className="border border-indigo-100 rounded-xl bg-slate-50/70 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowColorManager(!showColorManager)}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-800 uppercase tracking-wider hover:text-indigo-600 transition-colors cursor-pointer"
            >
              <Palette className="w-3.5 h-3.5 text-indigo-600" />
              <span>{isEs ? 'Paleta de Reglas de Color' : 'Custom Result Color Rules'}</span>
              <span className="text-[10px] text-indigo-600 font-normal">
                ({options.length} {isEs ? 'reglas' : 'rules'})
              </span>
            </button>
            <button
              type="button"
              onClick={handleAddCustomColorOption}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isEs ? '+ Añadir Color' : '+ Add Color'}</span>
            </button>
          </div>

          {showColorManager && (
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {options.map((opt, idx) => (
                <div key={opt.id || idx} className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-gray-200">
                  <select
                    value={opt.color}
                    onChange={(e) => handleUpdateOption(idx, 'color', e.target.value)}
                    className="text-xs py-1 px-2 rounded border border-gray-200 bg-gray-50 focus:outline-none"
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
                    placeholder={isEs ? 'Valor de resultado (ej. 1, Aprobado)' : 'Result value (e.g. 1, Approved)'}
                    onChange={(e) => handleUpdateOption(idx, 'label', e.target.value)}
                    className="flex-1 px-2 py-0.5 text-xs font-medium rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {options.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="text-gray-400 hover:text-rose-500 p-1 rounded hover:bg-gray-100 transition-colors"
                      title={isEs ? 'Eliminar regla' : 'Remove rule'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Formula Expression Preview & Live Validation */}
      <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-gray-600 uppercase tracking-wider text-[10px]">
            {t.formula_preview_label}
          </span>
          {validation.valid ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 text-[10px] font-bold">
              <Check className="w-3 h-3" />
              <span>{t.formula_syntax_valid}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-rose-600 text-[10px] font-bold">
              <AlertCircle className="w-3 h-3" />
              <span>{validation.error || t.formula_syntax_invalid}</span>
            </span>
          )}
        </div>
        <div className="font-mono text-xs text-indigo-900 bg-white px-2.5 py-1.5 rounded border border-gray-200 overflow-x-auto select-all">
          {formula || <span className="text-gray-400 italic font-sans">{isEs ? '(sin fórmula definida)' : '(no formula defined)'}</span>}
        </div>
      </div>

      {/* Quick Presets */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
          {t.formula_quick_examples}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onChangeFormula(p.formula);
                setIfTrueVal(p.trueVal);
                setIfFalseVal(p.falseVal);
                setTrueColor(p.trueColor);
                setFalseColor(p.falseColor);
                syncOptions(p.trueVal, p.trueColor, p.falseVal, p.falseColor);
              }}
              className="text-[10px] px-2.5 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer font-medium"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
