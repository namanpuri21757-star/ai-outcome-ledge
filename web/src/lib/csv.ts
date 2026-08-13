import type { LedgerRow } from './types';

/** Escape per RFC 4180: quote when the value contains a comma, quote or
 *  newline, and double any embedded quotes. Getting this wrong silently
 *  corrupts every export that contains a claim with a comma in it, which is
 *  most of them. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const EXPORT_COLUMNS = [
  'ref','company_name','claim_date','claim_kind','headline','claimed_amount_usd','claimed_value',
  'claimed_unit','measurement_basis','measurement_definition','destination','destination_rationale',
  'counterparty_absorbed','counterparty_name','transfer_amount_usd','traceable_to_pl_usd',
  'unreconciled_usd','reconciliation_note','observed_counter_move','cond_billing_unit_survives',
  'cond_demand_sink','cond_permission_to_act','epistemic_tag','evidence_tier','conflict_of_interest',
  'verification_status','verify_hint','source_type','source_name','source_url','source_date',
  'group_code','sector','margin_delta_1q_bps','margin_delta_4q_bps','price_delta_4q',
] as const;

export function toCsv(rows: LedgerRow[], columns: readonly string[] = EXPORT_COLUMNS): string {
  const header = columns.join(',');
  const body = rows.map((r) => columns.map((c) => csvCell((r as any)[c])).join(','));
  return [header, ...body].join('\r\n');
}

export function downloadCsv(filename: string, csv: string): void {
  // Byte order mark so spreadsheet software opens it as UTF-8 rather than
  // mangling every accented company name.
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
