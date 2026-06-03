import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

import MainCard from 'components/MainCard';
import ConfirmActionModal from 'components/ConfirmActionModal';
import PhenodeSelector from 'components/PhenodeSelector';
import { useSelection } from 'contexts/SelectionContext';
import useMyDevices from 'hooks/data/useMyDevices';
import useDeviceImages from 'hooks/data/useDeviceImages';
import useImageDetail from 'hooks/data/useImageDetail';
import useAuth from 'hooks/useAuth';
import useDisplayPreferences from 'hooks/useDisplayPreferences';
import { useToast } from 'providers/ToastProvider';
import { deleteDeviceImage } from 'services/mutations';
import API from 'services/endpoints';
import { buildUrl, fetcher } from 'services/fetcher';
import { formatDateWith, formatTimeWith } from 'utils/displayDateTime';

import AntIcon from 'components/AntIcon';
import CloseOutlined from '@ant-design/icons-svg/lib/asn/CloseOutlined';
import DownloadOutlined from '@ant-design/icons-svg/lib/asn/DownloadOutlined';
import InfoCircleOutlined from '@ant-design/icons-svg/lib/asn/InfoCircleOutlined';
import LeftOutlined from '@ant-design/icons-svg/lib/asn/LeftOutlined';
import RightOutlined from '@ant-design/icons-svg/lib/asn/RightOutlined';

import { glassSurfaceSx, reflectedCardChromeSx, neonControlSx, tooltipSlotProps } from 'themes/sx-tokens';

// Default rows-per-page for the imaging table. Mirrored as the
// page_size for the SWR hook so one page of UI === one network request.
// Per product requirement: the imaging page lands on the 10 most-recent
// images.
const IMAGES_PER_PAGE = 10;

// URL search-param name for the externally-selected device, kept in
// lockstep with sections/sensor-measurements/sensor-measurements.jsx
// (DEVICE_PARAM = 'device'). Sharing the convention means a fleet-card
// click that deep-links to /imaging?device=... lands the user on the
// right PheNode without any extra wiring.
const DEVICE_PARAM = 'device';

const datePickerTextFieldSx = {
  flex: 1,
  '& .MuiOutlinedInput-root, & .MuiPickersOutlinedInput-root': {
    ...neonControlSx,
    '& .MuiOutlinedInput-notchedOutline, & .MuiPickersOutlinedInput-notchedOutline': {
      border: 'none'
    },
    '&:hover:not(.Mui-disabled)': {
      borderColor: 'var(--green)'
    },
    '&.Mui-focused': {
      borderColor: 'var(--blue)',
      boxShadow: '0 11px 19px 1px #0000002e'
    }
  },
  '& .MuiInputBase-input': {
    color: 'var(--green) !important',
    WebkitTextFillColor: 'var(--green)',
    '&::placeholder': {
      color: 'var(--green)',
      opacity: 1
    }
  },
  '& .MuiPickersInputBase-root, & .MuiPickersSectionList-root, & .MuiPickersSectionList-sectionContent': {
    color: 'var(--green) !important'
  },
  '& [data-placeholder="true"]': {
    color: 'var(--green) !important',
    opacity: 1
  },
  '& .MuiSvgIcon-root': {
    color: 'var(--blue)'
  }
};

const datePickerPaperSx = {
  backgroundColor: 'rgba(0, 20, 61, 0.94)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
  border: '1px solid var(--reflected-light)',
  boxShadow: '0 11px 19px 1px #0000002e',
  color: 'var(--green)',
  backdropFilter: 'blur(6px)'
};

const datePickerPopperSx = {
  '& .MuiPaper-root': datePickerPaperSx,
  '& .MuiPickersLayout-root': {
    color: 'var(--blue)'
  },
  '& .MuiDayCalendar-weekDayLabel': {
    color: 'var(--blue)',
    fontWeight: 600
  },
  '& .MuiPickersCalendarHeader-label': {
    color: 'var(--blue)',
    fontWeight: 600
  },
  '& .MuiPickersArrowSwitcher-button, & .MuiPickersCalendarHeader-switchViewButton': {
    color: 'var(--blue)'
  },
  '& .MuiDateCalendar-viewTransitionContainer': {
    border: '1px solid var(--box-outline-blue)',
    borderRadius: 1,
    backgroundColor: 'rgba(0, 20, 61, 0.42)'
  },
  '& .MuiPickersDay-root': {
    color: 'var(--green)',
    borderRadius: 1,
    '&:hover': {
      backgroundColor: 'rgba(72, 247, 245, 0.12)'
    }
  },
  '& .MuiPickersDay-today': {
    border: '1px solid var(--reflected-light)'
  },
  '& .MuiPickersDay-root.Mui-selected': {
    backgroundColor: 'rgba(72, 247, 245, 0.2)',
    color: 'var(--green)',
    boxShadow: '0 0 7px -5px var(--green)'
  },
  // Year picker view — appears when the user clicks the calendar
  // header's year switcher chevron in the date picker. The default
  // styling renders year buttons in MUI's primary color (a bright
  // royal blue against the neon-on-navy popper), which reads as
  // foreign chrome. The recipe below recolors them to match the
  // calendar day cells: green text, teal hover, green-tinted
  // selected state, blue+opacity for disabled (out-of-range) years.
  //
  // Class names are MUI X v8-specific. The earlier v6/v7 selectors
  // (`.MuiPickersYear-yearButton`, `.MuiPickersMonth-monthButton`)
  // don't exist in v8 — verified against
  // node_modules/@mui/x-date-pickers/YearCalendar/yearCalendarClasses.js
  // which generates classes under `MuiYearCalendar-*`. The matching
  // month classes live under `MuiMonthCalendar-*`. State suffixes
  // are wired both as the local class (`MuiYearCalendar-selected`,
  // `MuiYearCalendar-disabled`) AND the global `Mui-selected` /
  // `Mui-disabled` — target both so the rule wins regardless of
  // which one MUI applies on a given render.
  '& .MuiYearCalendar-root': {
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(0, 68, 143, 0.6) transparent',
    '&::-webkit-scrollbar': { width: '6px' },
    '&::-webkit-scrollbar-track': { background: 'transparent' },
    '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0, 68, 143, 0.6)', borderRadius: '3px' }
  },
  '& .MuiYearCalendar-button': {
    color: 'var(--green)',
    fontWeight: 500,
    borderRadius: 1,
    transition: 'color 0.18s ease, background-color 0.18s ease',
    '&:hover, &:focus': {
      backgroundColor: 'rgba(72, 247, 245, 0.12)',
      color: 'var(--green)'
    }
  },
  '& .MuiYearCalendar-button.Mui-selected, & .MuiYearCalendar-button.MuiYearCalendar-selected': {
    backgroundColor: 'rgba(72, 247, 245, 0.2)',
    color: 'var(--green)',
    textShadow: '0 0 6px rgba(72, 247, 245, 0.45)',
    fontWeight: 700,
    '&:hover, &:focus': {
      backgroundColor: 'rgba(72, 247, 245, 0.28)'
    }
  },
  '& .MuiYearCalendar-button.Mui-disabled, & .MuiYearCalendar-button.MuiYearCalendar-disabled': {
    color: 'var(--blue)',
    opacity: 0.35
  },
  // Month picker view — parallel recipe with v8's MuiMonthCalendar-*
  // class set. Same vocabulary as the year buttons above so the two
  // views read as one cohesive surface when the user clicks through
  // year → month → day.
  '& .MuiMonthCalendar-button': {
    color: 'var(--green)',
    fontWeight: 500,
    borderRadius: 1,
    transition: 'color 0.18s ease, background-color 0.18s ease',
    '&:hover, &:focus': {
      backgroundColor: 'rgba(72, 247, 245, 0.12)',
      color: 'var(--green)'
    }
  },
  '& .MuiMonthCalendar-button.Mui-selected, & .MuiMonthCalendar-button.MuiMonthCalendar-selected': {
    backgroundColor: 'rgba(72, 247, 245, 0.2)',
    color: 'var(--green)',
    textShadow: '0 0 6px rgba(72, 247, 245, 0.45)',
    fontWeight: 700,
    '&:hover, &:focus': {
      backgroundColor: 'rgba(72, 247, 245, 0.28)'
    }
  },
  '& .MuiMonthCalendar-button.Mui-disabled, & .MuiMonthCalendar-button.MuiMonthCalendar-disabled': {
    color: 'var(--blue)',
    opacity: 0.35
  }
};

