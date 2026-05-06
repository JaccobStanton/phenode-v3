import { useEffect, useMemo, useRef, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import OutlinedInput from '@mui/material/OutlinedInput';
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';
import IdcardOutlined from '@ant-design/icons/IdcardOutlined';
import SearchOutlined from '@ant-design/icons/SearchOutlined';
import SortAscendingOutlined from '@ant-design/icons/SortAscendingOutlined';

import MainCard from 'components/MainCard';

// Fleet-overview pages use a slightly different glass surface (more saturated background)
// and a thinner box-outline-blue border than the rest of the app, so these tokens stay local.
const glassSurfaceSx = {
  backgroundColor: 'rgba(12, 35, 80, 0.359)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))'
};

const reflectedCardChromeSx = {
  border: '0.5px solid var(--box-outline-blue)',
  boxShadow: '0 11px 19px 1px #0000002e'
};

const greenGlowTextSx = {
  color: 'var(--green)',
  textShadow: '0 1px 9px #1a75e0c9'
};

// Single-line text with ellipsis when it exceeds its container's width.
// Spread onto any Typography that should never wrap to a second line.
//
// Why all three properties: textOverflow only kicks in when both
// overflow is clipped AND whiteSpace is forced single-line. Missing any
// one and the text wraps or overflows visibly instead of clipping with
// the "…".
//
// Pair with `title={fullText}` on the same Typography so the user can
// hover to read the truncated content — there's no other way to see
// what got cut.
const truncateLineSx = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  // Without `minWidth: 0` flex/grid children can ignore the truncation
  // rule and push their parent wider. Asserting it here makes
  // `truncateLineSx` self-contained.
  minWidth: 0
};

const controlBaseSx = {
  border: '1px solid var(--reflected-light)',
  borderRadius: 1,
  color: 'var(--blue)',
  backgroundColor: 'rgba(0, 17, 48, 0.03)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
  boxShadow: '0 11px 19px 1px #0000002e'
};

const tooltipSlotProps = {
  tooltip: {
    sx: {
      backgroundColor: 'rgba(0, 20, 61, 0.96)',
      color: 'var(--green)',
      border: '1px solid var(--reflected-light)',
      boxShadow: '0 11px 19px 1px #0000002e',
      fontSize: '0.78rem'
    }
  }
};

const sortToggleSx = {
  textTransform: 'none',
  px: { xs: 1.25, sm: 1.5 },
  minHeight: 40,
  minWidth: 40,
  gap: 0.75,
  ...controlBaseSx,
  '&:hover': {
    color: 'var(--green)',
    borderColor: 'var(--green)',
    backgroundColor: 'rgba(0, 17, 48, 0.03)',
    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))'
  },
  '&.Mui-selected': {
    color: 'var(--green)',
    borderColor: 'var(--green)',
    backgroundColor: 'rgba(72, 247, 245, 0.12)'
  },
  '&.Mui-selected:hover': {
    backgroundColor: 'rgba(72, 247, 245, 0.18)'
  }
};

const emptyRowCardSx = {
  width: '100%',
  minWidth: { xs: 840, sm: 900, md: 0 },
  backgroundColor: 'rgba(12, 35, 80, 0.359)',
  p: 2,
  border: '0.5px solid var(--box-outline-blue)',
  boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
  textAlign: 'center'
};

// Pagination chrome — matches the search/sort buttons (controlBaseSx)
// so the bottom-of-table pager reads as part of the same control row at
// the top. Each MUI PaginationItem (page numbers, prev/next arrows,
// ellipsis) is themed via `.MuiPaginationItem-root`. The selected page
// adopts the same green-outline language used by the active sort/filter
// toggles so the visual vocabulary stays consistent across all
// interactive controls on this surface.
const paginationSx = {
  '& .MuiPaginationItem-root': {
    color: 'var(--blue)',
    border: '1px solid var(--reflected-light)',
    backgroundColor: 'rgba(0, 17, 48, 0.03)',
    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
    boxShadow: '0 11px 19px 1px #0000002e',
    transition: 'color 0.18s ease, border-color 0.18s ease, background-color 0.18s ease',
    '&:hover': {
      color: 'var(--green)',
      borderColor: 'var(--green)',
      backgroundColor: 'rgba(72, 247, 245, 0.08)'
    }
  },
  '& .MuiPaginationItem-root.Mui-selected': {
    color: 'var(--green)',
    borderColor: 'var(--green)',
    backgroundColor: 'rgba(72, 247, 245, 0.15)',
    '&:hover': {
      backgroundColor: 'rgba(72, 247, 245, 0.22)'
    }
  },
  '& .MuiPaginationItem-ellipsis': {
    color: 'var(--blue)',
    border: 'none',
    backgroundColor: 'transparent',
    boxShadow: 'none'
  }
};

