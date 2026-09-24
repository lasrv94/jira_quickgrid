import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, Code, HelpCircle, Sliders, Sparkles } from 'lucide-react';
import type { CustomColumn } from '../types';
import type { Language } from '../utils/i18n';
import { getTranslation } from '../utils/i18n';
import { buildIfFormula, validateFormula } from '../utils/formulaEvaluator';

interface FormulaEditorProps {
  formula: string;
  onChangeFormula: (newFormula: string) => void;
  existingColumns?: CustomColumn[];
  lang?: Language;
}

export const FormulaEditor: React.FC<FormulaEditorProps> = ({
  formula,
  onChangeFormula,
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
  const [isManual, setIsManual] = useState(false);

  // Initialize or update visual formula if not manual
  useEffect(() => {
    if (!formula && !isManual) {
      const initial = buildIfFormula(ifField, ifOperator, ifValue, ifTrueVal, ifFalseVal);
      onChangeFormula(initial);
    }
  }, [formula, isManual, ifField, ifOperator, ifValue, ifTrueVal, ifFalseVal, onChangeFormula]);

  const handleVisualChange = (
    field: string,
    op: string,
    val: string,
    trueV: string,
    falseV: string
  ) => {
    setIfField(field);
    setIfOperator(op);
    setIfValue(val);
    setIfTrueVal(trueV);
    setIfFalseVal(falseV);

    const generated = buildIfFormula(field, op, val, trueV, falseV);
    onChangeFormula(generated);
  };

  const validation = validateFormula(formula);

  const presets = [
    {
      label: isEs ? 'Prioridad es Alta -> 1 o 0' : 'Priority is High -> 1 or 0',
      formula: 'IF({priority} = "High", 1, 0)',
    },
    {
      label: isEs ? 'Estado es Done -> 1 o 0' : 'Status is Done -> 1 or 0',
      formula: 'IF({jira_status} = "Done", 1, 0)',
    },
    {
      label: isEs ? 'Sin Asignar -> "Alerta", "OK"' : 'Unassigned -> "Alert", "OK"',
      formula: 'IF(IS_EMPTY({assignee}), "Alerta", "OK")',
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
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
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
        <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100 space-y-3 text-xs">
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

          {/* Row 3: Output Values (True / False) */}
          <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-indigo-100">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-1">
                {t.formula_then_val}
              </label>
              <input
                type="text"
                value={ifTrueVal}
                placeholder="1"
                onChange={(e) =>
                  handleVisualChange(ifField, ifOperator, ifValue, e.target.value, ifFalseVal)
                }
                className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-emerald-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-emerald-900"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                {t.formula_else_val}
              </label>
              <input
                type="text"
                value={ifFalseVal}
                placeholder="0"
                onChange={(e) =>
                  handleVisualChange(ifField, ifOperator, ifValue, ifTrueVal, e.target.value)
                }
                className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400 text-gray-700"
              />
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
              placeholder='IF({priority} = "High", 1, 0)'
              className="w-full p-2.5 font-mono text-xs text-indigo-950 bg-slate-50 border border-indigo-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white resize-none"
            />
          </div>
          <div className="flex items-center gap-1 text-[11px] text-gray-500">
            <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
            <span>
              {isEs
                ? 'Soporta IF(condición, verdadero, falso), IS_EMPTY(), NOT_EMPTY(), CONTAINS, =, !=, >, <, +, -, *, /'
                : 'Supports IF(condition, true, false), IS_EMPTY(), NOT_EMPTY(), CONTAINS, =, !=, >, <, +, -, *, /'}
            </span>
          </div>
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
                setIsManual(true);
              }}
              className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
