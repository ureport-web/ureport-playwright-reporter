export interface TestTransformResult {
  name?: string;                                  // display name + UID override
  relations?: Record<string, string | string[]>;  // extracted fields → saved as customs
}

export interface TestTransformContext {
  browser?: string;
  device?: string;
  platform?: string;
  platform_version?: string;
  stage?: string;
  version?: string;
  team?: string;
}

export interface UReportTestRelationPayload {
  uid: string;
  product: string;
  type: string;
  file?: string;
  path?: string;
  components?: string[];
  teams?: string[];
  tags?: string[];
  customs?: Record<string, unknown>;
}

export interface UReportBuildPayload {
  product: string;
  type: string;
  build: number;
  team?: string;
  browser?: string;
  device?: string;
  platform?: string;
  platform_version?: string;
  stage?: string;
  version?: string;
  start_time: string;
  environments?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface UReportBuildResponse {
  _id: string;
  [key: string]: unknown;
}

export interface UReportStepAttachment {
  screenshot?: string;       // base64 PNG/JPEG
  content?: string;          // raw text (JSON string, XML string, curl command, etc.)
  'content-type'?: string;   // comma-separated UReport format tokens: "json", "xml", "curl", "text"
}

export interface UReportStepPayload {
  timestamp: string;
  status: 'PASS' | 'FAIL';
  detail: string;
  attachment?: UReportStepAttachment;
  steps?: UReportStepPayload[];
}

export interface UReportFailure {
  error_message: string;
  stack_trace?: string;
}

// UReport does not have RERUN_FAIL / RERUN_SKIP status values.
// Retried failures/skips use the same FAIL/SKIP status as the first attempt;
// is_rerun: true on the payload is what signals "this was a retry".
export type UReportStatus =
  | 'PASS'
  | 'FAIL'
  | 'SKIP'
  | 'RERUN_PASS';

export interface UReportTestInfo {
  file: string;
  path: string;
  tags?: string[];
  components?: string[];
  teams?: string[];
  duration?: string; // e.g. "4.2s"
  quickInfo?: Array<{ key: string; value: string }>;
  [key: string]: unknown;
}

export interface UReportTestPayload {
  uid: string;
  name: string;
  build: string;
  status: UReportStatus;
  start_time: string;
  end_time: string;
  is_rerun: boolean;
  failure?: UReportFailure;
  info?: UReportTestInfo;
  body?: UReportStepPayload[];
  setup?: UReportStepPayload[];
  teardown?: UReportStepPayload[];
}