// 20 rows per page. If this needs to vary per fleet later, lift to a
// prop on FleetOverviewView — both pages currently share the same
// density expectation.
const PAGE_SIZE = 20;


// Cycle order for the tri-state Status filter. Single source of truth —
// the click handler reads (current → next) from this array, the button
// label reads from STATUS_LABELS[current], and the filter logic checks
// against the same string keys.
// Status vocabulary uses 'active' (not 'live') — the transformer
// translates the backend's "Live" → "Active" at the boundary, so every
// downstream consumer (the cards' Health Status cell, this filter, the
// header counter) speaks the same word.
const STATUS_FILTER_CYCLE = ['', 'active', 'offline'];
const STATUS_LABELS = { '': 'Status', active: 'Active', offline: 'Offline' };
const STATUS_TOOLTIPS = {
  '': 'Filter by status (currently off — click to filter to Active)',
  active: 'Showing Active only — click for Offline',
  offline: 'Showing Offline only — click to clear filter'
};

// Retry-button style for the error state. Mirrors the controlBaseSx
// chrome used elsewhere on this page (search/sort buttons) so the
// affordance feels native to the surface.
const retryButtonSx = {
  mt: 1.5,
  height: 40,
  px: 2.5,
  borderRadius: 1,
  cursor: 'pointer',
  color: 'var(--blue)',
  fontFamily: 'inherit',
  fontSize: '0.8rem',
  fontWeight: 500,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  border: '1px solid var(--reflected-light)',
  backgroundColor: 'rgba(0, 17, 48, 0.03)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
  boxShadow: '0 11px 19px 1px #0000002e',
  transition: 'color 0.18s ease, border-color 0.18s ease',
  '&:hover': {
    borderColor: 'var(--green)',
    color: 'var(--green)'
  }
};

/**
 * Renders the appropriate "no rows visible" state. Order matters: the
 * conditions below cascade from "still loading" → "failed" → "search
 * returned zero of N rows" → "fleet is genuinely empty." The order
 * means a hook that's both loading AND error'd shows loading first,
 * which matches user expectation (revalidation-in-flight after a prior
 * failure shouldn't flash an error message).
 *
 * `rows` here is the *unfiltered* array from the hook. The component's
 * `visibleRows` (filtered + sorted) is what triggers this render in the
 * first place; we use the unfiltered count to tell apart "no devices"
 * from "no search matches."
 */
function renderEmptyStateCard({ rows, isLoading, error, onRetry, searchValue, emptyMessage }) {
  // 1. Loading first time (no data yet)
  if (isLoading && (!rows || rows.length === 0)) {
    return (
      <Card sx={emptyRowCardSx}>
        <Typography variant="body1" sx={{ color: 'var(--blue)' }}>
          Loading fleet…
        </Typography>
      </Card>
    );
  }

  // 2. Failed first load (error, no data)
  if (error && (!rows || rows.length === 0)) {
    return (
      <Card sx={emptyRowCardSx}>
        <Typography variant="body1" sx={{ color: 'var(--orange)', fontWeight: 600 }}>
          Failed to load fleet
        </Typography>
        {error.message && (
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.55)', display: 'block', mt: 0.5, fontStyle: 'italic' }}>
            {error.message}
          </Typography>
        )}
        {onRetry && (
          <Box component="button" type="button" onClick={onRetry} sx={retryButtonSx}>
            Try again
          </Box>
        )}
      </Card>
    );
  }

  // 3. Search returned zero of N existing rows
  if (searchValue && rows && rows.length > 0) {
    return (
      <Card sx={emptyRowCardSx}>
        <Typography variant="body1" sx={{ color: 'var(--blue)' }}>
          No entries found for that search.
        </Typography>
      </Card>
    );
  }

  // 4. Fleet is genuinely empty (loaded successfully, zero rows)
  return (
    <Card sx={emptyRowCardSx}>
      <Typography variant="body1" sx={{ color: 'var(--blue)' }}>
        {emptyMessage}
      </Typography>
    </Card>
  );
}

