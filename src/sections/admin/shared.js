// =============================================================================
// Admin panel — shared sx tokens.
// =============================================================================
//
// Same intent as sections/account-settings/shared.js: pull the themed control
// recipes into one place so the User Management and Device Management tabs read
// as visually identical and match the rest of the neon-themed dashboard.
//
// The recipes here are aligned 1:1 with the canonical project sources so the
// admin panel reads as native:
//   - text field / select chrome      → sections/account-settings/shared.js
//   - caption-above field label        → fieldLabelSx (account-settings)
//   - primary action button            → account-settings / data-downloads
//   - table container / header / cell  → sections/imaging/imaging.jsx table
//
// Everything composes the canonical tokens from themes/sx-tokens.js so a
// global chrome tweak still flows through.

import { neonControlSx, neonMenuPaperSx, neonMenuItemSx, reflectedCardChromeSx } from 'themes/sx-tokens';

// ---------------------------------------------------------------------------
// Inputs / selects
// ---------------------------------------------------------------------------

// Plain text input (email, password, label, search). Neon surface, green
// text and green placeholder (opacity 1) — matches the account-settings
// device-settings-tab / display-tab text-field recipe so inputs read as one
// family across the app. No MUI notch border; green border on hover/focus.
//
// These controls are always paired with a caption label ABOVE the field
// (see fieldLabelSx) rather than an MUI floating `label`, so the in-box
// placeholder text stays put and never animates up into the border.
export const themedTextFieldSx = {
  '& .MuiOutlinedInput-root': {
    ...neonControlSx,
    color: 'var(--green)',
    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
    '&:hover:not(.Mui-disabled)': { borderColor: 'var(--green)' },
    '&.Mui-focused:not(.Mui-disabled)': { borderColor: 'var(--green)' }
  },
  '& .MuiInputBase-input': {
    color: 'var(--green)',
    WebkitTextFillColor: 'var(--green)',
    '&::placeholder': { color: 'var(--green)', opacity: 0.65 }
  }
};

// Select control — same surface as the text field so mixed forms read as a
// family. Blue chevron at rest → green on hover/focus.
export const themedSelectSx = {
  ...neonControlSx,
  color: 'var(--green)',
  '& .MuiSelect-select': { color: 'var(--green)' },
  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '& .MuiSelect-icon': { color: 'var(--blue)' },
  '&:hover:not(.Mui-disabled)': {
    borderColor: 'var(--green)',
    '& .MuiSelect-icon': { color: 'var(--green)' }
  },
  '&.Mui-focused:not(.Mui-disabled)': {
    borderColor: 'var(--green)',
    '& .MuiSelect-icon': { color: 'var(--green)' }
  }
};

// Caption label that sits ABOVE a Select / TextField — small uppercase blue
// caption, identical to fieldLabelSx in sections/account-settings/shared.js.
// This is the project's convention for labeling controls; it replaces the
// MUI floating `label` (which animates from inside the box up to the notch).
export const fieldLabelSx = {
  color: 'var(--blue)',
  fontSize: '0.78rem',
  fontWeight: 500,
  letterSpacing: '0.04em',
  mb: 0.75,
  textTransform: 'uppercase',
  display: 'block'
};

// Retained for backward compatibility with the Device Management tab, which
// still uses MUI floating InputLabels on its in-table "Assign User" select.
// Blue at rest, green when focused.
export const floatingLabelSx = {
  color: 'var(--blue)',
  '&.Mui-focused': { color: 'var(--green)' }
};

// Dropdown paper + list styling for any Select on the panel.
export const themedDropdownMenuProps = {
  PaperProps: { sx: { ...neonMenuPaperSx, maxHeight: 360 } },
  MenuListProps: {
    sx: { p: 0.5, '& .MuiMenuItem-root': { ...neonMenuItemSx, fontSize: '0.85rem' } }
  }
};

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

// Canonical primary-action button — verbatim from
// sections/account-settings/shared.js (which itself took it from the
// data-downloads Download button). Kept byte-identical so every action button
// across the app shares the exact same rest / hover / disabled treatment.
// textTransform is intentionally NOT set here — the global theme typography
// (themes/typography.js: button.textTransform 'capitalize') handles casing.
export const primaryActionButtonSx = {
  borderColor: 'var(--blue)',
  color: 'var(--green)',
  backgroundColor: 'rgba(0, 20, 61, 0.72)',
  boxShadow: '0 11px 19px 1px #0000002e',
  transition: 'none',
  '&.Mui-disabled': {
    color: 'var(--med-grey)',
    borderColor: 'var(--med-grey)',
    backgroundColor: '#01113d'
  },
  '&.Mui-disabled:hover': {
    backgroundColor: '#01113d'
  },
  '&:hover': {
    borderColor: 'var(--green)',
    boxShadow: '0 0 7px -5px var(--green)',
    color: 'var(--green)',
    textShadow: '0 1px 5px #007bff',
    backgroundColor: 'rgba(72, 247, 245, 0.08)'
  }
};

// ---------------------------------------------------------------------------
// Section chrome
// ---------------------------------------------------------------------------

// Inner form panel (Add User, Add Device, …) — translucent navy with the
// reflected-light border, matching the dashboard's inner-card language.
export const formPanelSx = {
  p: { xs: 1.75, sm: 2.25 },
  borderRadius: 1.5,
  backgroundColor: 'rgba(0, 20, 61, 0.35)',
  border: '1px solid var(--reflected-light)',
  boxShadow: '0 11px 19px 1px #0000002e'
};

