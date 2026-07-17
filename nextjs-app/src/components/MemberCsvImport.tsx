'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  LoaderCircle,
  X,
} from 'lucide-react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import useLocale from '@/hooks/useLocale';
import {
  MEMBER_CSV_TEMPLATE,
  parseMemberCsv,
  type CsvImportBranch,
  type CsvImportIssue,
  type MemberCsvParseResult,
} from '@/lib/members/csvImport';
import { colors, radii, shadows } from '@/ui/theme';

type MemberCsvImportProps = {
  branches: CsvImportBranch[];
};

type ImportMessage = { type: 'success' | 'error'; text: string } | null;

const MAX_FILE_SIZE = 1024 * 1024;

function buttonStyle(): React.CSSProperties {
  return {
    minHeight: 42,
    border: `1px solid ${colors.border}`,
    borderRadius: radii.md,
    background: colors.background,
    color: colors.textPrimary,
    padding: '0 0.9rem',
    fontWeight: 600,
  };
}

function fieldStyle(): React.CSSProperties {
  return {
    width: '100%',
    minHeight: 44,
    border: `1px solid ${colors.border}`,
    borderRadius: radii.md,
    background: colors.background,
    color: colors.textPrimary,
    padding: '0.72rem 0.85rem',
    outline: 'none',
  };
}

function fieldLabel(field: string | undefined, tr: (value: string) => string): string {
  const labels: Record<string, string> = {
    email: 'email',
    fullName: 'jméno',
    branch: 'pobočka',
    role: 'role',
    membershipUntil: 'platnost členství',
    status: 'stav',
    notes: 'poznámka',
  };
  return tr(field ? labels[field] ?? field : 'hodnota');
}

function issueText(issue: CsvImportIssue, tr: (value: string) => string): string {
  const field = fieldLabel(issue.field, tr);
  const messages: Record<CsvImportIssue['code'], string> = {
    empty_file: 'Soubor neobsahuje žádné členy.',
    too_many_rows: 'CSV může obsahovat nejvýše 250 členů.',
    missing_header: 'Chybí povinný sloupec {field}.',
    parse_error: 'CSV se nepodařilo správně přečíst.',
    missing_email: 'Chybí email.',
    invalid_email: 'Email nemá platný formát.',
    duplicate_email: 'Email je v souboru vícekrát.',
    missing_name: 'Chybí jméno.',
    name_too_long: 'Jméno je příliš dlouhé.',
    invalid_role: 'Role není podporovaná.',
    invalid_status: 'Stav není podporovaný.',
    missing_membership_date: 'Chybí platnost členství.',
    invalid_membership_date: 'Platnost musí být ve formátu RRRR-MM-DD.',
    active_membership_expired: 'Aktivní členství nemůže mít datum v minulosti.',
    unknown_branch: 'Pobočka nebyla nalezena nebo není jednoznačná.',
    inactive_branch: 'Aktivního člena nelze přiřadit k neaktivní pobočce.',
    notes_too_long: 'Poznámka může mít nejvýše 500 znaků.',
  };
  const detail = tr(messages[issue.code]).replace('{field}', field);
  return issue.line ? `${tr('Řádek')} ${issue.line}: ${detail}` : detail;
}

