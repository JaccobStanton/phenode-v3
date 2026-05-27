// =============================================================================
// Account Settings — shared sx tokens.
// =============================================================================
//
// Pulled out of each tab file so the Display / API Access / Devices
// tabs read as visually identical: same field labels, same select
// chrome, same primary-button recipe. Each tab still owns its own
// state, mutations, and copy — this file is style only.
//
// The themed control recipes mirror what the rest of the app does:
//
//   - themedSelectSx / themedDropdownMenuProps  → multi-sensor-graph.jsx
//   - primaryActionButtonSx                     → data-downloads.jsx:577
//   - fieldLabelSx                              → caption-over-control
//                                                  convention used
//                                                  throughout dashboards

import { neonControlSx, neonMenuPaperSx, neonMenuItemSx } from 'themes/sx-tokens';

// Project-themed Select sx — neonControlSx surface, green value text,
// blue chevron at rest, green border + green chevron on hover/focus,
// no MUI default notch border.
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

// Paper + list slotProps for any Select/Autocomplete dropdown on this page.
export const themedDropdownMenuProps = {
  PaperProps: { sx: { ...neonMenuPaperSx, maxHeight: 360 } },
  MenuListProps: {
    sx: { p: 0.5, '& .MuiMenuItem-root': { ...neonMenuItemSx, fontSize: '0.85rem' } }
  }
};

// Field label that sits ABOVE a Select / TextField — small uppercase
// blue caption, matching the caption-over-control convention used
// throughout the dashboard sections.
export const fieldLabelSx = {
  color: 'var(--blue)',
  fontSize: '0.78rem',
  fontWeight: 500,
  letterSpacing: '0.04em',
  mb: 0.75,
  textTransform: 'uppercase'
};

// Themed OutlinedInput / TextField sx — for plain text inputs (SSID,
// password, label). Same surface + border behavior as themedSelectSx so
// the controls read as a family even when mixed in one form.
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
    '&::placeholder': { color: 'var(--blue)', opacity: 0.65 }
  },
  '& .MuiInputBase-input.Mui-disabled': {
    color: 'var(--med-grey)',
    WebkitTextFillColor: 'var(--med-grey)'
  }
};

// Project's canonical primary-action Button — taken verbatim from the
// Download button in data-downloads.jsx so every action button on this
// page reads as the same control. Used by Save Changes (Display tab),
// Copy access token (API Access tab), Rename (Devices tab), Set Wi-Fi
// (Devices tab).
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

// Section title (green) + subtitle (muted blue) — used at the top of
// every form section on this page so the visual hierarchy stays
// consistent across tabs.
export const sectionTitleSx = { color: 'var(--green)', fontWeight: 600 };
export const sectionSubtitleSx = { color: 'var(--blue)', fontSize: '0.8rem', opacity: 0.85, mb: 1.5 };