/**
 * Renders the fleet-overview list (used both for PheNodes and wireless sensors).
 *
 * Distinguishes four "no rows visible" states so the user always sees a
 * useful message instead of a blank space:
 *
 *   1. First-time loading (no data yet, no error) → "Loading fleet…"
 *   2. Failed load          (error, no data)      → "Failed to load fleet"
 *                                                   + Retry button if onRetry supplied
 *   3. Loaded but empty     (no error, zero rows) → "No devices in your fleet yet"
 *   4. Search returned zero (rows exist, none match query)
 *                                                 → "No entries found for that search"
 *
 * Once rows are present and not filtered out, the cards render normally.
 *
 * @param {Object} props
 * @param {string} props.title
 * @param {string} props.searchPlaceholder
 * @param {string} props.entityLabel - "PheNodes" or "Sensors". The header
 *                                     count line composes its label from this:
 *                                     "{entityLabel} Active|Live|Offline: N",
 *                                     mirroring the current statusFilter.
 *                                     Replaces the old `activeLabel` +
 *                                     `activeCount` props — the view now
 *                                     owns the label/count derivation
 *                                     because both depend on internal
 *                                     statusFilter state.
 * @param {Array} props.rows - Array of {
 *   siteName,                                // display name
 *   lastMeasurements,                        // formatted display string
 *   lastMeasurementAt: string|null,          // raw ISO 8601 — used for default
 *                                            //   recency sort and as the recency
 *                                            //   tiebreaker inside status sort
 *   metrics: [{ label, value }]              // 5 cells in the grid
 * }
 * @param {boolean} [props.isLoading]
 * @param {Error} [props.error] - SWR error from the calling hook, if any
 * @param {Function} [props.onRetry] - Optional retry handler (e.g., the hook's mutate())
 * @param {string} [props.emptyMessage] - Override for state #3's message — wireless-sensor
 *                                        page may want different copy than the device page
 */
