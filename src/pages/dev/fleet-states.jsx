// =============================================================================
// Fleet states showcase — dev-only visual reference for the empty-state cascade.
// =============================================================================
//
// What this page is for:
//
//   The fleet overview's "no rows visible" cascade renders four
//   different cards depending on what's wrong (loading, errored, empty
//   fleet, search filtered out everything). In normal use, most of
//   these states are invisible because:
//
//     - SWR persists its cache to localStorage, so the FIRST-EVER
//       loading state appears once per device per session and is gone
//       in <100ms.
//     - keepPreviousData: true on the global SWRConfig means after a
//       silent token rotation, SWR keeps showing the previous data
//       instead of flashing isLoading=true, so the "Loading…" card
//       never re-appears once the user has seen the fleet once.
//     - Errors require the backend to actually be down.
//     - Empty fleet requires an account that genuinely has zero
//       devices/sensors assigned.
//
//   This page renders FleetOverviewView with hand-crafted props for
//   each state so all four cards are visible at once, on the real
//   theme, in the real chrome, without needing to fight SWR.
//
// How to use:
//
//   1. Run `npm run dev`.
//   2. Log in normally (the page is under the protected /dashboard tree).
//   3. Navigate to /dashboard/dev/fleet-states.
//   4. Scroll. Each section is labeled with the state it's showing.
//
//   The Try-Again button on the error state is wired to a no-op
//   callback that just `console.log`s — clicking it lets you verify
//   the click is reaching the handler without actually triggering a
//   refetch.
//
//   The search-returned-zero state requires you to type something into
//   that section's search box that doesn't match the mock rows ("xyz"
//   is a safe bet). FleetOverviewView's searchValue is internal state
//   and can't be force-fed from the outside without changing the
//   component, so this is the one state that needs a click to reveal.
//
// Why this lives under /dashboard rather than at the app root:
//
//   The MainCard chrome and surrounding layout (drawer, header, glass
//   surface background) are part of what we want to verify visually.
//   Putting the page inside DashboardLayout means it inherits the
//   exact same chrome the real fleet pages do.
//
// Why no special access gating:
//
//   The route is only registered when import.meta.env.DEV is true (see
//   routes/MainRoutes.jsx) — production builds never see it. RequireAuth
//   still wraps it, so nobody who isn't logged in can hit it even in dev.
//
// Adding more state previews:
//
//   Add a new <Section> in the JSX below with the prop combination you
//   want to render. The mockRows constant has sample data shaped like
//   the real transformer output, so a new state preview can re-use it
//   to look authentic.

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import FleetOverviewView from 'sections/fleet-overview/FleetOverviewView';

// Sample row data shaped exactly like the real transformer output
// (utils/transforms/device.js + utils/transforms/wirelessSensor.js),
// including the per-metric `color` field that the transformers
// attach to Health Status and Battery via the rules in
// utils/transforms/metricColors.js.
//
// The three rows below intentionally span every coloring tier so
// the showcase doubles as a color-rules verification:
//   - row 1: Active + 99% battery → green / green
//   - row 2: Offline + 78% battery → purple / green
//   - row 3: Active + 24% battery → green / critical
//   - row 4: Active + 42% battery → green / orange
const mockRows = [
  {
    siteName: 'Shakoor Lab 020',
    externalId: 'PN-A1B2C3D4',
    lastMeasurements: '5/6/2026, 8:13:44 AM',
    lastMeasurementAt: '2026-05-06T13:13:44Z',
    metrics: [
      { label: 'Health Status:', value: 'Active', color: 'var(--green)' },
      { label: 'Temperature:', value: '51.98°F' },
      { label: "Today's Rainfall:", value: '0 mm' },
      { label: 'Wind Speed:', value: '2.51 mph' },
      { label: 'Battery:', value: '99.29%', color: 'var(--green)' }
    ]
  },
  {
    siteName: 'Danforth Field Research',
    externalId: 'PN-E5F6G7H8',
    lastMeasurements: '5/6/2026, 7:48:24 AM',
    lastMeasurementAt: '2026-05-06T12:48:24Z',
    metrics: [
      { label: 'Health Status:', value: 'Offline', color: 'var(--purple)' },
      { label: 'Temperature:', value: '52.70°F' },
      { label: "Today's Rainfall:", value: '24.5 mm' },
      { label: 'Wind Speed:', value: '0.88 mph' },
      { label: 'Battery:', value: '78.40%', color: 'var(--green)' }
    ]
  },
  {
    siteName: 'Danforth Prairie',
    externalId: 'PN-I9J0K1L2',
    lastMeasurements: '5/6/2026, 6:32:08 AM',
    lastMeasurementAt: '2026-05-06T11:32:08Z',
    metrics: [
      { label: 'Health Status:', value: 'Active', color: 'var(--green)' },
      { label: 'Temperature:', value: '49.20°F' },
      { label: "Today's Rainfall:", value: '5 mm' },
      { label: 'Wind Speed:', value: '1.21 mph' },
      { label: 'Battery:', value: '24.10%', color: 'var(--critical)' }
    ]
  },
  {
    siteName: 'Clemson PDREC',
    externalId: 'PN-M3N4O5P6',
    lastMeasurements: '5/6/2026, 5:18:33 AM',
    lastMeasurementAt: '2026-05-06T10:18:33Z',
    metrics: [
      { label: 'Health Status:', value: 'Active', color: 'var(--green)' },
      { label: 'Temperature:', value: '54.30°F' },
      { label: "Today's Rainfall:", value: '0 mm' },
      { label: 'Wind Speed:', value: '0.45 mph' },
      { label: 'Battery:', value: '42.65%', color: 'var(--orange)' }
    ]
  }
];

