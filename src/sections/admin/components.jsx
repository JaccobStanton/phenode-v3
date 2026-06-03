import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

// material-ui
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

// project imports
import AntIcon from 'components/AntIcon';
import SearchOutlined from '@ant-design/icons-svg/lib/asn/SearchOutlined';
import DownOutlined from '@ant-design/icons-svg/lib/asn/DownOutlined';
import { neonControlSx, neonMenuPaperSx, neonMenuItemSx } from 'themes/sx-tokens';
import { themedTextFieldSx, fieldLabelSx, modalPaperSx, countLinkSx, paginationSx, primaryActionButtonSx, imagingCardSx } from './shared';

// =============================================================================
// Shared admin-panel UI primitives — used by BOTH the User Management and
// Device Management tabs so the two read identically.
// =============================================================================

// ---------------------------------------------------------------------------
// LabeledField — caption label ABOVE a control (project convention), no MUI
// floating label.
// ---------------------------------------------------------------------------
export function LabeledField({ label, htmlFor, children, sx }) {
  return (
    <Box sx={sx}>
      <Typography component="label" htmlFor={htmlFor} sx={fieldLabelSx}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

LabeledField.propTypes = {
  label: PropTypes.node,
  htmlFor: PropTypes.string,
  children: PropTypes.node,
  sx: PropTypes.object
};

// ---------------------------------------------------------------------------
// TableSearch — themed search box, static placeholder, blue search icon.
// ---------------------------------------------------------------------------
export function TableSearch({ value, onChange, placeholder, maxWidth = 460 }) {
  return (
    <TextField
      size="small"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      sx={{ ...themedTextFieldSx, maxWidth, width: '100%' }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start" sx={{ color: 'var(--blue)', mr: 0.5 }}>
            <AntIcon icon={SearchOutlined} />
          </InputAdornment>
        )
      }}
    />
  );
}

TableSearch.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  maxWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
};

// ---------------------------------------------------------------------------
// SearchableSelect — typeable (filter-as-you-type) single-select dropdown, the
// same MUI Autocomplete pattern the app's other device / wireless-sensor
// pickers use (sections/data-download/data-downloads.jsx:347-371). Options are
// { id, label }; value is the selected option object (or null).
// ---------------------------------------------------------------------------

// Input chrome — copied verbatim from the data-downloads autocompleteInputSx so
// these pickers read identically to the rest of the app.
const autocompleteInputSx = (disabled) => ({
  '& .MuiOutlinedInput-root': {
    ...neonControlSx,
    border: '1px solid var(--reflected-light)',
    '&.Mui-disabled': { opacity: 1 },
    '&:hover:not(.Mui-disabled)': { borderColor: 'var(--green)' },
    '&.Mui-focused:not(.Mui-disabled)': { borderColor: 'var(--green)' },
    '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
  },
  '& .MuiInputBase-input': {
    color: disabled ? 'var(--med-grey)' : 'var(--green)',
    WebkitTextFillColor: disabled ? 'var(--med-grey)' : 'var(--green)',
    '&::placeholder': { color: disabled ? 'var(--med-grey)' : 'var(--green)', opacity: 1 }
  },
  '& .MuiSvgIcon-root': { color: disabled ? 'var(--med-grey)' : 'var(--blue)' },
  '& .MuiOutlinedInput-root:hover:not(.Mui-disabled) .MuiSvgIcon-root': { color: 'var(--green)' },
  '& .MuiOutlinedInput-root.Mui-focused:not(.Mui-disabled) .MuiSvgIcon-root': { color: 'var(--green)' }
});

export function SearchableSelect({ id, placeholder, options, value, onChange, disabled = false }) {
  return (
    <Autocomplete
      fullWidth
      options={options}
      value={value}
      disabled={disabled}
      getOptionLabel={(o) => o?.label ?? ''}
      isOptionEqualToValue={(a, b) => a?.id === b?.id}
      onChange={(_e, newValue) => onChange(newValue)}
      renderInput={(params) => <TextField {...params} id={id} placeholder={placeholder} size="small" sx={autocompleteInputSx(disabled)} />}
      slotProps={{
        paper: { sx: neonMenuPaperSx },
        listbox: { sx: { p: 0.5, '& .MuiAutocomplete-option': { ...neonMenuItemSx } } }
      }}
    />
  );
}

SearchableSelect.propTypes = {
  id: PropTypes.string,
  placeholder: PropTypes.string,
  options: PropTypes.array,
  value: PropTypes.object,
  onChange: PropTypes.func,
  disabled: PropTypes.bool
};