export default function MemberCsvImport({ branches }: MemberCsvImportProps) {
  const { tr } = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parseResult, setParseResult] = useState<MemberCsvParseResult | null>(null);
  const [localError, setLocalError] = useState('');
  const [updateExisting, setUpdateExisting] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<ImportMessage>(null);
  const importAccessGrants = useMutation(api.members.importAccessGrants);

  const previewArgs =
    parseResult && parseResult.rows.length > 0 && parseResult.issues.length === 0
      ? { emails: parseResult.rows.map((row) => row.email) }
      : 'skip';
  const preview = useQuery(api.members.previewAccessGrantImport, previewArgs);
  const existingEmails = useMemo(() => new Set(preview?.existingEmails ?? []), [preview]);

  const resetSelection = () => {
    setFileName('');
    setParseResult(null);
    setLocalError('');
    setUpdateExisting(false);
    setReason('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = async (file: File | undefined) => {
    resetSelection();
    setMessage(null);
    if (!file) return;
    setFileName(file.name);
    if (file.size > MAX_FILE_SIZE) {
      setLocalError('Soubor může mít nejvýše 1 MB.');
      return;
    }

    try {
      const text = await file.text();
      setParseResult(parseMemberCsv(text, branches));
    } catch {
      setLocalError('Soubor se nepodařilo načíst.');
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([`\uFEFF${MEMBER_CSV_TEMPLATE}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'psychocas-clenove-vzor.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!parseResult || parseResult.rows.length === 0 || parseResult.issues.length > 0 || !preview) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await importAccessGrants({
        rows: parseResult.rows.map((row) => ({
          email: row.email,
          fullName: row.fullName,
          role: row.role,
          status: row.status,
          membershipUntil: row.membershipUntil,
          branchId: row.branchId as Id<'branches'> | undefined,
          notes: row.notes,
        })),
        updateExisting,
        reason: reason.trim() || undefined,
      });
      const skipped = result.skippedCount + result.protectedCount;
      setMessage({
        type: 'success',
        text: tr('Import dokončen: {created} nových, {updated} aktualizovaných, {skipped} přeskočených.')
          .replace('{created}', String(result.createdCount))
          .replace('{updated}', String(result.updatedCount))
          .replace('{skipped}', String(skipped)),
      });
      resetSelection();
    } catch {
      setMessage({ type: 'error', text: tr('Import se nepodařilo uložit. Zkontroluj data a oprávnění.') });
    } finally {
      setSaving(false);
    }
  };

  const valid = Boolean(parseResult && parseResult.rows.length > 0 && parseResult.issues.length === 0);

  return (
    <section
      className="rounded-lg border bg-white p-4 sm:p-5"
      style={{ borderColor: colors.border, boxShadow: shadows.sm }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center"
            style={{ borderRadius: radii.md, background: colors.brandSurface, color: colors.brandPrimary }}
          >
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold" style={{ color: colors.textPrimary }}>
              {tr('Import členů z CSV')}
            </h2>
            <p className="mt-1 text-sm leading-5" style={{ color: colors.textSecondary }}>
              {tr('Nejdřív zkontrolujeme všechny řádky. Bez potvrzení se nic neuloží.')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="inline-flex items-center justify-center gap-2"
          style={buttonStyle()}
          aria-expanded={open}
        >
          {open ? <X className="h-4 w-4" /> : <FileUp className="h-4 w-4" />}
          {tr(open ? 'Zavřít import' : 'Otevřít import')}
        </button>
      </div>

      {open && (
        <div className="mt-5 space-y-4 border-t pt-4" style={{ borderColor: colors.border }}>
          <div className="grid gap-2 sm:grid-cols-2">
            <label
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 font-semibold text-white"
              style={{ background: colors.brandPrimary }}
            >
              <FileUp className="h-4 w-4" />
              {tr(fileName ? 'Vybrat jiné CSV' : 'Vybrat CSV')}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
            </label>
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center justify-center gap-2"
              style={buttonStyle()}
            >
              <Download className="h-4 w-4" />
              {tr('Stáhnout vzor CSV')}
            </button>
          </div>

          {fileName && (
            <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ background: colors.neutralSurface }}>
              <span className="min-w-0 truncate text-sm font-semibold">{fileName}</span>
              <button
                type="button"
                onClick={resetSelection}
                className="grid h-9 w-9 shrink-0 place-items-center"
                title={tr('Odebrat soubor')}
                aria-label={tr('Odebrat soubor')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {(localError || (parseResult && parseResult.issues.length > 0)) && (
            <div className="rounded-lg border p-3" style={{ borderColor: colors.dangerSurface, background: colors.dangerSurface }} role="alert">
              <div className="flex items-center gap-2 font-semibold" style={{ color: colors.dangerStrong }}>
                <AlertTriangle className="h-4 w-4" />
                {tr('CSV obsahuje chyby')}
              </div>
              <ul className="mt-2 space-y-1 text-sm" style={{ color: colors.dangerStrong }}>
                {localError && <li>{tr(localError)}</li>}
                {parseResult?.issues.slice(0, 20).map((issue, index) => (
                  <li key={`${issue.code}-${issue.line ?? 0}-${index}`}>{issueText(issue, tr)}</li>
                ))}
                {(parseResult?.issues.length ?? 0) > 20 && (
                  <li>{tr('Další chyby oprav podle stejného pravidla a soubor načti znovu.')}</li>
                )}
              </ul>
            </div>
          )}

          {valid && (
            <>
              <div className="grid grid-cols-3 gap-2" aria-live="polite">
                <div className="rounded-lg p-3" style={{ background: colors.neutralSurface }}>
                  <p className="text-xl font-semibold">{parseResult?.rowCount ?? 0}</p>
                  <p className="text-xs" style={{ color: colors.textSecondary }}>{tr('Řádků')}</p>
                </div>
                <div className="rounded-lg p-3" style={{ background: colors.successSurface, color: colors.success }}>
                  <p className="text-xl font-semibold">{preview?.newCount ?? '…'}</p>
                  <p className="text-xs">{tr('Nových')}</p>
                </div>
                <div className="rounded-lg p-3" style={{ background: colors.infoSurface, color: colors.brandOnSurface }}>
                  <p className="text-xl font-semibold">{preview?.existingCount ?? '…'}</p>
                  <p className="text-xs">{tr('Existujících')}</p>
                </div>
              </div>

              <div className="divide-y rounded-lg border" style={{ borderColor: colors.border }}>
                {parseResult?.rows.slice(0, 12).map((row) => {
                  const existing = existingEmails.has(row.email);
                  const previewPending = !preview;
                  return (
                    <div key={row.email} className="flex items-start gap-3 p-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: colors.success }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{row.fullName}</p>
                        <p className="truncate text-xs" style={{ color: colors.textSecondary }}>{row.email}</p>
                        <p className="mt-1 text-xs" style={{ color: colors.textSecondary }}>
                          {row.branchLabel ?? tr('Bez pobočky')} · {row.membershipDate}
                        </p>
                      </div>
                      <span
                        className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold"
                        style={{
                          background: previewPending
                            ? colors.neutralSurface
                            : existing
                              ? colors.infoSurface
                              : colors.successSurface,
                          color: previewPending
                            ? colors.textSecondary
                            : existing
                              ? colors.brandOnSurface
                              : colors.success,
                        }}
                      >
                        {tr(previewPending ? 'Kontroluji…' : existing ? 'Existuje' : 'Nový')}
                      </span>
                    </div>
                  );
                })}
                {(parseResult?.rows.length ?? 0) > 12 && (
                  <p className="p-3 text-center text-sm" style={{ color: colors.textSecondary }}>
                    {tr('A dalších {count} řádků…').replace('{count}', String((parseResult?.rows.length ?? 0) - 12))}
                  </p>
                )}
              </div>

              {(preview?.existingCount ?? 0) > 0 && (
                <label className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: colors.border }}>
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(event) => setUpdateExisting(event.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0"
                  />
                  <span className="text-sm">
                    <strong className="block">{tr('Aktualizovat existující členy')}</strong>
                    <span style={{ color: colors.textSecondary }}>
                      {tr('Bez zaškrtnutí se existující emaily bezpečně přeskočí.')}
                    </span>
                  </span>
                </label>
              )}

              <label className="block space-y-1 text-sm">
                <span style={{ color: colors.textSecondary }}>{tr('Důvod importu')}</span>
                <input
                  value={reason}
                  maxLength={300}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={tr('Například import členů pro akademický rok')}
                  style={fieldStyle()}
                />
              </label>

              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={saving || !preview}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 font-semibold text-white"
                style={{ background: saving || !preview ? colors.textSecondary : colors.brandPrimary }}
              >
                {saving || !preview ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {tr(saving ? 'Importuji…' : 'Potvrdit import')}
              </button>
            </>
          )}

          {message && (
            <div
              role={message.type === 'error' ? 'alert' : 'status'}
              className="rounded-lg px-4 py-3 text-sm font-semibold"
              style={{
                background: message.type === 'success' ? colors.successSurface : colors.dangerSurface,
                color: message.type === 'success' ? colors.success : colors.dangerStrong,
              }}
            >
              {message.text}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
