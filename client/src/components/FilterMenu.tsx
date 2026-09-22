import React, { useEffect, useRef } from 'react';
import { Filter, Plus, Trash2, X } from 'lucide-react';
import type { CustomColumn, FilterCondition, FilterConjunction, FilterOperator, JiraIssue } from '../types';
import type { Language } from '../utils/i18n';
import { getTranslation } from '../utils/i18n';
import {
  getAllFilterableFields,
  getAvailableOperators,
  getFieldCategory,
  getFieldSelectOptions,
} from '../utils/filterEvaluator';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  conditions: FilterCondition[];
  onChangeConditions: (conditions: FilterCondition[]) => void;
  conjunction: FilterConjunction;
  onChangeConjunction: (conjunction: FilterConjunction) => void;
  columns: CustomColumn[];
  issues: JiraIssue[];
  matchingCount: number;
  totalCount: number;
  lang: Language;
}

export const FilterMenu: React.FC<Props> = ({
  isOpen,
  onClose,
  conditions,
  onChangeConditions,
  conjunction,
  onChangeConjunction,
  columns,
  issues,
  matchingCount,
  totalCount,
  lang,
}) => {
  const t = getTranslation(lang);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const allFields = getAllFilterableFields(columns);
  const builtinFields = allFields.filter((f) => !f.isCustom);
  const customFields = allFields.filter((f) => f.isCustom);

  const handleAddCondition = () => {
    const defaultField = 'summary';
    const newCondition: FilterCondition = {
      id: `filter-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      fieldId: defaultField,
      operator: 'contains',
      value: '',
    };
    onChangeConditions([...conditions, newCondition]);
  };

  const handleRemoveCondition = (id: string) => {
    onChangeConditions(conditions.filter((c) => c.id !== id));
  };

  const handleUpdateCondition = (id: string, updates: Partial<FilterCondition>) => {
    onChangeConditions(
      conditions.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, ...updates };

        // If fieldId changed, reset operator to valid operator for that field
        if (updates.fieldId && updates.fieldId !== c.fieldId) {
          const category = getFieldCategory(updates.fieldId, columns);
          const validOps = getAvailableOperators(category);
          updated.operator = validOps[0] || 'equals';
          updated.value = '';
        }

        return updated;
      })
    );
  };

  const handleClearAll = () => {
    onChangeConditions([]);
  };

  const getOperatorLabel = (op: FilterOperator): string => {
    switch (op) {
      case 'contains':
        return t.op_contains;
      case 'not_contains':
        return t.op_not_contains;
      case 'equals':
        return t.op_equals;
      case 'not_equals':
        return t.op_not_equals;
      case 'starts_with':
        return t.op_starts_with;
      case 'ends_with':
        return t.op_ends_with;
      case 'is_empty':
        return t.op_is_empty;
      case 'is_not_empty':
        return t.op_is_not_empty;
      case 'gt':
        return t.op_gt;
      case 'gte':
        return t.op_gte;
      case 'lt':
        return t.op_lt;
      case 'lte':
        return t.op_lte;
      case 'is_before':
        return t.op_is_before;
      case 'is_after':
        return t.op_is_after;
      case 'is_today':
        return t.op_is_today;
      default:
        return op;
    }
  };

  return (
    <div
      ref={menuRef}
      className="absolute left-0 sm:left-auto top-full mt-2 w-[calc(100vw-2rem)] sm:w-[620px] max-w-[620px] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col overflow-hidden text-gray-800"
      style={{ maxHeight: 'calc(100vh - 120px)' }}
    >
      {/* Top Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Filter className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-gray-800 tracking-tight">{t.filter_menu_title}</span>
          {conditions.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              {conditions.length} {t.filters_applied}
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Conjunction Selector (Where all/any are true) */}
      {conditions.length > 1 && (
        <div className="px-4 py-2 bg-emerald-50/50 border-b border-emerald-100/60 flex items-center justify-between text-xs">
          <span className="text-gray-600 font-medium">{t.filter_in_this_view}</span>
          <div className="inline-flex rounded-lg border border-emerald-300 bg-white p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => onChangeConjunction('and')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                conjunction === 'and'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-emerald-700'
              }`}
            >
              {lang === 'es' ? 'Todas (Y / AND)' : 'All (AND)'}
            </button>
            <button
              type="button"
              onClick={() => onChangeConjunction('or')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                conjunction === 'or'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-emerald-700'
              }`}
            >
              {lang === 'es' ? 'Cualquiera (O / OR)' : 'Any (OR)'}
            </button>
          </div>
        </div>
      )}

      {/* Conditions List */}
      <div className="p-4 overflow-y-auto max-h-[380px] space-y-2.5">
        {conditions.length === 0 ? (
          <div className="py-6 px-4 text-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50">
            <Filter className="w-6 h-6 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-500 mb-3">{t.no_filter_conditions}</p>
            <button
              type="button"
              onClick={handleAddCondition}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.add_condition_btn}</span>
            </button>
          </div>
        ) : (
          conditions.map((condition, idx) => {
            const isFirst = idx === 0;
            const fieldCategory = getFieldCategory(condition.fieldId, columns);
            const availableOps = getAvailableOperators(fieldCategory);
            const selectOptions = getFieldSelectOptions(condition.fieldId, columns, issues);
            const isNoValueOperator =
              condition.operator === 'is_empty' ||
              condition.operator === 'is_not_empty' ||
              condition.operator === 'is_today';

            return (
              <div
                key={condition.id}
                className="flex items-center gap-2 p-2 bg-gray-50/70 hover:bg-gray-100/60 rounded-xl border border-gray-200 transition-colors"
              >
                {/* Prefix Label (Where / And / Or) */}
                <div className="w-14 shrink-0 text-right">
                  {isFirst ? (
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      {t.conjunction_where}
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded uppercase tracking-wider">
                      {conjunction === 'and' ? t.conjunction_and : t.conjunction_or}
                    </span>
                  )}
                </div>

                {/* Field Selector */}
                <select
                  value={condition.fieldId}
                  onChange={(e) => handleUpdateCondition(condition.id, { fieldId: e.target.value })}
                  className="text-xs font-semibold text-gray-800 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44 shrink-0 transition-colors cursor-pointer"
                >
                  <optgroup label={t.filter_fields_jira}>
                    {builtinFields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </optgroup>
                  {customFields.length > 0 && (
                    <optgroup label={t.filter_fields_custom}>
                      {customFields.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {/* Operator Selector */}
                <select
                  value={condition.operator}
                  onChange={(e) =>
                    handleUpdateCondition(condition.id, { operator: e.target.value as FilterOperator })
                  }
                  className="text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-36 shrink-0 transition-colors cursor-pointer"
                >
                  {availableOps.map((op) => (
                    <option key={op} value={op}>
                      {getOperatorLabel(op)}
                    </option>
                  ))}
                </select>

                {/* Value Input */}
                <div className="flex-1 min-w-0">
                  {isNoValueOperator ? (
                    <div className="text-[11px] text-gray-400 italic px-2 py-1.5 bg-gray-100/60 rounded-lg border border-gray-200/50">
                      {lang === 'es' ? 'Condición sin valor' : 'No value needed'}
                    </div>
                  ) : selectOptions.length > 0 ? (
                    <select
                      value={condition.value}
                      onChange={(e) => handleUpdateCondition(condition.id, { value: e.target.value })}
                      className="w-full text-xs font-medium text-gray-800 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="">{t.select_option_placeholder}</option>
                      {selectOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : fieldCategory === 'date' ? (
                    <input
                      type="date"
                      value={condition.value}
                      onChange={(e) => handleUpdateCondition(condition.id, { value: e.target.value })}
                      className="w-full text-xs text-gray-800 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : fieldCategory === 'number' ? (
                    <input
                      type="number"
                      placeholder="0"
                      value={condition.value}
                      onChange={(e) => handleUpdateCondition(condition.id, { value: e.target.value })}
                      className="w-full text-xs text-gray-800 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder={t.filter_value_placeholder}
                      value={condition.value}
                      onChange={(e) => handleUpdateCondition(condition.id, { value: e.target.value })}
                      className="w-full text-xs text-gray-800 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>

                {/* Delete Condition Button */}
                <button
                  type="button"
                  onClick={() => handleRemoveCondition(condition.id)}
                  title={t.filter_remove_condition}
                  className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleAddCondition}
            className="flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.add_condition_btn}</span>
          </button>

          {conditions.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-gray-500 hover:text-rose-600 transition-colors cursor-pointer"
            >
              {t.clear_all_filters}
            </button>
          )}
        </div>

        {/* Real-time Matching count indicator */}
        <div className="text-[11px] font-medium text-gray-500">
          {lang === 'es' ? (
            <span>
              Mostrando <strong className="text-gray-800">{matchingCount}</strong> de {totalCount} incidencias
            </span>
          ) : (
            <span>
              Showing <strong className="text-gray-800">{matchingCount}</strong> of {totalCount} issues
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
