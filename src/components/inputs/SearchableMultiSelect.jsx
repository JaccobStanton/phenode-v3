import { useMemo } from 'react';

import Autocomplete from '@mui/material/Autocomplete';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';

import { neonControlSx, neonMenuPaperSx } from 'themes/sx-tokens';

const SELECT_ALL_LABEL = 'Select All';

// Multi-select variant matching the neon theme (different from neonMenuItemSx
// in sx-tokens.js, which is single-select). Hoisted so the slotProps object is
// stable across renders.
const neonMultiMenuItemSx = {
  color: 'var(--green)',
  '&:hover': {
    backgroundColor: 'rgba(72, 247, 245, 0.12)'
  },
  '&.Mui-selected': {
    backgroundColor: 'rgba(72, 247, 245, 0.18)',
    color: 'var(--green)'
  },
  '&.Mui-selected:hover': {
    backgroundColor: 'rgba(72, 247, 245, 0.24)'
  }
};

const checkboxSx = {
  p: 0.5,
  mr: 1,
  color: 'var(--blue)',
  '&.Mui-checked': {
    color: 'var(--green)'
  },
  '&:hover': {
    backgroundColor: 'rgba(72, 247, 245, 0.12)'
  }
};

const textFieldSx = {
  '& .MuiOutlinedInput-root': {
    ...neonControlSx,
    '&:hover:not(.Mui-disabled)': {
      borderColor: 'var(--green)'
    },
    '&.Mui-focused:not(.Mui-disabled)': {
      borderColor: 'var(--green)'
    },
    '& .MuiOutlinedInput-notchedOutline': {
      border: 'none'
    }
  },
  '& .MuiInputBase-input': {
    color: 'var(--green)',
    '&::placeholder': {
      color: 'var(--green)',
      opacity: 1
    }
  },
  '& .MuiChip-root': {
    color: 'var(--green)',
    borderColor: 'var(--box-outline-blue)',
    backgroundColor: 'rgba(0, 20, 61, 0.72)',
    borderRadius: 1,
    boxShadow: '0 11px 19px 1px #0000002e'
  },
  '& .MuiSvgIcon-root': {
    color: 'var(--blue)'
  },
  '& .MuiOutlinedInput-root:hover:not(.Mui-disabled) .MuiSvgIcon-root': {
    color: 'var(--green)'
  },
  '& .MuiOutlinedInput-root.Mui-focused:not(.Mui-disabled) .MuiSvgIcon-root': {
    color: 'var(--green)'
  }
};

const slotProps = {
  paper: { sx: neonMenuPaperSx },
  listbox: {
    sx: {
      p: 0.5,
      '& .MuiAutocomplete-option': neonMultiMenuItemSx
    }
  },
  chip: { size: 'small', variant: 'outlined' }
};

/**
 * Multi-select Autocomplete with a "Select All" affordance and the dashboard's
 * neon styling baked in. Used by data-downloads and multi-sensor-graph.
 */
export default function SearchableMultiSelect({ placeholder, options, value, onChange, disabled = false, limitTags = 2 }) {
  const allOptions = useMemo(() => [SELECT_ALL_LABEL, ...options], [options]);

  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      disabled={disabled}
      limitTags={limitTags}
      options={allOptions}
      value={value}
      onChange={(_, newValue) => {
        if (newValue.includes(SELECT_ALL_LABEL)) {
          const nextValue = value.length === options.length ? [] : options;
          onChange(nextValue);
          return;
        }
        onChange(newValue.filter((entry) => entry !== SELECT_ALL_LABEL));
      }}
      renderOption={(props, option, { selected }) => (
        <li {...props}>
          <Checkbox checked={selected || (value.length === options.length && option === SELECT_ALL_LABEL)} sx={checkboxSx} />
          {option}
        </li>
      )}
      renderInput={(params) => <TextField {...params} placeholder={placeholder} size="small" sx={textFieldSx} />}
      slotProps={slotProps}
    />
  );
}
