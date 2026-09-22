import { useEffect, useState, useMemo } from 'react';
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
  X,
} from 'lucide-react';
import { createColumn, fetchJiraFields, updateConfig, validateJiraFilter } from '../services/api';
import type { AppConfig, CustomColumn, JiraFieldInfo } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig | null;
  onRefreshConfig: () => Promise<void>;
  existingColumns?: CustomColumn[];
}

export const SettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  config,
  onRefreshConfig,
  existingColumns = [],
}) => {
  const [activeTab, setActiveTab] = useState<'connection' | 'filter' | 'fields' | 'storage'>('connection');

  // Connection settings
  const [authType, setAuthType] = useState<'mock' | 'pat' | 'oauth'>(config?.jira_auth_type || 'mock');
  const [domain, setDomain] = useState(config?.jira_domain || '');
  const [email, setEmail] = useState(config?.jira_email || '');
  const [apiToken, setApiToken] = useState('');
  const [clientId, setClientId] = useState(config?.jira_client_id || '');
  const [clientSecret, setClientSecret] = useState('');
  const [archivyDir, setArchivyDir] = useState(config?.archivy_dir || '');

  // Jira Filter / JQL settings
  const [filterId, setFilterId] = useState(config?.selected_filter_id || '');
  const [filterJql, setFilterJql] = useState(config?.filter_jql || '');
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

  useEffect(() => {
    if (config) {
      setAuthType(config.jira_auth_type || 'mock');
      setDomain(config.jira_domain || '');
      setEmail(config.jira_email || '');
      setClientId(config.jira_client_id || '');
      setArchivyDir(config.archivy_dir || '');
      setFilterId(config.selected_filter_id || '');
      setFilterJql(config.filter_jql || '');
    }
  }, [config, isOpen]);

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
      setJiraFields(fields);
    } catch (err: any) {
      console.error('Error fetching Jira fields:', err);
    } finally {
      setLoadingFields(false);
    }
  };

  if (!isOpen) return null;

  const handleValidateFilter = async () => {
    setValidatingFilter(true);
    setFilterValidation(null);
    try {
      const res = await validateJiraFilter(filterId || undefined, filterJql || undefined);
      setFilterValidation({
        valid: res.valid,
        name: res.name,
        message: res.message,
        matched_issues: res.matched_issues,
      });
      if (res.jql && !filterJql) {
        setFilterJql(res.jql);
      }
    } catch (err: any) {
      setFilterValidation({
        valid: false,
        error: err.message,
      });
    } finally {
      setValidatingFilter(false);
    }
  };

  const handleAddJiraFieldAsColumn = async (field: JiraFieldInfo) => {
    setAddingFieldId(field.id);
    try {
      await createColumn({
        name: field.name,
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    try {
      await updateConfig({
        jira_auth_type: authType,
        jira_domain: domain,
        jira_email: email,
        jira_api_token: apiToken || undefined,
        jira_client_id: clientId,
        jira_client_secret: clientSecret || undefined,
        archivy_dir: archivyDir || undefined,
        selected_filter_id: filterId || undefined,
        filter_jql: filterJql || undefined,
      });
      await onRefreshConfig();
      setStatusMsg('Configuración guardada exitosamente.');
      setTimeout(() => {
        setStatusMsg(null);
        onClose();
      }, 1200);
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
      const res = await fetch('/api/auth/jira/login');
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

  // Filtered Jira fields in explorer
  const filteredJiraFields = useMemo(() => {
    return jiraFields.filter((f) => {
      const matchesSearch =
        f.name.toLowerCase().includes(fieldSearch.toLowerCase()) ||
        f.id.toLowerCase().includes(fieldSearch.toLowerCase());
      if (!matchesSearch) return false;

      if (fieldFilterType === 'standard') return !f.custom;
      if (fieldFilterType === 'custom') return f.custom;
      return true;
    });
  }, [jiraFields, fieldSearch, fieldFilterType]);

  const isFieldAlreadyAdded = (fieldId: string) => {
    return existingColumns.some((col) => col.jira_field_key === fieldId || col.id === fieldId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden my-8 animate-in fade-in zoom-in duration-150 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 text-base">Configuración del Sistema</h3>
              <p className="text-[11px] text-gray-500">Conexión con Jira Cloud, Filtros y Field Selectors</p>
            </div>
          </div>
          <button
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
            <span>Conexión & Auth</span>
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
            <span>Filtro de Jira (JQL)</span>
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
            <span>Jira Field Selectors</span>
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
            <span>Archivy / Wiki</span>
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
              {/* Mode Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">
                  Modo de Integración Jira
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
                      <span>⚡ Modo Mock</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Demostración local</div>
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
                      <span>🔑 API Token</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Jira Cloud Token</div>
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
                      <span>🔒 Atlassian OAuth</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">OAuth 2.0 (3LO)</div>
                  </button>
                </div>
              </div>

              {/* Mock Help */}
              {authType === 'mock' && (
                <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 leading-relaxed">
                  <p className="font-semibold mb-1">ℹ️ Modo Simulación Activo</p>
                  El sistema cargará datos de prueba realistas para que puedas probar la aplicación sin credenciales.
                </div>
              )}

              {/* PAT Fields */}
              {authType === 'pat' && (
                <div className="space-y-3.5 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Dominio Jira (ej. miempresa.atlassian.net)</label>
                    <input
                      type="text"
                      placeholder="soteasmxsandbox.atlassian.net"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Correo Electrónico de Jira</label>
                    <input
                      type="email"
                      placeholder="usuario@empresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Jira API Token</label>
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
                      Generar token en Atlassian Security <ExternalLink className="w-2.5 h-2.5" />
                    </a>
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

          {/* TAB 2: JIRA FILTER / JQL */}
          {activeTab === 'filter' && (
            <div className="space-y-5">
              <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 text-xs text-blue-900 leading-relaxed">
                <p className="font-semibold mb-1">🎯 Filtrado de Tickets desde Jira</p>
                Puedes configurar un <strong>ID de Filtro de Jira</strong> (número del filtro guardado en tu Jira Cloud, por ejemplo <code className="font-mono bg-blue-100 px-1 rounded">10001</code>) o definir una consulta directa en <strong>JQL</strong>. Al sincronizar, sólo se descargarán los tickets que coincidan con este criterio.
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  ID del Filtro de Jira (Filter ID)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ej. 10001 o fav-1"
                    value={filterId}
                    onChange={(e) => setFilterId(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-lg border border-gray-300 bg-white font-mono focus:ring-1 focus:ring-blue-500 text-gray-800"
                  />
                  <button
                    type="button"
                    disabled={validatingFilter}
                    onClick={handleValidateFilter}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {validatingFilter ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    <span>Validar con Jira</span>
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Encuentra el ID en la URL de Jira al abrir tu filtro: <code className="font-mono text-gray-500">/issues/?filter=10001</code>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Consulta JQL Directa (Jira Query Language)
                </label>
                <textarea
                  rows={3}
                  placeholder="Ej. project = KAN AND status != Done ORDER BY created DESC"
                  value={filterJql}
                  onChange={(e) => setFilterJql(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 bg-white font-mono focus:ring-1 focus:ring-blue-500 text-gray-800 resize-none"
                />
              </div>

              {/* Quick JQL Presets */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Consultas JQL Rápidas
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterJql('project is not EMPTY ORDER BY created DESC')}
                    className="px-2.5 py-1 text-[11px] bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md border border-gray-200"
                  >
                    📁 Todos los proyectos
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterJql('resolution is EMPTY ORDER BY updated DESC')}
                    className="px-2.5 py-1 text-[11px] bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md border border-gray-200"
                  >
                    ⏳ Solo tickets abiertos
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterJql('assignee = currentUser() ORDER BY updated DESC')}
                    className="px-2.5 py-1 text-[11px] bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md border border-gray-200"
                  >
                    👤 Asignados a mí
                  </button>
                </div>
              </div>

              {/* Validation Result Display */}
              {filterValidation && (
                <div
                  className={`p-3.5 rounded-xl border text-xs leading-relaxed animate-in fade-in duration-150 ${
                    filterValidation.valid
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold mb-1">
                    {filterValidation.valid ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Filtro Válido: {filterValidation.name || 'Consulta JQL Correcta'}</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        <span>Error al validar filtro</span>
                      </>
                    )}
                  </div>
                  {filterValidation.valid ? (
                    <p className="text-[11px] text-emerald-700">
                      {filterValidation.message || 'La consulta JQL es compatible y devolverá tickets al sincronizar.'}
                    </p>
                  ) : (
                    <p className="text-[11px] text-rose-700 font-mono">{filterValidation.error}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: JIRA FIELD SELECTORS */}
          {activeTab === 'fields' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">Explorador de Field Selectors de Jira</p>
                  <p className="text-[11px] text-gray-500">
                    Inspecciona todos los campos nativos y personalizados expuestos por Jira Cloud y añádelos a tu tabla con 1 clic.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadJiraFields}
                  disabled={loadingFields}
                  className="px-2.5 py-1.5 text-xs bg-white hover:bg-gray-100 border border-gray-200 rounded-lg flex items-center gap-1 text-gray-700 shadow-2xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingFields ? 'animate-spin text-blue-600' : ''}`} />
                  <span>Recargar</span>
                </button>
              </div>

              {/* Search & Type filter */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar campos (ej. Labels, Sprint, Story Points, Components...)"
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
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setFieldFilterType('standard')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      fieldFilterType === 'standard' ? 'bg-white shadow-2xs text-blue-700 font-bold' : 'text-gray-600'
                    }`}
                  >
                    Estándar
                  </button>
                  <button
                    type="button"
                    onClick={() => setFieldFilterType('custom')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      fieldFilterType === 'custom' ? 'bg-white shadow-2xs text-blue-700 font-bold' : 'text-gray-600'
                    }`}
                  >
                    Custom Fields
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
                              {field.name}
                            </span>
                            <span className="font-mono text-[10px] text-gray-400 block truncate">
                              {field.id} • Tipo: {field.type}
                            </span>
                          </div>
                        </div>

                        <div>
                          {alreadyAdded ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <Check className="w-3 h-3" />
                              <span>Columna Activa</span>
                            </span>
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
                              <span>+ Agregar Columna</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ARCHIVY STORAGE */}
          {activeTab === 'storage' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                  Directorio de Notas Archivy (Markdown)
                </label>
                <input
                  type="text"
                  placeholder="Ruta local o dejar vacío para ./data/archivy_notes"
                  value={archivyDir}
                  onChange={(e) => setArchivyDir(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500 font-mono text-gray-700"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Las notas y documentación de cada ticket se almacenan en archivos Markdown locales (.md) y son completamente versionables en Git.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-between items-center px-6 py-3.5 bg-gray-50 border-t border-gray-100">
          <div className="text-[11px] text-gray-500">
            {activeTab === 'filter' && 'Guarda para aplicar el filtro en la próxima sincronización'}
            {activeTab === 'fields' && `${jiraFields.length} campos disponibles desde Jira Cloud`}
            {activeTab === 'connection' && 'Tus credenciales se guardan localmente en SQLite'}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
