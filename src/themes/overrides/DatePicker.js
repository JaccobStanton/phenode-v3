// ==============================|| OVERRIDES - DATE PICKERS ||============================== //

export default function DatePicker() {
  const surface = 'rgba(0, 20, 61, 0.94)';
  const innerSurface = 'rgba(0, 20, 61, 0.42)';
  const border = '1px solid var(--reflected-light)';
  const hoverBorderColor = 'var(--green)';

  return {
    MuiPickersPopper: {
      styleOverrides: {
        root: {
          '& .MuiPaper-root': {
            backgroundColor: surface,
            backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
            border,
            boxShadow: '0 11px 19px 1px #0000002e',
            backdropFilter: 'blur(6px)',
            color: 'var(--green)'
          }
        },
        paper: {
          backgroundColor: surface,
          backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
          border,
          boxShadow: '0 11px 19px 1px #0000002e',
          backdropFilter: 'blur(6px)',
          color: 'var(--green)'
        }
      }
    },
    MuiPickersLayout: {
      styleOverrides: {
        root: {
          color: 'var(--blue)'
        }
      }
    },
    MuiPickersToolbar: {
      styleOverrides: {
        root: {
          color: 'var(--blue)'
        }
      }
    },
    MuiPickersOutlinedInput: {
      styleOverrides: {
        root: {
          '&:hover:not(.Mui-disabled)': {
            borderColor: hoverBorderColor,
            '& .MuiPickersOutlinedInput-notchedOutline, & .MuiOutlinedInput-notchedOutline': {
              borderColor: hoverBorderColor
            },
            '& .MuiSvgIcon-root': {
              color: hoverBorderColor
            },
            '& .MuiSelect-icon': {
              color: hoverBorderColor
            }
          },
          '&.Mui-focused:not(.Mui-disabled)': {
            borderColor: hoverBorderColor,
            '& .MuiPickersOutlinedInput-notchedOutline, & .MuiOutlinedInput-notchedOutline': {
              borderColor: hoverBorderColor
            },
            '& .MuiSvgIcon-root': {
              color: hoverBorderColor
            },
            '& .MuiSelect-icon': {
              color: hoverBorderColor
            }
          }
        }
      }
    },
    MuiDateCalendar: {
      styleOverrides: {
        root: {
          color: 'var(--blue)'
        },
        viewTransitionContainer: {
          border: '1px solid var(--box-outline-blue)',
          borderRadius: 8,
          backgroundColor: innerSurface
        }
      }
    },
    MuiDayCalendar: {
      styleOverrides: {
        weekDayLabel: {
          color: 'var(--blue)',
          fontWeight: 600
        }
      }
    },
    MuiPickersCalendarHeader: {
      styleOverrides: {
        label: {
          color: 'var(--blue)',
          fontWeight: 600
        },
        switchViewButton: {
          color: 'var(--blue)'
        }
      }
    },
    MuiPickersArrowSwitcher: {
      styleOverrides: {
        button: {
          color: 'var(--blue)'
        }
      }
    },
    MuiPickersDay: {
      styleOverrides: {
        root: {
          color: 'var(--green)',
          border: '1px solid transparent',
          borderRadius: 6,
          '&:hover': {
            backgroundColor: 'rgba(72, 247, 245, 0.12)'
          }
        },
        today: {
          borderColor: 'var(--reflected-light)'
        },
        selected: {
          backgroundColor: 'rgba(72, 247, 245, 0.2) !important',
          color: 'var(--green) !important',
          boxShadow: '0 0 7px -5px var(--green)'
        },
        dayOutsideMonth: {
          color: 'rgba(175, 175, 175, 0.48)'
        }
      }
    },
    MuiPickersMonth: {
      styleOverrides: {
        monthButton: {
          color: 'var(--green)',
          '&.Mui-selected': {
            color: 'var(--green)',
            backgroundColor: 'rgba(72, 247, 245, 0.2)'
          }
        }
      }
    },
    MuiPickersYear: {
      styleOverrides: {
        yearButton: {
          color: 'var(--green)',
          '&.Mui-selected': {
            color: 'var(--green)',
            backgroundColor: 'rgba(72, 247, 245, 0.2)'
          }
        }
      }
    }
  };
}
