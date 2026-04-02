import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { DownloadOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

import MainCard from 'components/MainCard';
import downloadDataPreferencesActiveIcon from 'assets/toggle_buttons/Download_Data_Preferences_Icon_Active.svg';
import downloadDataPreferencesInactiveIcon from 'assets/toggle_buttons/Download_Data_Preferences_Icon_Inactive.svg';

const glassSurfaceSx = {
  backgroundColor: 'rgba(0, 17, 48, 0.03)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))'
};

const reflectedCardChromeSx = {
  border: '1px solid var(--reflected-light)',
  boxShadow: '0 11px 19px 1px #0000002e'
};

const downloadPanelSx = {
  border: '1px solid var(--reflected-light)',
  boxShadow: '0 11px 19px 1px #0000002e',
  backgroundColor: 'transparent',
  backgroundImage: 'none'
};

const neonControlSx = {
  backgroundColor: 'var(--drf)',
  border: '1px solid var(--reflected-light)',
  borderRadius: 1,
  minHeight: 40,
  boxShadow: '0 11px 19px 1px #0000002e'
};

const neonMenuPaperSx = {
  backgroundColor: 'rgba(0, 20, 61, 0.96)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
  border: '1px solid var(--reflected-light)',
  boxShadow: '0 11px 19px 1px #0000002e',
  backdropFilter: 'blur(6px)',
  color: 'var(--green)'
};

const neonMenuItemSx = {
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

const datePickerTextFieldSx = {
  flex: 1,
  '& .MuiOutlinedInput-root, & .MuiPickersOutlinedInput-root': {
    ...neonControlSx,
    '& .MuiOutlinedInput-notchedOutline, & .MuiPickersOutlinedInput-notchedOutline': {
      border: 'none'
    },
    '&.Mui-focused': {
      borderColor: 'var(--blue)',
      boxShadow: '0 11px 19px 1px #0000002e'
    }
  },
  '& .MuiInputBase-input': {
    color: 'var(--green) !important',
    WebkitTextFillColor: 'var(--green)',
    '&::placeholder': {
      color: 'var(--green)',
      opacity: 1
    }
  },
  '& .MuiPickersInputBase-root, & .MuiPickersSectionList-root, & .MuiPickersSectionList-sectionContent': {
    color: 'var(--green) !important'
  },
  '& [data-placeholder="true"]': {
    color: 'var(--green) !important',
    opacity: 1
  },
  '& .MuiSvgIcon-root': {
    color: 'var(--blue)'
  }
};

const datePickerPaperSx = {
  backgroundColor: 'rgba(0, 20, 61, 0.94)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
  border: '1px solid var(--reflected-light)',
  boxShadow: '0 11px 19px 1px #0000002e',
  color: 'var(--green)',
  backdropFilter: 'blur(6px)'
};

const datePickerPopperSx = {
  '& .MuiPaper-root': datePickerPaperSx,
  '& .MuiPickersLayout-root': {
    color: 'var(--blue)'
  },
  '& .MuiDayCalendar-weekDayLabel': {
    color: 'var(--blue)',
    fontWeight: 600
  },
  '& .MuiPickersCalendarHeader-label': {
    color: 'var(--blue)',
    fontWeight: 600
  },
  '& .MuiPickersArrowSwitcher-button, & .MuiPickersCalendarHeader-switchViewButton': {
    color: 'var(--blue)'
  },
  '& .MuiDateCalendar-viewTransitionContainer': {
    border: '1px solid var(--box-outline-blue)',
    borderRadius: 1,
    backgroundColor: 'rgba(0, 20, 61, 0.42)'
  },
  '& .MuiPickersDay-root': {
    color: 'var(--green)',
    borderRadius: 1,
    '&:hover': {
      backgroundColor: 'rgba(72, 247, 245, 0.12)'
    }
  },
  '& .MuiPickersDay-today': {
    border: '1px solid var(--reflected-light)'
  },
  '& .MuiPickersDay-root.Mui-selected': {
    backgroundColor: 'rgba(72, 247, 245, 0.2)',
    color: 'var(--green)',
    boxShadow: '0 0 7px -5px var(--green)'
  }
};

const datePickerSlotProps = (placeholder) => ({
  textField: {
    size: 'small',
    placeholder,
    sx: datePickerTextFieldSx
  },
  openPickerIcon: {
    sx: {
      color: 'var(--blue)'
    }
  },
  popper: {
    sx: datePickerPopperSx
  },
  desktopPaper: {
    sx: datePickerPaperSx
  },
  mobilePaper: {
    sx: datePickerPaperSx
  }
});

const DATA_TYPES = ['Environmental Data', 'PheNode Images', 'System Diagnostics Data', 'Wireless Sensor Data'];
const PHENODE_ENABLED_DATA_TYPES = ['Environmental Data', 'PheNode Images', 'System Diagnostics Data'];

const PHENODE_OPTIONS = ['PheNode 020', 'PheNode 017', 'PheNode 031', 'PheNode 105', 'PheNode 214'];

const WIRELESS_SENSOR_OPTIONS = ['WS-1234567', 'WS-1234568', 'WS-1234569', 'WS-1234570', 'WS-1234571'];

const SELECT_ALL_LABEL = 'Select All';

function SearchableMultiSelect({ placeholder, options, value, onChange, disabled = false, limitTags = -1 }) {
  const allOptions = useMemo(() => [SELECT_ALL_LABEL, ...options], [options]);

  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      limitTags={limitTags}
      options={allOptions}
      value={value}
      disabled={disabled}
      onChange={(_, newValue) => {
        if (newValue.includes(SELECT_ALL_LABEL)) {
          onChange(options);
          return;
        }
        onChange(newValue);
      }}
      renderOption={(props, option, { selected }) => (
        <li {...props}>
          <Checkbox
            checked={selected || (value.length === options.length && option === SELECT_ALL_LABEL)}
            sx={{
              p: 0.5,
              mr: 1,
              color: disabled ? 'var(--med-grey)' : 'var(--blue)',
              '&.Mui-checked': {
                color: disabled ? 'var(--med-grey)' : 'var(--green)'
              },
              '&:hover': {
                backgroundColor: 'rgba(72, 247, 245, 0.12)',
                color: disabled ? 'var(--med-grey)' : 'var(--blue)'
              },
              '&.Mui-checked:hover': {
                color: disabled ? 'var(--med-grey)' : 'var(--green)'
              }
            }}
          />
          {option}
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={placeholder}
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              ...neonControlSx,
              border: disabled ? '1px solid var(--med-grey)' : '1px solid var(--reflected-light)',
              '&.Mui-focused': {
                borderColor: disabled ? 'var(--med-grey)' : 'var(--blue)'
              },
              '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
            },
            '& .MuiInputBase-input': {
              color: disabled ? 'var(--med-grey)' : 'var(--green)',
              '&::placeholder': {
                color: disabled ? 'var(--med-grey)' : 'var(--green)',
                opacity: 1
              }
            },
            '& .MuiChip-root': disabled
              ? {
                  color: 'var(--med-grey)',
                  borderColor: 'var(--med-grey)'
                }
              : {},
            '& .MuiSvgIcon-root': { color: disabled ? 'var(--med-grey)' : 'var(--blue)' }
          }}
        />
      )}
      slotProps={{
        paper: {
          sx: neonMenuPaperSx
        },
        listbox: {
          sx: {
            p: 0.5,
            '& .MuiAutocomplete-option': {
              ...neonMenuItemSx
            }
          }
        },
        chip: {
          size: 'small',
          sx: {
            color: disabled ? 'var(--med-grey)' : 'var(--green)',
            borderColor: disabled ? 'var(--med-grey)' : 'var(--box-outline-blue)',
            backgroundColor: disabled ? 'rgba(0, 20, 61, 0.4)' : 'rgba(0, 20, 61, 0.72)'
          },
          variant: 'outlined'
        }
      }}
    />
  );
}

