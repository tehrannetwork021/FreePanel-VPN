import { useState, type FormEvent } from 'react';
import type { TranslationKey } from '@tehrannetwork/i18n';
import type { CreateUserInput, UserRecord } from '../api/client';

type T = (key: TranslationKey) => string;
type Props = {
  t: T;
  user?: UserRecord | null;
  busy?: boolean;
  onSave(input: CreateUserInput): Promise<void> | void;
  onCancel(): void;
};

function inputNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function localDate(epoch: number | null | undefined): string {
  if (!epoch) return '';
  const date = new Date(epoch);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function UserEditor({ t, user, busy = false, onSave, onCancel }: Props) {
  const [name, setName] = useState(user?.name ?? '');
  const [quota, setQuota] = useState(user?.quotaBytes?.toString() ?? '');
  const [dailyQuota, setDailyQuota] = useState(user?.dailyQuotaBytes?.toString() ?? '');
  const [expiry, setExpiry] = useState(localDate(user?.expiresAt));
  const [vless, setVless] = useState(user?.allowVless ?? true);
  const [trojan, setTrojan] = useState(user?.allowTrojan ?? true);
  const [xhttp, setXhttp] = useState(user?.allowXhttp ?? true);
  const [notes, setNotes] = useState(user?.notes ?? '');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    await onSave({
      name: trimmed,
      quotaBytes: inputNumber(quota),
      dailyQuotaBytes: inputNumber(dailyQuota),
      expiresAt: expiry ? new Date(expiry).getTime() : null,
      allowVless: vless,
      allowTrojan: trojan,
      allowXhttp: xhttp,
      notes,
      enabled: user?.enabled ?? true,
    });
  }

  return (
    <form className="editor-form" onSubmit={submit}>
      <label>
        <span>{t('panel.users.name')}</span>
        <input
          aria-label={t('panel.users.name')}
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </label>
      <div className="editor-grid">
        <label>
          <span>{t('panel.users.quota')}</span>
          <input
            type="number"
            min="0"
            step="1"
            value={quota}
            onChange={(e) => setQuota(e.target.value)}
            placeholder={t('panel.users.unlimited')}
          />
        </label>
        <label>
          <span>{t('panel.users.dailyQuota')}</span>
          <input
            type="number"
            min="0"
            step="1"
            value={dailyQuota}
            onChange={(e) => setDailyQuota(e.target.value)}
            placeholder={t('panel.users.unlimited')}
          />
        </label>
      </div>
      <label>
        <span>{t('panel.users.expiry')}</span>
        <input type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
      </label>
      <fieldset className="protocol-fieldset">
        <legend>{t('panel.users.protocols')}</legend>
        <label>
          <input type="checkbox" checked={vless} onChange={(e) => setVless(e.target.checked)} />{' '}
          VLESS-WS
        </label>
        <label>
          <input type="checkbox" checked={trojan} onChange={(e) => setTrojan(e.target.checked)} />{' '}
          Trojan-WS
        </label>
        <label>
          <input type="checkbox" checked={xhttp} onChange={(e) => setXhttp(e.target.checked)} />{' '}
          VLESS-XHTTP
        </label>
      </fieldset>
      <label>
        <span>{t('panel.users.notes')}</span>
        <textarea maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="dialog-actions">
        <button className="secondary-button" type="button" onClick={onCancel}>
          {t('panel.users.cancel')}
        </button>
        <button className="primary-button" type="submit" disabled={busy || !name.trim()}>
          {t('panel.users.save')}
        </button>
      </div>
    </form>
  );
}