// Section heading + the FleetOverviewView preview underneath. Pulls
// the boilerplate out of the JSX below so each preview is one line
// of intent ("here's what the empty state looks like").
function Section({ title, description, children }) {
  return (
    <Box>
      <Typography variant="h5" sx={{ color: 'var(--green)', mb: 0.5 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ color: 'var(--blue)', mb: 1.5, fontStyle: 'italic' }}>
          {description}
        </Typography>
      )}
      {children}
    </Box>
  );
}

export default function FleetStatesDev() {
  // Wired to console.log so a click on the Try Again button can be
  // verified without actually triggering a refetch. In production this
  // would be the SWR mutate function from the hook.
  const noopRetry = () => {
    // eslint-disable-next-line no-console
    console.log('[dev] Try Again clicked');
  };

  return (
    <Stack spacing={4} sx={{ width: '100%' }}>
      <Box>
        <Typography variant="h3" sx={{ color: 'var(--green)' }}>
          Fleet states showcase
        </Typography>
        <Typography variant="body1" sx={{ color: 'var(--blue)', mt: 1 }}>
          Visual reference for every state the FleetOverviewView empty-state cascade renders.
          Each section below feeds the same view component with hand-crafted props that
          force the corresponding state.
        </Typography>
      </Box>

      <Section
        title="1. Loading — PheNodes"
        description="rows: undefined, isLoading: true. The animated 'Loading PheNodes…' card with the three pulsing dots."
      >
        <FleetOverviewView
          title="Your Fleet"
          entityLabel="PheNodes"
          searchPlaceholder="Search PheNodes..."
          rows={undefined}
          isLoading={true}
          emptyMessage="No PheNodes assigned to your account yet."
        />
      </Section>

      <Section
        title="2. Loading — Sensors"
        description="Same state as above with entityLabel='Sensors' so you can verify the noun substitution."
      >
        <FleetOverviewView
          title="Your Fleet"
          entityLabel="Sensors"
          searchPlaceholder="Search Wireless Sensors..."
          rows={undefined}
          isLoading={true}
          emptyMessage="No wireless sensors assigned to your account yet."
        />
      </Section>

      <Section
        title="3. Failed first load — with retry"
        description="rows: undefined, isLoading: false, error: Error. Shows the orange 'Failed to load fleet' headline plus the Try Again button. Click the button — it's wired to a console.log so you can confirm the handler fires."
      >
        <FleetOverviewView
          title="Your Fleet"
          entityLabel="PheNodes"
          searchPlaceholder="Search PheNodes..."
          rows={undefined}
          isLoading={false}
          error={new Error('Network error: 503 Service Unavailable')}
          onRetry={noopRetry}
          emptyMessage="No PheNodes assigned to your account yet."
        />
      </Section>

      <Section
        title="4. Failed first load — no retry handler"
        description="Same as above but onRetry is omitted. The Try Again button should not render. Useful for verifying the button is correctly conditional."
      >
        <FleetOverviewView
          title="Your Fleet"
          entityLabel="PheNodes"
          searchPlaceholder="Search PheNodes..."
          rows={undefined}
          isLoading={false}
          error={new Error('Validation failed: response missing required field "external_device_id"')}
          emptyMessage="No PheNodes assigned to your account yet."
        />
      </Section>

      <Section
        title="5. Empty fleet — PheNodes"
        description="rows: [], isLoading: false, error: undefined. The customizable emptyMessage prop drives the copy."
      >
        <FleetOverviewView
          title="Your Fleet"
          entityLabel="PheNodes"
          searchPlaceholder="Search PheNodes..."
          rows={[]}
          isLoading={false}
          emptyMessage="No PheNodes assigned to your account yet."
        />
      </Section>

      <Section
        title="6. Empty fleet — Sensors"
        description="Same as above with the wireless-sensor copy."
      >
        <FleetOverviewView
          title="Your Fleet"
          entityLabel="Sensors"
          searchPlaceholder="Search Wireless Sensors..."
          rows={[]}
          isLoading={false}
          emptyMessage="No wireless sensors assigned to your account yet."
        />
      </Section>

      <Section
        title="7. Search returned zero of N — manual trigger"
        description='rows: [2 mock items], isLoading: false. Type "xyz" in the search box to filter the visible rows down to zero — the empty-state card will switch to "No entries found for that search." This state cannot be force-fed from outside because searchValue is internal state.'
      >
        <FleetOverviewView
          title="Your Fleet"
          entityLabel="PheNodes"
          searchPlaceholder="Search PheNodes..."
          rows={mockRows}
          isLoading={false}
          emptyMessage="No PheNodes assigned to your account yet."
        />
      </Section>

      <Section
        title="8. Happy path — cards visible"
        description="Sanity check that the full card render still works alongside all the other state previews. Same rows as above; do not search."
      >
        <FleetOverviewView
          title="Your Fleet"
          entityLabel="PheNodes"
          searchPlaceholder="Search PheNodes..."
          rows={mockRows}
          isLoading={false}
          emptyMessage="No PheNodes assigned to your account yet."
        />
      </Section>
    </Stack>
  );
}