export default function DataDownloads() {
  const [selectedDataType, setSelectedDataType] = useState('');
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [selectedPheNodes, setSelectedPheNodes] = useState([]);
  const [selectedWirelessSensors, setSelectedWirelessSensors] = useState([]);

  const isWirelessDataType = selectedDataType === 'Wireless Sensor Data';
  const isPheNodeDataType = PHENODE_ENABLED_DATA_TYPES.includes(selectedDataType);

  useEffect(() => {
    if (!isWirelessDataType) {
      setSelectedWirelessSensors([]);
    }
  }, [isWirelessDataType]);

  useEffect(() => {
    if (!isPheNodeDataType) {
      setSelectedPheNodes([]);
    }
  }, [isPheNodeDataType]);

  const fromDateLabel = fromDate ? dayjs(fromDate).format('MM/DD/YYYY') : 'Not selected';
  const toDateLabel = toDate ? dayjs(toDate).format('MM/DD/YYYY') : 'Not selected';

  const canDownload =
    selectedDataType && (!isPheNodeDataType || selectedPheNodes.length > 0) && (!isWirelessDataType || selectedWirelessSensors.length > 0);

  return (
    <MainCard content={false} sx={{ overflow: 'hidden', ...glassSurfaceSx, ...reflectedCardChromeSx }}>
      <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 2.5 } }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            borderBottom: '1px solid',
            borderBottomColor: 'var(--orange)',
            pb: 1.25
          }}
        >
          <Typography variant="h4" sx={{ color: 'var(--blue)' }}>
            Data Downloads
          </Typography>
          <Tooltip
            title="Download Preferences"
            slotProps={{
              tooltip: {
                sx: {
                  backgroundColor: 'rgba(0, 20, 61, 0.96)',
                  color: 'var(--green)',
                  border: '1px solid var(--reflected-light)',
                  boxShadow: '0 11px 19px 1px #0000002e',
                  fontSize: '0.78rem'
                }
              }
            }}
          >
            <Box
              component={Link}
              to="/dashboard/download-preferences"
              aria-label="Preferences"
              sx={{
                minWidth: 0,
                width: 40,
                height: 40,
                px: 1,
                py: 1,
                border: '1px solid var(--reflected-light)',
                borderRadius: 1,
                backgroundColor: 'rgba(0, 17, 48, 0.03)',
                backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
                boxShadow: '0 11px 19px 1px #0000002e',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0,
                cursor: 'pointer',
                position: 'relative',
                ml: 'auto',
                textDecoration: 'none',
                '& .download-pref-icon-inactive': {
                  opacity: 1
                },
                '& .download-pref-icon-active': {
                  opacity: 0
                },
                '&:hover .download-pref-icon-inactive': {
                  opacity: 0
                },
                '&:hover .download-pref-icon-active': {
                  opacity: 1
                }
              }}
            >
              <Box sx={{ position: 'relative', width: 24, height: 24 }}>
                <Box
                  component="img"
                  src={downloadDataPreferencesInactiveIcon}
                  alt=""
                  className="download-pref-icon-inactive"
                  sx={{ width: 24, height: 24, transition: 'opacity 0.2s ease', position: 'absolute', inset: 0 }}
                />
                <Box
                  component="img"
                  src={downloadDataPreferencesActiveIcon}
                  alt=""
                  className="download-pref-icon-active"
                  sx={{ width: 24, height: 24, transition: 'opacity 0.2s ease', position: 'absolute', inset: 0 }}
                />
              </Box>
            </Box>
          </Tooltip>
        </Stack>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Card sx={{ p: { xs: 1.5, sm: 2 }, ...downloadPanelSx }}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    Date Range
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Stack spacing={0.5} sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                        To
                      </Typography>
                      <DatePicker
                        value={toDate}
                        onChange={(newValue) => setToDate(newValue)}
                        format="MM/DD/YY"
                        slotProps={datePickerSlotProps('MM/DD/YY')}
                      />
                    </Stack>
                    <Stack spacing={0.5} sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                        From
                      </Typography>
                      <DatePicker
                        value={fromDate}
                        onChange={(newValue) => setFromDate(newValue)}
                        format="MM/DD/YY"
                        slotProps={datePickerSlotProps('MM/DD/YY')}
                      />
                    </Stack>
                  </Stack>

                  <Typography variant="subtitle1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    Download Type
                  </Typography>
                  <FormControl size="small">
                    <Select
                      displayEmpty
                      value={selectedDataType}
                      onChange={(event) => setSelectedDataType(event.target.value)}
                      MenuProps={{
                        PaperProps: {
                          sx: neonMenuPaperSx
                        },
                        MenuListProps: {
                          sx: {
                            p: 0.5,
                            '& .MuiMenuItem-root': {
                              ...neonMenuItemSx
                            }
                          }
                        }
                      }}
                      sx={{
                        ...neonControlSx,
                        color: 'var(--green)',
                        '&.Mui-focused': {
                          borderColor: 'var(--blue)'
                        },
                        '& .MuiSelect-select': {
                          color: 'var(--green)'
                        },
                        '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                        '& .MuiSelect-icon': { color: 'var(--blue)' },
                        '&.Mui-disabled': {
                          color: 'var(--med-grey)',
                          border: '1px solid var(--med-grey)',
                          backgroundColor: 'rgba(0, 20, 61, 0.4)',
                          '& .MuiSelect-select': { color: 'var(--med-grey)' },
                          '& .MuiSelect-icon': { color: 'var(--med-grey)' }
                        }
                      }}
                      renderValue={(selected) => selected || 'Select Download Type..'}
                    >
                      {DATA_TYPES.map((option) => (
                        <MenuItem key={option} value={option} sx={neonMenuItemSx}>
                          {option}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Typography variant="subtitle1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    PheNode
                  </Typography>
                  <SearchableMultiSelect
                    placeholder="Select PheNode(s).."
                    options={PHENODE_OPTIONS}
                    value={selectedPheNodes}
                    onChange={setSelectedPheNodes}
                    disabled={!isPheNodeDataType}
                    limitTags={4}
                  />
                  {!isPheNodeDataType && (
                    <Typography variant="caption" sx={{ color: 'var(--med-grey)' }}>
                      PheNode selection is enabled only for Environmental Data, PheNode Images, or System Diagnostics Data.
                    </Typography>
                  )}

                  <Typography variant="subtitle1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    Wireless Sensor
                  </Typography>
                  <SearchableMultiSelect
                    placeholder="Select Wireless Sensor(s).."
                    options={WIRELESS_SENSOR_OPTIONS}
                    value={selectedWirelessSensors}
                    onChange={setSelectedWirelessSensors}
                    disabled={!isWirelessDataType}
                    limitTags={4}
                  />
                  {!isWirelessDataType && (
                    <Typography variant="caption" sx={{ color: 'var(--med-grey)' }}>
                      Wireless Sensor selection is enabled only when 'Download Type' is Wireless Sensor Data.
                    </Typography>
                  )}
                </Stack>
              </LocalizationProvider>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 6 }}>
            <Card sx={{ p: { xs: 1.5, sm: 2 }, minHeight: 260, ...downloadPanelSx }}>
              <Stack spacing={1}>
                <Typography variant="subtitle1" sx={{ color: '#646cff', fontWeight: 600 }}>
                  Download Summary
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    columnGap: 2,
                    rowGap: 1.25,
                    '& .summary-green-text': {
                      color: 'var(--green)',
                      textShadow: '0 1px 9px #1a75e0c9'
                    }
                  }}
                >
                  <Typography variant="h6" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    From:
                  </Typography>
                  <Typography className="summary-green-text" variant="h6" sx={{ textAlign: 'right', fontWeight: 600 }}>
                    {fromDateLabel}
                  </Typography>

                  <Typography variant="h6" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    To:
                  </Typography>
                  <Typography className="summary-green-text" variant="h6" sx={{ textAlign: 'right', fontWeight: 600 }}>
                    {toDateLabel}
                  </Typography>

                  <Typography variant="h6" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    Type:
                  </Typography>
                  <Typography className="summary-green-text" variant="h6" sx={{ textAlign: 'right', fontWeight: 600 }}>
                    {selectedDataType || 'Not selected'}
                  </Typography>

                  <Typography variant="h6" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    PheNodes:
                  </Typography>
                  <Typography className="summary-green-text" variant="h6" sx={{ textAlign: 'right', fontWeight: 600 }}>
                    {selectedPheNodes.length || 0}
                  </Typography>

                  <Typography variant="h6" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    Wireless Sensors:
                  </Typography>
                  <Typography className="summary-green-text" variant="h6" sx={{ textAlign: 'right', fontWeight: 600 }}>
                    {selectedWirelessSensors.length || 0}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    mt: 2,
                    mx: 0.5,
                    borderTop: '1px solid var(--box-outline-blue)'
                  }}
                />
                <Box sx={{ pt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    disabled={!canDownload}
                    startIcon={<DownloadOutlined />}
                    sx={{
                      borderColor: 'var(--blue)',
                      color: 'var(--green)',
                      backgroundColor: 'rgba(0, 20, 61, 0.72)',
                      boxShadow: '0 11px 19px 1px #0000002e',
                      transition: 'none',
                      '&.Mui-disabled': {
                        color: 'var(--med-grey)',
                        borderColor: 'var(--med-grey)',
                        backgroundColor: 'rgba(0, 20, 61, 0.4)'
                      },
                      '&.Mui-disabled:hover': {
                        backgroundColor: 'rgba(0, 20, 61, 0.4)'
                      },
                      '&:hover': {
                        borderColor: 'var(--green)',
                        boxShadow: '0 0 7px -5px var(--green)',
                        color: 'var(--green)',
                        textShadow: '0 1px 5px #007bff',
                        backgroundColor: 'rgba(72, 247, 245, 0.08)'
                      }
                    }}
                  >
                    Download
                  </Button>
                </Box>
              </Stack>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </MainCard>
  );
}
