import React, { useState, useRef, useEffect } from 'react';
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
  onCreateLocalTable: (name: string) => Promise<void>;
  onOpenJiraFilters: () => void;
  onDeleteTable?: (tableId: string) => Promise<void>;
  lang: Language;
}

export const TableTabs: React.FC<Props> = ({
  tables,
  activeTableId,
  onSelectTable,
  onCreateLocalTable,
  onOpenJiraFilters,
  onDeleteTable,
  lang,
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isCreatingLocal, setIsCreatingLocal] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close add menu on outside click
  useEffect(() => {
    if (!showAddMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddMenu]);

  useEffect(() => {
    if (isCreatingLocal && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreatingLocal]);

  const handleConfirmCreateLocal = async () => {
    const name = newTableName.trim();
    if (!name) return;
    await onCreateLocalTable(name);
    setNewTableName('');
    setIsCreatingLocal(false);
    setShowAddMenu(false);
  };

  return (
    <div className="flex items-center bg-[#f8f9fb] border-b border-gray-200 px-3 pt-1 select-none overflow-x-auto shrink-0 gap-1">
      {/* Table Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto flex-1 py-0.5">
        {tables.map((table) => {
          const isActive = table.id === activeTableId;
          const isLocal = table.type === 'local' || table.id.startsWith('tbl-');

          return (
            <div
              key={table.id}
              onClick={() => onSelectTable(table.id)}
              className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-medium cursor-pointer transition-all border-t border-x shrink-0 ${
                isActive
                  ? 'bg-white text-blue-900 border-gray-200 border-b-white font-semibold shadow-xs -mb-[1px] z-10'
                  : 'bg-transparent hover:bg-gray-200/60 text-gray-600 border-transparent hover:border-gray-200'
              }`}
            >
              {/* Table Icon */}
              {isLocal ? (
                <Database className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
              ) : (
                <Filter className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
              )}

              {/* Table Name */}
              <span className="truncate max-w-[160px]">{table.name}</span>

              {/* Table Type Badge */}
              {isLocal && (
                <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 text-[9px] font-bold rounded-sm border border-indigo-200/60">
                  {lang === 'es' ? 'Local' : 'Local'}
                </span>
              )}

              {/* Delete / Remove Action */}
              {onDeleteTable && (tables.length > 1) && (
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
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-600 text-gray-400 rounded transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* Add Table / Project Button */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowAddMenu(!showAddMenu)}
            title={lang === 'es' ? 'Agregar tabla local o filtro de Jira' : 'Add local table or Jira filter'}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold text-gray-600 hover:text-blue-700 hover:bg-gray-200/80 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{lang === 'es' ? 'Tabla' : 'Table'}</span>
          </button>

          {/* Add Dropdown Menu */}
          {showAddMenu && (
            <div className="absolute left-0 mt-1 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-1.5 z-50 animate-in fade-in zoom-in-95">
              {!isCreatingLocal ? (
                <>
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {lang === 'es' ? 'Crear o vincular tabla' : 'Create or link table'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreatingLocal(true)}
                    className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-indigo-50 text-gray-700 hover:text-indigo-800 transition-colors"
                  >
                    <Database className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <div className="font-semibold">{lang === 'es' ? 'Nueva Tabla Local' : 'New Local Table'}</div>
                      <div className="text-[10px] text-gray-400">
                        {lang === 'es' ? 'Crea filas y campos 100% personalizados' : 'Create 100% custom rows & fields'}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMenu(false);
                      onOpenJiraFilters();
                    }}
                    className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-blue-50 text-gray-700 hover:text-blue-800 transition-colors"
                  >
                    <Filter className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <div className="font-semibold">{lang === 'es' ? 'Vincular Filtro de Jira' : 'Link Jira Filter'}</div>
                      <div className="text-[10px] text-gray-400">
                        {lang === 'es' ? 'Sincroniza tickets desde Jira Cloud' : 'Sync tickets from Jira Cloud'}
                      </div>
                    </div>
                  </button>
                </>
              ) : (
                <div className="p-3">
                  <div className="text-xs font-semibold text-gray-800 mb-1.5">
                    {lang === 'es' ? 'Nombre de la tabla local' : 'Local table name'}
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirmCreateLocal();
                      if (e.key === 'Escape') setIsCreatingLocal(false);
                    }}
                    placeholder={lang === 'es' ? 'Ej. Clientes, Entregables...' : 'e.g. Clients, Deliverables...'}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsCreatingLocal(false)}
                      className="px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                    >
                      {lang === 'es' ? 'Cancelar' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmCreateLocal}
                      disabled={!newTableName.trim()}
                      className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded"
                    >
                      {lang === 'es' ? 'Crear' : 'Create'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
