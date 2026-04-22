// project imports
import getShadow from 'utils/getShadow';

// ==============================|| OVERRIDES - INPUT BORDER & SHADOWS ||============================== //

function getColor({ variant, theme }) {
  const shadows = getShadow(theme, `${variant}`);
  const hoverBorderColor = 'var(--green)';

  return {
    '&:hover:not(.Mui-disabled)': {
      borderColor: hoverBorderColor,
      '& .MuiOutlinedInput-notchedOutline': { borderColor: hoverBorderColor },
      '& .MuiSelect-icon': { color: hoverBorderColor },
      '& .MuiAutocomplete-popupIndicator .MuiSvgIcon-root': { color: hoverBorderColor }
    },
    '&.Mui-focused:not(.Mui-disabled)': {
      boxShadow: shadows,
      borderColor: hoverBorderColor,
      '& .MuiOutlinedInput-notchedOutline': { border: '1px solid', borderColor: hoverBorderColor },
      '& .MuiSelect-icon': { color: hoverBorderColor },
      '& .MuiAutocomplete-popupIndicator .MuiSvgIcon-root': { color: hoverBorderColor }
    }
  };
}

// ==============================|| OVERRIDES - OUTLINED INPUT ||============================== //

export default function OutlinedInput(theme) {
  const inputBackgroundColor = 'rgb(44, 62, 74)';

  return {
    MuiOutlinedInput: {
      styleOverrides: {
        input: {
          padding: '10.5px 14px 10.5px 12px',
          color: '#ffffff',
          '&::placeholder': {
            color: '#ffffff',
            opacity: 1
          }
        },
        notchedOutline: { borderColor: theme.vars.palette.grey[300] },
        root: {
          backgroundColor: inputBackgroundColor,
          boxShadow: '0 11px 19px 1px #0000002e',
          color: '#ffffff',
          '& .MuiSelect-select': {
            color: '#ffffff'
          },
          '& .MuiSelect-icon': {
            color: '#ffffff'
          },
          ...getColor({ variant: 'primary', theme }),
          '&.Mui-error': { ...getColor({ variant: 'error', theme }) }
        },
        inputSizeSmall: { padding: '7.5px 8px 7.5px 12px' },
        inputMultiline: { padding: 0 },
        colorSecondary: getColor({ variant: 'secondary', theme }),
        colorError: getColor({ variant: 'error', theme }),
        colorWarning: getColor({ variant: 'warning', theme }),
        colorInfo: getColor({ variant: 'info', theme }),
        colorSuccess: getColor({ variant: 'success', theme })
      }
    }
  };
}
