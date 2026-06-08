import type { AngadiyaDetails, SalaryRecord } from "@/types";

export function normalizePhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function openWhatsAppShare(phone: string | undefined, message: string): void {
  const base = phone
    ? `https://wa.me/${normalizePhoneForWhatsApp(phone)}`
    : "https://wa.me/";
  const url = `${base}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function empMobile(emp: SalaryRecord["employeeId"]) {
  return typeof emp === "object" && emp !== null ? emp.mobileNumber : "";
}

function formatRs(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function formatAngadiyaBlock(details: {
  name: string;
  number: string;
  amount: number;
  city: string;
}): string {
  return [
    `Name: ${details.name}`,
    `Number: ${details.number}`,
    `Amount: ${formatRs(Number(details.amount))}`,
    `City: ${details.city}`,
  ].join("\n");
}

function angadiyaFromSalary(salary: SalaryRecord): AngadiyaDetails | null {
  const d = salary.angadiyaDetails;
  if (!d) return null;
  return {
    name: d.name,
    number: d.number || empMobile(salary.employeeId),
    amount: d.amount ?? salary.finalSalary,
    city: d.city,
    angadiyaNumber: d.angadiyaNumber,
  };
}

export function formatAngadiyaSalaryMessage(
  salary: SalaryRecord,
  angadiya?: Pick<AngadiyaDetails, "name" | "number" | "amount" | "city">
): string {
  const stored = angadiyaFromSalary(salary);
  const details = angadiya ?? stored;
  if (!details) return "";

  return formatAngadiyaBlock({
    name: details.name,
    number: details.number || empMobile(salary.employeeId),
    amount: Number(details.amount ?? salary.finalSalary),
    city: details.city,
  });
}

export function formatAngadiyaBulkMessage(salaries: SalaryRecord[]): string {
  return salaries
    .map((s) => formatAngadiyaSalaryMessage(s))
    .filter(Boolean)
    .join("\n\n");
}

function sharedAngadiyaContact(salaries: SalaryRecord[]): string | undefined {
  const contacts = salaries
    .map((s) => s.angadiyaDetails?.angadiyaNumber?.trim())
    .filter((c): c is string => Boolean(c));
  if (contacts.length === 0) return undefined;
  const first = contacts[0];
  return contacts.every((c) => c === first) ? first : undefined;
}

export function shareAngadiyaSalary(
  salary: SalaryRecord,
  angadiya?: Pick<AngadiyaDetails, "name" | "number" | "amount" | "city" | "angadiyaNumber">
): void {
  const contact =
    angadiya?.angadiyaNumber ?? salary.angadiyaDetails?.angadiyaNumber;
  const message = formatAngadiyaSalaryMessage(salary, angadiya);
  openWhatsAppShare(contact, message);
}

export function shareAngadiyaSalaries(salaries: SalaryRecord[]): void {
  const angadiyaSalaries = salaries.filter(
    (s) => s.paidStatus === "paid" && s.paymentMode === "angadiya"
  );
  if (angadiyaSalaries.length === 0) return;

  const message = formatAngadiyaBulkMessage(angadiyaSalaries);
  const contact = sharedAngadiyaContact(angadiyaSalaries);
  openWhatsAppShare(contact, message);
}
