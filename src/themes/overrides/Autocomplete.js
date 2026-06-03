// ==============================|| OVERRIDES - AUTOCOMPLETE ||============================== //
//
// The "No options" (and "Loading…") popup text MUI renders when a typed value
// matches nothing defaulted to a muted grey that read as near-white on the dark
// neon theme. Color it like the rest of the dropdown text (var(--green), the
// same token neonMenuItemSx / neonMenuPaperSx use) so it matches every typeable
// dropdown app-wide instead of needing a per-Autocomplete fix.

export default function Autocomplete() {
  return {
    MuiAutocomplete: {
      styleOverrides: {
        noOptions: {
          color: 'var(--green)'
        },
        loading: {
          color: 'var(--green)'
        }
      }
    }
  };
}