export const sectionTitleSx = { color: 'var(--green)', fontWeight: 600, fontSize: '1rem' };
export const subSectionTitleSx = { color: 'var(--blue)', fontWeight: 600, fontSize: '0.95rem' };

// ---------------------------------------------------------------------------
// Tables — EXACT replica of the imaging table (sections/imaging/imaging.jsx,
// ~lines 1181-1430). EVERY admin table uses these tokens, so all four tables
// across the User Management and Device Management tabs render identically to
// the imaging "PheNode Images" table: transparent body, reflected-light border,
// project shadow, the always-visible themed scrollbar (overflowY: 'scroll'),
// the rgb(8,36,82) sticky header band, blue header text with non-first columns
// centered, and the teal hover / selected row washes with a faint purple cell
// underline.
// ---------------------------------------------------------------------------

// Header background band — the exact value the imaging table uses.
const tableHeaderBg = 'rgb(8, 36, 82)';

// TableContainer chrome.
export const imagingTableContainerSx = {
  maxHeight: 600,
  overflowY: 'scroll',
  backgroundColor: 'transparent',
  border: '1px solid var(--reflected-light)',
  borderRadius: 1,
  boxShadow: '0 11px 19px 1px #0000002e',
  scrollbarWidth: 'thin',
  scrollbarColor: 'rgba(0, 68, 143, 0.6) transparent',
  '&::-webkit-scrollbar': { width: '8px' },
  '&::-webkit-scrollbar-track': { background: 'transparent' },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'rgba(0, 68, 143, 0.6)',
    borderRadius: '4px',
    '&:hover': { backgroundColor: 'rgba(0, 68, 143, 0.85)' }
  },
  '& .MuiTable-root': { backgroundColor: 'transparent' },
  '& .MuiTableHead-root': { backgroundColor: tableHeaderBg, borderTop: 'none', borderBottom: 'none' },
  '& .MuiTableCell-stickyHeader': {
    backgroundColor: `${tableHeaderBg} !important`,
    borderBottom: '1px solid var(--reflected-light) !important'
  },
  '& .MuiTableBody-root': { backgroundColor: 'transparent' }
};

// Header TableRow — sticky `& th` band, blue text, non-first columns centered.
export const imagingTableHeadRowSx = {
  '& th': { position: 'sticky', top: 0, zIndex: 1, backgroundColor: tableHeaderBg, color: 'var(--blue)' },
  '& th:not(:first-of-type)': { textAlign: 'center' }
};

// Body TableRow — faint purple cell underline, teal hover / selected washes.
export const imagingTableBodyRowSx = {
  '& .MuiTableCell-root': { borderBottom: '1px solid rgba(118, 76, 235, 0.12)' },
  '&:hover': { backgroundColor: 'rgba(72, 247, 245, 0.04)' },
  '&.Mui-selected': { backgroundColor: 'rgba(72, 247, 245, 0.08)' },
  '&.Mui-selected:hover': { backgroundColor: 'rgba(72, 247, 245, 0.1)' }
};

// Body cell — green value text.
export const imagingTableCellSx = { color: 'var(--green)' };

// ---------------------------------------------------------------------------
// Card wrapper for the table cards. Background matches the Add User / form
// panels (formPanelSx — rgba(0, 20, 61, 0.35)) so every card on the admin
// panel reads as one family, plus the reflected-light border + shadow chrome.
// ---------------------------------------------------------------------------
export const imagingCardSx = {
  p: { xs: 1.5, sm: 2 },
  overflow: 'hidden',
  backgroundColor: 'rgba(0, 20, 61, 0.35)',
  backgroundImage: 'none',
  ...reflectedCardChromeSx
};

// ---------------------------------------------------------------------------
// Themed modal (Dialog) + the clickable "count" link + pagination styling.
// Used by the list-column "# items → modal" declutter pattern and the table
// pagination footer (see sections/admin/components.jsx).
// ---------------------------------------------------------------------------

// Dialog Paper — same neon-on-navy chrome as the Profile popper / drawer menu
// (solid #054085 border per the alpha-border project memory).
export const modalPaperSx = {
  backgroundColor: '#002a63',
  backgroundImage: 'radial-gradient(circle at 50% 0%, #002a63, #001f53)',
  border: '1.5px solid #054085',
  boxShadow: '0 11px 19px 1px #0000002e',
  color: 'var(--green)',
  borderRadius: 2
};

// Clickable count text (e.g. "3 connected") that opens the detail modal.
export const countLinkSx = {
  minWidth: 0,
  px: 0.5,
  py: 0.25,
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '0.82rem',
  lineHeight: 1.4,
  color: 'var(--green)',
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
  transition: 'none',
  '&:hover': {
    backgroundColor: 'transparent',
    color: 'var(--green)',
    textShadow: '0 1px 5px #007bff'
  }
};

// MUI Pagination styling — matches the imaging table paginator exactly.
export const paginationSx = {
  '& .MuiPaginationItem-root': {
    color: 'var(--blue)',
    borderColor: 'var(--reflected-light)'
  },
  '& .MuiPaginationItem-root.Mui-selected': {
    color: 'var(--green)',
    backgroundColor: 'rgba(72, 247, 245, 0.14)'
  }
};
