import { useEffect, useMemo, useRef, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import AntIcon from 'components/AntIcon';
import CheckCircleOutlined from '@ant-design/icons-svg/lib/asn/CheckCircleOutlined';
import CheckOutlined from '@ant-design/icons-svg/lib/asn/CheckOutlined';
import IdcardOutlined from '@ant-design/icons-svg/lib/asn/IdcardOutlined';
import MoreOutlined from '@ant-design/icons-svg/lib/asn/MoreOutlined';
import SearchOutlined from '@ant-design/icons-svg/lib/asn/SearchOutlined';
import SortAscendingOutlined from '@ant-design/icons-svg/lib/asn/SortAscendingOutlined';

import ConfirmRenameModal from 'components/ConfirmRenameModal';
import EditableLabel from 'components/EditableLabel';
import MainCard from 'components/MainCard';
import { useToast } from 'providers/ToastProvider';
// Menu chrome tokens (paper + item) — used by the mobile filter
// overflow menu rendered below the kebab IconButton. Shared with the
// rest of the app's neon-on-navy dropdowns so the menu reads as part
// of the same vocabulary as PhenodeSelector / sensor-network's
// PheNode picker / etc.
import { neonMenuItemSx, neonMenuPaperSx } from 'themes/sx-tokens';

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
  // No minWidth — the empty / loading / error card sizes to its
  // container so it works on every breakpoint without forcing
  // horizontal scroll on mobile.
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
  '': 'Filter by Status',
  active: 'Showing Active only',
  offline: 'Showing Offline only'
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
function renderEmptyStateCard({ rows, isLoading, error, onRetry, searchValue, emptyMessage, entityLabel }) {
  // 1. Loading first time (no data yet)
  if (isLoading && (!rows || rows.length === 0)) {
    return (
      <Card sx={emptyRowCardSx}>
        <Typography
          variant="h5"
          sx={{
            // Bigger + greener + glowing so the loading state pops
            // visually rather than reading as a quiet info line. Same
            // textShadow recipe as the metric values inside cards so
            // it feels like part of the chrome's vocabulary.
            color: 'var(--green)',
            fontWeight: 600,
            fontSize: { xs: '0.85rem', sm: '0.95rem' },
            textShadow: '0 1px 9px #1a75e0c9',
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 0.25
          }}
        >
          Loading {entityLabel}
          {/*
            Three dots that pulse in sequence (each delayed 0.2s after
            the previous) using a shared `pheno-loading-dot` keyframe
            animation. Visually the row of dots reads as a wave of
            opacity moving left-to-right and looping — communicates
            "still working" without rotation or spinner.

            We render the dots as separate spans (rather than animating
            a single text content) because CSS `content` animations
            have inconsistent browser support; opacity on individual
            spans is universally supported.

            `inline-block` on each dot is required for `transform` /
            `opacity` to take their own animation timeline rather than
            inheriting the parent's text flow.
          */}
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              ml: 0.25,
              '@keyframes pheno-loading-dot': {
                '0%, 80%, 100%': { opacity: 0.25 },
                '40%': { opacity: 1 }
              },
              '& > span': {
                display: 'inline-block',
                animation: 'pheno-loading-dot 1.4s infinite ease-in-out both'
              },
              '& > span:nth-of-type(1)': { animationDelay: '0s' },
              '& > span:nth-of-type(2)': { animationDelay: '0.2s' },
              '& > span:nth-of-type(3)': { animationDelay: '0.4s' }
            }}
          >
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </Box>
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
 * @param {Function} [props.onRename] - Async (externalId, newLabel) → Promise<void>. When
 *                                      supplied, each card's site name becomes a
 *                                      click-to-edit label gated by the MAC toggle.
 *                                      Container is responsible for the mutation
 *                                      (see services/mutations.js) and for calling
 *                                      mutate() on its SWR hook to revalidate.
 *                                      When omitted, labels render plain (read-only).
 * @param {React.ReactNode} [props.scopeSelector] - Optional element rendered between the
 *                                                  header row and the toolbar. Used by
 *                                                  the wireless-sensor fleet to host the
 *                                                  PheNode selector — the dropdown that
 *                                                  scopes the visible sensors to one
 *                                                  PheNode's connected cohort. PheNode
 *                                                  fleet page omits it.
 * @param {string} [props.emptyMessage] - Override for state #3's message — wireless-sensor
 *                                        page may want different copy than the device page
 * @param {Function} [props.onRowClick] - (row) => void. When supplied, each card becomes
 *                                        clickable (role="button" + Enter/Space keyboard
 *                                        activation) and invokes this handler with the
 *                                        clicked row. Used by the PheNode fleet to deep-link
 *                                        into the sensor-measurements page scoped to the
 *                                        clicked device. EditableLabel internally stops
 *                                        propagation so the rename pencil keeps working
 *                                        without firing navigation. When omitted, cards are
 *                                        non-interactive (no role, no cursor change beyond
 *                                        the existing hover treatment).
 */
export default function FleetOverviewView({
  title = 'Your Fleet',
  entityLabel = 'Devices',
  searchPlaceholder,
  // Default to an empty array — both production containers already
  // pass an array (after their `(devices ?? []).map(...)` step), but
  // this default keeps the view robust against any caller passing
  // `undefined` (the dev showcase page does this to force the
  // first-time-loading state). Several spots below — the search/filter
  // useMemo, the headerStatus useMemo, the `Showing X of Y` count —
  // call `rows.filter(...)` and `rows.length` directly without local
  // guards, so a single default at the destructure is the cheapest
  // way to keep them all crash-free.
  rows = [],
  isLoading = false,
  error,
  onRetry,
  onRename,
  scopeSelector,
  emptyMessage = 'No devices in your fleet yet.',
  onRowClick
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
  // top-border treatment on the table wrapper — a thin
  // var(--box-outline-blue) hairline appears the moment a card scrolls
  // past the upper boundary, and disappears again when the user
  // scrolls back to the top. Tells the user "there's content above"
  // without imposing a permanent rule that would blend into the page
  // gradient at rest.
  const [isScrolledFromTop, setIsScrolledFromTop] = useState(false);
  // Imperative handle on the scroll container so the scroll listener
  // and the page-change reset effect can read/write scrollTop.
  const scrollContainerRef = useRef(null);

  // Anchor element for the mobile filter overflow menu (the "kebab"
  // three-dot button that collapses the Sort / Status / MAC toggles
  // into a single dropdown on narrow viewports). `null` means closed.
  // Kept here rather than threaded through props so the menu's open/
  // close state is colocated with the filter values it actually drives.
  const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);
  const isFilterMenuOpen = Boolean(filterMenuAnchor);

  // Rename flow state. `null` when no rename is in flight; otherwise
  // `{ externalId, oldName, newName }` carrying everything the
  // ConfirmRenameModal needs to render. Single piece of state instead
  // of separate flags so we can never get into a half-open modal where
  // e.g. open=true but no name to render.
  const [renameDraft, setRenameDraft] = useState(null);
  const toast = useToast();

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
        const searchableText = [
          row.siteName,
          row.externalId,
          row.lastMeasurements,
          ...row.metrics.map((metric) => `${metric.label} ${metric.value}`)
        ]
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

  // Singular form of entityLabel for tooltip / toast / modal copy.
  // "PheNodes" → "PheNode", "Sensors" → "Sensor". Same heuristic the
  // MAC button tooltip uses; centralized so both consumers share it.
  const entityNounSingular = entityLabel.endsWith('s') ? entityLabel.slice(0, -1) : entityLabel;

  // Confirmation handler — runs when the user clicks Continue in the
  // ConfirmRenameModal. Drives the actual mutation, surfaces the
  // success/error toast, and decides whether to close the modal.
  //
  // Success path: close the modal, fire success toast naming the new
  // label so the user sees the same name in the toast as on the card
  // (which has just rerendered with the new name post-mutate).
  //
  // Error path: surface backend `detail` if present (Yup validation,
  // 400 messages, etc.), otherwise the generic "Failed to rename …"
  // string. Modal stays open so the user can retry without re-typing
  // the new name; they can cancel out of the modal to abandon.
  const handleConfirmRename = async () => {
    if (!renameDraft || !onRename) return;
    const { externalId, newName } = renameDraft;
    try {
      await onRename(externalId, newName);
      toast.success(`'${newName}' renamed successfully`);
      setRenameDraft(null);
    } catch (err) {
      const backendMessage = typeof err?.detail === 'string' ? err.detail : null;
      const fallback = `Failed to rename ${entityNounSingular.toLowerCase()}`;
      toast.error(backendMessage ? `${fallback}: ${backendMessage}` : fallback);
      // Intentionally do NOT clear renameDraft — modal stays open for
      // retry. The Continue button re-enables (its internal isSubmitting
      // resets in its `finally`) and the user can click again.
    }
  };

  return (
    <>
      <MainCard
        content={false}
        sx={{ width: '100%', flex: 1, minWidth: 0, overflow: 'hidden', ...glassSurfaceSx, ...reflectedCardChromeSx }}
      >
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
              // `flex-end` (was `center`) so all toolbar controls
              // bottom-align with the PhenodeSelector's dropdown bottom.
              // The selector is the tallest item in the row (label
              // floats above the dropdown), and centering against it
              // would push the search icon + sort/filter buttons down
              // to the row's vertical middle, leaving them out of line
              // with the dropdown they share a row with. Bottom-aligning
              // puts every interactive element on the same baseline;
              // the label sits above as visual context for the dropdown.
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              // `flexWrap: 'nowrap'` — the toolbar must stay on a single
              // row at every breakpoint. On mobile, the Sort/Status/MAC
              // ToggleButtons collapse to a single 3-dot kebab IconButton
              // (see right-side Stack below), which means the toolbar's
              // total natural width fits a ~360px viewport without help
              // from wrapping. The previous `flexWrap: 'wrap'` + 100%-
              // width-on-xs treatment was there to avoid the search
              // input's expansion overlapping the three filter buttons;
              // with the filter chrome collapsed, there's nothing for
              // the search to overlap anymore. Keeping the row pinned
              // means the search bar grows inline up to its maxWidth
              // and stops next to the right-aligned kebab/buttons —
              // matching the product direction "search shouldn't push
              // buttons below it to the next line."
              flexWrap: 'nowrap',
              minWidth: 0
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              // Left sub-stack — holds the optional scope selector, the
              // search-icon affordance, and the expanding search input.
              // `flex: '1 1 auto'` lets the input grow into whatever
              // horizontal room is available before bumping into the
              // right sub-stack; `minWidth: 0` is required so flex
              // children can shrink below their content-width when the
              // viewport is narrow (without it, long PheNode labels in
              // the scope selector would force the toolbar to overflow).
              sx={{
                alignItems: 'flex-end',
                flex: '1 1 auto',
                minWidth: 0
              }}
            >
              {/*
              Optional scope-selector slot. When supplied (currently by
              the wireless-sensor fleet to host the PheNode dropdown),
              it sits at the LEFT of the toolbar row, before the
              search icon. The scope selector logically belongs WITH
              the search/filter controls — they're all "narrow what's
              visible" tools — and putting it inline keeps the toolbar
              a single row instead of growing taller.
            */}
              {scopeSelector}
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
                  <AntIcon icon={SearchOutlined} />
                </IconButton>
              </Tooltip>

              <Box
                sx={{
                  // Search input grows into the available toolbar space
                  // up to a ceiling rather than forcing 100% width on a
                  // breakpoint. `flexGrow: 1` lets it claim whatever
                  // horizontal room is free in the left sub-stack; the
                  // sub-stack's own flex limit + the right sub-stack's
                  // `flexShrink: 0` mean the search bar will stop the
                  // moment it touches the right-aligned filter chrome,
                  // never pushing those buttons to a second row.
                  //
                  // Closed state pins width to 0 + flexGrow 0 so the
                  // collapsed icon button doesn't leave a phantom gap.
                  width: isSearchOpen ? 'auto' : 0,
                  maxWidth: 260,
                  flexGrow: isSearchOpen ? 1 : 0,
                  flexShrink: 1,
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
                      <AntIcon icon={SearchOutlined} style={{ color: 'var(--blue)' }} />
                    </InputAdornment>
                  }
                  sx={{
                    minHeight: 40,
                    // No CSS border on the root at all. The visible bottom
                    // hairline is drawn entirely by the ::after pseudo-
                    // element below. Why this is the right move here:
                    //
                    //   A real CSS `border-bottom` follows the box's
                    //   border-radius — at the rounded bottom-left and
                    //   bottom-right corners the colored line curves up
                    //   the 8px arc. With var(--reflected-light) (subtle)
                    //   that's barely visible, but with var(--green) on
                    //   hover the curve reads as "green tint in the side
                    //   borders." A pseudo-element is a separate
                    //   absolutely-positioned rectangle that doesn't
                    //   inherit the parent's border-radius — it stays a
                    //   straight line.
                    //
                    // `position: relative` makes the pseudo-element's
                    // absolute positioning resolve against this box.
                    // `overflow: hidden` is the part that ties the
                    // straight-line pseudo-element back to the rounded
                    // visual shape: at the bottom corners the rounded
                    // mask clips the line so it terminates exactly where
                    // the corner curve begins. Cleaner than the line
                    // extending outside the visual box would have been.
                    position: 'relative',
                    overflow: 'hidden',
                    color: 'var(--blue)',
                    backgroundColor: '#00143642',
                    boxShadow: 'inset 1px 4px 5px #0003',
                    borderRadius: 1,
                    // Bottom hairline. Default state: 2px tall,
                    // var(--reflected-light). The transition smooths the
                    // height + color swap into hover so the change reads
                    // as a deliberate UI signal rather than a snap.
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '2px',
                      background: 'var(--reflected-light)',
                      pointerEvents: 'none',
                      transition: 'height 150ms ease, background 150ms ease',
                      zIndex: 1
                    },
                    // Hover (when not focused): line shrinks 2px → 1px
                    // and tints from --reflected-light to var(--green).
                    // Because this is a pseudo-element (not the box's
                    // border), changing its height does NOT affect the
                    // box's content area or padding — so the input text
                    // never shifts up or down on hover.
                    //
                    // `:not(.Mui-focused)` keeps this rule from applying
                    // when the input is focused; focus styling wins
                    // alone once the user has clicked in.
                    '&:hover:not(.Mui-focused):not(.Mui-disabled)::after': {
                      height: '1px',
                      background: 'var(--green)'
                    },
                    // Focused/selected: line returns to the default 2px
                    // var(--reflected-light) — explicitly re-asserted so
                    // the focus state is unambiguous and doesn't carry
                    // the hover treatment forward.
                    '&.Mui-focused::after': {
                      height: '2px',
                      background: 'var(--reflected-light)'
                    },
                    // Suppress MUI's notched outline in every state.
                    // Belt-and-braces — there's no border on the root
                    // anymore so the notched outline is the only place
                    // MUI could try to repaint a colored border.
                    '& .MuiOutlinedInput-notchedOutline': {
                      border: 'none'
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline, &.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      border: 'none'
                    },
                    // Typed text in var(--blue) so it matches the
                    // placeholder.
                    '& .MuiInputBase-input': {
                      color: 'var(--blue)'
                    },
                    '& .MuiInputBase-input::placeholder': {
                      color: 'var(--blue)',
                      opacity: 1
                    }
                  }}
                />
              </Box>
            </Stack>

            {/*
              Mobile-only kebab. Collapses the three filter ToggleButtons
              (Sort / Status / MAC) into a single 3-dot affordance so the
              toolbar fits on a 360–414px viewport without wrapping. The
              Menu rendered below opens from this button.
            */}
            <Tooltip title="Filters" arrow={false} slotProps={tooltipSlotProps}>
              <IconButton
                aria-label="open filter menu"
                aria-haspopup="true"
                aria-expanded={isFilterMenuOpen ? 'true' : undefined}
                onClick={(event) => setFilterMenuAnchor(event.currentTarget)}
                sx={{
                  display: { xs: 'inline-flex', sm: 'none' },
                  flexShrink: 0,
                  width: 40,
                  height: 40,
                  ...controlBaseSx,
                  '&:hover': {
                    borderColor: 'var(--green)',
                    color: 'var(--green)',
                    backgroundColor: 'rgba(0, 17, 48, 0.03)',
                    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))'
                  },
                  ...(isFilterMenuOpen && {
                    borderColor: 'var(--green)',
                    color: 'var(--green)'
                  })
                }}
              >
                <AntIcon icon={MoreOutlined} />
              </IconButton>
            </Tooltip>

            <Stack
              direction="row"
              spacing={1}
              sx={{
                // Three ToggleButton chrome is hidden on xs in favor of
                // the kebab above; the same buttons reappear at sm+ where
                // the toolbar has room to lay them out side-by-side.
                display: { xs: 'none', sm: 'flex' },
                alignItems: 'center',
                justifyContent: 'flex-end',
                flexShrink: 0
              }}
            >
              <Tooltip title="Sort Alphabetically" arrow={false} slotProps={tooltipSlotProps}>
                <ToggleButton
                  value="alpha"
                  selected={sortMode === 'alpha'}
                  onChange={() => setSortMode((previous) => (previous === 'alpha' ? '' : 'alpha'))}
                  aria-label="sort fleet alphabetically"
                  sx={sortToggleSx}
                >
                  <AntIcon icon={SortAscendingOutlined} />
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
                  // The aria-label MUST lead with the visible button text
                  // (STATUS_LABELS[statusFilter] — "Status" / "Active" /
                  // "Offline") to satisfy WCAG 2.5.3 "Label in Name". If
                  // the visible word doesn't appear at the start of the
                  // accessible name, voice-control users can't activate
                  // the button by speaking its visible text, and
                  // Lighthouse's label-content-name-mismatch audit fails.
                  aria-label={`${STATUS_LABELS[statusFilter]} — filter by status`}
                  sx={sortToggleSx}
                >
                  {/*
                  `aria-hidden` on the icon is load-bearing for the
                  label-content-name-mismatch audit. Ant Design's
                  CheckCircleOutlined ships with its own `aria-label`
                  ("check-circle") on the wrapping span — fine for
                  isolated decorative use, but inside an aria-labeled
                  button it pollutes axe-core's "visible text"
                  computation. axe then sees the visible text as
                  "check-circle Status" and looks for THAT substring
                  in the button's aria-label "Status — filter by
                  status", doesn't find it, and the audit fails even
                  though the visible word "Status" is in the
                  accessible name. Hiding the decorative icon from
                  the a11y tree means visible text resolves to plain
                  "Status" again — which matches.
                */}
                  <AntIcon icon={CheckCircleOutlined} aria-hidden="true" />
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
                  <AntIcon icon={IdcardOutlined} />
                  <Typography variant="caption" sx={{ display: { xs: 'none', md: 'inline' }, color: 'inherit' }}>
                    MAC
                  </Typography>
                </ToggleButton>
              </Tooltip>
            </Stack>

            {/*
              Mobile filter menu — the dropdown opened by the kebab
              IconButton above. Each item invokes the same state setter
              its corresponding ToggleButton would on desktop, so the
              two affordances are interchangeable at the data layer.
              A check icon on the left signals which filters are
              currently engaged; the trailing text on the Status item
              shows where in the cycle the user currently sits.
            */}
            <Menu
              anchorEl={filterMenuAnchor}
              open={isFilterMenuOpen}
              onClose={() => setFilterMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              slotProps={{ paper: { sx: { ...neonMenuPaperSx, minWidth: 200, mt: 0.5 } } }}
            >
              <MenuItem
                onClick={() => {
                  setSortMode((previous) => (previous === 'alpha' ? '' : 'alpha'));
                  setFilterMenuAnchor(null);
                }}
                sx={neonMenuItemSx}
              >
                <ListItemIcon sx={{ color: 'var(--green)', minWidth: 28 }}>
                  {sortMode === 'alpha' ? <AntIcon icon={CheckOutlined} /> : <AntIcon icon={SortAscendingOutlined} />}
                </ListItemIcon>
                <ListItemText primary="Sort A–Z" />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  cycleStatusFilter();
                  setFilterMenuAnchor(null);
                }}
                sx={neonMenuItemSx}
              >
                <ListItemIcon sx={{ color: 'var(--green)', minWidth: 28 }}>
                  {statusFilter ? <AntIcon icon={CheckOutlined} /> : <AntIcon icon={CheckCircleOutlined} />}
                </ListItemIcon>
                <ListItemText
                  primary={`Status: ${STATUS_LABELS[statusFilter] === 'Status' ? 'All' : STATUS_LABELS[statusFilter]}`}
                />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setShowMacAddress((previous) => !previous);
                  setFilterMenuAnchor(null);
                }}
                sx={neonMenuItemSx}
              >
                <ListItemIcon sx={{ color: 'var(--green)', minWidth: 28 }}>
                  {showMacAddress ? <AntIcon icon={CheckOutlined} /> : <AntIcon icon={IdcardOutlined} />}
                </ListItemIcon>
                <ListItemText primary={showMacAddress ? `Show ${entityNounSingular} Name` : 'Show MAC Address'} />
              </MenuItem>
            </Menu>
          </Stack>

          {/*
          Scroll boundary wrapper. Carries the visible top/bottom hairlines
          that mark where the scroll viewport ends.

          Top edge: invisible at rest, but a 1px var(--box-outline-blue)
          hairline appears the moment a card scrolls past the upper
          boundary. Driven by `isScrolledFromTop` (toggled in the scroll
          listener useEffect above). When the user scrolls back to the
          top the border disappears again. An always-on top rule blends
          too much into the page gradient at rest; only painting it
          when there's content above keeps the chrome quiet most of
          the time and useful precisely when it carries information.

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
                //
                // Viewport-relative height across all breakpoints so the
                // table grows with the screen — important on xl monitors
                // where a fixed-pixel cap (the previous `md: 635`) left
                // hundreds of pixels of unused vertical space below the
                // pagination on a 1440+ px tall display. The `100vh - 280`
                // subtracts the header (60), page padding (24×2), the
                // MainCard's title bar + toolbar (~120), and the
                // pagination + footer area (~50) — same recipe the xs
                // branch was already using, just applied universally.
                height: 'calc(100vh - 280px)',
                overflowY: 'auto',
                // Horizontal scroll re-enabled on every breakpoint. The
                // cards carry their original 5-column metric grid +
                // 3/9 left-right split at every viewport (instead of
                // collapsing the grid on narrow screens), so on mobile
                // the inner content sled (see `minWidth: 860` below)
                // overflows the scroll container's right edge and the
                // user can swipe across to read the rest of each row.
                // Per product direction: "expand the card out" rather
                // than smush the metric grid to two columns.
                overflowX: 'auto',
                pb: 1,
                // Shift the scrollbar gutter ~8px to the right.
                //
                // The negative right margin lets the scroll container
                // extend past the wrapper's right edge by 8px — the
                // scrollbar is rendered at the scroll container's right
                // edge, so it follows. The matching paddingRight pushes
                // the cards back to their original position so they
                // stay visually aligned with the wrapper's right edge.
                //
                // Net effect: cards stay where they are, scrollbar
                // appears 8px further right (out into the MainCard's
                // own right padding gutter). Without this, the scrollbar
                // sits at the cards' right edge — visually reading as
                // "to the left" of where the table chrome ends.
                mr: '-8px',
                pr: '8px',
                // Thin themed scrollbar. Visible on scroll but narrow
                // (8px) so the difference between card right edge and
                // wrapper right edge stays small. Track is transparent
                // — the chrome's saturated dark navy is what shows
                // through behind the thumb. Thumb is the same dark blue
                // we use elsewhere for filled-in interactive accents,
                // bumped to higher opacity on hover so the affordance
                // grows when the user actually goes for it.
                //
                // Firefox uses the `scrollbar-width` / `scrollbar-color`
                // standard properties; Chrome/Safari/Edge use the
                // `::-webkit-scrollbar` pseudo-element family. Both are
                // styled here so the look is consistent across browsers.
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(0, 68, 143, 0.6) transparent',
                '&::-webkit-scrollbar': {
                  width: '8px',
                  height: '8px'
                },
                '&::-webkit-scrollbar-track': {
                  background: 'transparent'
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: 'rgba(0, 68, 143, 0.6)',
                  borderRadius: '4px'
                },
                '&::-webkit-scrollbar-thumb:hover': {
                  backgroundColor: 'rgba(0, 68, 143, 0.9)'
                },
                // Subtle scroll-edge fade. Cards passing the boundary
                // dim from 100% to ~85% opacity over an 8px band — the
                // effect is barely perceptible on its own; the
                // borderTop/borderBottom on the wrapper provides the
                // crisp visual delimiter.
                maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0px, black 8px, black calc(100% - 8px), rgba(0,0,0,0.85) 100%)',
                WebkitMaskImage:
                  'linear-gradient(to bottom, rgba(0,0,0,0.85) 0px, black 8px, black calc(100% - 8px), rgba(0,0,0,0.85) 100%)'
              }}
            >
              {/*
            Inner content sled — re-pinned to a fixed minWidth so the
            cards keep their full desktop layout on narrow viewports.
            860px is wide enough to fit the 25/75 title-vs-metric-grid
            split with the 5-column metric grid comfortably; the scroll
            container above (overflowX: 'auto') lets the user swipe
            right to read the columns that don't fit on a phone screen.
            On md+ viewports the parent is already wider than 860, so
            the minWidth is inert and the cards stretch to fill the
            available width as before.
          */}
              <Box sx={{ minWidth: 860 }}>
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
                    // Card is clickable iff the container supplied an
                    // onRowClick handler. We attach role + tabIndex + key
                    // activation conditionally so the non-clickable case
                    // (showcase / dev preview without a handler) doesn't
                    // expose a misleading "button" affordance to AT users.
                    //
                    // Enter/Space mirror native button keyboard activation;
                    // preventDefault on Space stops the page from scrolling
                    // when the user activates a card with the spacebar.
                    const isClickable = Boolean(onRowClick);
                    const handleCardClick = isClickable ? () => onRowClick(row) : undefined;
                    const handleCardKeyDown = isClickable
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined;
                    return (
                      <Card
                        // Key on the immutable external_id (not the user-set
                        // label) — labels can collide between two devices and
                        // collisions cause React to incorrectly reconcile/reuse
                        // wrong Card instances on re-render.
                        key={row.externalId}
                        // Conditional interaction attributes — only present
                        // when onRowClick is wired. role="button" + tabIndex=0
                        // make the card focusable and announce as activatable
                        // to screen readers; aria-label uses the human-readable
                        // siteName (not the MAC-style externalId) so the SR
                        // announcement is meaningful.
                        role={isClickable ? 'button' : undefined}
                        tabIndex={isClickable ? 0 : undefined}
                        aria-label={isClickable ? `View measurements for ${row.siteName}` : undefined}
                        onClick={handleCardClick}
                        onKeyDown={handleCardKeyDown}
                        sx={{
                          width: '100%',
                          // No fixed minWidth — the card sizes to its container
                          // (the scroll content area). The previous 840-900px
                          // floor forced horizontal scroll on mobile because
                          // the metric grid was always 5 columns wide. With
                          // the metric grid now collapsing to 2 cols on xs,
                          // 3 on sm, and 5 on md+, the card fits comfortably
                          // at every breakpoint without overflow.
                          backgroundColor: 'rgba(12, 35, 80, 0.359)',
                          p: 2,
                          border: '0.5px solid var(--box-outline-blue)',
                          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
                          boxSizing: 'border-box',
                          textAlign: 'center',
                          opacity: 1,
                          // Only show the pointer cursor when the card is
                          // actually clickable. The previous hover-only
                          // pointer cursor was misleading on the
                          // wireless-sensor fleet page where cards weren't
                          // wired to navigate anywhere yet.
                          cursor: isClickable ? 'pointer' : 'default',
                          transition: 'background-color 120ms ease, border-color 120ms ease',
                          // Keyboard focus ring — matches the green hover
                          // border treatment so focus and hover read as the
                          // same affordance. `outline: none` suppresses the
                          // browser default (which would draw a separate
                          // ring inside the card) in favor of our themed
                          // border treatment.
                          '&:focus-visible': isClickable
                            ? {
                                outline: 'none',
                                borderLeft: '0.5px solid var(--green)',
                                borderRight: '0.5px solid var(--green)',
                                backgroundColor: 'rgba(56, 152, 236, 0.1)'
                              }
                            : undefined,
                          '&:hover': {
                            backgroundColor: 'rgba(56, 152, 236, 0.1)',
                            borderLeft: '0.5px solid var(--green)',
                            borderRight: '0.5px solid var(--green)',
                            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
                            cursor: isClickable ? 'pointer' : 'default'
                          }
                        }}
                      >
                        {/*
                    Card layout responds to viewport width.

                    Mobile (xs / sm) — Grid is single-column:
                      Row 1 (header): siteName on left, [caption / date]
                                      stacked vertically on right.
                      Row 2: 2- or 3-column metric grid (full width).

                    Desktop (md+) — Grid is 3 / 9 split (original):
                      Left column (size 3): siteName on top, caption
                                            below, date below caption
                                            — vertical Stack like before.
                      Right column (size 9): 5-column metric grid.

                    The single piece that changes between breakpoints is
                    the inner header Stack's `direction` — `row` on
                    mobile (so caption/date end up next to siteName) and
                    `column` on desktop (so the original vertical stack
                    is restored inside the narrow 25% left column).

                    `alignItems: 'center'` on the Grid container only
                    matters in the side-by-side desktop case — it
                    vertically centers the left column against the
                    taller metric grid.
                  */}
                        <Grid container spacing={2} sx={{ alignItems: 'center' }}>
                          {/*
                            Fixed 3/9 split at every breakpoint — the
                            outer scroll container handles overflow on
                            mobile so the card never collapses to a
                            single column the way it used to.
                          */}
                          <Grid size={3} sx={{ minWidth: 0 }}>
                            <Stack
                              direction="column"
                              spacing={1.25}
                              sx={{
                                // Stretch children to fill the 25%-wide
                                // left column at every breakpoint, same
                                // as the original desktop behavior.
                                alignItems: 'stretch',
                                minWidth: 0
                              }}
                            >
                              <EditableLabel
                                value={displayedTitle}
                                // Explicit variant — preserves the MUI h4
                                // font-weight + leading the bare Typography
                                // had before this became editable. Without
                                // it, EditableLabel's Typography would fall
                                // back to body1 weight and the label would
                                // read noticeably thinner than the values
                                // beside it.
                                variant="h4"
                                // Lock when MAC is being shown (the immutable
                                // hardware id is read-only by definition) OR
                                // when the parent didn't supply an onRename
                                // (in dev showcase / contexts without a
                                // mutation handler). Either lock condition
                                // makes EditableLabel render as a plain
                                // Typography with no pencil affordance.
                                locked={showMacAddress || !onRename}
                                onSubmit={(newName) =>
                                  setRenameDraft({
                                    externalId: row.externalId,
                                    oldName: row.siteName,
                                    newName
                                  })
                                }
                                ariaLabel={`Rename ${row.siteName}`}
                                containerSx={{
                                  // Layout-affecting props go on the outer
                                  // wrapper so the label participates in the
                                  // parent column flow the same way the bare
                                  // Typography did. No breakpoint-specific
                                  // flex here anymore — the card uses the
                                  // desktop column layout at every viewport,
                                  // with horizontal scroll covering mobile.
                                  minWidth: 0
                                }}
                                typographySx={{
                                  color: 'var(--green)',
                                  fontSize: { xs: '1.1rem', sm: '1.25rem' },
                                  textAlign: 'left'
                                }}
                              />
                              <Stack
                                spacing={0}
                                sx={{
                                  // Caption + date sit under the siteName on
                                  // every breakpoint. The card no longer
                                  // collapses into a row layout on mobile —
                                  // the parent scroll container provides the
                                  // horizontal-scroll affordance instead.
                                  alignItems: 'flex-start',
                                  flexShrink: 0,
                                  minWidth: 0
                                }}
                              >
                                <Typography
                                  variant="subtitle1"
                                  // component="span" opts the field label out of
                                  // being rendered as <h6> (Typography's default
                                  // element for subtitle1). This is a label, not
                                  // a section heading — keeping it as <h6> caused
                                  // Lighthouse's heading-order audit to fail
                                  // because there's no <h1>–<h5> above it.
                                  component="span"
                                  sx={{
                                    color: 'var(--blue)',
                                    fontSize: { xs: '0.78rem', sm: '0.84rem' },
                                    ...truncateLineSx
                                  }}
                                >
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

                          <Grid size={9}>
                            {/*
                        Metric grid stays at 5 columns at every
                        breakpoint. Narrower viewports show the same
                        grid but the parent scroll container clips it
                        and lets the user swipe horizontally to read
                        the columns that don't fit on screen — per
                        product direction "expand the card out instead
                        of smushing it."
                      */}
                            <Box
                              sx={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                                gap: { xs: 1.25, sm: 1.5, lg: 2 },
                                justifyItems: 'stretch'
                              }}
                            >
                              {row.metrics.map((metric) => (
                                <Stack
                                  key={`${row.siteName}-${metric.label}`}
                                  spacing={0.2}
                                  sx={{ alignItems: 'stretch', minWidth: 0, width: '100%' }}
                                >
                                  <Typography
                                    variant="subtitle1"
                                    // Same rationale as the "Last measurements
                                    // taken:" label above — these are metric
                                    // field labels, not section headings, so
                                    // they must not render as <h6>.
                                    component="span"
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
                                      // Spread greenGlowTextSx first (color +
                                      // textShadow), then override the two
                                      // pieces that depend on the metric's
                                      // own color:
                                      //   1. `color` — Health Status and
                                      //      Battery supply their own; all
                                      //      other metrics fall through to
                                      //      the default green.
                                      //   2. `textShadow` — for the purple
                                      //      Offline state, use a reduced-
                                      //      intensity shadow (smaller blur,
                                      //      lower alpha). The default
                                      //      shadow is tuned for the green
                                      //      glow recipe and reads heavy
                                      //      under purple text on the dark
                                      //      surface; softening it keeps
                                      //      "Offline" feeling like a state
                                      //      indicator without competing
                                      //      visually with the bright green
                                      //      Active values around it.
                                      ...greenGlowTextSx,
                                      color: metric.color ?? 'var(--green)',
                                      textShadow: metric.color === 'var(--purple)' ? '0 1px 5px #1a75e060' : greenGlowTextSx.textShadow,
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
                  {visibleRows.length === 0 &&
                    renderEmptyStateCard({ rows, isLoading, error, onRetry, searchValue, emptyMessage, entityLabel })}
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
                Showing {pagedRows.length.toLocaleString()} of {rows.length.toLocaleString()}
              </Typography>
            </Box>
          </Stack>
        </Box>
      </MainCard>
      {/*
      Single mounted ConfirmRenameModal for the whole table — opened
      by setting renameDraft, closed by clearing it. MUI Dialog uses a
      Portal internally so it visually escapes the MainCard chrome and
      sits above the rest of the page content with the backdrop blur.
    */}
      <ConfirmRenameModal
        open={Boolean(renameDraft)}
        entityNoun={entityNounSingular}
        // Immutable hardware id rendered as a read-only badge near the
        // top of the modal so the user can verify which physical unit
        // they're renaming. The label can be the same on two units in
        // a fleet (rare but possible — and in the wireless-sensor case
        // the backend doesn't even reject duplicates yet); the
        // external_id never collides.
        externalId={renameDraft?.externalId}
        oldName={renameDraft?.oldName}
        newName={renameDraft?.newName}
        onConfirm={handleConfirmRename}
        onCancel={() => setRenameDraft(null)}
      />
    </>
  );
}
