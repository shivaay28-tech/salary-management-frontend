export type UserRole = "super_admin" | "sub_admin";
export type Permission =
  | "dashboard"
  | "offices"
  | "employees"
  | "salaries"
  | "advances"
  | "reports"
  | "users"
  | "audit_logs";
export type OfficeStatus = "active" | "inactive";
export type EmployeeStatus = "active" | "inactive";
export type SalaryPaidStatus = "pending" | "paid" | "deferred" | "skipped";
export type AdvanceRecoveryMode = "full" | "installment" | "custom";
export type SalaryPaymentMode = "bank" | "angadiya" | "cash_in_hand";

export interface Office {
  _id: string;
  name: string;
  contactNumber: string;
  status: OfficeStatus;
}

export interface BankDetails {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
}

export interface AngadiyaDetails {
  name: string;
  number: string;
  angadiyaNumber: string;
  amount: number;
  city: string;
}

export interface Employee {
  _id: string;
  fullName: string;
  mobileNumber: string;
  photoUrl?: string;
  dateOfJoining: string;
  officeId: Office | string;
  status: EmployeeStatus;
  outDate?: string;
  monthlySalary: number;
  paymentMode?: SalaryPaymentMode;
  bankDetails?: BankDetails;
  angadiyaDetails?: AngadiyaDetails;
}

export interface Advance {
  _id: string;
  employeeId: Employee | string;
  officeId: Office | string;
  advanceAmount: number;
  date: string;
  reason: string;
  notes?: string;
  outstandingAmount: number;
  recoveryMode: AdvanceRecoveryMode;
  installmentAmount?: number;
  amountRecovered: number;
  isFullyRecovered: boolean;
}

export interface SalaryRecord {
  _id: string;
  employeeId: Employee | string;
  officeId: Office | string;
  month: number;
  year: number;
  baseSalary: number;
  bonus: number;
  otherAddition: number;
  otherDeduction: number;
  advanceDeduction: number;
  advanceDeductionManual?: boolean;
  outstandingAdvance?: number;
  finalSalary: number;
  paidStatus: SalaryPaidStatus;
  paidDate?: string;
  paymentMode?: SalaryPaymentMode;
  bankDetails?: BankDetails;
  angadiyaDetails?: AngadiyaDetails;
  remarks?: string;
  deferredCarryForward?: number;
  settledDeferredIds?: string[];
  deferredUntilMonth?: number;
  deferredUntilYear?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  assignedOfficeIds: Office[] | string[];
  permissions?: Permission[];
  isActive?: boolean;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface DeferredStatementEntry {
  id: string;
  month: number;
  year: number;
  periodLabel: string;
  amount: number;
  remarks?: string;
  lineStatus: "open" | "carried_forward" | "settled";
  carriedToPeriod?: string;
  settledInPeriod?: string;
  settledOn?: string;
  deferredAt?: string;
}

export interface DeferredStatementEmployee {
  employeeId: string;
  fullName: string;
  mobileNumber: string;
  officeName: string;
  totalOutstanding: number;
  totalSettled: number;
  pendingCarryPeriod?: string;
  pendingCarryAmount?: number;
  pendingNetSalary?: number;
  entries: DeferredStatementEntry[];
}

export interface DeferredSalaryStatement {
  generatedAt: string;
  scope: string;
  employeeCount: number;
  totalOutstanding: number;
  totalSettled: number;
  totalPendingCarry: number;
  byEmployee: DeferredStatementEmployee[];
}

export interface SkippedStatementEntry {
  id: string;
  month: number;
  year: number;
  periodLabel: string;
  waivedAmount: number;
  remarks?: string;
  skippedAt?: string;
}

export interface SkippedStatementEmployee {
  employeeId: string;
  fullName: string;
  mobileNumber: string;
  officeName: string;
  skippedCount: number;
  totalWaived: number;
  entries: SkippedStatementEntry[];
}

export interface SkippedSalaryStatement {
  generatedAt: string;
  scope: string;
  employeeCount: number;
  totalSkipped: number;
  totalWaived: number;
  byEmployee: SkippedStatementEmployee[];
}

export interface DashboardData {
  period: { month: number; year: number; label: string };
  cards: {
    totalOffices: number;
    totalEmployees: number;
    activeEmployees: number;
    totalMonthlySalary: number;
    totalOutstandingAdvances: number;
    paidSalaryThisMonth: number;
    pendingSalaryThisMonth: number;
    deferredSalaryThisMonth: number;
    deferredCountThisMonth: number;
    skippedCountThisMonth: number;
    advancesThisMonth: number;
  };
  charts: {
    salaryTrend: {
      label: string;
      total: number;
      paid: number;
      pending: number;
      deferred: number;
      skipped: number;
    }[];
    officeWiseSalary: {
      office: string;
      total: number;
      paid: number;
      pending: number;
      deferred: number;
    }[];
    advanceTrend: { label: string; total: number }[];
    salaryStatus: { paid: number; pending: number; deferred: number; skipped: number };
  };
  recent: {
    salaries: SalaryRecord[];
    advances: Advance[];
    employees: Employee[];
  };
}

export interface AuditLog {
  _id: string;
  userEmail: string;
  action: string;
  module: string;
  details?: Record<string, unknown>;
  createdAt: string;
}
