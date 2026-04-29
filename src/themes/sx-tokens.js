// ==============================|| SHARED SX TOKENS ||============================== //
//
// Centralized `sx` style objects used across the dashboard's neon-themed sections.
// Importing from here keeps visual tweaks to a single source of truth so a change
// to e.g. the glass-card chrome only needs to be made once.

// Subtle "glass" surface — used as a base for MainCard wrappers.
export const glassSurfaceSx = {
  backgroundColor: 'rgba(0, 17, 48, 0.03)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))'
};

// Reflected-light border + shadow used on inner cards/panels.
export const reflectedCardChromeSx = {
  border: '1px solid var(--reflected-light)',
  boxShadow: '0 11px 19px 1px #0000002e'
};

// Solid dark "drf" surface for inner panels (sensor diagrams, info cards).
export const drfSurfaceSx = {
  backgroundColor: 'var(--drf)',
  backgroundImage: 'none'
};

// Slightly translucent dark surface used as backdrop for line-charts.
export const chartSurfaceSx = {
  backgroundColor: 'rgba(0, 18, 55, 0.6)'
};

// Neon-styled select / autocomplete control surface.
export const neonControlSx = {
  backgroundColor: 'var(--drf)',
  border: '1px solid var(--reflected-light)',
  borderRadius: 1,
  minHeight: 40,
  boxShadow: '0 11px 19px 1px #0000002e'
};

// Drawer-nav-style icon-button surface (also re-used by header toggles).
export const drawerNavButtonSurfaceSx = {
  backgroundColor: 'rgba(0, 17, 48, 0.03)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))'
};

// Orientation / view-toggle button used to flip chart layout, etc.
export const orientationButtonSx = {
  border: '1px solid var(--reflected-light)',
  color: 'var(--blue)',
  backgroundColor: 'rgba(0, 20, 61, 0.72)',
  boxShadow: '0 11px 19px 1px #0000002e',
  '&:hover': {
    borderColor: 'var(--green)',
    boxShadow: '0 0 7px -5px var(--green)',
    color: 'var(--green)',
    textShadow: '0 1px 5px #007bff',
    backgroundColor: 'rgba(72, 247, 245, 0.08)'
  }
};

// Dropdown / menu paper styling (Autocomplete, Select).
export const neonMenuPaperSx = {
  backgroundColor: 'rgba(0, 20, 61, 0.96)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
  border: '1px solid var(--reflected-light)',
  boxShadow: '0 11px 19px 1px #0000002e',
  backdropFilter: 'blur(6px)',
  color: 'var(--green)'
};

// Individual list-item styling inside neon menus.
export const neonMenuItemSx = {
  color: 'var(--green)',
  '&:hover': {
    backgroundColor: 'rgba(72, 247, 245, 0.12)'
  },
  '&.Mui-focused': {
    backgroundColor: 'rgba(72, 247, 245, 0.12)'
  }
};

// Tooltip slotProps used across all neon-styled tooltips. Hoisted so MUI's slot
// caching is preserved (the previous duplicates created a fresh object literal
// every render).
export const tooltipSlotProps = {
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

// Generic Select PaperProps used by `MenuProps`.
export const neonSelectMenuPaperProps = {
  sx: {
    backgroundColor: 'rgba(0, 20, 61, 0.96)',
    border: '1px solid var(--reflected-light)',
    boxShadow: '0 11px 19px 1px #0000002e',
    color: 'var(--green)'
  }
};
