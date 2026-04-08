import { useState } from 'react';
import { Link } from 'react-router-dom';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';
import downloadIconActive from 'assets/toggle_buttons/Download_Icon_Active.svg';
import downloadIconInactive from 'assets/toggle_buttons/Download_Icon_Inactive.svg';

const glassSurfaceSx = {
  backgroundColor: 'rgba(0, 17, 48, 0.03)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))'
};

const reflectedCardChromeSx = {
  border: '1px solid var(--reflected-light)',
  boxShadow: '0 11px 19px 1px #0000002e'
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

const preferenceSelectSx = {
  ...neonControlSx,
  color: 'var(--green)',
  '& .MuiSelect-select': {
    color: 'var(--green)'
  },
  '& .MuiOutlinedInput-notchedOutline': {
    border: 'none'
  },
  '& .MuiSelect-icon': {
    color: 'var(--blue)'
  }
};

function PreferenceBox({ title, children }) {
  return (
    <Card
      sx={{
        p: 1.75,
        height: '100%',
        ...reflectedCardChromeSx,
        boxShadow: 'none',
        backgroundColor: 'var(--drf)',
        backgroundImage: 'none'
      }}
    >
      <Stack spacing={1.25}>
        <Typography variant="subtitle1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
          {title}
        </Typography>
        {children}
      </Stack>
    </Card>
  );
}

export default function DownloadPreferences() {
  const [errorValuesStrategy, setErrorValuesStrategy] = useState('Leave error');
  const [errorCustomValue, setErrorCustomValue] = useState('');
  const [decimalPlacesDigits, setDecimalPlacesDigits] = useState('2');
  const [blankCellsStrategy, setBlankCellsStrategy] = useState('Replace with zero');
  const [blankCustomValue, setBlankCustomValue] = useState('');
  const [timeZone, setTimeZone] = useState('UTC');
  const [hyphensStrategy, setHyphensStrategy] = useState('Leave hyphen');
  const [isDownloadsButtonHovered, setIsDownloadsButtonHovered] = useState(false);

  const showErrorCustomInput = errorValuesStrategy === 'Flag with custom value';
  const showBlankCustomInput = blankCellsStrategy === 'Flag with custom value';

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
            Download Preferences
          </Typography>

          <Tooltip
            title="Data Downloads"
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
              to="/dashboard/data-download"
              aria-label="Back to Data Downloads"
              onMouseEnter={() => setIsDownloadsButtonHovered(true)}
              onMouseLeave={() => setIsDownloadsButtonHovered(false)}
              onFocus={() => setIsDownloadsButtonHovered(true)}
              onBlur={() => setIsDownloadsButtonHovered(false)}
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
                cursor: 'pointer',
                color: 'var(--blue)',
                textDecoration: 'none'
              }}
            >
              <Box
                component="img"
                src={isDownloadsButtonHovered ? downloadIconActive : downloadIconInactive}
                alt="Data Downloads"
                sx={{ width: 24, height: 24 }}
              />
            </Box>
          </Tooltip>
        </Stack>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6, xl: 4 }}>
            <PreferenceBox title="In the case of error values...">
              <FormControl size="small">
                <Select
                  value={errorValuesStrategy}
                  onChange={(event) => setErrorValuesStrategy(event.target.value)}
                  MenuProps={{
                    PaperProps: { sx: neonMenuPaperSx },
                    MenuListProps: {
                      sx: {
                        p: 0.5,
                        '& .MuiMenuItem-root': { ...neonMenuItemSx }
                      }
                    }
                  }}
                  sx={preferenceSelectSx}
                >
                  <MenuItem value="Leave error" sx={neonMenuItemSx}>
                    Leave error
                  </MenuItem>
                  <MenuItem value="Replace with zero" sx={neonMenuItemSx}>
                    Replace with zero
                  </MenuItem>
                  <MenuItem value="Flag with custom value" sx={neonMenuItemSx}>
                    Flag with custom value
                  </MenuItem>
                </Select>
              </FormControl>

              {showErrorCustomInput && (
                <TextField
                  size="small"
                  placeholder="Enter custom value"
                  value={errorCustomValue}
                  onChange={(event) => setErrorCustomValue(event.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      ...neonControlSx,
                      '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
                    },
                    '& .MuiInputBase-input': {
                      color: 'var(--green)',
                      '&::placeholder': { color: 'var(--green)', opacity: 1 }
                    }
                  }}
                />
              )}
            </PreferenceBox>
          </Grid>

          <Grid size={{ xs: 12, md: 6, xl: 4 }}>
            <PreferenceBox title="Desired number of decimal places...">
              <FormControl size="small">
                <Select
                  value={decimalPlacesDigits}
                  onChange={(event) => setDecimalPlacesDigits(event.target.value)}
                  MenuProps={{
                    PaperProps: { sx: neonMenuPaperSx },
                    MenuListProps: {
                      sx: {
                        p: 0.5,
                        '& .MuiMenuItem-root': { ...neonMenuItemSx }
                      }
                    }
                  }}
                  sx={preferenceSelectSx}
                >
                  <MenuItem value="1" sx={neonMenuItemSx}>
                    1
                  </MenuItem>
                  <MenuItem value="2" sx={neonMenuItemSx}>
                    2
                  </MenuItem>
                  <MenuItem value="3" sx={neonMenuItemSx}>
                    3
                  </MenuItem>
                  <MenuItem value="4" sx={neonMenuItemSx}>
                    4
                  </MenuItem>
                  <MenuItem value="No limit" sx={neonMenuItemSx}>
                    No limit
                  </MenuItem>
                </Select>
              </FormControl>
            </PreferenceBox>
          </Grid>

          <Grid size={{ xs: 12, md: 6, xl: 4 }}>
            <PreferenceBox title="In the case of blank cells...">
              <FormControl size="small">
                <Select
                  value={blankCellsStrategy}
                  onChange={(event) => setBlankCellsStrategy(event.target.value)}
                  MenuProps={{
                    PaperProps: { sx: neonMenuPaperSx },
                    MenuListProps: {
                      sx: {
                        p: 0.5,
                        '& .MuiMenuItem-root': { ...neonMenuItemSx }
                      }
                    }
                  }}
                  sx={preferenceSelectSx}
                >
                  <MenuItem value="Replace with zero" sx={neonMenuItemSx}>
                    Replace with zero
                  </MenuItem>
                  <MenuItem value="Leave cell blank" sx={neonMenuItemSx}>
                    Leave cell blank
                  </MenuItem>
                  <MenuItem value="Flag with custom value" sx={neonMenuItemSx}>
                    Flag with custom value
                  </MenuItem>
                </Select>
              </FormControl>

              {showBlankCustomInput && (
                <TextField
                  size="small"
                  placeholder="Enter custom value"
                  value={blankCustomValue}
                  onChange={(event) => setBlankCustomValue(event.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      ...neonControlSx,
                      '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
                    },
                    '& .MuiInputBase-input': {
                      color: 'var(--green)',
                      '&::placeholder': { color: 'var(--green)', opacity: 1 }
                    }
                  }}
                />
              )}
            </PreferenceBox>
          </Grid>

          <Grid size={{ xs: 12, md: 6, xl: 4 }}>
            <PreferenceBox title="Select a time zone...">
              <FormControl size="small">
                <Select
                  value={timeZone}
                  onChange={(event) => setTimeZone(event.target.value)}
                  MenuProps={{
                    PaperProps: { sx: neonMenuPaperSx },
                    MenuListProps: {
                      sx: {
                        p: 0.5,
                        '& .MuiMenuItem-root': { ...neonMenuItemSx }
                      }
                    }
                  }}
                  sx={preferenceSelectSx}
                >
                  <MenuItem value="UTC" sx={neonMenuItemSx}>
                    Coordinated Universal Time (GMT)
                  </MenuItem>
                  <MenuItem value="America/New_York" sx={neonMenuItemSx}>
                    Eastern Standard Time (GMT-5)
                  </MenuItem>
                  <MenuItem value="America/Chicago" sx={neonMenuItemSx}>
                    Central Standard Time (GMT-6)
                  </MenuItem>
                  <MenuItem value="America/Denver" sx={neonMenuItemSx}>
                    Mountain Standard Time (GMT-7)
                  </MenuItem>
                  <MenuItem value="America/Los_Angeles" sx={neonMenuItemSx}>
                    Pacific Standard Time (GMT-8)
                  </MenuItem>
                  <MenuItem value="Australia/Sydney" sx={neonMenuItemSx}>
                    Australian Eastern Standard Time (GMT+10)
                  </MenuItem>
                </Select>
              </FormControl>
            </PreferenceBox>
          </Grid>

          <Grid size={{ xs: 12, md: 6, xl: 4 }}>
            <PreferenceBox title="In the case of hyphens...">
              <FormControl size="small">
                <Select
                  value={hyphensStrategy}
                  onChange={(event) => setHyphensStrategy(event.target.value)}
                  MenuProps={{
                    PaperProps: { sx: neonMenuPaperSx },
                    MenuListProps: {
                      sx: {
                        p: 0.5,
                        '& .MuiMenuItem-root': { ...neonMenuItemSx }
                      }
                    }
                  }}
                  sx={preferenceSelectSx}
                >
                  <MenuItem value="Leave hyphen" sx={neonMenuItemSx}>
                    Leave hyphen
                  </MenuItem>
                  <MenuItem value="Replace with underscore" sx={neonMenuItemSx}>
                    Replace with underscore
                  </MenuItem>
                  <MenuItem value="Delete hyphen" sx={neonMenuItemSx}>
                    Delete hyphen
                  </MenuItem>
                </Select>
              </FormControl>
            </PreferenceBox>
          </Grid>
        </Grid>

        <Box sx={{ mt: 2.5, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            sx={{
              borderColor: 'var(--blue)',
              color: 'var(--green)',
              backgroundColor: 'rgba(0, 20, 61, 0.72)',
              boxShadow: '0 11px 19px 1px #0000002e',
              transition: 'none',
              '&:hover': {
                borderColor: 'var(--green)',
                boxShadow: '0 0 7px -5px var(--green)',
                color: 'var(--green)',
                textShadow: '0 1px 5px #007bff',
                backgroundColor: 'rgba(72, 247, 245, 0.08)'
              }
            }}
          >
            Update Preferences
          </Button>
        </Box>
      </Box>
    </MainCard>
  );
}
