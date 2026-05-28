import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
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

import useAuth from 'hooks/useAuth';
import useUserPreferences from 'hooks/data/useUserPreferences';
import { useToast } from 'providers/ToastProvider';
import { updateUserPreferences } from 'services/mutations';
import { glassSurfaceSx, reflectedCardChromeSx, neonControlSx, neonMenuPaperSx, tooltipSlotProps } from 'themes/sx-tokens';

// Multi-select variant (uses .Mui-selected styling).
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

// Sentinel the dropdown uses for "don't round" — stored on the backend as
// the string "No limit" (the rest of the digits values are integers).
const NO_LIMIT = 'No limit';
const CUSTOM_VALUE_STRATEGY = 'Flag with custom value';

// Timezone sentinel — when the user picks this option we send `zone: null`
// to the backend, which then defers to the auto-seed behavior in
// phenodeX/phenode_backend/api/preferences/routes.py:122-134 (UI timezone
// from the Display tab is copied into the download zone whenever it's
// blank). Storing an explicit zone here would silently disable that
// inheritance for the user's entire account, so the sentinel is the
// recommended default for users who want their downloads to follow the
// timezone they set in account settings.
const USE_DISPLAY_TZ_VALUE = '';
const USE_DISPLAY_TZ_LABEL = 'Match my Display Timezone (recommended)';

// Best-effort full IANA list — same recipe display-tab.jsx uses, so the two
// timezone pickers stay in sync. Falls back to a small static list if the
// runtime doesn't support `Intl.supportedValuesOf` (older Safari, etc.).
function getAllTimezones() {
  try {
    if (typeof Intl?.supportedValuesOf === 'function') {
      return Intl.supportedValuesOf('timeZone');
    }
  } catch {
    // ignore — fall through to the static list
  }
  return ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Australia/Sydney'];
}

// TextField sx for the Autocomplete — mirrors the device picker / display
// tab so the typeable timezone field reads as part of the same control
// family across the app.
const timezoneInputSx = {
  '& .MuiOutlinedInput-root': {
    ...neonControlSx,
    border: '1px solid var(--reflected-light)',
    '&.Mui-disabled': { opacity: 1 },
    '&:hover:not(.Mui-disabled)': { borderColor: 'var(--green)' },
    '&.Mui-focused:not(.Mui-disabled)': { borderColor: 'var(--green)' },
    '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
  },
  '& .MuiInputBase-input': {
    color: 'var(--green)',
    WebkitTextFillColor: 'var(--green)',
    '&::placeholder': { color: 'var(--green)', opacity: 1 }
  },
  '& .MuiSvgIcon-root': { color: 'var(--blue)' },
  '& .MuiOutlinedInput-root:hover:not(.Mui-disabled) .MuiSvgIcon-root': { color: 'var(--green)' },
  '& .MuiOutlinedInput-root.Mui-focused:not(.Mui-disabled) .MuiSvgIcon-root': { color: 'var(--green)' }
};

// Form defaults — used before preferences load and as the fallback when a
// stored preferences row is missing a field. Mirror the option lists in the
// JSX below and the legacy phenodeX DownloadPreferences defaults.
const DEFAULT_FORM = {
  errorValuesStrategy: 'Leave error',
  errorCustomValue: '',
  decimalPlacesDigits: '2',
  blankCellsStrategy: 'Replace with zero',
  blankCustomValue: '',
  // Empty string = the "Use display preferences timezone" sentinel; serializes
  // to null on save so the backend continues to inherit the UI timezone.
  timeZone: USE_DISPLAY_TZ_VALUE,
  hyphensStrategy: 'Leave hyphen'
};

// Map a backend DataDownloadPreferences object → the flat form state this
// view drives. The stored shape is:
//   { errorValues: {strategy, customValue}, blankCells: {strategy, customValue},
//     hyphens: {strategy}, decimalPlaces: {digits}, dateAndTimeFormat: {zone}, … }
// (see phenodeX/phenode_backend/schemas/user_preferences.py:DataDownloadPreferences).
function formFromPreferences(ddp) {
  if (!ddp) return { ...DEFAULT_FORM };

  // Legacy rows stored the display label "Coordinated Universal Time (GMT)"
  // in the zone field instead of the IANA "UTC"; coerce it so the picker
  // (whose options are IANA names) doesn't render an out-of-range value.
  // A missing or empty stored zone maps to the "Use display preferences
  // timezone" sentinel — that way the form correctly reflects the user
  // opting into the auto-seed behavior.
  const storedZoneRaw = ddp.dateAndTimeFormat?.zone;
  const storedZone = storedZoneRaw === 'Coordinated Universal Time (GMT)' ? 'UTC' : storedZoneRaw;
  const safeZone = typeof storedZone === 'string' && storedZone.trim() ? storedZone : USE_DISPLAY_TZ_VALUE;

  const storedDigits = ddp.decimalPlaces?.digits;

  return {
    errorValuesStrategy: ddp.errorValues?.strategy ?? DEFAULT_FORM.errorValuesStrategy,
    errorCustomValue: ddp.errorValues?.customValue ?? '',
    decimalPlacesDigits: storedDigits == null ? DEFAULT_FORM.decimalPlacesDigits : String(storedDigits),
    blankCellsStrategy: ddp.blankCells?.strategy ?? DEFAULT_FORM.blankCellsStrategy,
    blankCustomValue: ddp.blankCells?.customValue ?? '',
    timeZone: safeZone,
    hyphensStrategy: ddp.hyphens?.strategy ?? DEFAULT_FORM.hyphensStrategy
  };
}

