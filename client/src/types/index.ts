export type ColumnType =
  | 'single_select'
  | 'text'
  | 'long_text'
  | 'date'
  | 'number'
  | 'archivy_link';

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