const datePickerSlotProps = (placeholder, error = false) => ({
  textField: {
    size: 'small',
    placeholder,
    // `error` paints the field's themed error state when the From/To range is
    // reversed, alongside the inline message below the pickers.
    error,
    sx: datePickerTextFieldSx
  },
  openPickerIcon: {
    sx: {
      color: 'var(--blue)'
    }
  },
  popper: {
    sx: datePickerPopperSx
  },
  desktopPaper: {
    sx: datePickerPaperSx
  },
  mobilePaper: {
    sx: datePickerPaperSx
  }
});

const imagingTableBorder = '1px solid var(--reflected-light)';
const imagingTableHeaderBg = 'rgb(8, 36, 82)';

// Parse a backend image timestamp into a JS Date.
//
// Why this helper exists: the backend stores image timestamps as naive
// UTC datetimes (phenodeX/phenode_backend/db/models.py:210 — column has
// no `timezone=True`, ingestion at notehub/routes.py:_parse_timestamp
// strips tzinfo before storing). Pydantic serializes those naive
// datetimes as ISO strings WITHOUT a `Z` or offset suffix
// (e.g. `"2026-05-21T14:30:00"`). The wire contract is "always UTC,"
// but the string itself doesn't say so.
//
// ISO 8601 says a no-offset string represents local time. So passing
// the raw string to `new Date(...)` or `dayjs(...)` parses it as the
// USER's local time — producing a displayed wall-clock offset by the
// user's UTC offset for every image. (The old code did exactly that.)
//
// Fix: tag the string with `Z` before parsing so the Date object
// represents the correct instant. Strings that already carry an
// offset (`Z`, `+05:30`, `-04:00`) pass through unchanged.
const parseBackendTimestamp = (raw) => {
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'string') {
    const d = new Date(raw);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const hasOffset = /Z$|[+-]\d{2}:?\d{2}$/.test(raw);
  const iso = hasOffset ? raw : `${raw}Z`;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
};

// Two-digit numeric date in the user's timezone (matches the legacy
// `dayjs.format('MM/DD/YYYY')` shape: "05/21/2026"). The Intl options
// produce a localized order, but for `en-US` (the project's locale
// default) that's M/D/YYYY which renders identically to the dayjs
// pattern.
const IMAGING_DATE_FORMAT = { year: 'numeric', month: '2-digit', day: '2-digit' };

// Two-digit 12-hour time in the user's timezone (matches the legacy
// `dayjs.format('hh:mm A')` shape: "02:30 PM").
const IMAGING_TIME_FORMAT = { hour: '2-digit', minute: '2-digit', hour12: true };

// Normalize a single ImageRead row from the API into the view-shape
// the carousel / table / details panel expect. Centralized so the
// table cells, the carousel slide, and the details panel all read
// from the same canonical fields and a backend rename (e.g. `s3_url`
// → `image_url`) only needs to be patched once.
//
// Takes a `timezone` argument (the user's saved preference from
// Account Settings → Display, or null for browser-local) so every
// rendered date/time on this page honors the same setting every other
// page does. See `utils/displayDateTime.js` for the central helpers.
//
// Backend reference: phenodeX/phenode_backend/schemas/images.py:9-20
const normalizeImage = (img, timezone) => {
  const date = parseBackendTimestamp(img?.timestamp);
  return {
    // String id so it composes cleanly with array-based selection state
    // (selectedRows is string[]). The backend returns numeric ids; we
    // coerce here so all downstream code can treat them uniformly.
    id: img?.id != null ? String(img.id) : null,
    rawId: img?.id,
    name: img?.filename || (img?.id != null ? `image-${img.id}.jpg` : 'image.jpg'),
    src: img?.s3_url || null,
    hasData: Boolean(img?.has_data),
    // Milliseconds since epoch (true UTC instant). The date-picker
    // prefill effect uses this via dayjs() — dayjs accepts a number
    // millis with no ambiguity, so we don't re-introduce the
    // local-vs-UTC parsing issue downstream.
    timestamp: date ? date.getTime() : null,
    date: date ? formatDateWith(date, IMAGING_DATE_FORMAT, timezone) : '—',
    time: date ? formatTimeWith(date, IMAGING_TIME_FORMAT, timezone) : '—'
  };
};

