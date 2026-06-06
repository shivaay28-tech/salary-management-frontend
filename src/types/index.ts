export type UserRole = "super_admin" | "sub_admin";
export type Permission =
  | "dashboard"
  | "employees"
  | "salaries"
  | "advances"
  | "reports";
export type OfficeStatus = "active" | "inactive";
export type EmployeeStatus = "active" | "inactive";
export type SalaryPaidStatus = "pending" | "paid";
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
    advancesThisMonth: number;
  };
  charts: {
    salaryTrend: { label: string; total: number; paid: number; pending: number }[];
    officeWiseSalary: {
      office: string;
      total: number;
      paid: number;
      pending: number;
    }[];
    advanceTrend: { label: string; total: number }[];
    salaryStatus: { paid: number; pending: number };
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
