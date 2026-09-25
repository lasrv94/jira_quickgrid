import React, { useState } from 'react';
import {
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Table,
  Trash2,
  Sliders,
} from 'lucide-react';
import type { SavedView } from '../types';
import type { Language } from '../utils/i18n';
import { getTranslation } from '../utils/i18n';

interface Props {
  views: SavedView[];
  activeViewId: string;
  onSelectView: (view: SavedView) => void;
  onOpenCreateView: () => void;
  onDeleteView: (viewId: string) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  lang: Language;
}

export const ViewsSidebar: React.FC<Props> = ({
  views,
  activeViewId,
  onSelectView,
  onOpenCreateView,
  onDeleteView,
  isOpen,
  onToggleOpen,
  lang,
}) => {
  const t = getTranslation(lang);
  const [filterQuery, setFilterQuery] = useState('');

  const filteredViews = views.filter((v) => {
    let name = v.name;
    if (v.id === 'view-all') name = t.all_tickets_view;
    if (v.id === 'view-by-status') name = t.by_status_view;
    if (v.id === 'view-by-assignee') name = t.by_assignee_view;
    return name.toLowerCase().includes(filterQuery.toLowerCase());
  });

  return (
    <aside
      className={`bg-white border-r border-gray-200 flex flex-col select-none shrink-0 z-20 h-full overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isOpen ? 'w-60' : 'w-11'
      }`}
    >
      {!isOpen ? (
        <div className="flex flex-col items-center py-2 px-1 gap-2">
          <button
            type="button"
            onClick={onToggleOpen}
            title={lang === 'es' ? 'Abrir barra lateral de vistas' : 'Open views sidebar'}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer btn-tactile"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
          <div className="w-6 h-px bg-gray-200" />
          <button
            type="button"
            onClick={onOpenCreateView}
            title={t.new_view_btn}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer btn-tactile"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col h-full w-60">
          {/* Header */}
          <div className="px-3.5 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-gray-800 tracking-tight">
                {lang === 'es' ? 'Vistas' : 'Views'}
              </span>
              <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.2">
                {views.length}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onOpenCreateView}
                title={t.new_view_btn}
                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors btn-tactile cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onToggleOpen}
                title={lang === 'es' ? 'Colapsar barra lateral' : 'Collapse sidebar'}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors btn-tactile cursor-pointer"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search Views (shown if > 4 views) */}
          {views.length > 4 && (
            <div className="px-3 py-1.5 border-b border-gray-100">
              <div className="relative">
                <Search className="w-3 h-3 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={lang === 'es' ? 'Buscar vista...' : 'Search view...'}
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="w-full text-xs pl-7 pr-2 py-1 bg-gray-50 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Views List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5 scrollbar-thin">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {lang === 'es' ? 'Mis Vistas' : 'My Views'}
            </div>

            {filteredViews.map((v) => {
              const isActive = v.id === activeViewId;
              let displayName = v.name;
              if (v.id === 'view-all') displayName = t.all_tickets_view;
              if (v.id === 'view-by-status') displayName = t.by_status_view;
              if (v.id === 'view-by-assignee') displayName = t.by_assignee_view;

              return (
                <div
                  key={v.id}
                  onClick={() => onSelectView(v)}
                  className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:translate-x-0.5 active:scale-[0.98] ${
                    isActive
                      ? 'bg-blue-50/90 text-blue-900 font-semibold border-l-3 border-blue-600 shadow-2xs'
                      : 'text-gray-700 hover:bg-gray-100/70 border-l-3 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {v.group_by ? (
                      <Layers className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                    ) : (
                      <Table className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                    )}
                    <span className="truncate">{displayName}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Delete button (non-default views) */}
                    {!v.is_default && (
                      <button
                        type="button"
                        title={t.delete_view_confirm}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`${t.delete_view_confirm}: "${displayName}"`)) {
                            onDeleteView(v.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-600 text-gray-400 rounded transition-all duration-150 hover:bg-rose-50 active:scale-90"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Action: Create view */}
          <div className="p-2 border-t border-gray-100 bg-gray-50/50">
            <button
              type="button"
              onClick={onOpenCreateView}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50/80 rounded-md border border-dashed border-blue-200 transition-colors btn-tactile cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.new_view_btn}</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
