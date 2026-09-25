import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowDownUp,
  Check,
  Columns,
  FileDown,
  Filter,
  Layers,
  PanelLeft,
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
  filters?: JiraFilter[];
  selectedFilterId?: string;
  onSelectFilter?: (filterId: string) => void;
  onSync: () => Promise<void>;
  syncing: boolean;
  lastSync?: string;
  isLocalTable?: boolean;
  onAddRow?: () => void;
  isViewsSidebarOpen?: boolean;
  onToggleViewsSidebar?: () => void;
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
  filters: _filters = [],
  selectedFilterId: _selectedFilterId,
  onSelectFilter: _onSelectFilter,
  onSync,
  syncing,
  lastSync,
  isLocalTable = false,
  onAddRow,
  isViewsSidebarOpen = true,
  onToggleViewsSidebar,
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
  type ActiveMenu = 'filter' | 'sort' | 'group' | 'columns' | null;
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>(null);

  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeMenu) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenu(null);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (activeMenu === 'filter' && filterRef.current && !filterRef.current.contains(target)) {
        setActiveMenu(null);
      } else if (activeMenu === 'sort' && sortRef.current && !sortRef.current.contains(target)) {
        setActiveMenu(null);
      } else if (activeMenu === 'group' && groupRef.current && !groupRef.current.contains(target)) {
        setActiveMenu(null);
      } else if (activeMenu === 'columns' && columnsRef.current && !columnsRef.current.contains(target)) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [activeMenu]);

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
      {/* Left controls: Toggle Views, Add Row, Sync */}
      <div className="flex items-center gap-2 flex-wrap">
        {onToggleViewsSidebar && (
          <button
            type="button"
            onClick={onToggleViewsSidebar}
            title={lang === 'es' ? 'Mostrar / Ocultar panel de vistas' : 'Toggle views panel'}
            className={`p-1.5 rounded-lg border transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer btn-tactile ${
              isViewsSidebarOpen
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-200'
            }`}
          >
            <PanelLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{lang === 'es' ? 'Vistas' : 'Views'}</span>
          </button>
        )}

        {onAddRow && (
          <button
            type="button"
            onClick={onAddRow}
            className="btn-tactile flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{lang === 'es' ? 'Nueva Fila' : 'New Row'}</span>
          </button>
        )}

        {/* Sync Button */}
        {!isLocalTable && (
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            className="btn-tactile flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? t.syncing_btn : t.sync_btn}</span>
          </button>
        )}

        {!isLocalTable && (
          <span className="text-[11px] text-gray-400 hidden sm:inline">
            {t.sync_label}: <strong className="text-gray-600 font-medium">{formatLastSync(lastSync)}</strong>
          </span>
        )}
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
        <div ref={filterRef} className="relative">
          <button
            type="button"
            onClick={() => setActiveMenu((prev) => (prev === 'filter' ? null : 'filter'))}
            title={lang === 'es' ? 'Filtrar por uno o varios campos' : 'Filter by one or multiple fields'}
            className={`btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
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
            isOpen={activeMenu === 'filter'}
            onClose={() => setActiveMenu(null)}
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
        <div ref={sortRef} className="relative">
          <button
            type="button"
            onClick={() => setActiveMenu((prev) => (prev === 'sort' ? null : 'sort'))}
            className={`btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
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

          {activeMenu === 'sort' && (
            <div className="absolute right-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-40 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                {t.sort_by}
              </div>
              <button
                type="button"
                onClick={() => {
                  onSortChange(null, 'asc');
                  setActiveMenu(null);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-50 ${
                  !sortField ? 'font-semibold text-blue-600' : 'text-gray-700'
                }`}
              >
                <span>{t.clear_sort}</span>
                {!sortField && <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  onSortChange('priority', sortDirection === 'asc' ? 'desc' : 'asc');
                  setActiveMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-50 text-gray-700"
              >
                <span>{t.group_priority}</span>
                {sortField === 'priority' && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  onSortChange('jira_status', sortDirection === 'asc' ? 'desc' : 'asc');
                  setActiveMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-50 text-gray-700"
              >
                <span>{t.group_status}</span>
                {sortField === 'jira_status' && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  onSortChange('key', sortDirection === 'asc' ? 'desc' : 'asc');
                  setActiveMenu(null);
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
        <div ref={groupRef} className="relative">
          <button
            type="button"
            onClick={() => setActiveMenu((prev) => (prev === 'group' ? null : 'group'))}
            className={`btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              groupBy ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 hover:bg-gray-50 text-gray-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t.group_btn}</span>
            {groupBy && <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />}
          </button>

          {activeMenu === 'group' && (
            <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-40 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                {t.group_by_label}
              </div>
              <button
                type="button"
                onClick={() => {
                  onGroupByChange(null);
                  setActiveMenu(null);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-50 ${
                  !groupBy ? 'font-semibold text-purple-600' : 'text-gray-700'
                }`}
              >
                <span>{t.no_group}</span>
                {!groupBy && <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  onGroupByChange('jira_status');
                  setActiveMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-50 text-gray-700"
              >
                <span>{t.group_status}</span>
                {groupBy === 'jira_status' && <Check className="w-3.5 h-3.5 text-purple-600" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  onGroupByChange('priority');
                  setActiveMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-50 text-gray-700"
              >
                <span>{t.group_priority}</span>
                {groupBy === 'priority' && <Check className="w-3.5 h-3.5 text-purple-600" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  onGroupByChange('assignee_name');
                  setActiveMenu(null);
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
                    type="button"
                    onClick={() => {
                      onGroupByChange(c.id);
                      setActiveMenu(null);
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
        <div ref={columnsRef} className="relative">
          <button
            type="button"
            onClick={() => setActiveMenu((prev) => (prev === 'columns' ? null : 'columns'))}
            className="btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>{t.columns_btn}</span>
          </button>

          {activeMenu === 'columns' && (
            <div className="absolute right-0 mt-1 w-60 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-40 max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
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
            className="btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 transition-colors shadow-2xs cursor-pointer"
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
          className="btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-blue-600" />
          <span>{t.add_column_btn}</span>
        </button>

        {/* PDF Export Button */}
        {onExportPdf && (
          <button
            onClick={onExportPdf}
            title={t.export_pdf}
            className="btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 transition-colors border border-rose-200 shadow-2xs cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5 text-rose-600" />
            <span>{t.export_pdf}</span>
          </button>
        )}

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          title={t.settings_tooltip}
          className="btn-tactile p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors border border-gray-200 cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
