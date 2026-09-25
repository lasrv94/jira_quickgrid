import { apiFetch } from '../services/api';
import React, { useEffect, useState, useMemo } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Database,
  ExternalLink,
  Filter,
  Folder,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  addConfiguredFilter,
  createColumn,
  deleteColumn,
  fetchAvailableJiraFilters,
  fetchFilters,
  fetchJiraFields,
  removeConfiguredFilter,
  syncIssues,
  updateConfig,
  validateJiraFilter,
} from '../services/api';
import type { AppConfig, CustomColumn, JiraFieldInfo, JiraFilter } from '../types';
import type { Language } from '../utils/i18n';
import { getTranslation } from '../utils/i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig | null;
  onRefreshConfig: () => Promise<void>;
  existingColumns?: CustomColumn[];
  lang?: Language;
}

export const SettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  config,
  onRefreshConfig,
  existingColumns = [],
  lang = 'es',
}) => {
  const t = getTranslation(lang);
  const [activeTab, setActiveTab] = useState<'connection' | 'filter' | 'fields' | 'storage'>('connection');

  // Connection settings
  const [authType, setAuthType] = useState<'mock' | 'pat' | 'oauth'>(config?.jira_auth_type || 'mock');
  const [domain, setDomain] = useState(config?.jira_domain || '');
  const [email, setEmail] = useState(config?.jira_email || '');
  const [apiToken, setApiToken] = useState('');
  const [verifyTls, setVerifyTls] = useState(config?.jira_verify_tls ?? true);
  const [clientId, setClientId] = useState(config?.jira_client_id || '');
  const [clientSecret, setClientSecret] = useState('');
  const [archivyDir, setArchivyDir] = useState(config?.archivy_dir || '');

  // Jira Filter / JQL settings
  const [filterId, setFilterId] = useState(config?.selected_filter_id || '');
  const [filterJql, setFilterJql] = useState(config?.filter_jql || '');
  const [configuredFilters, setConfiguredFilters] = useState<JiraFilter[]>(config?.configured_filters || []);
  const [newFilterId, setNewFilterId] = useState('');
  const [newFilterName, setNewFilterName] = useState('');
  const [newFilterJql, setNewFilterJql] = useState('');
  const [availableFilters, setAvailableFilters] = useState<JiraFilter[]>([]);
  const [loadingAvailableFilters, setLoadingAvailableFilters] = useState(false);
  const [addingFilter, setAddingFilter] = useState(false);
  const [deletingFilterId, setDeletingFilterId] = useState<string | null>(null);
  const [validatingFilter, setValidatingFilter] = useState(false);
  const [filterValidation, setFilterValidation] = useState<{
    valid: boolean;
    name?: string;
    message?: string;
    matched_issues?: number;
    error?: string;
  } | null>(null);

  // Jira Field Selectors explorer
  const [jiraFields, setJiraFields] = useState<JiraFieldInfo[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [fieldSearch, setFieldSearch] = useState('');
  const [fieldFilterType, setFieldFilterType] = useState<'all' | 'standard' | 'custom'>('all');
  const [addingFieldId, setAddingFieldId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Sync state from config when opened
  useEffect(() => {
    if (config) {
      setAuthType(config.jira_auth_type || 'mock');
      setDomain(config.jira_domain || '');
      setEmail(config.jira_email || '');
      setVerifyTls(config.jira_verify_tls ?? true);
      setClientId(config.jira_client_id || '');
      setArchivyDir(config.archivy_dir || '');
      setFilterId(config.selected_filter_id || '');
      setFilterJql(config.filter_jql || '');
      setConfiguredFilters(config.configured_filters || []);
    }
  }, [config, isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === 'filter') {
      fetchFilters()
        .then((res) => {
          if (Array.isArray(res) && res.length > 0) {
            setConfiguredFilters(res);
          }
        })
        .catch(console.error);
    }
  }, [isOpen, activeTab]);

  const loadAvailableFilters = async () => {
    setLoadingAvailableFilters(true);
    try {
      const data = await fetchAvailableJiraFilters();
      setAvailableFilters(data);
    } catch (err: any) {
      console.error('Error fetching available Jira filters:', err);
    } finally {
      setLoadingAvailableFilters(false);
    }
  };

  const handleAddCustomFilter = async () => {
    if (!newFilterId && !newFilterJql) {
      alert(lang === 'es' ? 'Ingresa un ID de Filtro o una consulta JQL' : 'Enter a Filter ID or JQL query');
      return;
    }
    setAddingFilter(true);
    try {
      const updated = await addConfiguredFilter({
        id: newFilterId.trim() || undefined,
        name: newFilterName.trim() || undefined,
        jql: newFilterJql.trim() || undefined,
      });
      setConfiguredFilters(updated);
      setNewFilterId('');
      setNewFilterName('');
      setNewFilterJql('');
      setFilterValidation(null);
      await onRefreshConfig();
    } catch (err: any) {
      alert(err.message || 'Error al agregar filtro');
    } finally {
      setAddingFilter(false);
    }
  };

  const handleAddAvailableFilter = async (avail: JiraFilter) => {
    setAddingFilter(true);
    try {
      const updated = await addConfiguredFilter({
        id: avail.id,
        name: avail.name,
        jql: avail.jql,
      });
      setConfiguredFilters(updated);
      await onRefreshConfig();
    } catch (err: any) {
      alert(err.message || 'Error al agregar filtro');
    } finally {
      setAddingFilter(false);
    }
  };

  const handleDeleteFilter = async (id: string) => {
    if (configuredFilters.length <= 1) {
      alert(lang === 'es' ? 'Debes mantener al menos un filtro configurado.' : 'You must keep at least one configured filter.');
      return;
    }
    if (!window.confirm(lang === 'es' ? '¿Eliminar este filtro de tu barra?' : 'Remove this filter from your toolbar?')) return;
    setDeletingFilterId(id);
    try {
      const updated = await removeConfiguredFilter(id);
      setConfiguredFilters(updated);
      if (filterId === id && updated.length > 0) {
        setFilterId(updated[0].id);
        setFilterJql(updated[0].jql);
      }
      await onRefreshConfig();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar filtro');
    } finally {
      setDeletingFilterId(null);
    }
  };

  const handleSelectActiveFilter = async (f: JiraFilter) => {
    setFilterId(f.id);
    setFilterJql(f.jql);
    try {
      await updateConfig({
        selected_filter_id: f.id,
        selected_filter_name: f.name,
        filter_jql: f.jql,
      });
      await onRefreshConfig();
    } catch (err: any) {
      console.error(err);
    }
  };

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load fields when Fields tab is opened
  useEffect(() => {
    if (isOpen && activeTab === 'fields' && jiraFields.length === 0) {
      loadJiraFields();
    }
  }, [isOpen, activeTab]);

  const loadJiraFields = async () => {
    setLoadingFields(true);
    try {
      const fields = await fetchJiraFields();
      if (Array.isArray(fields)) {
        setJiraFields(fields);
      } else {
        setJiraFields([]);
      }
    } catch (err: any) {
      console.error('Error fetching Jira fields:', err);
      setJiraFields([]);
    } finally {
      setLoadingFields(false);
    }
  };


  const handleAddJiraFieldAsColumn = async (field: JiraFieldInfo) => {
    if (!field || !field.id) return;
    setAddingFieldId(field.id);
    try {
      await createColumn({
        name: field.name || field.id,
        type: 'jira_field',
        jira_field_key: field.id,
        is_visible: true,
        width: 170,
      });
      await onRefreshConfig();
    } catch (err: any) {
      alert(`Error al agregar columna: ${err.message}`);
    } finally {
      setAddingFieldId(null);
    }
  };

  const [removingColId, setRemovingColId] = useState<string | null>(null);

  const handleRemoveJiraFieldColumn = async (fieldId: string) => {
    const col = existingColumns.find(
      (c) => c.jira_field_key === fieldId || c.id === fieldId || c.name.toLowerCase() === fieldId.toLowerCase()
    );
    if (!col) return;
    if (!window.confirm(t.remove_column_confirm)) return;
    setRemovingColId(fieldId);
    try {
      await deleteColumn(col.id);
      await onRefreshConfig();
    } catch (err: any) {
      alert(`Error al eliminar columna: ${err.message}`);
    } finally {
      setRemovingColId(null);
    }
  };

  const handleDeleteExistingColumn = async (columnId: string) => {
    if (!window.confirm(t.remove_column_confirm)) return;
    setRemovingColId(columnId);
    try {
      await deleteColumn(columnId);
      await onRefreshConfig();
    } catch (err: any) {
      alert(`Error al eliminar columna: ${err.message}`);
    } finally {
      setRemovingColId(null);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    try {
      await updateConfig({
        jira_auth_type: authType,
        jira_domain: domain,
        jira_email: email,
        jira_api_token: apiToken || undefined,
        jira_verify_tls: verifyTls,
        jira_client_id: clientId,
        jira_client_secret: clientSecret || undefined,
        archivy_dir: archivyDir || undefined,
        selected_filter_id: filterId || undefined,
        filter_jql: filterJql || undefined,
      });
      try {
        await syncIssues(filterId || undefined);
      } catch (syncErr) {
        console.warn('Auto-sync after settings save:', syncErr);
      }
      await onRefreshConfig();
      setStatusMsg(lang === 'es' ? 'Configuración guardada exitosamente.' : 'Settings saved successfully.');
      setTimeout(() => {
        setStatusMsg(null);
        onClose();
      }, 1000);
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleOAuthLogin = async () => {
    try {
      if (clientId) {
        await updateConfig({ jira_client_id: clientId, jira_client_secret: clientSecret || undefined });
      }
      const res = await apiFetch('/api/auth/jira/login?' + new URLSearchParams({ redirect_uri: window.location.origin + '/auth/callback' }));
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.detail || 'Error al generar URL de Atlassian OAuth');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Safe filtered Jira fields in explorer
  const filteredJiraFields = useMemo(() => {
    if (!Array.isArray(jiraFields)) return [];
    const q = (fieldSearch || '').toLowerCase().trim();
    return jiraFields.filter((f) => {
      if (!f) return false;
      const name = String(f.name || '').toLowerCase();
      const id = String(f.id || '').toLowerCase();
      const matchesSearch = !q || name.includes(q) || id.includes(q);
      if (!matchesSearch) return false;

      if (fieldFilterType === 'standard') return !f.custom;
      if (fieldFilterType === 'custom') return !!f.custom;
      return true;
    });
  }, [jiraFields, fieldSearch, fieldFilterType]);

  const isFieldAlreadyAdded = (fieldId: string) => {
    if (!fieldId || !Array.isArray(existingColumns)) return false;
    return existingColumns.some((col) => col?.jira_field_key === fieldId || col?.id === fieldId);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden my-6 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 text-base">{t.settings_title}</h3>
              <p className="text-[11px] text-gray-500">{t.settings_subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-md hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Tabs */}
        <div className="flex border-b border-gray-200 px-6 bg-white shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('connection')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'connection'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{t.tab_connection}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('filter')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'filter'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>{t.tab_filter}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fields')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'fields'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>{t.tab_fields}</span>
            {jiraFields.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-700 font-bold">
                {jiraFields.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('storage')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'storage'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Folder className="w-4 h-4" />
            <span>{t.tab_storage}</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {statusMsg && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 mb-4 ${
                statusMsg.startsWith('Error')
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {statusMsg.startsWith('Error') ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{statusMsg}</span>
            </div>
          )}

          {/* TAB 1: CONNECTION & AUTH */}
          {activeTab === 'connection' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">
                  {t.jira_mode_label}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAuthType('mock')}
                    className={`px-3 py-2.5 rounded-lg border text-xs font-medium text-left transition-all ${
                      authType === 'mock'
                        ? 'border-blue-500 bg-blue-50/50 text-blue-800 shadow-xs'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1">
                      <span>⚡ {t.mock_mode}</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{t.mock_title}</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuthType('pat')}
                    className={`px-3 py-2.5 rounded-lg border text-xs font-medium text-left transition-all ${
                      authType === 'pat'
                        ? 'border-blue-500 bg-blue-50/50 text-blue-800 shadow-xs'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1">
                      <span>🔑 {t.pat_mode}</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{t.pat_title}</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuthType('oauth')}
                    className={`px-3 py-2.5 rounded-lg border text-xs font-medium text-left transition-all ${
                      authType === 'oauth'
                        ? 'border-blue-500 bg-blue-50/50 text-blue-800 shadow-xs'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1">
                      <span>🔒 {t.oauth_mode}</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{t.oauth_title}</div>
                  </button>
                </div>
              </div>

              {/* Mock Help */}
              {authType === 'mock' && (
                <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 leading-relaxed">
                  <p className="font-semibold mb-1">ℹ️ Modo Simulación Activo</p>
                  El sistema utilizará datos de prueba para que puedas explorar la interfaz visual, crear vistas y añadir columnas personalizadas sin requerir claves de API.
                </div>
              )}

              {/* PAT Fields */}
              {authType === 'pat' && (
                <div className="space-y-3.5 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">{t.domain_label}</label>
                    <input
                      type="text"
                      placeholder="soteasmxsandbox.atlassian.net"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">{t.email_label}</label>
                    <input
                      type="email"
                      placeholder="usuario@empresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">{t.token_label}</label>
                    <input
                      type="password"
                      placeholder={config?.has_api_token ? '••••••••••••••••' : 'Pega tu Jira Cloud API Token'}
                      value={apiToken}
                      onChange={(e) => setApiToken(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500"
                    />
                    <a
                      href="https://id.atlassian.com/manage-profile/security/api-tokens"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-1 mt-1"
                    >
                      {t.token_link} <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <div className="border-t border-gray-200 pt-3">
                    <label className="flex items-center justify-between gap-3 text-xs font-medium text-gray-700">
                      {t.tls_verify_label}
                      <span className="relative inline-flex shrink-0">
                        <input
                          type="checkbox"
                          role="switch"
                          checked={verifyTls}
                          onChange={(e) => setVerifyTls(e.target.checked)}
                          aria-describedby="tls-verification-help"
                          className="peer sr-only"
                        />
                        <span aria-hidden="true" className="h-5 w-9 rounded-full bg-gray-300 transition-colors peer-checked:bg-blue-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600" />
                        <span aria-hidden="true" className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
                      </span>
                    </label>
                    <p id="tls-verification-help" className="mt-1 text-[11px] text-gray-500">{t.tls_verify_help}</p>
                    {!verifyTls && (
                      <p role="alert" className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                        {t.tls_verify_warning}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* OAuth Fields */}
              {authType === 'oauth' && (
                <div className="space-y-3.5 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Credenciales Atlassian Developer</span>
                    <a
                      href="https://developer.atlassian.com/console/myapps/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                    >
                      Atlassian Console <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Client ID</label>
                    <input
                      type="text"
                      placeholder="Atlassian OAuth Client ID"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Client Secret</label>
                    <input
                      type="password"
                      placeholder={config?.jira_client_id ? '••••••••••••••••' : 'Atlassian OAuth Client Secret'}
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleOAuthLogin}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Conectar con Atlassian Jira (OAuth 2.0)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: JIRA FILTERS MANAGER */}
          {activeTab === 'filter' && (
            <div className="space-y-6">
              <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 leading-relaxed">
                <p className="font-semibold mb-1">🎯 {t.configured_filters_title}</p>
                {t.configured_filters_desc}
              </div>

              {/* SECTION 1: Current Configured Filters List */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
                  {t.configured_filters_title} ({configuredFilters.length})
                </label>
                {configuredFilters.length === 0 ? (
                  <p className="text-xs text-gray-400 italic p-3 bg-gray-50 rounded-lg border border-gray-200">
                    {t.no_configured_filters}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {configuredFilters.map((f) => {
                      const isActive = filterId === f.id || config?.selected_filter_id === f.id;
                      return (
                        <div
                          key={f.id}
                          className={`p-3 rounded-lg border text-xs flex items-center justify-between transition-all ${
                            isActive
                              ? 'bg-blue-50/70 border-blue-300 shadow-2xs'
                              : 'bg-white hover:bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="min-w-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-800 text-xs truncate">
                                📁 {f.name}
                              </span>
                              {isActive && (
                                <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded text-[10px] font-bold">
                                  {t.active_filter_badge}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400 font-mono truncate mt-0.5">
                              ID: {f.id} • JQL: {f.jql || 'project is not EMPTY'}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {!isActive && (
                              <button
                                type="button"
                                onClick={() => handleSelectActiveFilter(f)}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 rounded transition-colors"
                              >
                                {t.set_as_active}
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={deletingFilterId === f.id || configuredFilters.length <= 1}
                              onClick={() => handleDeleteFilter(f.id)}
                              title={t.remove_filter}
                              className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded border border-gray-200 transition-colors disabled:opacity-30"
                            >
                              {deletingFilterId === f.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION 2: Add New Filter Form */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-blue-600" />
                    {t.add_new_jira_filter}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      {t.filter_name_label}
                    </label>
                    <input
                      type="text"
                      placeholder={t.filter_name_placeholder}
                      value={newFilterName}
                      onChange={(e) => setNewFilterName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      {t.filter_id_label}
                    </label>
                    <input
                      type="text"
                      placeholder="10001 (opcional si defines JQL)"
                      value={newFilterId}
                      onChange={(e) => setNewFilterId(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 bg-white font-mono focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    {t.jql_label}
                  </label>
                  <textarea
                    rows={2}
                    placeholder="project = KAN AND status != Done ORDER BY created DESC"
                    value={newFilterJql}
                    onChange={(e) => setNewFilterJql(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 bg-white font-mono focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold">Presets:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setNewFilterName('Todos los tickets');
                      setNewFilterJql('project is not EMPTY ORDER BY created DESC');
                    }}
                    className="px-2 py-0.5 text-[10px] bg-white hover:bg-gray-100 text-gray-700 rounded border border-gray-200"
                  >
                    📁 Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewFilterName('Tickets abiertos');
                      setNewFilterJql('resolution is EMPTY ORDER BY updated DESC');
                    }}
                    className="px-2 py-0.5 text-[10px] bg-white hover:bg-gray-100 text-gray-700 rounded border border-gray-200"
                  >
                    ⏳ Abiertos
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewFilterName('Mis tickets');
                      setNewFilterJql('assignee = currentUser() ORDER BY updated DESC');
                    }}
                    className="px-2 py-0.5 text-[10px] bg-white hover:bg-gray-100 text-gray-700 rounded border border-gray-200"
                  >
                    👤 Asignados a mí
                  </button>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-200/80">
                  <button
                    type="button"
                    disabled={validatingFilter || (!newFilterId && !newFilterJql)}
                    onClick={async () => {
                      setValidatingFilter(true);
                      setFilterValidation(null);
                      try {
                        const res = await validateJiraFilter(newFilterId || undefined, newFilterJql || undefined);
                        setFilterValidation({
                          valid: res?.valid ?? true,
                          name: res?.name,
                          message: res?.message,
                          matched_issues: res?.matched_issues,
                        });
                        if (res?.name && !newFilterName) setNewFilterName(res.name);
                        if (res?.jql && !newFilterJql) setNewFilterJql(res.jql);
                      } catch (err: any) {
                        setFilterValidation({ valid: false, error: err?.message || 'Error validando filtro' });
                      } finally {
                        setValidatingFilter(false);
                      }
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {validatingFilter ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                    <span>{validatingFilter ? t.validating : t.validate_filter_btn}</span>
                  </button>

                  <button
                    type="button"
                    disabled={addingFilter || (!newFilterId && !newFilterJql)}
                    onClick={handleAddCustomFilter}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                  >
                    {addingFilter ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>{t.add_filter_btn}</span>
                  </button>
                </div>

                {filterValidation && (
                  <div className={`p-2.5 rounded-lg border text-xs ${filterValidation.valid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                    <div className="font-semibold">{filterValidation.valid ? `✓ ${filterValidation.name || 'Filtro válido'}` : `✗ ${filterValidation.error}`}</div>
                  </div>
                )}
              </div>

              {/* SECTION 3: Explore / Import from Jira instance */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-gray-800 block">
                      🔍 {t.browse_jira_filters}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Explora filtros guardados en tu cuenta de Jira para agregarlos con 1 clic.
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={loadingAvailableFilters}
                    onClick={loadAvailableFilters}
                    className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-medium rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingAvailableFilters ? 'animate-spin text-blue-600' : ''}`} />
                    <span>{t.load_available_filters}</span>
                  </button>
                </div>

                {availableFilters.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-gray-200 rounded-lg bg-white p-2 divide-y divide-gray-100">
                    {availableFilters.map((avail) => {
                      const alreadyAdded = configuredFilters.some((cf) => cf.id === avail.id);
                      return (
                        <div key={avail.id} className="pt-1.5 first:pt-0 flex items-center justify-between py-1 text-xs">
                          <div className="truncate pr-2">
                            <span className="font-medium text-gray-800 block truncate">{avail.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono block truncate">{avail.id} • {avail.jql}</span>
                          </div>
                          {alreadyAdded ? (
                            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 shrink-0">
                              <Check className="w-3 h-3" />
                              <span>En tu barra</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={addingFilter}
                              onClick={() => handleAddAvailableFilter(avail)}
                              className="px-2.5 py-1 text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors flex items-center gap-1 shrink-0 disabled:opacity-50"
                            >
                              <Plus className="w-3 h-3" />
                              <span>{t.add_filter_btn}</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: JIRA FIELD SELECTORS */}
          {activeTab === 'fields' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{t.fields_title}</p>
                  <p className="text-[11px] text-gray-500">{t.fields_desc}</p>
                </div>
                <button
                  type="button"
                  onClick={loadJiraFields}
                  disabled={loadingFields}
                  className="px-2.5 py-1.5 text-xs bg-white hover:bg-gray-100 border border-gray-200 rounded-lg flex items-center gap-1 text-gray-700 shadow-2xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingFields ? 'animate-spin text-blue-600' : ''}`} />
                  <span>{t.reload_fields}</span>
                </button>
              </div>

              {/* Search & Type filter */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder={t.search_fields}
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setFieldFilterType('all')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      fieldFilterType === 'all' ? 'bg-white shadow-2xs text-blue-700 font-bold' : 'text-gray-600'
                    }`}
                  >
                    {t.field_all}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFieldFilterType('standard')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      fieldFilterType === 'standard' ? 'bg-white shadow-2xs text-blue-700 font-bold' : 'text-gray-600'
                    }`}
                  >
                    {t.field_standard}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFieldFilterType('custom')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      fieldFilterType === 'custom' ? 'bg-white shadow-2xs text-blue-700 font-bold' : 'text-gray-600'
                    }`}
                  >
                    {t.field_custom}
                  </button>
                </div>
              </div>

              {/* Field List Container */}
              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-gray-100 bg-white">
                {loadingFields ? (
                  <div className="p-8 text-center text-xs text-gray-400 flex flex-col items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <span>Consultando esquema de campos desde Jira API...</span>
                  </div>
                ) : filteredJiraFields.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-400">
                    No se encontraron campos que coincidan con la búsqueda.
                  </div>
                ) : (
                  filteredJiraFields.map((field) => {
                    const alreadyAdded = isFieldAlreadyAdded(field.id);
                    const isAdding = addingFieldId === field.id;

                    return (
                      <div
                        key={field.id}
                        className="px-3.5 py-2 flex items-center justify-between hover:bg-blue-50/30 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              field.custom
                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {field.custom ? 'CUSTOM' : 'CORE'}
                          </span>
                          <div className="truncate">
                            <span className="font-semibold text-xs text-gray-800 block truncate">
                              {field.name || field.id}
                            </span>
                            <span className="font-mono text-[10px] text-gray-400 block truncate">
                              {field.id} • Tipo: {field.type || 'string'}
                            </span>
                          </div>
                        </div>

                        <div>
                          {alreadyAdded ? (
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <Check className="w-3 h-3" />
                                <span>{t.column_active}</span>
                              </span>
                              <button
                                type="button"
                                disabled={removingColId === field.id}
                                onClick={() => handleRemoveJiraFieldColumn(field.id)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 transition-colors disabled:opacity-50"
                                title={t.remove_column}
                              >
                                {removingColId === field.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                                <span>{t.remove_column}</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isAdding}
                              onClick={() => handleAddJiraFieldAsColumn(field)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
                            >
                              {isAdding ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Plus className="w-3 h-3" />
                              )}
                              <span>{t.add_as_column}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Active Columns in Grid */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-blue-600" />
                    {t.active_columns_section} ({existingColumns.length})
                  </span>
                </div>
                {existingColumns.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">{t.no_active_custom_columns}</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {existingColumns.map((col) => (
                      <div
                        key={col.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200 text-xs"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          {col.type === 'jira_field' || col.jira_field_key ? (
                            <span className="px-1 text-[9px] font-mono bg-blue-100 text-blue-700 rounded font-bold">JIRA</span>
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                          )}
                          <span className="font-medium text-gray-800 truncate" title={col.name}>{col.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteExistingColumn(col.id)}
                          disabled={removingColId === col.id}
                          className="text-gray-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors ml-2"
                          title={t.remove_column}
                        >
                          {removingColId === col.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ARCHIVY STORAGE */}
          {activeTab === 'storage' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                  {t.archivy_dir_label}
                </label>
                <input
                  type="text"
                  placeholder="Ruta local o dejar vacío para ./data/archivy_notes"
                  value={archivyDir}
                  onChange={(e) => setArchivyDir(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500 font-mono text-gray-700"
                />
                <p className="text-[11px] text-gray-400 mt-1">{t.archivy_dir_hint}</p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-between items-center px-6 py-3.5 bg-gray-50 border-t border-gray-100 shrink-0">
          <div className="text-[11px] text-gray-500">
            {activeTab === 'filter' && 'Guarda para aplicar el filtro en la próxima sincronización'}
            {activeTab === 'fields' && `${jiraFields.length} campos disponibles`}
            {activeTab === 'connection' && 'Almacenamiento seguro SQLite local'}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
            >
              {t.close}
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {saving ? t.saving : t.save_settings}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
