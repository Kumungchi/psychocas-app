'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ExternalLink, Loader2, PlusCircle, RefreshCcw, Trash2 } from 'lucide-react';
import Navigation from '@/components/Navigation';
import useMemberContext from '@/hooks/useMemberContext';
import useLocale from '@/hooks/useLocale';
import { supabase } from '@/lib/supabaseClient';
import Card from '@/ui/components/Card';
import Button from '@/ui/components/Button';
import Badge from '@/ui/components/Badge';
import type { MemberRole } from '@/types/member';
import {
  prepareMemberEventPayload,
  type MemberEventFormErrors,
  type MemberEventFormState,
  type MemberEventFormErrorKey,
  type MemberEventRecord,
} from '@/lib/events';
import { colors } from '@/ui/theme';
import { logError } from '@/lib/logging';

const demoEvents: MemberEventRecord[] = [
  {
    id: 'demo-event-1',
    title: 'Ukázková událost Psychočas',
    description:
      'Zde se zobrazí aktuální akce a důležité informace pro členy. Tuto ukázku vidí pouze v demo režimu.',
    link_label: 'Web Psychočas',
    link_url: 'https://psychocas.cz',
    created_at: new Date().toISOString(),
  },
];

const defaultFormState: MemberEventFormState = {
  title: '',
  description: '',
  linkLabel: '',
  linkUrl: '',
};

type FeedbackMessage = { type: 'success' | 'error'; text: string };