// Normalize a form snapshot for dirty-compare: a custom value only counts
// when its strategy is actually "Flag with custom value", so typing into a
// since-hidden custom field never falsely marks the form dirty.
function normalizeForm(form) {
  return {
    errorValuesStrategy: form.errorValuesStrategy,
    errorCustomValue: form.errorValuesStrategy === CUSTOM_VALUE_STRATEGY ? form.errorCustomValue : '',
    decimalPlacesDigits: form.decimalPlacesDigits,
    blankCellsStrategy: form.blankCellsStrategy,
    blankCustomValue: form.blankCellsStrategy === CUSTOM_VALUE_STRATEGY ? form.blankCustomValue : '',
    timeZone: form.timeZone,
    hyphensStrategy: form.hyphensStrategy
  };
}

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
  const { accessToken } = useAuth();
  const toast = useToast();
  const { preferences, isLoading, error, mutate } = useUserPreferences();

  // Full IANA timezone list, computed once per mount.
  const timezones = useMemo(() => getAllTimezones(), []);

  const [errorValuesStrategy, setErrorValuesStrategy] = useState(DEFAULT_FORM.errorValuesStrategy);
  const [errorCustomValue, setErrorCustomValue] = useState(DEFAULT_FORM.errorCustomValue);
  const [decimalPlacesDigits, setDecimalPlacesDigits] = useState(DEFAULT_FORM.decimalPlacesDigits);
  const [blankCellsStrategy, setBlankCellsStrategy] = useState(DEFAULT_FORM.blankCellsStrategy);
  const [blankCustomValue, setBlankCustomValue] = useState(DEFAULT_FORM.blankCustomValue);
  const [timeZone, setTimeZone] = useState(DEFAULT_FORM.timeZone);
  const [hyphensStrategy, setHyphensStrategy] = useState(DEFAULT_FORM.hyphensStrategy);
  const [isDownloadsButtonHovered, setIsDownloadsButtonHovered] = useState(false);
  const [saving, setSaving] = useState(false);

  const showErrorCustomInput = errorValuesStrategy === CUSTOM_VALUE_STRATEGY;
  const showBlankCustomInput = blankCellsStrategy === CUSTOM_VALUE_STRATEGY;

  // Snapshot of what's currently persisted, mapped into form shape. Seeds the
  // controls on load and is the baseline for dirty-tracking.
  const loadedForm = useMemo(() => formFromPreferences(preferences?.dataDownloadPreferences), [preferences]);

  // Hydrate the controls whenever a fresh preferences object arrives (initial
  // load, or a re-fetch after save).
  useEffect(() => {
    setErrorValuesStrategy(loadedForm.errorValuesStrategy);
    setErrorCustomValue(loadedForm.errorCustomValue);
    setDecimalPlacesDigits(loadedForm.decimalPlacesDigits);
    setBlankCellsStrategy(loadedForm.blankCellsStrategy);
    setBlankCustomValue(loadedForm.blankCustomValue);
    setTimeZone(loadedForm.timeZone);
    setHyphensStrategy(loadedForm.hyphensStrategy);
  }, [loadedForm]);

  const currentForm = {
    errorValuesStrategy,
    errorCustomValue,
    decimalPlacesDigits,
    blankCellsStrategy,
    blankCustomValue,
    timeZone,
    hyphensStrategy
  };

  const isDirty = JSON.stringify(normalizeForm(currentForm)) !== JSON.stringify(normalizeForm(loadedForm));

  // Block initial render of the form until the first preferences payload
  // resolves, so we never flash defaults the user could save over their
  // real, not-yet-loaded values.
  const isInitialLoad = isLoading && !preferences;
  const loadFailed = error && !preferences;

  const handleUpdate = async () => {
    if (saving || !isDirty || !preferences) return;

    // Backend replaces data_download_preferences wholesale when this key is
    // present (routes.py:94-95 model_dump), so spread the existing stored
    // object first to preserve fields this view doesn't surface
    // (zeroValues, downsample, and any extra dateAndTimeFormat keys).
    const existing = preferences.dataDownloadPreferences || {};
    const dataDownloadPreferences = {
      ...existing,
      errorValues: {
        strategy: errorValuesStrategy,
        customValue: showErrorCustomInput ? errorCustomValue : ''
      },
      blankCells: {
        strategy: blankCellsStrategy,
        customValue: showBlankCustomInput ? blankCustomValue : ''
      },
      decimalPlaces: {
        digits: decimalPlacesDigits === NO_LIMIT ? NO_LIMIT : parseInt(decimalPlacesDigits, 10) || 1
      },
      dateAndTimeFormat: {
        ...(existing.dateAndTimeFormat || {}),
        // Sentinel ('') means "use display preferences timezone" — send null
        // so the backend's auto-seed at preferences/routes.py:122-134 stays
        // active for this user (UI timezone is mirrored into the download
        // zone whenever the download zone is blank). Sending an explicit
        // 'UTC' here would permanently disable that inheritance.
        zone: timeZone ? timeZone : null
      },
      hyphens: { strategy: hyphensStrategy }
    };

    setSaving(true);
    try {
      const updated = await updateUserPreferences({ dataDownloadPreferences }, accessToken);
      // Push the server's canonical response into the SWR cache (no re-fetch)
      // so the form re-seeds from saved data and isDirty resets to false.
      await mutate(updated, { revalidate: false });
      toast.success('Your download preferences have been saved.');
    } catch (err) {
      const detail = err?.detail;
      toast.error(detail ? `Couldn't save: ${detail}` : "Couldn't save your download preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainCard content={false} sx={{ width: '100%', minWidth: 0, overflow: 'hidden', ...glassSurfaceSx, ...reflectedCardChromeSx }}>
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

          <Tooltip title="Data Downloads" slotProps={tooltipSlotProps}>
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
                border: isDownloadsButtonHovered ? '1px solid var(--green)' : '1px solid var(--reflected-light)',
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

      {isInitialLoad ? (
        <Stack alignItems="center" sx={{ py: 6, gap: 1.5 }}>
          <CircularProgress sx={{ color: 'var(--green)' }} size={28} />
          <Typography sx={{ color: 'var(--blue)', fontSize: '0.9rem' }}>Loading your preferences…</Typography>
        </Stack>
      ) : loadFailed ? (
        <Stack alignItems="center" sx={{ py: 6, gap: 1 }}>
          <Typography sx={{ color: 'var(--orange)', fontWeight: 600 }}>We couldn&apos;t load your preferences.</Typography>
          <Typography sx={{ color: 'var(--blue)', fontSize: '0.85rem', opacity: 0.85 }}>
            Try refreshing the page. If this keeps happening, contact support.
          </Typography>
        </Stack>
      ) : (
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
              <PreferenceBox title="Time zone for CSV download timestamps...">
                <Autocomplete
                  options={[USE_DISPLAY_TZ_VALUE, ...timezones]}
                  getOptionLabel={(opt) => (opt === USE_DISPLAY_TZ_VALUE ? USE_DISPLAY_TZ_LABEL : opt)}
                  isOptionEqualToValue={(a, b) => a === b}
                  value={timeZone}
                  // Autocomplete passes `null` when cleared; we keep the
                  // sentinel as the canonical "no explicit zone" value so
                  // the dirty-compare and the save-time null serialization
                  // both stay simple.
                  onChange={(_e, next) => setTimeZone(next ?? USE_DISPLAY_TZ_VALUE)}
                  disableClearable
                  autoHighlight
                  renderInput={(params) => <TextField {...params} placeholder={USE_DISPLAY_TZ_LABEL} size="small" sx={timezoneInputSx} />}
                  slotProps={{
                    paper: { sx: { ...neonMenuPaperSx, maxHeight: 360 } },
                    listbox: {
                      sx: {
                        p: 0.5,
                        '& .MuiAutocomplete-option': { ...neonMenuItemSx, fontSize: '0.85rem' }
                      }
                    }
                  }}
                />
                <Typography variant="caption" sx={{ color: 'var(--blue)', fontSize: '0.72rem', lineHeight: 1.4 }}>
                  Applies only to timestamps in CSV downloads. The app&apos;s charts, sensor cards, and map use the Display Timezone you set
                  on Account Settings. Pick a specific zone here to override that default for downloads, or leave on &quot;Match my Display
                  Timezone&quot; to keep them in sync.
                </Typography>
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

          <Box sx={{ mt: 2.5, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5 }}>
            {isDirty && !saving && (
              <Typography sx={{ fontSize: '0.78rem', color: 'var(--orange)', fontStyle: 'italic' }}>You have unsaved changes.</Typography>
            )}
            <Button
              variant="outlined"
              onClick={handleUpdate}
              disabled={!isDirty || saving}
              startIcon={saving ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : null}
              sx={{
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
              }}
            >
              {saving ? 'Updating…' : 'Update Preferences'}
            </Button>
          </Box>
        </Box>
      )}
    </MainCard>
  );
}
