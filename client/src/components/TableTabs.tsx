import React from 'react';
import {
  Database,
  Filter,
  Plus,
  Trash2,
} from 'lucide-react';
import type { JiraFilter } from '../types';
import type { Language } from '../utils/i18n';

interface Props {
  tables: JiraFilter[];
  activeTableId: string;
  onSelectTable: (tableId: string) => void;
  onOpenCreateTable: () => void;
  onDeleteTable?: (tableId: string) => Promise<void>;
  lang: Language;
}

export const TableTabs: React.FC<Props> = ({
  tables,
  activeTableId,
  onSelectTable,
  onOpenCreateTable,
  onDeleteTable,
  lang,
}) => {
  return (
    <div className="flex items-center bg-[#f4f5f8] border-b border-gray-200/90 px-3 pt-1.5 select-none overflow-x-auto shrink-0 gap-1.5 scrollbar-thin">
      {/* Table Tabs List */}
      <div className="flex items-center gap-1.5 overflow-x-auto flex-1 py-0.5">
        {tables.map((table) => {
          const isActive = table.id === activeTableId;
          const isLocal = table.type === 'local' || table.id.startsWith('tbl-');

          return (
            <div
              key={table.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              onClick={() => onSelectTable(table.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onSelectTable(table.id);
                }
              }}
              className={`group relative flex items-center gap-2 px-3.5 py-1.5 rounded-t-lg text-xs font-medium cursor-pointer transition-all duration-200 transition-spring border-t border-x shrink-0 active:scale-[0.98] ${
                isActive
                  ? `bg-white border-gray-200 border-b-transparent font-semibold shadow-xs -mb-[1px] z-10 border-t-2 ${
                      isLocal ? 'border-t-indigo-600 text-indigo-950' : 'border-t-blue-600 text-blue-950'
                    }`
                  : 'bg-gray-200/40 hover:bg-white/80 text-gray-600 border-transparent hover:border-gray-200/60'
              }`}
            >
              {/* Table Icon with subtle pulse or spring on active */}
              {isLocal ? (
                <div className={`p-0.5 rounded ${isActive ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 group-hover:text-indigo-500'} transition-colors`}>
                  <Database className="w-3.5 h-3.5" />
                </div>
              ) : (
                <div className={`p-0.5 rounded ${isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-400 group-hover:text-blue-500'} transition-colors`}>
                  <Filter className="w-3.5 h-3.5" />
                </div>
              )}

              {/* Table Name */}
              <span className="truncate max-w-[170px] tracking-tight">{table.name}</span>

              {/* Table Type Pill Badge */}
              <span
                className={`px-1.5 py-0.2 text-[9px] font-bold rounded-sm border ${
                  isLocal
                    ? 'bg-indigo-50/80 text-indigo-700 border-indigo-200/60'
                    : 'bg-blue-50/80 text-blue-700 border-blue-200/60'
                }`}
              >
                {isLocal ? 'Local' : 'Jira'}
              </span>

              {/* Delete / Close Tab Action Button */}
              {onDeleteTable && tables.length > 1 && (
                <button
                  type="button"
                  title={lang === 'es' ? 'Eliminar / Cerrar tabla' : 'Delete / Close table'}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      window.confirm(
                        lang === 'es'
                          ? `¿Deseas cerrar la tabla "${table.name}"?`
                          : `Close table "${table.name}"?`
                      )
                    ) {
                      onDeleteTable(table.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-600 text-gray-400 rounded transition-all duration-150 hover:bg-rose-50 active:scale-90"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* Add Table Button - Triggers CreateTableModal Directly */}
        <button
          type="button"
          onClick={onOpenCreateTable}
          title={lang === 'es' ? 'Crear nueva tabla (local o filtro Jira)' : 'Create new table (local or Jira filter)'}
          className="btn-tactile shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50/80 hover:bg-blue-100 hover:text-blue-800 border border-blue-200/70 shadow-2xs cursor-pointer ml-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{lang === 'es' ? 'Crear Nueva Tabla' : 'Create New Table'}</span>
        </button>
      </div>
    </div>
  );
};
