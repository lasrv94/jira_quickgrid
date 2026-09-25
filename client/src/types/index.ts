export type ColumnType =
  | 'single_select'
  | 'text'
  | 'long_text'
  | 'date'
  | 'number'
  | 'archivy_link'
  | 'jira_field'
  | 'formula';

export interface SelectOption {
  id: string;
  label: string;
  color: string;
}

export interface CustomColumn {
  id: string;
  name: string;
  type: ColumnType;
  options?: SelectOption[];
  position: number;
  is_visible: boolean;
  width: number;
  jira_field_key?: string;
  formula?: string;
}

export interface JiraFieldInfo {
  id: string;
  name: string;
  custom: boolean;
  type: string;
  navigable?: boolean;
}

export interface JiraIssue {
  key: string;
  jira_id?: string;
  summary: string;
  jira_status: string;
  jira_status_category: string;
  issue_type: string;
  priority: string;
  assignee_name?: string;
  assignee_avatar?: string;
  reporter_name?: string;
  jira_created_at?: string;
  jira_updated_at?: string;
  last_synced_at?: string;
  is_archived_in_jira: boolean;
  custom_values: Record<string, any>;
  raw_jira_fields?: Record<string, any>;
}

export interface JiraFilter {
  id: string;
  name: string;
  jql: string;
  description?: string;
}

export interface AppConfig {
  id: string;
  selected_filter_id?: string;
  selected_filter_name?: string;
  filter_jql?: string;
  last_sync?: string;
  jira_auth_type: 'mock' | 'pat' | 'oauth';
  jira_domain?: string;
  jira_email?: string;
  has_api_token: boolean;
  has_oauth_token: boolean;
  jira_api_token?: string;
  jira_verify_tls?: boolean;
  jira_client_id?: string;
  jira_client_secret?: string;
  jira_cloud_id?: string;
  archivy_dir?: string;
}

export interface ArchivyNote {
  issue_key: string;
  title: string;
  content: string;
  exists: boolean;
  updated_at?: string;
  path?: string;
}

export type FilterOperator =
  | 'contains'
  | 'not_contains'
  | 'equals'
  | 'not_equals'
  | 'starts_with'
  | 'ends_with'
  | 'has_any_of'
  | 'has_all_of'
  | 'has_none_of'
  | 'is_exactly'
  | 'is_empty'
  | 'is_not_empty'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'is_before'
  | 'is_after'
  | 'is_on_or_before'
  | 'is_on_or_after'
  | 'is_today'
  | 'is_yesterday'
  | 'in_last_7_days'
  | 'in_last_30_days'
  | 'in_this_month'
  | 'in_this_year';

export interface FilterCondition {
  id: string;
  fieldId: string;
  operator: FilterOperator;
  value: string;
}

export type FilterConjunction = 'and' | 'or';

export interface FilterRules {
  conditions: FilterCondition[];
  conjunction: FilterConjunction;
}

export interface SavedView {
  id: string;
  name: string;
  group_by?: string | null;
  sort_field?: string | null;
  sort_direction?: 'asc' | 'desc';
  search_query?: string;
  filter_id?: string | null;
  visible_columns?: string[] | null;
  filter_rules?: FilterRules | null;
  is_default?: boolean;
  created_at?: string;
}


