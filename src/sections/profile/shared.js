// =============================================================================
// Profile — shared sx tokens.
// =============================================================================
//
// Re-exports the token set that the Account Settings tabs already
// established, plus a Switch recipe that the profile tabs need. Goal
// is one source of truth for the chrome so the two tabbed pages
// (Account Settings + Profile) read as a single visual family.
//
// When the project eventually grows a third tabbed section, promote
// the re-exported tokens to a project-level location
// (e.g. `themes/sx-tokens.js`) instead of chaining another re-export.

export {
  themedSelectSx,
  themedDropdownMenuProps,
  themedTextFieldSx,
  fieldLabelSx,
  primaryActionButtonSx,
  sectionTitleSx,
  sectionSubtitleSx
} from '../account-settings/shared';

// Themed Switch — the project doesn't have an existing pattern (no
// other section uses MUI Switch), so we define one here.
//
// Recipe:
//   - off: muted blue track + grey thumb
//   - on:  green track + brighter green thumb
//   - hover: subtle glow halo around the thumb
//
// Sized small by default since notification preferences tend to
// appear in dense lists where the full-size Switch is too loud.
export const themedSwitchSx = {
  '& .MuiSwitch-switchBase': {
    color: 'var(--med-grey)',
    '&:hover': {
      backgroundColor: 'rgba(72, 247, 245, 0.08)'
    },
    '&.Mui-checked': {
      color: 'var(--green)',
      '& + .MuiSwitch-track': {
        backgroundColor: 'var(--blue)',
        opacity: 0.85
      },
      '&:hover': {
        backgroundColor: 'rgba(72, 247, 245, 0.14)'
      }
    },
    '&.Mui-disabled': {
      color: 'var(--inactive-grey)',
      '& + .MuiSwitch-track': {
        backgroundColor: 'var(--reflected-light)',
        opacity: 0.4
      }
    }
  },
  '& .MuiSwitch-track': {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    opacity: 1,
    transition: 'background-color 0.18s ease, opacity 0.18s ease'
  },
  '& .MuiSwitch-thumb': {
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.4)'
  }
};

// Themed Checkbox — small reusable sx that matches the inline pattern
// already used in `data-downloads.jsx` Autocomplete options.
// Pulled here so the four profile tabs don't all duplicate it.
export const themedCheckboxSx = {
  p: 0.5,
  color: 'var(--blue)',
  '&.Mui-checked': { color: 'var(--green)' },
  '&:hover': { backgroundColor: 'rgba(72, 247, 245, 0.12)' },
  '&.Mui-checked:hover': { color: 'var(--green)' }
};

// Card surface used inside each tab to group related rows (General
// Settings, Advance Settings, Recognized Devices, etc.). Matches the
// "inner panel" treatment from sensor-measurements / data-downloads
// so the visual hierarchy reads as section → card → row.
export const innerCardSx = {
  p: { xs: 2, sm: 2.5 },
  borderRadius: 1.5,
  border: '1px solid var(--reflected-light)',
  backgroundColor: 'rgba(0, 17, 48, 0.35)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.02))',
  boxShadow: '0 11px 19px 1px #0000002e'
};
