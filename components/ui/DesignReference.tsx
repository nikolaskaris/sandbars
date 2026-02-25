'use client';

import { useState } from 'react';
import {
  Plus,
  Minus,
  Layers,
  Search,
  Star,
  MapPin,
  Wind,
  Waves,
  Compass,
  ArrowUp,
} from 'lucide-react';
import { Button } from '.';
import { Card } from '.';
import { Input } from '.';
import { Toggle } from '.';
import { Badge } from '.';
import { Slider } from '.';
import { Select } from '.';
import { Tooltip } from '.';
import { Skeleton } from '.';
import { IconButton } from '.';

/* =========================================================================
   Helpers
   ========================================================================= */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-medium text-text-primary tracking-tight">{title}</h2>
      <Card>{children}</Card>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-text-tertiary font-medium">{children}</p>;
}

function Swatch({ name, bg, hex }: { name: string; bg: string; hex: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={['w-14 h-14 rounded-lg border border-border shadow-sm', bg].join(' ')} />
      <span className="text-xs text-text-primary font-medium text-center leading-data">{name}</span>
      <span className="text-xs text-text-tertiary tabular-nums">{hex}</span>
    </div>
  );
}

/* =========================================================================
   Main Component
   ========================================================================= */

export default function DesignReference() {
  const [toggleA, setToggleA] = useState(true);
  const [toggleB, setToggleB] = useState(false);
  const [toggleC, setToggleC] = useState(true);
  const [toggleLayers, setToggleLayers] = useState({ wave: true, period: false, wind: false, buoys: true });
  const [slider, setSlider] = useState(50);
  const [selectVal, setSelectVal] = useState('waveHeight');

  return (
    <div className="min-h-screen bg-surface-secondary">
      {/* Header */}
      <div className="bg-surface border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-medium text-text-primary tracking-tight">
            Sandbars Design Reference
          </h1>
          <p className="text-base text-text-secondary mt-1">
            Component library and design token showcase
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* ================================================================
           1. COLOR PALETTE
           ================================================================ */}
        <Section title="Color Palette">
          <div className="space-y-6">
            {/* Backgrounds */}
            <div>
              <Label>Backgrounds</Label>
              <div className="flex flex-wrap gap-4 mt-2">
                <Swatch name="background" bg="bg-background" hex="#FAF8F5" />
                <Swatch name="surface" bg="bg-surface" hex="#FEFDFB" />
                <Swatch name="surface-secondary" bg="bg-surface-secondary" hex="#F5F0E8" />
                <Swatch name="surface-map" bg="bg-surface-map" hex="#EDE7DC" />
              </div>
            </div>

            {/* Borders */}
            <div>
              <Label>Borders</Label>
              <div className="flex flex-wrap gap-4 mt-2">
                <Swatch name="border" bg="bg-border" hex="#E0D8CC" />
                <Swatch name="border-strong" bg="bg-border-strong" hex="#C9BFB0" />
              </div>
            </div>

            {/* Text */}
            <div>
              <Label>Text</Label>
              <div className="flex flex-wrap gap-4 mt-2">
                <Swatch name="text-primary" bg="bg-text-primary" hex="#2C2825" />
                <Swatch name="text-secondary" bg="bg-text-secondary" hex="#8C8279" />
                <Swatch name="text-tertiary" bg="bg-text-tertiary" hex="#B5ADA4" />
                <Swatch name="tooltip" bg="bg-tooltip" hex="#3D3630" />
              </div>
            </div>

            {/* Accent terracotta options */}
            <div>
              <Label>Accent — Terracotta Options</Label>
              <div className="flex flex-wrap gap-6 mt-2">
                <div className="space-y-2">
                  <p className="text-xs text-text-secondary font-medium">A: Dusty</p>
                  <div className="flex gap-2">
                    <Swatch name="default" bg="bg-accent-dusty" hex="#C4856C" />
                    <Swatch name="hover" bg="bg-accent-dusty-hover" hex="#B5755C" />
                    <Swatch name="muted" bg="bg-accent-dusty-muted" hex="#F3E8E2" />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-text-secondary font-medium">B: Warm (default)</p>
                  <div className="flex gap-2">
                    <Swatch name="default" bg="bg-accent" hex="#B8704C" />
                    <Swatch name="hover" bg="bg-accent-hover" hex="#A5623F" />
                    <Swatch name="muted" bg="bg-accent-muted" hex="#F2E4DA" />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-text-secondary font-medium">C: Earthy</p>
                  <div className="flex gap-2">
                    <Swatch name="default" bg="bg-accent-earthy" hex="#A66B4F" />
                    <Swatch name="hover" bg="bg-accent-earthy-hover" hex="#955E43" />
                    <Swatch name="muted" bg="bg-accent-earthy-muted" hex="#EFE2D9" />
                  </div>
                </div>
              </div>
            </div>

            {/* Data visualization */}
            <div>
              <Label>Data Visualization</Label>
              <div className="flex flex-wrap gap-6 mt-2">
                <div className="space-y-1">
                  <p className="text-xs text-text-secondary font-medium">Swell Height</p>
                  <div className="flex gap-2">
                    <Swatch name="low" bg="bg-data-swell-low" hex="#B5ADA4" />
                    <Swatch name="mid" bg="bg-data-swell-mid" hex="#6B9AC4" />
                    <Swatch name="high" bg="bg-data-swell-high" hex="#1E3A6E" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-text-secondary font-medium">Swell Period</p>
                  <div className="flex gap-2">
                    <Swatch name="low" bg="bg-data-period-low" hex="#B5ADA4" />
                    <Swatch name="mid" bg="bg-data-period-mid" hex="#9B7FBF" />
                    <Swatch name="high" bg="bg-data-period-high" hex="#4A2D73" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-text-secondary font-medium">Wind Speed</p>
                  <div className="flex gap-2">
                    <Swatch name="low" bg="bg-data-wind-low" hex="#B5ADA4" />
                    <Swatch name="mid" bg="bg-data-wind-mid" hex="#5BA8A0" />
                    <Swatch name="high" bg="bg-data-wind-high" hex="#1B6B62" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quality + Status */}
            <div>
              <Label>Quality Score &amp; Status</Label>
              <div className="flex flex-wrap gap-6 mt-2">
                <div className="space-y-1">
                  <p className="text-xs text-text-secondary font-medium">Quality</p>
                  <div className="flex gap-2">
                    <Swatch name="poor" bg="bg-quality-poor" hex="#C47A6C" />
                    <Swatch name="fair" bg="bg-quality-fair" hex="#C9A96E" />
                    <Swatch name="good" bg="bg-quality-good" hex="#7BA882" />
                    <Swatch name="epic" bg="bg-quality-epic" hex="#3A7F7A" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-text-secondary font-medium">Status</p>
                  <div className="flex gap-2">
                    <Swatch name="success" bg="bg-success" hex="#7BA882" />
                    <Swatch name="warning" bg="bg-warning" hex="#C9A96E" />
                    <Swatch name="error" bg="bg-error" hex="#C47A6C" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ================================================================
           2. TYPOGRAPHY
           ================================================================ */}
        <Section title="Typography">
          <div className="space-y-6">
            <div>
              <Label>Type Scale</Label>
              <div className="mt-2 space-y-3">
                {([
                  ['3xl', '32px', 'text-3xl'],
                  ['2xl', '24px', 'text-2xl'],
                  ['xl', '20px', 'text-xl'],
                  ['lg', '16px', 'text-lg'],
                  ['base', '14px', 'text-base'],
                  ['sm', '13px', 'text-sm'],
                  ['xs', '11px', 'text-xs'],
                ] as const).map(([name, px, cls]) => (
                  <div key={name} className="flex items-baseline gap-4">
                    <span className="text-xs text-text-tertiary w-16 shrink-0 tabular-nums">{name} / {px}</span>
                    <span className={[cls, 'text-text-primary'].join(' ')}>
                      The quick brown fox jumps over the lazy dog
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Weight: Regular (400) vs Medium (500)</Label>
              <div className="mt-2 space-y-2">
                <p className="text-lg font-normal text-text-primary">
                  Regular 400 — Swell height 2.4m @ 14s from SSW
                </p>
                <p className="text-lg font-medium text-text-primary">
                  Medium 500 — Swell height 2.4m @ 14s from SSW
                </p>
              </div>
            </div>

            <div>
              <Label>Tabular Numbers</Label>
              <div className="mt-2 flex gap-8">
                <div>
                  <p className="text-xs text-text-tertiary mb-1">Proportional</p>
                  <p className="text-lg text-text-primary">123,456</p>
                  <p className="text-lg text-text-primary">789,012</p>
                </div>
                <div>
                  <p className="text-xs text-text-tertiary mb-1">Tabular</p>
                  <p className="text-lg text-text-primary tabular-nums">123,456</p>
                  <p className="text-lg text-text-primary tabular-nums">789,012</p>
                </div>
              </div>
            </div>

            <div>
              <Label>Sample Data Display</Label>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-2xl font-medium text-text-primary tabular-nums">2.4m</span>
                <span className="text-base text-text-secondary">@ 14s from SSW</span>
                <span className="text-sm text-text-tertiary">Wind: 8 m/s NW</span>
              </div>
            </div>
          </div>
        </Section>

        {/* ================================================================
           3. BUTTONS
           ================================================================ */}
        <Section title="Buttons">
          <div className="space-y-6">
            <div>
              <Label>Variants x Sizes</Label>
              <div className="mt-2 space-y-3">
                {(['primary', 'secondary', 'ghost'] as const).map((variant) => (
                  <div key={variant} className="flex items-center gap-3">
                    <span className="text-xs text-text-tertiary w-20 shrink-0">{variant}</span>
                    <Button variant={variant} size="sm">Small</Button>
                    <Button variant={variant} size="md">Medium</Button>
                    <Button variant={variant} size="lg">Large</Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Disabled</Label>
              <div className="mt-2 flex gap-3">
                <Button variant="primary" disabled>Disabled</Button>
                <Button variant="secondary" disabled>Disabled</Button>
                <Button variant="ghost" disabled>Disabled</Button>
              </div>
            </div>

            <div>
              <Label>Loading</Label>
              <div className="mt-2 flex gap-3">
                <Button variant="primary" loading>Loading</Button>
                <Button variant="secondary" loading>Loading</Button>
              </div>
            </div>
          </div>
        </Section>

        {/* ================================================================
           4. CARDS
           ================================================================ */}
        <Section title="Cards">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Elevated (default)</Label>
                <Card>
                  <p className="text-base text-text-primary">Default padding card with warm shadow lift.</p>
                </Card>
              </div>
              <div className="space-y-2">
                <Label>Flat</Label>
                <Card variant="flat">
                  <p className="text-base text-text-primary">Flat card with border, no shadow.</p>
                </Card>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Compact</Label>
                <Card padding="compact">
                  <p className="text-sm text-text-secondary">Compact padding</p>
                </Card>
              </div>
              <div className="space-y-2">
                <Label>Default</Label>
                <Card padding="default">
                  <p className="text-sm text-text-secondary">Default padding</p>
                </Card>
              </div>
              <div className="space-y-2">
                <Label>Spacious</Label>
                <Card padding="spacious">
                  <p className="text-sm text-text-secondary">Spacious padding</p>
                </Card>
              </div>
            </div>

            <div>
              <Label>Card with Forecast Content</Label>
              <Card className="max-w-sm">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">Pipeline, Oahu</span>
                    <Badge variant="quality" score={82} />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-medium text-text-primary tabular-nums">3.2m</span>
                    <span className="text-base text-text-secondary">@ 16s from NW</span>
                  </div>
                  <p className="text-sm text-text-tertiary">Wind: 5 m/s offshore E</p>
                </div>
              </Card>
            </div>
          </div>
        </Section>

        {/* ================================================================
           5. FORM ELEMENTS
           ================================================================ */}
        <Section title="Form Elements">
          <div className="space-y-6">
            {/* Inputs */}
            <div>
              <Label>Input</Label>
              <div className="mt-2 grid grid-cols-2 gap-4 max-w-2xl">
                <Input placeholder="Default input" />
                <Input label="With Label" placeholder="Enter location" />
                <Input label="With Error" placeholder="Required field" error="This field is required" />
                <Input variant="search" placeholder="Search locations..." />
                <Input icon={MapPin} placeholder="With icon" />
              </div>
            </div>

            {/* Toggles */}
            <div>
              <Label>Toggle</Label>
              <div className="mt-2 flex flex-wrap gap-6">
                <Toggle checked={toggleA} onChange={setToggleA} label="Active (md)" />
                <Toggle checked={toggleB} onChange={setToggleB} label="Inactive (md)" />
                <Toggle checked={toggleC} onChange={setToggleC} label="Active (sm)" size="sm" />
                <Toggle checked={false} onChange={() => {}} label="Disabled" disabled />
              </div>
            </div>

            {/* Select */}
            <div>
              <Label>Select</Label>
              <div className="mt-2 max-w-xs">
                <Select
                  label="Data Layer"
                  value={selectVal}
                  onChange={(e) => setSelectVal(e.target.value)}
                  options={[
                    { value: 'waveHeight', label: 'Wave Height' },
                    { value: 'wavePeriod', label: 'Wave Period' },
                    { value: 'wind', label: 'Wind Speed' },
                  ]}
                />
              </div>
            </div>

            {/* Slider */}
            <div>
              <Label>Slider</Label>
              <div className="mt-2 max-w-sm space-y-4">
                <Slider
                  label={`Forecast Hour: ${slider}h`}
                  min={0}
                  max={384}
                  step={3}
                  value={slider}
                  onChange={(e) => setSlider(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        </Section>

        {/* ================================================================
           6. BADGES
           ================================================================ */}
        <Section title="Badges">
          <div className="space-y-4">
            <div>
              <Label>Quality Score</Label>
              <div className="mt-2 flex flex-wrap gap-3">
                <Badge variant="quality" score={15} />
                <Badge variant="quality" score={35} />
                <Badge variant="quality" score={55} />
                <Badge variant="quality" score={75} />
                <Badge variant="quality" score={95} />
              </div>
            </div>

            <div>
              <Label>Quality Score (md size)</Label>
              <div className="mt-2 flex flex-wrap gap-3">
                <Badge variant="quality" score={15} size="md" />
                <Badge variant="quality" score={55} size="md" />
                <Badge variant="quality" score={95} size="md" />
              </div>
            </div>

            <div>
              <Label>Status</Label>
              <div className="mt-2 flex flex-wrap gap-3">
                <Badge variant="status" status="success">Online</Badge>
                <Badge variant="status" status="warning">Stale Data</Badge>
                <Badge variant="status" status="error">Offline</Badge>
              </div>
            </div>

            <div>
              <Label>Neutral</Label>
              <div className="mt-2 flex gap-3">
                <Badge>Default</Badge>
                <Badge size="md">Medium</Badge>
              </div>
            </div>
          </div>
        </Section>

        {/* ================================================================
           7. UTILITY COMPONENTS
           ================================================================ */}
        <Section title="Utility Components">
          <div className="space-y-6">
            <div>
              <Label>Tooltip</Label>
              <div className="mt-2 flex gap-6">
                <Tooltip content="Top tooltip" side="top">
                  <Button variant="secondary" size="sm">Hover (top)</Button>
                </Tooltip>
                <Tooltip content="Bottom tooltip" side="bottom">
                  <Button variant="secondary" size="sm">Hover (bottom)</Button>
                </Tooltip>
                <Tooltip content="Right tooltip" side="right">
                  <Button variant="secondary" size="sm">Hover (right)</Button>
                </Tooltip>
              </div>
            </div>

            <div>
              <Label>IconButton</Label>
              <div className="mt-2 flex gap-2">
                <IconButton aria-label="Zoom in"><Plus className="h-4 w-4" /></IconButton>
                <IconButton aria-label="Zoom out"><Minus className="h-4 w-4" /></IconButton>
                <IconButton aria-label="Layers"><Layers className="h-4 w-4" /></IconButton>
                <IconButton aria-label="Search"><Search className="h-4 w-4" /></IconButton>
                <IconButton aria-label="Favorite" active><Star className="h-4 w-4" /></IconButton>
              </div>
            </div>

            <div>
              <Label>Skeleton</Label>
              <div className="mt-2 flex gap-4 items-start">
                <div className="space-y-2 flex-1">
                  <Skeleton variant="text" />
                  <Skeleton variant="text" className="w-3/4" />
                  <Skeleton variant="text" className="w-1/2" />
                </div>
                <Skeleton variant="card" className="w-48" />
                <Skeleton variant="circle" />
              </div>
            </div>
          </div>
        </Section>

        {/* ================================================================
           8. MAP CONTROLS PREVIEW
           ================================================================ */}
        <Section title="Map Controls Preview">
          <div className="space-y-4">
            <Label>How components compose on the map</Label>
            <div className="relative bg-surface-map rounded-lg p-8 min-h-64">
              {/* Zoom controls */}
              <div className="absolute top-4 right-4 flex flex-col gap-1">
                <IconButton aria-label="Zoom in"><Plus className="h-4 w-4" /></IconButton>
                <IconButton aria-label="Zoom out"><Minus className="h-4 w-4" /></IconButton>
              </div>

              {/* Layer toggle panel */}
              <Card padding="compact" className="absolute top-4 left-4 w-48">
                <div className="space-y-2.5">
                  <p className="text-sm font-medium text-text-primary">Layers</p>
                  <Toggle
                    checked={toggleLayers.wave}
                    onChange={(v) => setToggleLayers((s) => ({ ...s, wave: v }))}
                    label="Wave Height"
                    size="sm"
                  />
                  <Toggle
                    checked={toggleLayers.period}
                    onChange={(v) => setToggleLayers((s) => ({ ...s, period: v }))}
                    label="Period"
                    size="sm"
                  />
                  <Toggle
                    checked={toggleLayers.wind}
                    onChange={(v) => setToggleLayers((s) => ({ ...s, wind: v }))}
                    label="Wind"
                    size="sm"
                  />
                  <Toggle
                    checked={toggleLayers.buoys}
                    onChange={(v) => setToggleLayers((s) => ({ ...s, buoys: v }))}
                    label="Buoys"
                    size="sm"
                  />
                </div>
              </Card>

              {/* Legend panel */}
              <Card padding="compact" className="absolute bottom-4 left-4">
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-text-primary">Wave Height</p>
                  <div className="flex gap-1">
                    <div className="w-16 h-2 rounded-sm bg-gradient-to-r from-data-swell-low via-data-swell-mid to-data-swell-high" />
                  </div>
                  <div className="flex justify-between text-xs text-text-tertiary tabular-nums">
                    <span>0m</span>
                    <span>3m</span>
                    <span>6m+</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </Section>

        {/* ================================================================
           9. SAMPLE FORECAST CARD
           ================================================================ */}
        <Section title="Sample Forecast Card">
          <Label>Preview of a spot forecast entry</Label>
          <Card className="max-w-md mt-2">
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-text-tertiary" />
                  <span className="text-base font-medium text-text-primary">Pipeline, North Shore</span>
                </div>
                <Badge variant="quality" score={88} size="md" />
              </div>

              {/* Primary data */}
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-medium text-text-primary tabular-nums">3.8m</span>
                <div className="flex flex-col">
                  <span className="text-base text-text-secondary">@ 16s from NW</span>
                  <span className="text-sm text-text-tertiary">Secondary: 1.2m @ 8s from S</span>
                </div>
              </div>

              {/* Secondary data row */}
              <div className="flex gap-4 pt-1 border-t border-border">
                <div className="flex items-center gap-1.5">
                  <Wind className="h-3.5 w-3.5 text-text-tertiary" />
                  <span className="text-sm text-text-secondary tabular-nums">5 m/s</span>
                  <span className="text-sm text-text-tertiary">offshore E</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Waves className="h-3.5 w-3.5 text-text-tertiary" />
                  <span className="text-sm text-text-secondary tabular-nums">22°C</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5 text-text-tertiary" />
                  <span className="text-sm text-text-secondary">Rising</span>
                </div>
              </div>

              {/* Time entries */}
              <div className="space-y-1 pt-1">
                {[
                  { time: '6:00 AM', height: '3.2', period: '15', dir: 'NW', wind: '4' },
                  { time: '9:00 AM', height: '3.8', period: '16', dir: 'NW', wind: '5' },
                  { time: '12:00 PM', height: '3.5', period: '15', dir: 'NNW', wind: '8' },
                  { time: '3:00 PM', height: '3.0', period: '14', dir: 'NNW', wind: '10' },
                ].map((entry) => (
                  <div key={entry.time} className="flex items-center gap-3 py-1.5 text-sm">
                    <span className="w-16 text-text-secondary tabular-nums shrink-0">{entry.time}</span>
                    <span className="font-medium text-text-primary tabular-nums w-10">{entry.height}m</span>
                    <span className="text-text-tertiary tabular-nums">@ {entry.period}s</span>
                    <ArrowUp
                      className="h-3 w-3 text-text-tertiary shrink-0"
                    />
                    <span className="text-text-tertiary">{entry.dir}</span>
                    <span className="text-text-tertiary ml-auto tabular-nums">{entry.wind} m/s</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Section>

        {/* Footer */}
        <div className="text-center py-8">
          <p className="text-sm text-text-tertiary">
            Sandbars Design System v1.0 — Tokens defined in tailwind.config.ts
          </p>
        </div>
      </div>
    </div>
  );
}
