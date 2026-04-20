
export interface AuditCheck {
  id: string;
  category: 'placement' | 'distance' | 'poster' | 'prohibited' | 'general';
  title: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  suggestion?: string;
}

export interface AuditResult {
  overallScore: number; // 0-100
  summary: string;
  checks: AuditCheck[];
  timestamp: string;
}

export interface Company {
  id: string;
  name: string;
  createdAt: string;
}

export interface Guideline {
  id: string;
  companyId: string;
  name: string;
  description: string;
  rules: string;
  images: string[]; // Base64 strings
  createdAt: string;
}
