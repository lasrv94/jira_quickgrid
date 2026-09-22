import { useState } from 'react';
import {
  ArrowDownUp,
  Check,
  ChevronDown,
  Columns,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Settings,
  X
} from 'lucide-react';
import type { CustomColumn, JiraFilter } from '../types';

interface Props {
  filters: JiraFilter[];
  selectedFilterId?: string;
  onSelectFilter: (filterId: string) => void;
  onSync: () => Promise<void>;
  syncing: boolean;
  lastSync?: string;
  columns: CustomColumn[];
  onToggleColumnVisibility: (colId: string) => void;
  onOpenAddColumn: () => void;
  onOpenSettings: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  groupBy: string | null;
  onGroupByChange: (field: string | null) => void;
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  onSortChange: (field: string | null, dir: 'asc' | 'desc') => void;
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
  onOpenAddColumn,
  onOpenSettings,
  searchQuery,
  onSearchChange,
  groupBy,
  onGroupByChange,
  sortField,
  sortDirection,
  onSortChange,
}) => {
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const formatLastSync = (iso?: string) => {
    if (!iso) return 'No sincronizado';
    const date = new Date(iso);
    const diffMin = Math.round((Date.now() - date.getTime()) / 60000);
    if (diffMin <= 1) return 'hace un momento';
    if (diffMin < 60) return `hace ${diffMin} min`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs select-none">
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
          <span>{syncing ? 'Sincronizando...' : 'Actualizar Datos'}</span>
        </button>

        <span className="text-[11px] text-gray-400 hidden sm:inline">
          Sync: <strong className="text-gray-600 font-medium">{formatLastSync(lastSync)}</strong>
        </span>
      </div>

      {/* Middle & Right tools: Search, Sort, Group, Columns, Settings */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar tickets..."
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

        {/* Sort Menu */}
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              sortField ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50 text-gray-700'
            }`}
          >
            <ArrowDownUp className="w-3.5 h-3.5" />
            <span>Ordenar</span>
            {sortField && (
              <span className="ml-0.5 px-1 py-0.2 bg-blue-200 text-blue-800 rounded-sm text-[10px]">
                {sortDirection.toUpperCase()}
              </span>
            )}
          </button>

          {showSortMenu && (
            <div className="absolute right-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-40 animate-in fade-in zoom-in-95">
              <div className="px-3 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Ordenar por
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
                <span>Por defecto (Jira Updated)</span>
                {!sortField && <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => {
                  onSortChange('priority', sortDirection === 'asc' ? 'desc' : 'asc');
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-50 text-gray-700"
              >
                <span>Prioridad</span>
                {sortField === 'priority' && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
              <button
                onClick={() => {
                  onSortChange('jira_status', sortDirection === 'asc' ? 'desc' : 'asc');
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-50 text-gray-700"
              >
                <span>Estado Jira</span>
                {sortField === 'jira_status' && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
              <button
                onClick={() => {
                  onSortChange('key', sortDirection === 'asc' ? 'desc' : 'asc');
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-50 text-gray-700"
              >
                <span>Clave (Key)</span>
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
            <span>Agrupar</span>
            {groupBy && <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />}
          </button>

          {showGroupMenu && (
            <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-40 animate-in fade-in zoom-in-95">
              <div className="px-3 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Agrupar registros por
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
                <span>Sin agrupación</span>
                {!groupBy && <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => {
                  onGroupByChange('jira_status');
                  setShowGroupMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-50 text-gray-700"
              >
                <span>Estado Jira</span>
                {groupBy === 'jira_status' && <Check className="w-3.5 h-3.5 text-purple-600" />}
              </button>
              <button
                onClick={() => {
                  onGroupByChange('priority');
                  setShowGroupMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-50 text-gray-700"
              >
                <span>Prioridad</span>
                {groupBy === 'priority' && <Check className="w-3.5 h-3.5 text-purple-600" />}
              </button>
              <button
                onClick={() => {
                  onGroupByChange('assignee_name');
                  setShowGroupMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-50 text-gray-700"
              >
                <span>Asignado</span>
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
            <span>Columnas</span>
          </button>

          {showColumnsMenu && (
            <div className="absolute right-0 mt-1 w-60 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-40 max-h-72 overflow-y-auto animate-in fade-in zoom-in-95">
              <div className="px-3 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Visibilidad de Columnas
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

        {/* Add Column Button */}
        <button
          onClick={onOpenAddColumn}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-blue-600" />
          <span>Añadir Campo</span>
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          title="Configuración de Jira y OAuth"
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors border border-gray-200"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
