import React, { useState } from 'react';
import {
  ArrowDownUp,
  Check,
  ChevronDown,
  Columns,
  FileDown,
  Filter,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { CustomColumn, FilterCondition, FilterConjunction, JiraFilter, JiraIssue } from '../types';
import type { Language } from '../utils/i18n';
import { getTranslation } from '../utils/i18n';
import { FilterMenu } from './FilterMenu';

interface Props {
  filters: JiraFilter[];
  selectedFilterId?: string;
  onSelectFilter: (filterId: string) => void;
  onSync: () => Promise<void>;
  syncing: boolean;
  lastSync?: string;
  columns: CustomColumn[];
  onToggleColumnVisibility: (colId: string) => void;
  onOpenManageFields?: () => void;
  onOpenAddColumn: () => void;
  onOpenSettings: () => void;
  onExportPdf?: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  groupBy: string | null;
  onGroupByChange: (field: string | null) => void;
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  onSortChange: (field: string | null, dir: 'asc' | 'desc') => void;
  filterConditions: FilterCondition[];
  onFilterConditionsChange: (conditions: FilterCondition[]) => void;
  filterConjunction: FilterConjunction;
  onFilterConjunctionChange: (conjunction: FilterConjunction) => void;
  issues: JiraIssue[];
  matchingCount: number;
  totalCount: number;
  lang: Language;
}

export const Toolbar: React.FC<Props> = ({
  filters,
  selectedFilterId,
  onSelectFilter,
  onSync,
  syncing,
  lastSync,
  columns,
  onToggleColumnVisibility,
  onOpenManageFields,
  onOpenAddColumn,
  onOpenSettings,
  onExportPdf,
  searchQuery,
  onSearchChange,
  groupBy,
  onGroupByChange,
  sortField,
  sortDirection,
  onSortChange,
  filterConditions,
  onFilterConditionsChange,
  filterConjunction,
  onFilterConjunctionChange,
  issues,
  matchingCount,
  totalCount,
  lang,
}) => {
  const t = getTranslation(lang);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const formatLastSync = (iso?: string) => {
    if (!iso) return lang === 'es' ? 'No sincronizado' : 'Not synced';
    const date = new Date(iso);
    const diffMin = Math.round((Date.now() - date.getTime()) / 60000);
    if (diffMin <= 1) return lang === 'es' ? 'hace un momento' : 'just now';
    if (diffMin < 60) return lang === 'es' ? `hace ${diffMin} min` : `${diffMin}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-xs select-none shrink-0">
      {/* Left controls: Jira Filter & Sync */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Jira Filter Selector */}
        <div className="relative">
          <select
            value={selectedFilterId || ''}
            onChange={(e) => onSelectFilter(e.target.value)}
            className="text-xs font-medium text-gray-800 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer max-w-xs transition-colors pr-7 appearance-none"
          >
            {filters.map((f) => (
              <option key={f.id} value={f.id}>
                📁 {f.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Sync Button */}
        <button
          onClick={onSync}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? t.syncing_btn : t.sync_btn}</span>
        </button>

        <span className="text-[11px] text-gray-400 hidden sm:inline">
          {t.sync_label}: <strong className="text-gray-600 font-medium">{formatLastSync(lastSync)}</strong>
        </span>
      </div>

      {/* Middle & Right tools: Search, Sort, Group, Columns, Settings */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t.search_placeholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="text-xs pl-8 pr-3 py-1.5 bg-gray-50 hover:bg-gray-100/80 focus:bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-36 sm:w-48 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Smart Multi-field Filter Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            title={lang === 'es' ? 'Filtrar por uno o varios campos' : 'Filter by one or multiple fields'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
              filterConditions.length > 0
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-semibold shadow-2xs'
                : 'border-gray-200 hover:bg-gray-50 text-gray-700'
            }`}
          >
            <Filter className={`w-3.5 h-3.5 ${filterConditions.length > 0 ? 'text-emerald-600' : 'text-gray-500'}`} />
            <span>{t.filter_btn}</span>
            {filterConditions.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded-full text-[10px] font-bold">
                {filterConditions.length}
              </span>
            )}
          </button>

          <FilterMenu
            isOpen={showFilterMenu}
            onClose={() => setShowFilterMenu(false)}
            conditions={filterConditions}
            onChangeConditions={onFilterConditionsChange}
            conjunction={filterConjunction}
            onChangeConjunction={onFilterConjunctionChange}
            columns={columns}
            issues={issues}
            matchingCount={matchingCount}
            totalCount={totalCount}
            lang={lang}
          />
        </div>

        {/* Sort Menu */}
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              sortField ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50 text-gray-700'
            }`}
          >
            <ArrowDownUp className="w-3.5 h-3.5" />
            <span>{t.sort_btn}</span>
            {sortField && (
              <span className="ml-0.5 px-1 py-0.2 bg-blue-200 text-blue-800 rounded-sm text-[10px]">
                {sortDirection.toUpperCase()}
              </span>
            )}
          </button>

          {showSortMenu && (
            <div className="absolute right-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-40 animate-in fade-in zoom-in-95">
              <div className="px-3 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                {t.sort_by}
              </div>
              <button
                onClick={() => {
                  onSortChange(null, 'asc');
                  setShowSortMenu(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-50 ${
                  !sortField ? 'font-semibold text-blue-600' : 'text-gray-700'
                }`}
              >
                <span>{t.clear_sort}</span>
                {!sortField && <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => {
                  onSortChange('priority', sortDirection === 'asc' ? 'desc' : 'asc');
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-50 text-gray-700"
              >
                <span>{t.group_priority}</span>
                {sortField === 'priority' && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
              <button
                onClick={() => {
                  onSortChange('jira_status', sortDirection === 'asc' ? 'desc' : 'asc');
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-50 text-gray-700"
              >
                <span>{t.group_status}</span>
                {sortField === 'jira_status' && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
              <button
                onClick={() => {
                  onSortChange('key', sortDirection === 'asc' ? 'desc' : 'asc');
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-50 text-gray-700"
              >
                <span>{t.col_key}</span>
                {sortField === 'key' && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
            </div>
          )}
        </div>

        {/* Group By Menu */}
        <div className="relative">
          <button
            onClick={() => setShowGroupMenu(!showGroupMenu)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              groupBy ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 hover:bg-gray-50 text-gray-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t.group_btn}</span>
            {groupBy && <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />}
          </button>

          {showGroupMenu && (
            <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-40 animate-in fade-in zoom-in-95">
              <div className="px-3 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                {t.group_by_label}
              </div>
              <button
                onClick={() => {
                  onGroupByChange(null);
                  setShowGroupMenu(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-50 ${
                  !groupBy ? 'font-semibold text-purple-600' : 'text-gray-700'
                }`}
              >
                <span>{t.no_group}</span>
                {!groupBy && <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => {
                  onGroupByChange('jira_status');
                  setShowGroupMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-50 text-gray-700"
              >
                <span>{t.group_status}</span>
                {groupBy === 'jira_status' && <Check className="w-3.5 h-3.5 text-purple-600" />}
              </button>
              <button
                onClick={() => {
                  onGroupByChange('priority');
                  setShowGroupMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-50 text-gray-700"
              >
                <span>{t.group_priority}</span>
                {groupBy === 'priority' && <Check className="w-3.5 h-3.5 text-purple-600" />}
              </button>
              <button
                onClick={() => {
                  onGroupByChange('assignee_name');
                  setShowGroupMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-50 text-gray-700"
              >
                <span>{t.group_assignee}</span>
                {groupBy === 'assignee_name' && <Check className="w-3.5 h-3.5 text-purple-600" />}
              </button>

              {/* Custom Single-Select Columns */}
              {columns
                .filter((c) => c.type === 'single_select')
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onGroupByChange(c.id);
                      setShowGroupMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-50 text-gray-700"
                  >
                    <span>{c.name} (Local)</span>
                    {groupBy === c.id && <Check className="w-3.5 h-3.5 text-purple-600" />}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Column Visibility Menu */}
        <div className="relative">
          <button
            onClick={() => setShowColumnsMenu(!showColumnsMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>{t.columns_btn}</span>
          </button>

          {showColumnsMenu && (
            <div className="absolute right-0 mt-1 w-60 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-40 max-h-72 overflow-y-auto animate-in fade-in zoom-in-95">
              <div className="px-3 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                {t.columns_visibility}
              </div>
              {columns.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-xs text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={c.is_visible}
                    onChange={() => onToggleColumnVisibility(c.id)}
                    className="rounded text-blue-600 focus:ring-0"
                  />
                  <span className="truncate">{c.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Manage Fields Button */}
        {onOpenManageFields && (
          <button
            onClick={onOpenManageFields}
            title={lang === 'es' ? 'Gestionar, Ocultar y Reacomodar Campos' : 'Manage, Hide & Reorder Fields'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 transition-colors shadow-2xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
            <span>{t.manage_fields_btn}</span>
            <span className="text-[10px] font-bold bg-indigo-200/80 text-indigo-800 rounded-full px-1.5 py-0.2">
              {columns.filter((c) => c.is_visible).length}/{columns.length}
            </span>
          </button>
        )}

        {/* Add Column Button */}
        <button
          onClick={onOpenAddColumn}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-blue-600" />
          <span>{t.add_column_btn}</span>
        </button>

        {/* PDF Export Button */}
        {onExportPdf && (
          <button
            onClick={onExportPdf}
            title={t.export_pdf}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 transition-colors border border-rose-200 shadow-2xs"
          >
            <FileDown className="w-3.5 h-3.5 text-rose-600" />
            <span>{t.export_pdf}</span>
          </button>
        )}

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          title={t.settings_tooltip}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors border border-gray-200"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