export default function EventsPage() {
  const { t, formatMessage } = useLocale();
  const { status, member, user, error, refresh } = useMemberContext({ scope: 'events-page' });

  const memberRole: MemberRole = member?.role ?? 'member';
  const canManage = memberRole === 'manager' || memberRole === 'council' || memberRole === 'admin';
  const isDemo = member?.origin === 'demo';

  const [events, setEvents] = useState<MemberEventRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formState, setFormState] = useState<MemberEventFormState>(defaultFormState);
  const [formErrors, setFormErrors] = useState<MemberEventFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const errorMessages = useMemo<Record<MemberEventFormErrorKey, string>>(
    () => ({
      titleTooShort: t('events.formErrors.titleTooShort'),
      titleTooLong: t('events.formErrors.titleTooLong'),
      descriptionTooLong: t('events.formErrors.descriptionTooLong'),
      linkUrlInvalid: t('events.formErrors.linkUrlInvalid'),
      linkLabelMissing: t('events.formErrors.linkLabelMissing'),
    }),
    [t]
  );

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    if (isDemo) {
      setEvents(demoEvents);
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('member_events')
      .select('id, title, description, link_label, link_url, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (fetchError) {
      logError('events-page', 'Failed to load member events', fetchError);
      setLoadError(t('events.states.errorDescription'));
    } else {
      setEvents((data ?? []) as MemberEventRecord[]);
    }

    setLoading(false);
  }, [isDemo, t]);

  useEffect(() => {
    if (status === 'ready') {
      void loadEvents();
    }
  }, [loadEvents, status]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeout = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timeout);
  }, [message]);

  const handleFieldChange = useCallback(
    <K extends keyof MemberEventFormState>(field: K, value: MemberEventFormState[K]) => {
      setFormState((prev) => ({ ...prev, [field]: value }));
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    []
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const validation = prepareMemberEventPayload(formState);
      setFormErrors(validation.errors);

      const payload = validation.payload;

      if (!payload) {
        setMessage({ type: 'error', text: t('events.manage.error') });
        return;
      }

      if (isDemo) {
        setEvents((prev) => {
          const demoRecord: MemberEventRecord = {
            id: `demo-event-${prev.length + 1}`,
            title: payload.title,
            description: payload.description ?? null,
            link_label: payload.link_label ?? null,
            link_url: payload.link_url ?? null,
            created_at: new Date().toISOString(),
          };

          return [demoRecord, ...prev];
        });
        setFormState(defaultFormState);
        setMessage({ type: 'success', text: t('events.manage.success') });
        return;
      }

      if (!user) {
        setMessage({ type: 'error', text: t('events.manage.error') });
        return;
      }

      setSaving(true);
      const { error: insertError } = await supabase.from('member_events').insert([
        {
          ...payload,
          created_by: user.id,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
      ]);

      if (insertError) {
        logError('events-page', 'Failed to insert member event', insertError);
        setMessage({ type: 'error', text: t('events.manage.error') });
      } else {
        setMessage({ type: 'success', text: t('events.manage.success') });
        setFormState(defaultFormState);
        await loadEvents();
      }

      setSaving(false);
    },
    [formState, isDemo, loadEvents, t, user]
  );

  const handleDelete = useCallback(
    async (eventId: string) => {
      if (!confirm(t('events.manage.deleteConfirm'))) {
        return;
      }

      if (isDemo) {
        setEvents((prev) => prev.filter((entry) => entry.id !== eventId));
        setMessage({ type: 'success', text: t('events.manage.deleteSuccess') });
        return;
      }

      setPendingDeleteId(eventId);
      const { error: deleteError } = await supabase.from('member_events').delete().eq('id', eventId);

      if (deleteError) {
        logError('events-page', 'Failed to delete member event', deleteError);
        setMessage({ type: 'error', text: t('events.manage.deleteError') });
      } else {
        setMessage({ type: 'success', text: t('events.manage.deleteSuccess') });
        await loadEvents();
      }

      setPendingDeleteId(null);
    },
    [isDemo, loadEvents, t]
  );

  if (status === 'loading' || status === 'idle') {
    return (
      <main className="psychocas-section pb-24">
        <div className="psychocas-container fade-in-up">
          <div className="psychocas-card flex items-center gap-3" style={{ color: colors.textSecondary }}>
            <Loader2 className="h-5 w-5 animate-spin" />
            {t('events.states.loading')}
          </div>
        </div>
      </main>
    );
  }

  if (status === 'error' || !member) {
    return (
      <main className="psychocas-section pb-24">
        <div className="psychocas-container fade-in-up">
          <div className="psychocas-card space-y-4">
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
              {t('events.states.errorTitle')}
            </h2>
            <p style={{ color: colors.textSecondary }}>{error ?? t('events.states.errorDescription')}</p>
            <button onClick={refresh} className="psychocas-button-primary w-max flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" /> {t('events.states.refresh')}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="psychocas-section pb-28">
      <div className="psychocas-container fade-in-up space-y-6 pt-6 pb-28">
        <header className="space-y-2">
          <span className="stat-pill stat-pill--info w-fit text-sm">
            <CalendarDays className="h-4 w-4" />
            Psychočas
          </span>
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 lg:text-[2.5rem]">{t('events.heading')}</h1>
            <p className="text-base text-slate-600 lg:text-lg">{t('events.subheading')}</p>
          </div>
        </header>

        {message && (
          <div
            className="psychocas-card text-sm"
            style={{
              border: `1px solid ${message.type === 'error' ? colors.danger : colors.accent}`,
              color: message.type === 'error' ? colors.danger : colors.success,
              backgroundColor: message.type === 'error' ? colors.dangerSurface : colors.successSurface,
            }}
          >
            {message.text}
          </div>
        )}

        <Card title={formatMessage('events.listTitle', { count: events.length })}>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('events.states.loading')}
            </div>
          ) : loadError ? (
            <p className="text-sm text-rose-600">{loadError}</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-slate-500">{t('events.empty')}</p>
          ) : (
            <div className="space-y-4">
              {events.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-lg"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">{entry.title}</h3>
                      {entry.created_at && (
                        <Badge tone="info">
                          {new Intl.DateTimeFormat(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          }).format(new Date(entry.created_at))}
                        </Badge>
                      )}
                    </div>
                    {entry.description && <p className="text-sm leading-relaxed text-slate-600">{entry.description}</p>}
                    <div className="flex flex-wrap items-center gap-3">
                      {entry.link_url ? (
                        <a
                          href={entry.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 transition hover:text-sky-900"
                        >
                          <ExternalLink className="h-4 w-4" />
                          {entry.link_label ?? t('events.linkDefaultLabel')}
                        </a>
                      ) : (
                        <span className="text-sm text-slate-400">{t('events.listNoLink')}</span>
                      )}
                      {canManage && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => void handleDelete(entry.id)}
                          disabled={pendingDeleteId === entry.id}
                          className="ml-auto"
                        >
                          <Trash2 className={pendingDeleteId === entry.id ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                          {pendingDeleteId === entry.id
                            ? t('events.manage.deleting')
                            : t('events.manage.delete')}
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>

        {canManage && (
          <Card title={t('events.manage.heading')} subtitle={t('events.manage.description')}>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="event-title">
                  {t('events.manage.title')}
                </label>
                <input
                  id="event-title"
                  className="psychocas-input"
                  value={formState.title}
                  onChange={(event) => handleFieldChange('title', event.target.value)}
                  placeholder={t('events.manage.titlePlaceholder')}
                  required
                />
                {formErrors.title && (
                  <p className="text-sm text-rose-600">{errorMessages[formErrors.title]}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="event-description">
                  {t('events.manage.descriptionLabel')}
                </label>
                <textarea
                  id="event-description"
                  className="psychocas-input"
                  rows={4}
                  value={formState.description}
                  onChange={(event) => handleFieldChange('description', event.target.value)}
                  placeholder={t('events.manage.descriptionPlaceholder')}
                />
                {formErrors.description && (
                  <p className="text-sm text-rose-600">{errorMessages[formErrors.description]}</p>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="event-link-label">
                    {t('events.manage.linkLabel')}
                  </label>
                  <input
                    id="event-link-label"
                    className="psychocas-input"
                    value={formState.linkLabel}
                    onChange={(event) => handleFieldChange('linkLabel', event.target.value)}
                    placeholder={t('events.manage.linkLabelPlaceholder')}
                  />
                  {formErrors.linkLabel && (
                    <p className="text-sm text-rose-600">{errorMessages[formErrors.linkLabel]}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="event-link-url">
                    {t('events.manage.linkUrl')}
                  </label>
                  <input
                    id="event-link-url"
                    className="psychocas-input"
                    value={formState.linkUrl}
                    onChange={(event) => handleFieldChange('linkUrl', event.target.value)}
                    placeholder={t('events.manage.linkUrlPlaceholder')}
                  />
                  {formErrors.linkUrl && (
                    <p className="text-sm text-rose-600">{errorMessages[formErrors.linkUrl]}</p>
                  )}
                </div>
              </div>

              <Button type="submit" disabled={saving}>
                <PlusCircle className={saving ? 'h-5 w-5 animate-spin' : 'h-5 w-5'} />
                {saving ? t('events.manage.submitting') : t('events.manage.submit')}
              </Button>
            </form>
          </Card>
        )}
      </div>

      <Navigation userRole={memberRole} />
    </main>
  );
}