// ---------------------------------------------------------------------------
// CountModalCell — the table-declutter pattern. When `count` is 0 it renders a
// muted `emptyLabel`; when ≥ 1 it renders a clickable "<label>" that opens a
// project-themed modal showing `children` (the detailed list).
// ---------------------------------------------------------------------------
export function CountModalCell({ count, label, title, emptyLabel = 'None', children }) {
  const [open, setOpen] = useState(false);

  // When the underlying count drops to 0 (e.g. the last item was removed from
  // inside the modal), there's nothing left to show — collapse to the empty
  // label, which also unmounts the Dialog.
  if (!count || count < 1) {
    return <Typography sx={{ color: 'var(--blue)', fontSize: '0.82rem' }}>{emptyLabel}</Typography>;
  }

  return (
    <>
      <Button variant="text" disableRipple onClick={() => setOpen(true)} sx={countLinkSx}>
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: modalPaperSx }}>
        <DialogTitle sx={{ color: 'var(--green)', fontWeight: 600, fontSize: '1.05rem', pb: 1 }}>{title}</DialogTitle>
        <DialogContent dividers sx={{ borderColor: 'var(--reflected-light)' }}>
          {children}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5 }}>
          <Button variant="outlined" onClick={() => setOpen(false)} sx={{ ...primaryActionButtonSx, minWidth: 96 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

CountModalCell.propTypes = {
  count: PropTypes.number,
  label: PropTypes.node,
  title: PropTypes.node,
  emptyLabel: PropTypes.node,
  children: PropTypes.node
};

// ---------------------------------------------------------------------------
// Pagination — client-side, 10 rows per page, matching the imaging table.
// ---------------------------------------------------------------------------
export const ROWS_PER_PAGE = 10;

// Hook: slice a filtered array into the current page, clamping the page when
// the underlying data shrinks (e.g. a search narrows the result set).
export function usePaginatedRows(rows, perPage = ROWS_PER_PAGE) {
  const [page, setPage] = useState(1);
  const all = Array.isArray(rows) ? rows : [];
  const total = all.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const start = (page - 1) * perPage;
  const pageRows = all.slice(start, start + perPage);
  return { page, setPage, pageCount, total, pageRows };
}

// Footer: "Showing X of Y nouns" + the MUI paginator — replicates the imaging
// table footer (sections/imaging/imaging.jsx:1474-1500).
export function PaginationFooter({ page, pageCount, onChange, shown, total, noun }) {
  return (
    <>
      <Divider sx={{ borderColor: 'rgba(118, 76, 235, 0.16)' }} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" sx={{ color: 'var(--blue)' }}>
          {`Showing ${shown} of ${total} ${noun}`}
        </Typography>
        <Pagination page={page} count={pageCount} onChange={onChange} shape="rounded" size="small" sx={paginationSx} />
      </Stack>
    </>
  );
}

PaginationFooter.propTypes = {
  page: PropTypes.number,
  pageCount: PropTypes.number,
  onChange: PropTypes.func,
  shown: PropTypes.number,
  total: PropTypes.number,
  noun: PropTypes.string
};

// ---------------------------------------------------------------------------
// CollapsibleCard — imaging-style Card whose body collapses behind a chevron
// in the top-right corner. The whole header row is the toggle (keyboard
// accessible); the chevron rotates 180° when open and turns green on hover.
// `defaultOpen={false}` lands the card closed.
// ---------------------------------------------------------------------------
export function CollapsibleCard({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = () => setOpen((o) => !o);
  return (
    <Card sx={imagingCardSx}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        sx={{
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover .collapse-chevron': { color: 'var(--green)' },
          '&:focus-visible': { outline: 'none', '& .collapse-chevron': { color: 'var(--green)' } }
        }}
      >
        <Typography variant="h5" sx={{ color: 'var(--blue)' }}>
          {title}
        </Typography>
        <Box
          className="collapse-chevron"
          aria-hidden
          sx={{
            display: 'inline-flex',
            color: 'var(--blue)',
            fontSize: '0.95rem',
            transition: 'transform 0.2s ease, color 0.18s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        >
          <AntIcon icon={DownOutlined} />
        </Box>
      </Stack>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box sx={{ mt: 2 }}>{children}</Box>
      </Collapse>
    </Card>
  );
}

CollapsibleCard.propTypes = {
  title: PropTypes.node,
  defaultOpen: PropTypes.bool,
  children: PropTypes.node
};
