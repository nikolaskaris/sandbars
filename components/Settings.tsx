'use client';

import { useAuth } from '@/contexts/AuthContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { signOut } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={[
            'px-3 py-1.5 rounded text-sm font-medium transition-colors duration-150 border-none cursor-pointer',
            value === opt.value
              ? 'bg-accent text-white'
              : 'bg-surface-secondary text-text-secondary hover:text-text-primary',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function PreferenceRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm text-text-primary">{label}</span>
      <SegmentedControl value={value} options={options} onChange={onChange} />
    </div>
  );
}

export default function Settings() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { prefs, updatePref } = usePreferences();

  return (
    <div
      data-testid="settings-page"
      className="absolute inset-0 bg-background z-30 overflow-y-auto"
    >
      <div className="max-w-[500px] mx-auto px-6 py-6">

        {/* ─── ACCOUNT ─── */}
        <div className="text-[11px] font-medium text-text-tertiary tracking-widest uppercase mb-3">
          Account
        </div>

        <div className="bg-surface rounded-lg border border-border p-4 mb-8">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin h-5 w-5 border-2 border-accent border-t-transparent rounded-full" />
            </div>
          ) : user ? (
            <div className="flex items-center gap-4">
              {/* Avatar */}
              {user.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url as string}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-lg"
                  style={{ background: '#C17F5E' }}
                >
                  {(user.email || '?')[0].toUpperCase()}
                </div>
              )}

              {/* Name + email */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary truncate">
                  {(user.user_metadata?.full_name as string) || user.email}
                </div>
                {user.user_metadata?.full_name && (
                  <div className="text-sm text-text-secondary truncate">{user.email}</div>
                )}
              </div>

              {/* Sign out */}
              <Button variant="ghost" size="sm" onClick={signOut}>
                Sign out
              </Button>
            </div>
          ) : (
            <div className="text-center py-2">
              <div className="text-sm text-text-secondary mb-3">
                Sign in to sync your favorites across devices and save your preferences
              </div>
              <Button variant="primary" size="md" onClick={() => router.push('/login')}>
                Sign in
              </Button>
            </div>
          )}
        </div>

        {/* ─── UNITS & PREFERENCES ─── */}
        <div className="text-[11px] font-medium text-text-tertiary tracking-widest uppercase mb-3">
          Units &amp; Preferences
        </div>

        <div className="bg-surface rounded-lg border border-border px-4 divide-y divide-border mb-8">
          <PreferenceRow
            label="Wave Height"
            value={prefs.waveUnit}
            options={[
              { value: 'ft', label: 'ft' },
              { value: 'm', label: 'm' },
            ]}
            onChange={(v) => updatePref('waveUnit', v)}
          />
          <PreferenceRow
            label="Wind Speed"
            value={prefs.windUnit}
            options={[
              { value: 'mph', label: 'mph' },
              { value: 'kts', label: 'kts' },
              { value: 'kph', label: 'kph' },
              { value: 'm/s', label: 'm/s' },
            ]}
            onChange={(v) => updatePref('windUnit', v)}
          />
          <PreferenceRow
            label="Temperature"
            value={prefs.tempUnit}
            options={[
              { value: 'F', label: '°F' },
              { value: 'C', label: '°C' },
            ]}
            onChange={(v) => updatePref('tempUnit', v)}
          />
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-text-tertiary pt-4 pb-8">
          Sandbars v0.1 · Built for surfers
        </div>
      </div>
    </div>
  );
}