export default function FleetOverviewView({
  title = 'Your Fleet',
  entityLabel = 'Devices',
  searchPlaceholder,
  rows,
  isLoading = false,
  error,
  onRetry,
  emptyMessage = 'No devices in your fleet yet.'
}) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  // 'sortMode' is binary now ('' | 'alpha'). The previous 'status' value
  // moved to its own statusFilter state below — sort and filter were
  // entangled before, so picking a status sort prevented you from also
  // sorting alphabetically. Splitting them lets the user combine
  // (e.g. "show only Live cards, alphabetized").
  const [sortMode, setSortMode] = useState('');
  // Tri-state filter: '' (no filter) | 'active' | 'offline'. Drives both
  // which rows render AND the Status button's label. Vocabulary is
  // 'active' to match what the user sees in each card's Health Status
  // cell (the transformer translated the backend's "Live" → "Active").
  const [statusFilter, setStatusFilter] = useState('');
  // 1-indexed current page. Reset to 1 whenever the filter/search/sort
  // changes the underlying set (see useEffect below) so the user isn't
  // stranded on, say, page 4 of a list that just shrank to one page.
  const [currentPage, setCurrentPage] = useState(1);
  // Whether each card's title shows the user-set label (false, default)
  // or the immutable external_id / externalSensorId (true). Toggled by
  // the "MAC Address" button in the toolbar. Keeps the fallback chain
  // in the transformer untouched — when no label exists the row's
  // siteName already shows the external id; this just forces it for
  // every row, label or not.
  const [showMacAddress, setShowMacAddress] = useState(false);
  // Whether the card list is scrolled away from the top. Drives the
  // top-border treatment on the table wrapper — a thin var(--blue)
  // hairline appears the moment a card scrolls past the upper boundary,
  // and disappears again when the user scrolls back to the top. Tells
  // the user "there's content above" without needing a permanent rule.
  const [isScrolledFromTop, setIsScrolledFromTop] = useState(false);
  // Imperative handle on the scroll container so the scroll listener
  // and the page-change reset effect can read/write scrollTop.
  const scrollContainerRef = useRef(null);

  const visibleRows = useMemo(() => {
    const loweredSearch = searchValue.trim().toLowerCase();

    // Why pull the health string off `metrics` instead of carrying a
    // top-level `healthStatus` on the row: the row shape is
    // intentionally generic ("metrics is just an array of {label,
    // value}") so future fleet types can change which slots they fill
    // without the view needing to know. The label-string lookup is
    // the agreed contract.
    const getHealthStatus = (row) => {
      const healthMetric = row.metrics.find((metric) => metric.label.toLowerCase().includes('health status'));
      return healthMetric?.value?.toLowerCase() || '';
    };

    // Single filter pass — search + status combined. Doing both in one
    // loop avoids walking the rows array twice for what's conceptually
    // one operation ("which rows survive the current view criteria").
    const filteredRows = rows.filter((row) => {
      if (loweredSearch) {
        // Include both siteName and externalId in the search corpus so
        // a user can find a card by either its label OR its MAC/external
        // id, regardless of which one is currently being displayed in
        // the card title (controlled by the MAC Address toggle).
        const searchableText = [row.siteName, row.externalId, row.lastMeasurements, ...row.metrics.map((metric) => `${metric.label} ${metric.value}`)]
          .join(' ')
          .toLowerCase();
        if (!searchableText.includes(loweredSearch)) return false;
      }
      if (statusFilter) {
        // statusFilter is 'active' | 'offline'; getHealthStatus returns
        // the lowercased string from the metric ('active'/'offline'/
        // 'unknown'/''). Strict equality so 'unknown' doesn't sneak
        // into either bucket.
        if (getHealthStatus(row) !== statusFilter) return false;
      }
      return true;
    });

    // Recency comparator (descending — newest first).
    //
    // Reads `lastMeasurementAt`, which the row transformers set to the
    // raw ISO timestamp (see utils/transforms/device.js +
    // wirelessSensor.js). Rows that have never reported (null) sort to
    // the bottom regardless of direction, via -Infinity fallback —
    // "Never" should never push ahead of a real timestamp.
    const compareRecencyDesc = (a, b) => {
      const aTime = a.lastMeasurementAt ? new Date(a.lastMeasurementAt).getTime() : -Infinity;
      const bTime = b.lastMeasurementAt ? new Date(b.lastMeasurementAt).getTime() : -Infinity;
      return bTime - aTime;
    };

    // 'alpha' — pure A-Z by whatever's currently displayed as the title.
    //           When the MAC Address toggle is OFF this is siteName;
    //           when it's ON the user is looking at externalIds, so
    //           the sort follows the display. Per product direction
    //           this mode explicitly does NOT chain on recency; users
    //           picking alphabetical want a stable ordering they can
    //           scan top-to-bottom.
    if (sortMode === 'alpha') {
      return [...filteredRows].sort((a, b) => {
        const aText = showMacAddress ? a.externalId : a.siteName;
        const bText = showMacAddress ? b.externalId : b.siteName;
        return aText.localeCompare(bText);
      });
    }

    // Default — most-recent-first. Recently-reporting devices/sensors
    // are what users are most likely scanning for; surfacing them at
    // the top means the page is useful at a glance without picking a
    // sort mode.
    return [...filteredRows].sort(compareRecencyDesc);
  }, [rows, searchValue, sortMode, statusFilter, showMacAddress]);

  // Pagination derived from the full filtered+sorted set so search and
  // filter behave the way users expect: the search box reaches every
  // row in the fleet (across all pages), not just the current page.
  // Sort and filter run before pagination, so paging is always against
  // the user's current view.
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return visibleRows.slice(start, start + PAGE_SIZE);
  }, [visibleRows, currentPage]);

  // Reset to page 1 whenever the underlying set shifts. Without this,
  // a user on page 3 who clears their search lands on page 3 of a
  // (possibly much shorter) list — usually empty, which reads as a bug.
  // The effect intentionally runs on sort changes too: alphabetizing a
  // 100-card fleet rearranges which 20 cards appear on each page, so
  // it makes more sense to start from page 1 than to leave the user
  // on the same page number with different cards.
  useEffect(() => {
    setCurrentPage(1);
  }, [searchValue, sortMode, statusFilter]);

  // Whenever the rendered slice changes (page change OR any change that
  // resets us to page 1), force-scroll the container back to the top.
  // Otherwise the previous page's scroll position carries over and the
  // user lands mid-list on the new page — and the scroll-from-top border
  // would show up incorrectly until the next manual scroll.
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    setIsScrolledFromTop(false);
  }, [currentPage, searchValue, sortMode, statusFilter]);

  // Scroll listener — toggles `isScrolledFromTop` whenever the container
  // crosses the top boundary. Passive listener so it doesn't block
  // smooth scrolling. Threshold is `> 0` (any pixel of scroll counts as
  // "away from top") rather than a tolerance, so the border appears
  // immediately as the first card slides past instead of after some
  // arbitrary buffer.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return undefined;

    const onScroll = () => {
      const scrolled = el.scrollTop > 0;
      // Functional update with a guard so we only trigger a re-render
      // when the boolean actually flips, not on every scroll tick.
      setIsScrolledFromTop((prev) => (prev === scrolled ? prev : scrolled));
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Tri-state click cycle: '' → 'active' → 'offline' → ''.
  // Source of truth is STATUS_FILTER_CYCLE so adding a 4th state later
  // (e.g., 'unknown') only requires editing the constant.
  const cycleStatusFilter = () => {
    setStatusFilter((previous) => {
      const idx = STATUS_FILTER_CYCLE.indexOf(previous);
      const nextIdx = (idx + 1) % STATUS_FILTER_CYCLE.length;
      return STATUS_FILTER_CYCLE[nextIdx];
    });
  };

  // Header label + count derived from the current statusFilter.
  //
  //   statusFilter ''        → "Total {Entity}: <total fleet size>"
  //   statusFilter 'active'  → "{Entity} Active: <active count>"
  //   statusFilter 'offline' → "{Entity} Offline: <offline count>"
  //
  // Default state shows the TOTAL fleet count (not active count) so the
  // user can glance at the page and immediately see how many devices/
  // sensors they own — independent of any filter. Clicking the Status
  // button cycles into the focused counts.
  //
  // Why the count + label both live in the view (not the container): the
  // value depends on `statusFilter`, which is internal state of this
  // component. Containers shouldn't have to mirror that state to know
  // what to pass in.
  //
  // All counts are computed against the FULL `rows` array, not against
  // visibleRows. So e.g. "Sensors Active: 12" reflects the size of the
  // Active cohort across the entire fleet, regardless of search text or
  // pagination. The "Total {Entity}" is also unfiltered by design — per
  // product direction, the rest state shows the canonical fleet size,
  // not whatever happens to be on screen.
  const headerStatus = useMemo(() => {
    const activeCount = rows.filter((row) => {
      const health = row.metrics.find((metric) => metric.label.toLowerCase().includes('health status'));
      return health?.value?.toLowerCase() === 'active';
    }).length;
    const offlineCount = rows.filter((row) => {
      const health = row.metrics.find((metric) => metric.label.toLowerCase().includes('health status'));
      return health?.value?.toLowerCase() === 'offline';
    }).length;

    if (statusFilter === 'active') return { label: `${entityLabel} Active:`, count: activeCount };
    if (statusFilter === 'offline') return { label: `${entityLabel} Offline:`, count: offlineCount };
    // Default — "Total" framing, count is rows.length so the user always
    // sees the canonical fleet size at rest.
    return { label: `Total ${entityLabel}:`, count: rows.length };
  }, [rows, statusFilter, entityLabel]);

  return (
    <MainCard content={false} sx={{ width: '100%', minWidth: 0, overflow: 'hidden', ...glassSurfaceSx, ...reflectedCardChromeSx }}>
      <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 2.5 } }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            borderBottom: '1px solid',
            borderBottomColor: 'var(--orange)',
            pb: 1.25
          }}
        >
          <Typography variant="h4" sx={{ color: 'var(--blue)' }}>
            {title}
          </Typography>
          <Typography variant="body1" sx={{ ml: 'auto', textAlign: 'right' }}>
            <Box component="span" sx={{ color: 'var(--blue)', fontSize: { xs: '0.9rem', sm: '1rem' } }}>
              {headerStatus.label}
            </Box>
            <Box component="span" sx={{ ...greenGlowTextSx, ml: 1.5, display: 'inline-block', fontSize: { xs: '0.9rem', sm: '1rem' } }}>
              {headerStatus.count}
            </Box>
          </Typography>
        </Stack>
      </Box>

      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 0, pb: { xs: 2, sm: 3 } }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            mb: 2,
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', width: { xs: '100%', sm: 'auto' }, flex: { xs: 1, sm: '0 1 auto' }, minWidth: 0 }}
          >
            <Tooltip title="Search" arrow={false} slotProps={tooltipSlotProps}>
              <IconButton
                aria-label="open search"
                onClick={() => setIsSearchOpen((previous) => !previous)}
                sx={{
                  width: 40,
                  height: 40,
                  ...controlBaseSx,
                  '&:hover': {
                    borderColor: 'var(--green)',
                    color: 'var(--green)',
                    backgroundColor: 'rgba(0, 17, 48, 0.03)',
                    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))'
                  },
                  ...(isSearchOpen && {
                    borderColor: 'var(--green)',
                    color: 'var(--green)'
                  })
                }}
              >
                <SearchOutlined />
              </IconButton>
            </Tooltip>

            <Box
              sx={{
                width: isSearchOpen ? { xs: '100%', sm: 260 } : 0,
                maxWidth: { sm: 260 },
                flexGrow: isSearchOpen ? 1 : 0,
                minWidth: 0,
                opacity: isSearchOpen ? 1 : 0,
                overflow: 'hidden',
                transition: 'width 220ms ease, opacity 220ms ease, flex-grow 220ms ease'
              }}
            >
              <OutlinedInput
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                size="small"
                placeholder={searchPlaceholder}
                fullWidth
                inputProps={{ 'aria-label': 'Search fleet table' }}
                startAdornment={
                  <InputAdornment position="start">
                    <SearchOutlined style={{ color: 'var(--blue)' }} />
                  </InputAdornment>
                }
                sx={{
                  minHeight: 40,
                  borderStyle: 'none none solid',
                  borderWidth: '1px 1px 2px',
                  borderColor: 'var(--dark-blue) var(--dark-blue) var(--reflected-light)',
                  color: 'var(--blue)',
                  backgroundColor: '#00143642',
                  boxShadow: 'inset 1px 4px 5px #0003',
                  borderRadius: 1,
                  '& .MuiOutlinedInput-notchedOutline': {
                    border: 'none'
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: 'var(--blue)',
                    opacity: 1
                  }
                }}
              />
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
            <Tooltip title="Sort Alphabetically" arrow={false} slotProps={tooltipSlotProps}>
              <ToggleButton
                value="alpha"
                selected={sortMode === 'alpha'}
                onChange={() => setSortMode((previous) => (previous === 'alpha' ? '' : 'alpha'))}
                aria-label="sort fleet alphabetically"
                sx={sortToggleSx}
              >
                <SortAscendingOutlined />
                <Typography variant="caption" sx={{ display: { xs: 'none', md: 'inline' }, color: 'inherit' }}>
                  A-Z
                </Typography>
              </ToggleButton>
            </Tooltip>

            <Tooltip title={STATUS_TOOLTIPS[statusFilter]} arrow={false} slotProps={tooltipSlotProps}>
              {/*
                Tri-state cycle button — clicks advance through:
                  Status (no filter) → Live → Offline → Status …
                ToggleButton's `selected` is binary, so we treat any
                non-empty filter as "selected" for the visual treatment.
                The label text is the actual state indicator, and is
                shown on every breakpoint (unlike A-Z where the icon
                alone conveys meaning) because the icon doesn't tell
                you Live vs Offline.
              */}
              <ToggleButton
                value="status"
                selected={statusFilter !== ''}
                onChange={cycleStatusFilter}
                aria-label={`Filter by status. Currently: ${STATUS_LABELS[statusFilter]}.`}
                sx={sortToggleSx}
              >
                <CheckCircleOutlined />
                <Typography variant="caption" sx={{ color: 'inherit' }}>
                  {STATUS_LABELS[statusFilter]}
                </Typography>
              </ToggleButton>
            </Tooltip>

            {/*
              MAC Address toggle — flips each card title between the user-
              friendly label (default) and the immutable external_id.
              The transformer always falls back to the external_id when no
              label exists, so this button just forces it for cards that
              DO have a label, giving the user a quick way to read off
              hardware identifiers without renaming anything.

              Tooltip text describes the action the next click will take
              (the action verb, not the current state):
                showMacAddress=false → tooltip "MAC Address" (click → show MACs)
                showMacAddress=true  → tooltip "{Entity} Name" (click → back to names)

              Singular form derived from the entityLabel prop ("PheNodes"
              → "PheNode", "Sensors" → "Sensor") so each fleet's tooltip
              reads naturally without the container needing to pass it in
              separately.
            */}
            <Tooltip
              title={showMacAddress ? `${entityLabel.replace(/s$/, '')} Name` : 'MAC Address'}
              arrow={false}
              slotProps={tooltipSlotProps}
            >
              <ToggleButton
                value="mac"
                selected={showMacAddress}
                onChange={() => setShowMacAddress((previous) => !previous)}
                aria-label={
                  showMacAddress
                    ? `Show ${entityLabel.replace(/s$/, '').toLowerCase()} name (currently showing MAC address)`
                    : 'Show MAC address (currently showing name)'
                }
                sx={sortToggleSx}
              >
                <IdcardOutlined />
                <Typography variant="caption" sx={{ display: { xs: 'none', md: 'inline' }, color: 'inherit' }}>
                  MAC
                </Typography>
              </ToggleButton>
            </Tooltip>
          </Stack>
        </Stack>

        {/*
          Scroll boundary wrapper. Carries the visible top/bottom hairlines
          that mark where the scroll viewport ends.

          Top edge: invisible at rest, but a 1px var(--box-outline-blue)
          hairline appears the moment a card scrolls past the upper
          boundary. Driven by `isScrolledFromTop` (toggled in the scroll
          listener useEffect above). When the user scrolls back to the
          top the border disappears again.

          Borders are hidden during the loading / empty-fleet state
          (no `rows`) — a bordered "table" framing an inert "Loading…"
          message reads as a UI error.
        */}
        <Box
          sx={{
            borderTop: rows && rows.length > 0 && isScrolledFromTop ? '1px solid var(--box-outline-blue)' : 'none',
            borderBottom: rows && rows.length > 0 ? '1px solid var(--box-outline-blue)' : 'none'
          }}
        >
          <Box
            ref={scrollContainerRef}
            sx={{
              // Fixed `height` (not `maxHeight`) so the table stays a
              // constant size regardless of how many cards are inside.
              // With one card and `maxHeight`, the wrapper would shrink
              // to that one card's height and the bottom border + the
              // results count below would slide up under it. With fixed
              // `height`, the bottom border stays at the bottom of the
              // allotted area and the count below stays anchored at the
              // page-bottom position the user is used to seeing.
              height: { xs: 'calc(100vh - 280px)', md: 635 },
              overflowY: 'auto',
              overflowX: { xs: 'auto', md: 'hidden' },
              pb: 1,
              // Hide the native scrollbar entirely. Reason: a visible
              // scrollbar takes ~13px of width inside the scroll
              // container, which means cards (width: 100% of inner
              // content area) end up ~13px short of the wrapper's right
              // edge. That's why the table's bordered chrome and the
              // toolbar's Status button were extending past the cards
              // on the right. With the scrollbar hidden, cards extend
              // to the wrapper's right edge — and the borders + Status
              // button already sit at the wrapper's right edge, so all
              // three line up naturally without manual offsets.
              //
              // The scroll itself still works: mouse wheel, touchpad
              // two-finger swipe, touch drag, keyboard PgUp/PgDown,
              // arrow keys all continue to operate on the overflowing
              // content. The only thing missing is the visible
              // scrollbar thumb — which the scroll-edge fade and the
              // top/bottom border lines together communicate well
              // enough ("there's more above/below").
              scrollbarWidth: 'none', // Firefox
              '&::-webkit-scrollbar': {
                display: 'none' // Chrome / Safari / Edge
              },
              // Subtle scroll-edge fade. Cards passing the boundary
              // dim from 100% to ~85% opacity over an 8px band — the
              // effect is barely perceptible on its own; the
              // borderTop/borderBottom on the wrapper provides the
              // crisp visual delimiter.
              maskImage:
                'linear-gradient(to bottom, rgba(0,0,0,0.85) 0px, black 8px, black calc(100% - 8px), rgba(0,0,0,0.85) 100%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, rgba(0,0,0,0.85) 0px, black 8px, black calc(100% - 8px), rgba(0,0,0,0.85) 100%)'
            }}
          >
          <Box sx={{ minWidth: { xs: 860, sm: 920, md: 'auto' } }}>
            <Stack
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                boxSizing: 'border-box'
              }}
            >
              {/*
                Render only the current page slice. `visibleRows` (the
                full filtered+sorted set) is still used for the empty-state
                check below and for the pagination total — search and
                filter are applied BEFORE this slice, so the search box
                always reaches every row in the fleet, not just what's
                currently on screen.
              */}
              {pagedRows.map((row) => {
                // Pick which identifier to render as the card title.
                // The MAC button toggles `showMacAddress`; when on we
                // force the immutable externalId for every card. When
                // off, siteName retains its existing fallback chain
                // (label || externalId), so cards without a label
                // still show something useful by default.
                const displayedTitle = showMacAddress ? row.externalId : row.siteName;
                return (
                <Card
                  // Key on the immutable external_id (not the user-set
                  // label) — labels can collide between two devices and
                  // collisions cause React to incorrectly reconcile/reuse
                  // wrong Card instances on re-render.
                  key={row.externalId}
                  sx={{
                    width: '100%',
                    minWidth: { xs: 840, sm: 900, md: 0 },
                    backgroundColor: 'rgba(12, 35, 80, 0.359)',
                    p: 2,
                    border: '0.5px solid var(--box-outline-blue)',
                    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
                    boxSizing: 'border-box',
                    textAlign: 'center',
                    opacity: 1,
                    transition: 'background-color 120ms ease, border-color 120ms ease',
                    '&:hover': {
                      backgroundColor: 'rgba(56, 152, 236, 0.1)',
                      borderLeft: '0.5px solid var(--green)',
                      borderRight: '0.5px solid var(--green)',
                      boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
                      cursor: 'pointer'
                    }
                  }}
                >
                  <Grid container spacing={{ xs: 1.5, md: 2 }} sx={{ alignItems: 'center' }}>
                    <Grid size={{ xs: 3, md: 3, lg: 3 }}>
                      {/*
                        Outer Stack spacing controls the gap between the
                        site name (top) and the caption+value pair (below).
                        Bumped from 0.4 → 1.25 so the site name has more
                        breathing room and the caption "Last measurements
                        taken:" feels visually pushed down rather than
                        crowding the title.

                        Inner Stack with spacing=0 keeps the caption tight
                        against its value so they read as one unit.
                      */}
                      {/*
                        minWidth: 0 — without this the Stack would otherwise
                        let its Typography children push out the grid cell
                        when siteName or the date string is too long,
                        defeating the ellipsis truncation. minWidth: 0 lets
                        the grid cell's `1fr` actually constrain the
                        content width.
                      */}
                      <Stack spacing={1.25} sx={{ textAlign: 'left', minWidth: 0 }}>
                        <Typography
                          variant="h4"
                          title={displayedTitle}
                          sx={{
                            color: 'var(--green)',
                            fontSize: { xs: '1.1rem', sm: '1.25rem' },
                            ...truncateLineSx
                          }}
                        >
                          {displayedTitle}
                        </Typography>
                        <Stack spacing={0} sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle1" sx={{ color: 'var(--blue)', fontSize: { xs: '0.78rem', sm: '0.84rem' }, ...truncateLineSx }}>
                            Last measurements taken:
                          </Typography>
                          <Typography
                            variant="body1"
                            title={row.lastMeasurements}
                            sx={{
                              color: 'var(--green)',
                              fontSize: { xs: '0.8rem', sm: '0.88rem' },
                              ...truncateLineSx
                            }}
                          >
                            {row.lastMeasurements}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Grid>

                    <Grid size={{ xs: 9, md: 9, lg: 9 }}>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: {
                            xs: 'repeat(5, minmax(0, 1fr))',
                            sm: 'repeat(5, minmax(0, 1fr))',
                            lg: 'repeat(5, minmax(0, 1fr))'
                          },
                          gap: { xs: 1.25, sm: 1.5, lg: 2 },
                          justifyItems: 'stretch'
                        }}
                      >
                        {/*
                          justifyItems: 'stretch' (instead of 'center') so
                          each metric Stack fills its grid cell width,
                          giving the truncation rule something to truncate
                          AGAINST. Without stretch, the Stack collapsed to
                          fit-content and there was nothing to ellipsis.
                          The text inside each Typography is then
                          re-centered via textAlign: 'center'.
                        */}
                        {row.metrics.map((metric) => (
                          <Stack
                            key={`${row.siteName}-${metric.label}`}
                            spacing={0.2}
                            sx={{ alignItems: 'stretch', minWidth: 0, width: '100%' }}
                          >
                            <Typography
                              variant="subtitle1"
                              title={metric.label}
                              sx={{
                                color: 'var(--blue)',
                                fontSize: { xs: '0.82rem', sm: '0.9rem' },
                                textAlign: 'center',
                                ...truncateLineSx
                              }}
                            >
                              {metric.label}
                            </Typography>
                            <Typography
                              variant="h4"
                              title={metric.value}
                              sx={{
                                ...greenGlowTextSx,
                                fontSize: { xs: '1rem', sm: '1.15rem' },
                                textAlign: 'center',
                                ...truncateLineSx
                              }}
                            >
                              {metric.value}
                            </Typography>
                          </Stack>
                        ))}
                      </Box>
                    </Grid>
                  </Grid>
                </Card>
                );
              })}
              {visibleRows.length === 0 && renderEmptyStateCard({ rows, isLoading, error, onRetry, searchValue, emptyMessage })}
            </Stack>
          </Box>
          </Box>
        </Box>

        {/*
          Footer row — pagination centered, results count right-justified.
          - Pagination only renders when there's more than one page; a
            lone "1" pager adds visual noise without a function.
          - The count is always present so the user can see the live
            filter effect even when the entire fleet fits on one page.
            X = currently visible (filtered + sorted set), Y = total
            fleet size — when X < Y the user knows a filter is reducing
            the view, when X === Y nothing is being hidden.
          - Stacks vertically on xs (so they don't fight for horizontal
            room), side-by-side from sm+ with pagination centered and
            count pushed to the right via the spacer Box on the left.
        */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems="center"
          spacing={{ xs: 1, sm: 0 }}
          sx={{ pt: 2.5, pb: { xs: 1, sm: 1.5 } }}
        >
          {/* Left spacer — keeps Pagination optically centered when the
              count Box on the right has variable width. Hidden when
              there's no pagination so the count snaps right cleanly. */}
          {totalPages > 1 && <Box sx={{ flex: 1, display: { xs: 'none', sm: 'block' } }} />}
          {totalPages > 1 && (
            <Pagination
              count={totalPages}
              page={currentPage}
              onChange={(_, page) => setCurrentPage(page)}
              shape="rounded"
              size="medium"
              siblingCount={1}
              boundaryCount={1}
              sx={paginationSx}
            />
          )}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              justifyContent: 'flex-end',
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: 'var(--blue)',
                fontSize: { xs: '0.78rem', sm: '0.85rem' },
                whiteSpace: 'nowrap'
              }}
            >
              Showing {visibleRows.length.toLocaleString()} of {rows.length.toLocaleString()}
            </Typography>
          </Box>
        </Stack>
      </Box>
    </MainCard>
  );
}
