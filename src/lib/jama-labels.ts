import type { SalaryPaidStatus } from "@/types";

export const JAMA_LABEL = "Jama";

export const SALARY_STATUS_LABELS: Record<SalaryPaidStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  deferred: JAMA_LABEL,
  skipped: "Skipped",
};

export const JAMA_LINE_STATUS_LABELS = {
  open: "Open",
  carried_forward: "Carried forward",
  settled: "Settled",
} as const;

export const JAMA_UI = {
  report: "Jama Report",
  statement: "Jama Salary Statement",
  statementByEmployee: "Jama Salary Statement — By Employee",
  andSkipped: "Jama & Skipped",
  outstanding: "Outstanding Jama",
  outstandingAll: "All outstanding jama",
  add: "Jama Add.",
  period: "Jama period",
  count: "Jama Count",
  months: "Jama months",
  export: "Export Jama",
  exportExcel: "Export Jama Excel",
  exportPdf: "Export Jama PDF",
  inPending: "Jama In Pending",
  lines: "Jama Lines",
  fromPriorMonths: "Jama from prior month(s)",
  noData: "No jama salary data",
  noDataFilters: "No jama salary data for these filters",
  loadingStatement: "Loading jama statement...",
  loadingReport: "Loading jama report...",
  statementDownloaded: "Jama statement downloaded",
  reportDownloaded: (format: string) => `Jama report ${format} downloaded`,
  markedSuccess: "Salary marked as Jama — amount will carry to next month",
  actionTitle: "Jama Salary",
  actionButton: "Jama",
  actionTooltip: "Jama — pay later, adds to next month",
  addJama: "Add Jama",
  addJamaTitle: "New Jama Salary",
  addJamaDescription:
    "Record jama (pay later) for an employee. Amount will carry forward to a future salary month.",
  addJamaSuccess: "Jama salary recorded",
  filterStatement: "Filter jama statement by period, office, employee, and status",
  statementDescription:
    "Employee-wise jama salary statement with carry-forward and settlement history",
  expandLines: "Click a row to expand month-wise jama lines",
  expandDetails:
    "Click a row to see each jama month, carry-forward target, and settlement",
  outstandingNote:
    "Jama outstanding shows all salaries still owed (any month). Settled jama and skipped/waived entries use the selected Year from filters above.",
  settledNote:
    "Outstanding jama shows all salaries still owed (any month). Settled jama uses the selected year.",
  scopePrefix: "Jama statement scope:",
  pageDescription:
    "Jama (pay later + carry forward), Skip (waived), or Pay pending salaries",
} as const;
