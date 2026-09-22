import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Table,
} from 'lucide-react';
import { AddColumnModal } from './components/AddColumnModal';
import { ArchivyDrawer } from './components/ArchivyDrawer';
import { DataGrid } from './components/DataGrid';
import { SettingsModal } from './components/SettingsModal';
import { Toolbar } from './components/Toolbar';
import {
  createColumn,
  deleteColumn,
  fetchColumns,
  fetchConfig,
  fetchFilters,
  fetchIssues,
  setCustomValue,
  syncIssues,
  updateColumn
} from './services/api';
import type { AppConfig, CustomColumn, JiraFilter, JiraIssue } from './types';

export function App() {
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [columns, setColumns] = useState<CustomColumn[]>([]);
  const [filters, setFilters] = useState<JiraFilter[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [selectedFilterId, setSelectedFilterId] = useState<string>('fav-1');
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  // View state
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Modals & Drawers
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeArchivyIssue, setActiveArchivyIssue] = useState<JiraIssue | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  // Initial Data Load & OAuth Callback handling
  useEffect(() => {
    // Check if redirect from Atlassian OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const oauthCode = urlParams.get('code');
    if (oauthCode) {
      window.history.replaceState({}, document.title, window.location.pathname);
      fetch('/api/auth/jira/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: oauthCode, redirect_uri: window.location.origin + '/auth/callback' }),
      })
        .then((res) => res.json())
        .then(() => {
          setBannerMessage('Conexión con Atlassian OAuth 2.0 establecida con éxito.');
          setTimeout(() => setBannerMessage(null), 5000);
          loadAllData();
        })
        .catch((err) => alert(`Error en callback de Atlassian OAuth: ${err.message}`));
    } else {
      loadAllData();
    }
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [fetchedConfig, fetchedFilters, fetchedColumns, fetchedIssues] = await Promise.all([
        fetchConfig(),
        fetchFilters(),
        fetchColumns(),
        fetchIssues(),
      ]);
      setConfig(fetchedConfig);
      setFilters(fetchedFilters);
      setColumns(fetchedColumns);
      setIssues(fetchedIssues);
      if (fetchedConfig.selected_filter_id) {
        setSelectedFilterId(fetchedConfig.selected_filter_id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncIssues(selectedFilterId);
      const updatedIssues = await fetchIssues();
      const updatedConfig = await fetchConfig();
      setIssues(updatedIssues);
      setConfig(updatedConfig);
      setBannerMessage(result.message);
      setTimeout(() => setBannerMessage(null), 4000);
    } catch (err: any) {
      alert(`Error al sincronizar: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectFilter = async (filterId: string) => {
    setSelectedFilterId(filterId);
    setSyncing(true);
    try {
      await syncIssues(filterId);
      const updatedIssues = await fetchIssues();
      const updatedConfig = await fetchConfig();
      setIssues(updatedIssues);
      setConfig(updatedConfig);
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateCustomValue = async (issueKey: string, columnId: string, value: any) => {
    // Optimistic UI update
    setIssues((prev) =>
      prev.map((item) => {
        if (item.key === issueKey) {
          return {
            ...item,
            custom_values: {
              ...item.custom_values,
              [columnId]: value,
            },
          };
        }
        return item;
      })
    );

    try {
      await setCustomValue(issueKey, columnId, value);
    } catch (err) {
      console.error('Error saving custom value:', err);
      const reloaded = await fetchIssues();
      setIssues(reloaded);
    }
  };

  const handleAddColumn = async (newCol: Partial<CustomColumn>) => {
    const created = await createColumn(newCol);
    setColumns([...columns, created]);
  };

  const handleDeleteColumn = async (colId: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta columna local?')) return;
    await deleteColumn(colId);
    setColumns(columns.filter((c) => c.id !== colId));
  };

  const handleToggleColumnVisibility = async (colId: string) => {
    const col = columns.find((c) => c.id === colId);
    if (!col) return;
    const updated = await updateColumn(colId, { is_visible: !col.is_visible });
    setColumns(columns.map((c) => (c.id === colId ? updated : c)));
  };

  // Filter and Sort Pipeline
  const filteredAndSortedIssues = useMemo(() => {
    let result = [...issues];

    // 1. Text Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.key.toLowerCase().includes(q) ||
          i.summary.toLowerCase().includes(q) ||
          (i.assignee_name && i.assignee_name.toLowerCase().includes(q)) ||
          i.jira_status.toLowerCase().includes(q)
      );
    }

    // 2. Sorting
    if (sortField) {
      result.sort((a, b) => {
        let valA: any = (a as any)[sortField];
        let valB: any = (b as any)[sortField];

        if (sortField === 'priority') {
          const weights: Record<string, number> = { highest: 4, high: 3, medium: 2, low: 1, lowest: 0 };
          valA = weights[String(valA).toLowerCase()] ?? 0;
          valB = weights[String(valB).toLowerCase()] ?? 0;
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [issues, searchQuery, sortField, sortDirection]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#f4f5f7] overflow-hidden text-gray-900">
      {/* Top Navbar inspired by Airtable Base */}
      <header className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between shadow-2xs z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold shadow-xs">
            <Table className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-gray-900 tracking-tight">Jira Airtable Grid</h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                Persistent Storage Active
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Gestión visual de tickets Jira con campos locales no sobreescribibles y Archivy Wiki
            </p>
          </div>
        </div>

        {/* Right Header Status Badges */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
            <span className="text-gray-500">Modo Conexión:</span>
            <span className="font-semibold text-gray-800 uppercase text-[10px]">
              {config?.jira_auth_type === 'oauth'
                ? '🔒 Atlassian OAuth'
                : config?.jira_auth_type === 'pat'
                ? '🔑 API Token'
                : '⚡ Simulación / Mock'}
            </span>
          </div>

          <div className="text-xs bg-blue-50 text-blue-800 px-3 py-1.5 rounded-lg border border-blue-200 font-medium">
            <strong>{issues.length}</strong> tickets cargados
          </div>
        </div>
      </header>

      {/* Dynamic Sync Banner */}
      {bannerMessage && (
        <div className="bg-blue-600 text-white text-xs px-5 py-2 flex items-center justify-between shadow-sm animate-in slide-in-from-top duration-150">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span>{bannerMessage}</span>
          </div>
          <span className="text-[11px] opacity-80">Los campos personalizados se mantuvieron intactos.</span>
        </div>
      )}

      {/* Airtable Toolbar */}
      <Toolbar
        filters={filters}
        selectedFilterId={selectedFilterId}
        onSelectFilter={handleSelectFilter}
        onSync={handleSync}
        syncing={syncing}
        lastSync={config?.last_sync}
        columns={columns}
        onToggleColumnVisibility={handleToggleColumnVisibility}
        onOpenAddColumn={() => setIsAddColumnOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={(field, dir) => {
          setSortField(field);
          setSortDirection(dir);
        }}
      />

      {/* Main Data Table Area */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white text-gray-400 gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium">Cargando base de datos y tickets de Jira...</p>
        </div>
      ) : (
        <DataGrid
          issues={filteredAndSortedIssues}
          columns={columns}
          onUpdateCustomValue={handleUpdateCustomValue}
          onOpenArchivyDrawer={(issue) => setActiveArchivyIssue(issue)}
          onOpenAddColumn={() => setIsAddColumnOpen(true)}
          onDeleteColumn={handleDeleteColumn}
          groupBy={groupBy}
        />
      )}

      {/* Side Drawer for Archivy Notes */}
      <ArchivyDrawer
        issue={activeArchivyIssue}
        onClose={() => setActiveArchivyIssue(null)}
      />

      {/* Add Column Modal */}
      <AddColumnModal
        isOpen={isAddColumnOpen}
        onClose={() => setIsAddColumnOpen(false)}
        onAddColumn={handleAddColumn}
      />

      {/* Jira Connection Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onRefreshConfig={loadAllData}
      />
    </div>
  );
}

export default App;
