'use client';

export default function SettingsPlaceholder() {
  return (
    <div
      data-testid="settings-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        fontFamily: 'system-ui, sans-serif',
        color: '#6b7280',
        padding: 40,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u2699'}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
        Settings
      </div>
      <div style={{ fontSize: 14 }}>Coming soon.</div>
    </div>
  );
}