export default function Imaging() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  // fromDate / toDate are BOTH the visible date-picker values AND the
  // filter arguments sent to the API. Starting as null is load-bearing:
  // the SWR hook drops null params from the query string, so the first
  // fetch is the unconstrained "give me the 10 most recent" request the
  // product requirement asks for. After that response lands, a one-shot
  // effect (see prefillTimespanRef below) seeds these from the response
  // so the pickers show the timespan they currently represent — user can
  // edit either side to narrow the range.
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [page, setPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadedCount, setDownloadedCount] = useState(0);
  const rowsPerPage = IMAGES_PER_PAGE;

  // -----------------------------------------------------------------
  // Device selection — shared, session-scoped (see SelectionContext).
  //
  // The recency default + per-page freeze that used to live here moved
  // up to SelectionContext so the Imaging page shares ONE selection with
  // every other device page: a PheNode picked on Sensor Measurements,
  // Wireless Sensors, or System Diagnostics shows up here too, and a pick
  // made here carries back to them. It only resets on logout.
  //
  // The URL `?device=` stays as a deep-link entry point + shareable
  // mirror. A valid `?device=` is treated as an explicit pick and pushed
  // into the shared selection (the bridge effect below); the dropdown
  // change handler writes both the shared selection and the URL.
  // -----------------------------------------------------------------
  const { devices, isLoading: devicesLoading } = useMyDevices();
  const deviceFromUrl = searchParams.get(DEVICE_PARAM);
  const { selectedPheNodeId, selectPheNode } = useSelection() ?? {};

  // Deep-link bridge — a valid `?device=` becomes the explicit shared
  // selection. selectPheNode no-ops on an unchanged id, so re-running on
  // every render is cheap.
  useEffect(() => {
    if (!devices || !deviceFromUrl) return;
    const exists = devices.some((d) => d.external_device_id === deviceFromUrl);
    if (exists) selectPheNode?.(deviceFromUrl);
  }, [devices, deviceFromUrl, selectPheNode]);

  // What the page actually renders — simply the shared selection.
  const externalDeviceId = selectedPheNodeId ?? null;

  // If the URL referenced a device that no longer exists in the fleet,
  // clean the param out so back/forward + reload don't keep pointing at
  // a phantom selection. Guarded against the loading window where
  // `devices` is still undefined.
  useEffect(() => {
    if (!devices) return;
    if (!deviceFromUrl) return;
    const exists = devices.some((d) => d.external_device_id === deviceFromUrl);
    if (!exists) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete(DEVICE_PARAM);
          return next;
        },
        { replace: true }
      );
    }
  }, [devices, deviceFromUrl, setSearchParams]);

  // PheNodeSelector change → write to the URL. URL is the source of
  // truth — the next render reads the new value back out of
  // searchParams. replace:false (default) so the dropdown action
  // creates a real history entry (Back button takes the user to their
  // previous PheNode).
  const handlePhenodeChange = useCallback(
    (nextDeviceId) => {
      // Record the explicit pick in the shared selection first so it sticks
      // app-wide, then mirror it to the URL for shareability + back-button.
      selectPheNode?.(nextDeviceId ?? null);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (nextDeviceId) {
          next.set(DEVICE_PARAM, nextDeviceId);
        } else {
          next.delete(DEVICE_PARAM);
        }
        return next;
      });
    },
    [setSearchParams, selectPheNode]
  );

  // Active DeviceRead for the resolved id — used by the description
  // panel below to display the human label ("Greenhouse 3") rather
  // than the raw external id ("D3:1F:20:E1:49:B7"). Null while devices
  // are still loading; the panel falls back to the external id in
  // that case so the row never reads as blank.
  const activeDevice = useMemo(() => {
    if (!devices || !externalDeviceId) return null;
    return devices.find((d) => d.external_device_id === externalDeviceId) ?? null;
  }, [devices, externalDeviceId]);

  // -----------------------------------------------------------------
  // Device-switch reset. When the user picks a different PheNode in
  // the dropdown (or the deep-link param changes), the previous
  // device's filter state would otherwise carry over — most visibly:
  // the prefilled from/to dates would still constrain the new device's
  // query, hiding most of its images for no obvious reason. Reset
  // from/to to null (so the next fetch is the unconstrained "10 most
  // recent" request), page to 1, and clear cross-page selection.
  //
  // Skipping the very first transition (previousDeviceIdRef.current ===
  // null) avoids clobbering state on initial mount before any image
  // has loaded.
  // -----------------------------------------------------------------
  const previousDeviceIdRef = useRef(null);
  useEffect(() => {
    if (previousDeviceIdRef.current && previousDeviceIdRef.current !== externalDeviceId) {
      setFromDate(null);
      setToDate(null);
      setPage(1);
      setSelectedRows([]);
    }
    previousDeviceIdRef.current = externalDeviceId;
  }, [externalDeviceId]);

  // -----------------------------------------------------------------
  // ISO strings for the API. Use startOf('day') / endOf('day') so the
  // calendar-day the user picked is fully inclusive — picking "May 21"
  // as `to` should include any image captured before midnight on May 21,
  // not just the start of that day.
  // -----------------------------------------------------------------
  const fromIso = useMemo(() => (fromDate ? dayjs(fromDate).startOf('day').toISOString() : null), [fromDate]);
  const toIso = useMemo(() => (toDate ? dayjs(toDate).endOf('day').toISOString() : null), [toDate]);

  // Both dates picked but reversed (From later than To) — surfaced as an inline
  // error below the pickers so the empty result reads as "fix your range",
  // not "no images."
  const datesReversed = useMemo(
    () =>
      fromDate != null &&
      toDate != null &&
      dayjs(fromDate).isValid() &&
      dayjs(toDate).isValid() &&
      dayjs(fromDate).isAfter(dayjs(toDate)),
    [fromDate, toDate]
  );

  const {
    images: apiImages,
    total: apiTotal,
    isLoading: imagesLoading,
    error: imagesError,
    mutate: mutateImages
  } = useDeviceImages(externalDeviceId, {
    page,
    pageSize: rowsPerPage,
    from: fromIso,
    to: toIso
  });

  // Access token — used by the per-image detail fetches that power
  // download() and by deleteDeviceImage() below. fetcher accepts a
  // [url, token] tuple and attaches the Bearer header.
  const { accessToken } = useAuth();

  // Themed toast surface for success / error feedback. Replaces the
  // browser-native window.alert() we used during the initial wire-up;
  // the toast lives at the app root and matches the project's neon-on-
  // navy chrome (see providers/ToastProvider.jsx).
  const toast = useToast();

  // User's saved Display Timezone preference (Account Settings →
  // Display → Display Timezone). `null` here means "Use device
  // timezone" — the formatters in displayDateTime.js handle that as a
  // fallback to the browser's resolved zone. Every visible timestamp
  // on this page (carousel filename overlay, table rows, View dialog
  // header, "Last Image Captured" header, description-card Date row)
  // flows through `normalizeImage(img, timezone)` below so changing
  // the Account Settings value moves every clock on this page in
  // lockstep with the rest of the app.
  const { timezone } = useDisplayPreferences();

  // The API returns images sorted newest-first
  // (phenodeX/phenode_backend/api/devices/routes.py:619 — order_by
  // timestamp.desc()). We preserve that ordering for the table and the
  // carousel so the "latest capture" affordance is always slide 0.
  const normalizedImages = useMemo(
    () => (apiImages ?? []).map((img) => normalizeImage(img, timezone)).filter((img) => img.id != null),
    [apiImages, timezone]
  );

  // -----------------------------------------------------------------
  // One-shot effect: when the first batch of images lands AND the user
  // hasn't touched the date pickers, seed the pickers with the timespan
  // of the returned page (newest → toDate, oldest → fromDate). This
  // matches the product requirement: the pickers display the active
  // range and are editable.
  //
  // Tracked with a ref so we don't re-prefill after a user clears a
  // picker back to null (which would otherwise re-trigger this branch
  // every poll). The ref is reset if the user navigates to a different
  // device — otherwise the second device would inherit the first
  // device's prefill state and never show its own timespan.
  // -----------------------------------------------------------------
  const prefilledForDeviceRef = useRef(null);
  useEffect(() => {
    if (prefilledForDeviceRef.current === externalDeviceId) return;
    if (!normalizedImages.length) return;
    // Only prefill while both pickers are still untouched (null). If
    // the user has already picked a from/to we never want to clobber
    // their choice.
    if (fromDate !== null || toDate !== null) {
      prefilledForDeviceRef.current = externalDeviceId;
      return;
    }
    const timestamps = normalizedImages.map((img) => img.timestamp).filter((ts) => Number.isFinite(ts));
    if (!timestamps.length) return;
    const newest = Math.max(...timestamps);
    const oldest = Math.min(...timestamps);
    setFromDate(dayjs(oldest));
    setToDate(dayjs(newest));
    prefilledForDeviceRef.current = externalDeviceId;
  }, [externalDeviceId, normalizedImages, fromDate, toDate]);

  // -----------------------------------------------------------------
  // Carousel: current image + nav. Bound to the rows currently on
  // screen so flipping pages doesn't desync the carousel from the
  // table the user is reading.
  // -----------------------------------------------------------------
  const safeCarouselIndex = normalizedImages.length === 0 ? 0 : Math.min(currentImageIndex, normalizedImages.length - 1);
  const currentImage = normalizedImages[safeCarouselIndex] ?? null;
  const lastCapturedImage = normalizedImages[0] ?? null; // newest-first ordering

  // -----------------------------------------------------------------
  // Carousel preview source. The /images list endpoint only ships
  // metadata (no base64), so when a row has no `s3_url` (the dev /
  // seed-demo path where images are stored as base64 in Postgres) the
  // <img> would render blank. useImageDetail lazy-fetches the single
  // active image's full record and exposes a ready-to-use `src` —
  // either the s3_url verbatim, or a `data:image/jpeg;base64,...`
  // wrapping the encoded payload.
  //
  // `enabled` short-circuits the fetch when the list row already has
  // an s3_url — no point hitting the detail endpoint just to confirm
  // what we already know.
  // -----------------------------------------------------------------
  const carouselNeedsDetail = Boolean(currentImage && !currentImage.src);
  const { src: carouselDetailSrc, isLoading: carouselDetailLoading } = useImageDetail(externalDeviceId, currentImage?.rawId, {
    enabled: carouselNeedsDetail
  });
  const carouselDisplaySrc = currentImage?.src || carouselDetailSrc || null;

  // -----------------------------------------------------------------
  // View dialog — opened from the row's "View" button. Holds the
  // metadata row we want to show. Source resolution mirrors the
  // carousel: prefer s3_url, fall back to lazy-fetched base64.
  // -----------------------------------------------------------------
  const [viewingImage, setViewingImage] = useState(null);
  const viewDialogNeedsDetail = Boolean(viewingImage && !viewingImage.src);
  const { src: viewDetailSrc, isLoading: viewDetailLoading } = useImageDetail(externalDeviceId, viewingImage?.rawId, {
    enabled: viewDialogNeedsDetail
  });
  const viewDialogSrc = viewingImage?.src || viewDetailSrc || null;

  // Page rows ARE the API page — server-side pagination handles the
  // slicing. Selection-set math is therefore scoped to "the rows
  // currently visible" rather than "the full filtered set" (which the
  // backend never sends in one payload). Practically the user can
  // still select-all the visible page and then page forward to select
  // more; cross-page selection persists in `selectedRows`.
  const pageRows = normalizedImages;
  const pageRowIds = useMemo(() => pageRows.map((row) => row.id), [pageRows]);
  const selectedOnPageCount = useMemo(() => pageRows.filter((row) => selectedRows.includes(row.id)).length, [pageRows, selectedRows]);
  const allSelected = pageRows.length > 0 && selectedOnPageCount === pageRows.length;
  const someSelected = selectedOnPageCount > 0 && !allSelected;
  const pageCount = Math.max(1, Math.ceil((apiTotal ?? 0) / rowsPerPage));
  const totalImagesToDownload = selectedRows.length;
  const estimatedDownloadSizeMb = (totalImagesToDownload * 4.2).toFixed(1);
  const downloadProgress = totalImagesToDownload > 0 ? (downloadedCount / totalImagesToDownload) * 100 : 0;

  const handlePreviousImage = () => {
    if (normalizedImages.length === 0) return;
    setCurrentImageIndex((prev) => (prev === 0 ? normalizedImages.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    if (normalizedImages.length === 0) return;
    setCurrentImageIndex((prev) => (prev === normalizedImages.length - 1 ? 0 : prev + 1));
  };

  // Reset the carousel pointer when the underlying page of images
  // changes — otherwise paging forward leaves the carousel pointing
  // at index 7 on a fresh page of 10 with no obvious cue.
  useEffect(() => {
    setCurrentImageIndex(0);
  }, [page, externalDeviceId, fromIso, toIso]);

  const handleToggleRow = (rowId) => {
    setSelectedRows((prev) => (prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]));
  };

  const handleToggleAllRows = () => {
    setSelectedRows((prev) => {
      if (allSelected) {
        return prev.filter((id) => !pageRowIds.includes(id));
      }
      return [...new Set([...prev, ...pageRowIds])];
    });
  };

  // -----------------------------------------------------------------
  // View action — open the larger preview in a Dialog. We hand the
  // normalized row to setViewingImage; the Dialog reads src / name /
  // date / time off it and the useImageDetail hook above lazy-fetches
  // the bytes if s3_url is missing.
  // -----------------------------------------------------------------
  const handleView = useCallback((row) => {
    setViewingImage(row);
  }, []);

  // -----------------------------------------------------------------
  // Delete action. Backend expects a filename (not numeric id) on the
  // DELETE path and gates the route on require_role('ADMIN'). We
  // confirm via window.confirm — adequate for a destructive action
  // until the project has a dedicated themed confirm dialog.
  //
  // On success: refetch the list (mutateImages) and prune the row's
  // id from any cross-page selection state. On failure: log and let
  // the SWR cache continue serving the (still-present) row, which
  // matches the user's mental model — "delete didn't take, image
  // still here."
  // -----------------------------------------------------------------
  // Two-phase delete:
  //   1. `handleDelete(row)` opens the themed ConfirmActionModal by
  //      setting `pendingDeleteRow`. Nothing hits the network until
  //      the user clicks Continue.
  //   2. `runDelete()` is invoked by the modal's onConfirm. It calls
  //      the API, surfaces success/error via the themed toast, and
  //      mutates the SWR cache on success.
  //
  // `deletingRowIds` is still tracked so the table row's Delete
  // button can show "Deleting…" while the network call is in
  // flight — covering the case where the user closes the modal and
  // watches the table directly.
  const [deletingRowIds, setDeletingRowIds] = useState([]);
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);

  const handleDelete = useCallback((row) => {
    if (!row?.name) return;
    setPendingDeleteRow(row);
  }, []);

  const runDelete = useCallback(async () => {
    if (!externalDeviceId || !pendingDeleteRow?.name) return;
    const row = pendingDeleteRow;
    setDeletingRowIds((prev) => [...prev, row.id]);
    try {
      await deleteDeviceImage(externalDeviceId, row.name, accessToken);
      setSelectedRows((prev) => prev.filter((id) => id !== row.id));
      if (viewingImage?.id === row.id) setViewingImage(null);
      await mutateImages();
      toast.success(`Deleted ${row.name}.`);
      setPendingDeleteRow(null);
    } catch (err) {
      // Friendlier copy for the most common failure (403 — backend
      // gates this route on require_role('ADMIN')). Everything else
      // falls through to the backend's `detail`, then the JS message,
      // then a generic fallback.
      const message =
        err?.status === 403
          ? "You don't have permission to delete this image."
          : `Could not delete ${row.name}: ${err?.detail || err?.message || 'unknown error'}`;
      toast.error(message);
      // Keep the modal OPEN on failure so the user can read the
      // toast then retry or cancel. Mirrors the ConfirmRenameModal
      // contract used elsewhere in the app.
    } finally {
      setDeletingRowIds((prev) => prev.filter((id) => id !== row.id));
    }
  }, [externalDeviceId, accessToken, mutateImages, viewingImage, pendingDeleteRow, toast]);

  // -----------------------------------------------------------------
  // Download action — fetches the bytes for each selected image and
  // triggers a browser download via a Blob URL. Two source paths:
  //
  //   1. Row has `s3_url` → fetch the URL directly, blob the response.
  //      This is the prod path; the browser caches the bytes and the
  //      file lands at full fidelity.
  //   2. Row has no `s3_url` → hit the detail endpoint
  //      (/devices/{ext}/images/{id}) for base64encoded, decode into
  //      a Uint8Array, wrap in a Blob. This is the dev / seed-demo
  //      path.
  //
  // Sequential rather than parallel so the progress bar stays honest
  // and we don't fire 50 concurrent fetches at the backend on a
  // bulk-selection download. If throughput becomes a problem we can
  // bump the concurrency to ~3 — but for the typical "download what
  // I just selected" case, serial is fine.
  //
  // Errors per-row are swallowed so a single bad row doesn't abort
  // the whole batch — the surrounding finally clears `isDownloading`
  // regardless.
  // -----------------------------------------------------------------
  const downloadOne = useCallback(
    async (row) => {
      let blob;
      if (row.src) {
        const response = await fetch(row.src);
        if (!response.ok) throw new Error(`Failed to fetch ${row.src}: ${response.status}`);
        blob = await response.blob();
      } else {
        // Hit detail endpoint for base64. Going through `fetcher` so
        // we get the same auto-401-refresh-and-retry behavior the SWR
        // hooks have.
        const detailUrl = buildUrl(API.devices.imageDetail(externalDeviceId, row.rawId));
        const detail = await fetcher([detailUrl, accessToken]);
        if (!detail?.base64encoded) {
          throw new Error('No image data available');
        }
        // atob → byte string → Uint8Array. We can't pass the raw
        // base64 to a Blob directly; the wrapper has to be binary.
        const byteString = atob(detail.base64encoded);
        const u8 = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i += 1) u8[i] = byteString.charCodeAt(i);
        blob = new Blob([u8], { type: 'image/jpeg' });
      }
      // Standard "anchor with download attribute" idiom — works in all
      // modern browsers without an extra library. Clean up the
      // object URL right after click() so we don't leak memory on
      // bulk downloads.
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = row.name || `image-${row.id}.jpg`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
    },
    [externalDeviceId, accessToken]
  );

  const handleDownload = useCallback(async () => {
    if (!totalImagesToDownload || !externalDeviceId) return;
    // Only download rows from the CURRENT page that the user has
    // selected — selectedRows can carry ids from prior pages we've
    // navigated past but no longer have row metadata for. Downloading
    // those would require re-fetching their metadata, which is more
    // moving parts than this iteration warrants. Future enhancement:
    // remember row metadata across pages.
    const toDownload = pageRows.filter((row) => selectedRows.includes(row.id));
    if (toDownload.length === 0) return;

    setDownloadedCount(0);
    setIsDownloading(true);
    let successCount = 0;
    let failureCount = 0;
    try {
      for (const row of toDownload) {
        try {
          await downloadOne(row);
          successCount += 1;
          setDownloadedCount((prev) => prev + 1);
        } catch (err) {
          failureCount += 1;
          // Per-row failures don't abort the batch — we just count
          // them and surface a single summary toast at the end.
          console.error('Failed to download image', row?.id, err);
        }
      }
    } finally {
      setIsDownloading(false);
      // One summarizing toast at the end rather than one-per-row,
      // which would feel spammy on a 10-image batch.
      if (failureCount === 0) {
        toast.success(`Downloaded ${successCount} image${successCount === 1 ? '' : 's'}.`);
      } else if (successCount === 0) {
        toast.error(`Download failed for all ${failureCount} image${failureCount === 1 ? '' : 's'}.`);
      } else {
        toast.error(`Downloaded ${successCount} of ${toDownload.length} — ${failureCount} failed.`);
      }
    }
  }, [totalImagesToDownload, externalDeviceId, pageRows, selectedRows, downloadOne, toast]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  // Top-level loading / empty states. Showing distinct copy for each
  // case matters: "loading" implies a spinner is doing work, "no
  // device" implies the account hasn't been linked yet, "no images"
  // implies the device exists but hasn't captured anything in range.
  const showingFullPageSpinner = (devicesLoading || imagesLoading) && normalizedImages.length === 0;
  const hasNoDevice = !devicesLoading && !externalDeviceId;
  const hasNoImages = !showingFullPageSpinner && !hasNoDevice && normalizedImages.length === 0;

  return (
    <MainCard
      content={false}
      sx={{
        // width: '100%' is load-bearing — the dashboard layout sets
        // `display: flex` on the container that holds this MainCard
        // but doesn't force the card to grow, so by default the card
        // sizes to its CONTENT width (default flex: 0 1 auto). That
        // meant when the carousel showed a 40px spinner during
        // image-load, the card collapsed inward to fit, then snapped
        // back to full width once the wide image appeared — visibly
        // "shrinking from the right then returning." Locking the
        // card to 100% of its parent's width pins it regardless of
        // what's inside.
        width: '100%',
        overflow: 'hidden',
        ...glassSurfaceSx,
        ...reflectedCardChromeSx
      }}
    >
      <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 2.5 } }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
          sx={{
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            width: '100%',
            borderBottom: '1px solid',
            borderBottomColor: 'var(--orange)',
            pb: 1.25
          }}
        >
          <Typography variant="h4" sx={{ color: 'var(--blue)' }}>
            Imaging
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{
              textAlign: { xs: 'left', md: 'right' },
              width: { xs: '100%', md: 'auto' },
              display: { xs: 'flex', md: 'block' },
              alignItems: { xs: 'center', md: 'unset' }
            }}
          >
            <Box component="span" sx={{ color: 'var(--blue)' }}>
              Last Image Captured:
            </Box>
            <Box component="span" sx={{ color: 'var(--green)', ml: { xs: 'auto', md: 1.5 }, display: 'inline-block', textAlign: 'right' }}>
              {lastCapturedImage ? `${lastCapturedImage.date}, ${lastCapturedImage.time}` : 'N/A'}
            </Box>
          </Typography>
        </Stack>
      </Box>

      {/*
        PheNode picker row — drives every downstream data fetch on this
        page (carousel images, table rows, total count, last-captured
        timestamp). Lives in its own Box with the same px/pt/pb spacing
        sensor-measurements.jsx uses, so the dropdown sits at the same
        vertical distance below the title divider on both pages.

        PhenodeSelector is the shared themed Autocomplete — passing
        `label={null}` suppresses the inline label since the page
        title above already provides the context.
      */}
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 0, pb: { xs: 1.5, sm: 2 } }}>
        <Stack
          direction="row"
          sx={{
            justifyContent: 'flex-start',
            alignItems: 'center',
            mb: { xs: 1.5, sm: 2 },
            gap: 1
          }}
        >
          <PhenodeSelector
            devices={devices}
            selectedDeviceId={externalDeviceId}
            onChange={handlePhenodeChange}
            isLoading={devicesLoading}
            label={null}
          />
        </Stack>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 3 }, pt: 0 }}>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, lg: 12 }}>
            <Card
              sx={{
                position: 'relative',
                // Explicit width: 100% so the Card's width is
                // determined by the parent (Grid item / dashboard
                // main column) and never by its content. Without
                // this, when the carousel switches between a 40px
                // spinner and a 1280px-natural-width <img>, the flex
                // layout above can re-resolve the Card's flex-basis
                // and briefly compute a narrower box — which read as
                // the "shrinks from the right then snaps back" the
                // user saw in the screenshots.
                width: '100%',
                // Back to the original minHeight floor — the inner
                // image-container Box now carries an EXPLICIT height
                // (see below) so Card size is dictated by Box, not by
                // its inner content. That keeps the loaded-state size
                // (what users were used to) as the steady state, and
                // the loading state matches it because Box's height
                // is fixed regardless of whether a spinner or image
                // is centered inside.
                minHeight: { xs: 380, sm: 480, lg: 560 },
                overflow: 'hidden',
                backgroundColor: 'var(--drf)',
                backgroundImage: 'none',
                ...reflectedCardChromeSx
              }}
            >
              <IconButton
                aria-label="previous image"
                onClick={handlePreviousImage}
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: 16,
                  transform: 'translateY(-50%)',
                  zIndex: 2,
                  color: 'var(--green)',
                  backgroundColor: 'rgba(0, 20, 61, 0.72)',
                  border: '1px solid var(--reflected-light)',
                  boxShadow: '0 11px 19px 1px #0000002e',
                  '&:hover': {
                    backgroundColor: 'rgba(72, 247, 245, 0.08)'
                  }
                }}
              >
                <AntIcon icon={LeftOutlined} />
              </IconButton>

              <IconButton
                aria-label="next image"
                onClick={handleNextImage}
                sx={{
                  position: 'absolute',
                  top: '50%',
                  right: 16,
                  transform: 'translateY(-50%)',
                  zIndex: 2,
                  color: 'var(--green)',
                  backgroundColor: 'rgba(0, 20, 61, 0.72)',
                  border: '1px solid var(--reflected-light)',
                  boxShadow: '0 11px 19px 1px #0000002e',
                  '&:hover': {
                    backgroundColor: 'rgba(72, 247, 245, 0.08)'
                  }
                }}
              >
                <AntIcon icon={RightOutlined} />
              </IconButton>

              {/*
                Image container with an EXPLICIT height (vs the
                previous height:100%) so the slot reserved for the
                preview is the same size whether a CircularProgress
                or a fully-loaded <img> is centered inside it. The
                values below are image maxHeight + the Box's own
                vertical padding, computed for each breakpoint:
                  xs:  320 (img) + 112 (24 pt + 88 pb) = 432
                  sm:  430 (img) + 124 (28 pt + 96 pb) = 554
                  lg:  650 (img) + 124                  = 774
                Box-sizing is border-box, so `height` already includes
                the padding — image content area lands at exactly the
                image's maxHeight.

                Card's minHeight is the floor; this Box's explicit
                height pushes Card up to the loaded-state size at
                every breakpoint, so the Card has the SAME total size
                whether the image is in flight or already painted.
                The spinner just centers inside the otherwise-empty
                slot rather than collapsing the Box around itself.
              */}
              <Box
                sx={{
                  position: 'relative',
                  zIndex: 1,
                  width: '100%',
                  height: { xs: 432, sm: 554, lg: 774 },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  px: { xs: 6, sm: 7 },
                  pt: { xs: 3, sm: 3.5 },
                  pb: { xs: 11, sm: 12 }
                }}
              >
                {showingFullPageSpinner || (carouselNeedsDetail && carouselDetailLoading) ? (
                  <CircularProgress sx={{ color: 'var(--green)' }} />
                ) : currentImage && carouselDisplaySrc ? (
                  <Box
                    component="img"
                    src={carouselDisplaySrc}
                    alt={currentImage.name}
                    // `decoding=async` lets the browser decode the image
                    // off the main thread instead of blocking the layout
                    // pass. Without it, the synchronous decode frame can
                    // be just long enough to register as a one-frame
                    // layout reflow.
                    decoding="async"
                    sx={{
                      width: 'auto',
                      height: 'auto',
                      maxWidth: '100%',
                      maxHeight: { xs: 320, sm: 430, lg: 650 },
                      objectFit: 'contain',
                      border: '1px solid var(--reflected-light)',
                      borderRadius: 1,
                      filter: 'drop-shadow(0 12px 24px rgba(0, 0, 0, 0.35))'
                    }}
                  />
                ) : (
                  // Placeholder copy. Reaches this branch when:
                  //   - no device on the account, OR
                  //   - no images in the selected range, OR
                  //   - detail endpoint returned no usable src
                  //     (genuinely-orphaned row).
                  <Typography variant="body2" sx={{ color: 'var(--blue)', textAlign: 'center' }}>
                    {hasNoDevice
                      ? 'No PheNode found on this account yet.'
                      : hasNoImages
                        ? 'No images have been captured for the selected range.'
                        : 'Preview unavailable for this image.'}
                  </Typography>
                )}
              </Box>

              {currentImage && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: { xs: 16, sm: 20 },
                    bottom: { xs: 16, sm: 18 },
                    zIndex: 2
                  }}
                >
                  <Typography variant="subtitle1" sx={{ color: 'var(--green)', fontWeight: 600 }}>
                    {currentImage.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'var(--blue)' }}>
                    {currentImage.date} | {currentImage.time}
                  </Typography>
                </Box>
              )}

              <Stack
                direction="row"
                spacing={0.75}
                sx={{
                  position: 'absolute',
                  left: '50%',
                  bottom: 16,
                  transform: 'translateX(-50%)',
                  zIndex: 2
                }}
              >
                {normalizedImages.map((image, index) => (
                  <Tooltip key={image.id} title={image.name} arrow={false} slotProps={tooltipSlotProps}>
                    <Box
                      component="button"
                      type="button"
                      onClick={() => setCurrentImageIndex(index)}
                      sx={{
                        width: index === safeCarouselIndex ? 28 : 10,
                        height: 10,
                        borderRadius: 999,
                        border: '1px solid var(--reflected-light)',
                        backgroundColor: index === safeCarouselIndex ? 'var(--green)' : 'rgba(72, 247, 245, 0.18)',
                        boxShadow: index === safeCarouselIndex ? '0 0 8px var(--green)' : 'none',
                        p: 0,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    />
                  </Tooltip>
                ))}
              </Stack>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 12 }} sx={{ order: { xs: 3, lg: 3 } }}>
            <Card sx={{ p: { xs: 1.5, sm: 2 }, height: 'fit-content', ...glassSurfaceSx, ...reflectedCardChromeSx }}>
              <Stack spacing={1}>
                <Typography variant="subtitle1" sx={{ color: '#646cff', fontWeight: 600 }}>
                  Description:
                </Typography>

                <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 1.25 }}>
                  <Typography variant="h6" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    Total Images:
                  </Typography>
                  <Typography variant="h6" sx={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>
                    {apiTotal ?? 0}
                  </Typography>

                  <Typography variant="h6" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    PheNode Taken From:
                  </Typography>
                  <Typography variant="h6" sx={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>
                    {activeDevice?.label || externalDeviceId || '—'}
                  </Typography>

                  <Typography variant="h6" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    Date:
                  </Typography>
                  <Typography variant="h6" sx={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>
                    {currentImage?.date ?? '—'}
                  </Typography>

                  <Typography variant="h6" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    Images To Download:
                  </Typography>
                  <Typography variant="h6" sx={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>
                    {totalImagesToDownload}
                  </Typography>
                </Box>

                {/* <Box
                  sx={{
                    mt: 2,
                    mx: 0.5,
                    borderTop: '1px solid var(--box-outline-blue)'
                  }}
                /> */}
                <Box sx={{ pt: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={downloadProgress}
                    sx={{
                      height: 8,
                      borderRadius: 999,
                      backgroundColor: 'rgba(0, 20, 61, 0.45)',
                      border: '1px solid var(--reflected-light)',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: 'var(--green)',
                        boxShadow: '0 0 8px rgba(72, 247, 245, 0.65)'
                      }
                    }}
                  />
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mt: 0.75 }}>
                    <Typography variant="caption" sx={{ color: 'var(--blue)' }}>
                      {totalImagesToDownload === 0
                        ? 'Select image rows to enable download.'
                        : `Downloaded ${downloadedCount}/${totalImagesToDownload} image${totalImagesToDownload === 1 ? '' : 's'}`}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--green)', fontWeight: 600 }}>
                      {totalImagesToDownload === 0 ? '-- MB' : `${estimatedDownloadSizeMb} MB`}
                    </Typography>
                  </Stack>
                </Box>

                <Box sx={{ pt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    startIcon={<AntIcon icon={DownloadOutlined} />}
                    onClick={handleDownload}
                    disabled={isDownloading || totalImagesToDownload === 0}
                    sx={{
                      borderColor: 'var(--orange)',
                      color: 'var(--green)',
                      backgroundColor: 'rgba(0, 20, 61, 0.72)',
                      boxShadow: '0 11px 19px 1px #0000002e',
                      '&.Mui-disabled': {
                        color: 'var(--med-grey)',
                        borderColor: 'var(--med-grey)',
                        backgroundColor: 'rgba(0, 20, 61, 0.4)'
                      },
                      '&.Mui-disabled:hover': {
                        backgroundColor: 'rgba(0, 20, 61, 0.4)'
                      },
                      '&:hover': {
                        borderColor: 'var(--green)',
                        boxShadow: '0 0 7px -5px var(--green)',
                        color: 'var(--green)',
                        textShadow: '0 1px 5px #007bff',
                        backgroundColor: 'rgba(72, 247, 245, 0.08)'
                      }
                    }}
                  >
                    {isDownloading ? 'Downloading...' : 'Download'}
                  </Button>
                </Box>

                {/* <Box sx={{ pt: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={downloadProgress}
                    sx={{
                      height: 8,
                      borderRadius: 999,
                      backgroundColor: 'rgba(0, 20, 61, 0.45)',
                      border: '1px solid var(--reflected-light)',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: 'var(--green)',
                        boxShadow: '0 0 8px rgba(72, 247, 245, 0.65)'
                      }
                    }}
                  />
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mt: 0.75 }}>
                    <Typography variant="caption" sx={{ color: 'var(--blue)' }}>
                      {totalImagesToDownload === 0
                        ? 'Select image rows to enable download.'
                        : `Downloaded ${downloadedCount}/${totalImagesToDownload} image${totalImagesToDownload === 1 ? '' : 's'}`}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--green)', fontWeight: 600 }}>
                      {totalImagesToDownload === 0 ? '-- MB' : `${estimatedDownloadSizeMb} MB`}
                    </Typography>
                  </Stack>
                </Box> */}
              </Stack>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 12 }} sx={{ order: { xs: 2, lg: 2 } }}>
            <Card sx={{ p: { xs: 1.5, sm: 2 }, overflow: 'hidden', ...glassSurfaceSx, ...reflectedCardChromeSx }}>
              <Stack spacing={2}>
                {/*
                  Title row uses justifyContent: 'space-between' so the
                  info-icon hugs the top-right corner of the card per
                  the imaging spec. The tooltip explains the default
                  load-state (10 most recent) and that the date pickers
                  ship prefilled with the timespan of the current page
                  but are editable to narrow the range.
                */}
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="h5" sx={{ color: 'var(--blue)' }}>
                    PheNode Images
                  </Typography>
                  <Tooltip
                    title="Showing the 10 most recent images captured by your PheNode. The To / From dates are prefilled with the timespan of these images — edit either side to narrow the range."
                    arrow={false}
                    slotProps={tooltipSlotProps}
                  >
                    <Box
                      component="span"
                      aria-label="About this table"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--blue)',
                        cursor: 'help'
                      }}
                    >
                      <AntIcon icon={InfoCircleOutlined} />
                    </Box>
                  </Tooltip>
                </Stack>

                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  {/*
                    Order is From → To (left to right) per the imaging
                    spec — reading direction matches range semantics
                    ("from start, to end").
                  */}
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Stack spacing={0.5} sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                        From
                      </Typography>
                      <DatePicker
                        value={fromDate}
                        onChange={(newValue) => setFromDate(newValue)}
                        format="MM/DD/YY"
                        slotProps={datePickerSlotProps('MM/DD/YY', datesReversed)}
                      />
                    </Stack>
                    <Stack spacing={0.5} sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                        To
                      </Typography>
                      <DatePicker
                        value={toDate}
                        onChange={(newValue) => setToDate(newValue)}
                        format="MM/DD/YY"
                        slotProps={datePickerSlotProps('MM/DD/YY', datesReversed)}
                      />
                    </Stack>
                  </Stack>
                  {datesReversed && (
                    <Typography
                      variant="caption"
                      role="alert"
                      sx={{ color: 'var(--orange)', fontWeight: 600, mt: 0.5 }}
                    >
                      The “From” date is after the “To” date. Pick a “From” date that’s on or before the “To” date.
                    </Typography>
                  )}
                </LocalizationProvider>

                <TableContainer
                  sx={{
                    // Taller table — 600px gives 10 typical rows
                    // (header ~52px + ~52px per row) breathing room
                    // and lets the user see the full page without
                    // immediately scrolling. The maxHeight still
                    // caps it on shorter viewports so the table
                    // doesn't shove the description card / paginator
                    // off-screen.
                    maxHeight: 600,
                    // overflow-y: scroll (not 'auto') forces the
                    // vertical scrollbar to render even when the
                    // body is short enough not to need scrolling —
                    // per product requirement, the scrollbar is
                    // always visible inside this table.
                    overflowY: 'scroll',
                    backgroundColor: 'transparent',
                    border: imagingTableBorder,
                    borderRadius: 1,
                    boxShadow: '0 11px 19px 1px #0000002e',
                    // Themed scrollbar — matches the recipe used by
                    // sensor-measurements / sensor-network / privacy
                    // modal so the scrollbar reads as part of the
                    // same chrome vocabulary across the app.
                    //
                    // Firefox uses `scrollbarWidth` + `scrollbarColor`;
                    // WebKit (Safari + Chrome) uses ::-webkit-scrollbar
                    // pseudo-elements. Specifying both covers every
                    // evergreen browser.
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(0, 68, 143, 0.6) transparent',
                    '&::-webkit-scrollbar': { width: '8px' },
                    '&::-webkit-scrollbar-track': { background: 'transparent' },
                    '&::-webkit-scrollbar-thumb': {
                      backgroundColor: 'rgba(0, 68, 143, 0.6)',
                      borderRadius: '4px',
                      // Brighter on hover so the user gets an active
                      // affordance when they reach for the bar — same
                      // hover treatment the sensor-measurements
                      // scroll containers use.
                      '&:hover': {
                        backgroundColor: 'rgba(0, 68, 143, 0.85)'
                      }
                    },
                    '& .MuiTable-root': { backgroundColor: 'transparent' },
                    '& .MuiTableHead-root': {
                      backgroundColor: imagingTableHeaderBg,
                      borderTop: 'none',
                      borderBottom: 'none'
                    },
                    '& .MuiTableCell-stickyHeader': {
                      backgroundColor: `${imagingTableHeaderBg} !important`,
                      borderBottom: '1px solid var(--reflected-light) !important'
                    },
                    '& .MuiTableBody-root': { backgroundColor: 'transparent' }
                  }}
                >
                  <Table stickyHeader aria-label="imaging table">
                    <TableHead>
                      <TableRow
                        sx={{
                          '& th': {
                            position: 'sticky',
                            top: 0,
                            zIndex: 1,
                            backgroundColor: imagingTableHeaderBg,
                            color: 'var(--blue)'
                          },
                          '& th:not(:first-of-type)': {
                            textAlign: 'center'
                          }
                        }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={allSelected}
                            indeterminate={someSelected}
                            onChange={handleToggleAllRows}
                            disableRipple
                            sx={{
                              color: 'var(--blue)',
                              '&.Mui-checked': { color: 'var(--green)' },
                              '&.MuiCheckbox-indeterminate': { color: 'var(--green)' },
                              '&:hover': {
                                backgroundColor: 'rgba(72, 247, 245, 0.08)'
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell align="center">Image Name</TableCell>
                        <TableCell align="center">Date</TableCell>
                        <TableCell align="center">Time</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {showingFullPageSpinner ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ color: 'var(--blue)', py: 4 }}>
                            <CircularProgress size={24} sx={{ color: 'var(--green)' }} />
                          </TableCell>
                        </TableRow>
                      ) : imagesError ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ color: 'var(--critical, #ff5c5c)' }}>
                            Could not load images. Please refresh or try again later.
                          </TableCell>
                        </TableRow>
                      ) : pageRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ color: 'var(--blue)' }}>
                            {hasNoDevice ? 'No PheNode found on this account yet.' : 'No images found for the selected range.'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        pageRows.map((row) => {
                          const isSelected = selectedRows.includes(row.id);

                          return (
                            <TableRow
                              key={row.id}
                              hover
                              selected={isSelected}
                              sx={{
                                '& .MuiTableCell-root': {
                                  borderBottom: '1px solid rgba(118, 76, 235, 0.12)'
                                },
                                '&:hover': {
                                  backgroundColor: 'rgba(72, 247, 245, 0.04)'
                                },
                                '&.Mui-selected': {
                                  backgroundColor: 'rgba(72, 247, 245, 0.08)'
                                },
                                '&.Mui-selected:hover': {
                                  backgroundColor: 'rgba(72, 247, 245, 0.1)'
                                }
                              }}
                            >
                              <TableCell padding="checkbox">
                                <Checkbox
                                  checked={isSelected}
                                  onChange={() => handleToggleRow(row.id)}
                                  disableRipple
                                  sx={{
                                    color: 'var(--blue)',
                                    '&.Mui-checked': { color: 'var(--green)' },
                                    '&:hover': {
                                      backgroundColor: 'rgba(72, 247, 245, 0.08)'
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell align="center" sx={{ color: 'var(--green)' }}>
                                {row.name}
                              </TableCell>
                              <TableCell align="center" sx={{ color: 'var(--green)' }}>
                                {row.date}
                              </TableCell>
                              <TableCell align="center" sx={{ color: 'var(--green)' }}>
                                {row.time}
                              </TableCell>
                              <TableCell align="center">
                                <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', alignItems: 'center' }}>
                                  <Button
                                    variant="text"
                                    disableRipple
                                    onClick={() => handleView(row)}
                                    sx={{
                                      minWidth: 0,
                                      px: 0.75,
                                      py: 0.25,
                                      color: 'var(--blue)',
                                      textTransform: 'none',
                                      borderRadius: 0.75,
                                      '&:hover': {
                                        backgroundColor: 'transparent',
                                        color: 'var(--green)'
                                      }
                                    }}
                                  >
                                    View
                                  </Button>
                                  <Typography component="span" sx={{ color: 'var(--medium-grey)' }}>
                                    |
                                  </Typography>
                                  <Button
                                    variant="text"
                                    disableRipple
                                    onClick={() => handleDelete(row)}
                                    disabled={deletingRowIds.includes(row.id)}
                                    sx={{
                                      minWidth: 0,
                                      px: 0.75,
                                      py: 0.25,
                                      color: 'var(--blue)',
                                      textTransform: 'none',
                                      borderRadius: 0.75,
                                      '&:hover': {
                                        backgroundColor: 'transparent',
                                        color: 'var(--critical)'
                                      },
                                      '&.Mui-disabled': {
                                        color: 'var(--med-grey)'
                                      }
                                    }}
                                  >
                                    {deletingRowIds.includes(row.id) ? 'Deleting…' : 'Delete'}
                                  </Button>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Divider sx={{ borderColor: 'rgba(118, 76, 235, 0.16)' }} />
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.25}
                  sx={{ justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Typography variant="caption" sx={{ color: 'var(--blue)' }}>
                    {`Showing ${pageRows.length} of ${apiTotal ?? 0} images`}
                  </Typography>
                  <Pagination
                    page={page}
                    count={pageCount}
                    onChange={(_, value) => setPage(value)}
                    shape="rounded"
                    size="small"
                    sx={{
                      '& .MuiPaginationItem-root': {
                        color: 'var(--blue)',
                        borderColor: 'var(--reflected-light)'
                      },
                      '& .MuiPaginationItem-root.Mui-selected': {
                        color: 'var(--green)',
                        backgroundColor: 'rgba(72, 247, 245, 0.14)'
                      }
                    }}
                  />
                </Stack>
              </Stack>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/*
        Themed delete confirmation. Replaces the original
        window.confirm(): same destructive-action contract (Continue
        button shows critical hover-color, OFF by default), shares
        the project's neon-on-navy paper / blur-backdrop chrome with
        ConfirmRenameModal, and lets the success/error path flow
        through the toast surface below.
      */}
      <ConfirmActionModal
        open={Boolean(pendingDeleteRow)}
        title="Delete image?"
        description="This will permanently remove the image from this PheNode."
        itemBadgeLabel="Filename"
        itemBadgeValue={pendingDeleteRow?.name}
        confirmLabel="Delete"
        confirmTone="critical"
        submittingLabel="Deleting…"
        onConfirm={runDelete}
        onCancel={() => setPendingDeleteRow(null)}
      />

      {/*
        View dialog — opens when a row's "View" button is clicked.
        Mirrors the carousel's lazy-fetch pattern: if the row already
        carries an s3_url we render it immediately; otherwise we
        show a spinner while useImageDetail fetches the base64
        payload from /images/{id}.

        Paper styling matches the neon-on-navy popper surfaces used
        elsewhere (DatePicker popper, sensor-measurements DateTimePicker)
        so the affordance reads as part of the same vocabulary.
      */}
      <Dialog
        open={Boolean(viewingImage)}
        onClose={() => setViewingImage(null)}
        maxWidth="lg"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              backgroundColor: 'rgba(0, 20, 61, 0.96)',
              backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
              border: '1px solid var(--reflected-light)',
              boxShadow: '0 11px 19px 1px #0000002e',
              color: 'var(--green)'
            }
          }
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: 'var(--blue)',
            borderBottom: '1px solid var(--reflected-light)',
            py: 1.5
          }}
        >
          <Stack spacing={0.25}>
            <Typography variant="subtitle1" sx={{ color: 'var(--green)', fontWeight: 600 }}>
              {viewingImage?.name || 'Image'}
            </Typography>
            {viewingImage && (
              <Typography variant="caption" sx={{ color: 'var(--blue)' }}>
                {viewingImage.date} | {viewingImage.time}
              </Typography>
            )}
          </Stack>
          <IconButton
            aria-label="close image preview"
            onClick={() => setViewingImage(null)}
            sx={{
              color: 'var(--blue)',
              '&:hover': { color: 'var(--green)', backgroundColor: 'rgba(72, 247, 245, 0.08)' }
            }}
          >
            <AntIcon icon={CloseOutlined} />
          </IconButton>
        </DialogTitle>
        <DialogContent
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: { xs: 240, sm: 360 },
            p: { xs: 2, sm: 3 }
          }}
        >
          {viewDialogNeedsDetail && viewDetailLoading ? (
            <CircularProgress sx={{ color: 'var(--green)' }} />
          ) : viewDialogSrc ? (
            <Box
              component="img"
              src={viewDialogSrc}
              alt={viewingImage?.name || ''}
              sx={{
                width: 'auto',
                height: 'auto',
                maxWidth: '100%',
                maxHeight: '80vh',
                objectFit: 'contain',
                border: '1px solid var(--reflected-light)',
                borderRadius: 1
              }}
            />
          ) : (
            <Typography variant="body2" sx={{ color: 'var(--blue)' }}>
              Preview unavailable for this image.
            </Typography>
          )}
        </DialogContent>
      </Dialog>
    </MainCard>
  );
}
