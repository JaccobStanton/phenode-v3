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

import { neonControlSx, neonMenuPaperSx, neonMenuItemSx } from 'themes/sx-tokens';

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
// Tables — neon chrome shared by the admin tables (header band, border,
// shadow, themed scrollbar). The All Users table opts into the fuller imaging
// table replica locally (see user-management-tab.jsx); these tokens are the
// lighter shared baseline used by the other admin tables.
// ---------------------------------------------------------------------------

// Header background band.
const tableHeaderBg = 'rgb(8, 36, 82)';

export const tableContainerSx = {
  maxHeight: 460,
  backgroundColor: 'transparent',
  border: '1px solid var(--reflected-light)',
  borderRadius: 1,
  boxShadow: '0 11px 19px 1px #0000002e',
  scrollbarWidth: 'thin',
  scrollbarColor: 'rgba(0, 68, 143, 0.6) transparent',
  '&::-webkit-scrollbar': { width: '8px', height: '8px' },
  '&::-webkit-scrollbar-track': { background: 'transparent' },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'rgba(0, 68, 143, 0.6)',
    borderRadius: '4px',
    '&:hover': { backgroundColor: 'rgba(0, 68, 143, 0.85)' }
  },
  '& .MuiTable-root': { backgroundColor: 'transparent' },
  '& .MuiTableHead-root': { backgroundColor: tableHeaderBg },
  '& .MuiTableCell-stickyHeader': {
    backgroundColor: `${tableHeaderBg} !important`,
    borderBottom: '1px solid var(--reflected-light) !important'
  },
  '& .MuiTableBody-root': { backgroundColor: 'transparent' }
};

// Header cell — blue text on the header band. Font weight / uppercase / size
// come from the global MuiTableCell.head theme override.
export const tableHeaderCellSx = {
  color: 'var(--blue)',
  backgroundColor: tableHeaderBg,
  whiteSpace: 'nowrap'
};

// Body cell — green value text.
export const tableCellSx = {
  color: 'var(--green)',
  verticalAlign: 'top'
};
