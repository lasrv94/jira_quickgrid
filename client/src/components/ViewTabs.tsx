import React from 'react';
import { Layers, Plus, Table, Trash2 } from 'lucide-react';
import type { SavedView } from '../types';
import type { Language } from '../utils/i18n';
import { getTranslation } from '../utils/i18n';

interface Props {
  views: SavedView[];
  activeViewId: string;
  onSelectView: (view: SavedView) => void;
  onOpenCreateView: () => void;
  onDeleteView: (viewId: string) => void;
  lang: Language;
}

export const ViewTabs: React.FC<Props> = ({
  views,
  activeViewId,
  onSelectView,
  onOpenCreateView,
  onDeleteView,
  lang,
}) => {
  const t = getTranslation(lang);

  return (
    <div className="flex items-center gap-1.5 px-4 bg-white border-b border-gray-200 overflow-x-auto select-none py-1.5 shrink-0">
      <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-gray-400 mr-2 shrink-0">
        <Table className="w-3.5 h-3.5 text-gray-500" />
        <span>{t.views_label}</span>
      </div>

      <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
        {views.map((v) => {
          const isActive = v.id === activeViewId;

          // Localize view names if they are standard ones
          let displayName = v.name;
          if (v.id === 'view-all') displayName = t.all_tickets_view;
          if (v.id === 'view-by-status') displayName = t.by_status_view;
          if (v.id === 'view-by-assignee') displayName = t.by_assignee_view;

          return (
            <div
              key={v.id}
              className={`group relative flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-all border shrink-0 ${
                isActive
                  ? 'bg-blue-50 text-blue-800 border-blue-300 font-semibold shadow-2xs'
                  : 'bg-white hover:bg-gray-50 text-gray-600 border-transparent hover:border-gray-200'
              }`}
              onClick={() => onSelectView(v)}
            >
              {v.group_by ? (
                <Layers className={`w-3 h-3 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
              ) : (
                <Table className={`w-3 h-3 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
              )}
              <span className="truncate max-w-[140px]">{displayName}</span>

              {/* Active Indicator */}
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}

              {/* Delete button (only for non-default views) */}
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
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-600 text-gray-400 transition-opacity ml-0.5 rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* Add View Button */}
        <button
          type="button"
          onClick={onOpenCreateView}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50/50 rounded-md transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t.new_view_btn}</span>
        </button>
      </div>
    </div>
  );
};
