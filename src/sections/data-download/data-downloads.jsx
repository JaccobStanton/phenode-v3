import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
// Subpath import (matches the rest of the codebase) — avoids
// pulling the @ant-design/icons barrel module, which can drag
// extra icon code into the chunk when tree-shaking can't fully
// eliminate the barrel's re-export side-effects.
import AntIcon from 'components/AntIcon';
import DownloadOutlined from '@ant-design/icons-svg/lib/asn/DownloadOutlined';
import { Link } from 'react-router-dom';

import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
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

import { glassSurfaceSx, reflectedCardChromeSx, neonControlSx, neonMenuPaperSx, tooltipSlotProps } from 'themes/sx-tokens';

import useAuth from 'hooks/useAuth';
import useMyDevices from 'hooks/data/useMyDevices';
import useMyWirelessSensors from 'hooks/data/useMyWirelessSensors';
import { useToast } from 'providers/ToastProvider';
import triggerBlobDownload from 'utils/triggerBlobDownload';
import {
  downloadDeviceSensorData,
  downloadDeviceHealthData,
  downloadDeviceImages,
  downloadWirelessSensorData,
  downloadAllDeviceData
} from 'services/mutations';

const downloadPanelSx = {
  border: '1px solid var(--reflected-light)',
  boxShadow: '0 11px 19px 1px #0000002e',
  backgroundColor: 'transparent',
  backgroundImage: 'none'
};

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

const datePickerTextFieldSx = {
  flex: 1,
  '& .MuiOutlinedInput-root, & .MuiPickersOutlinedInput-root': {
    ...neonControlSx,
    '& .MuiOutlinedInput-notchedOutline, & .MuiPickersOutlinedInput-notchedOutline': {
      border: 'none'
    },
    '&:hover:not(.Mui-disabled)': {
      borderColor: 'var(--green)'
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
  },
  // Year picker view — appears when the user clicks the calendar
  // header's year switcher chevron in the date picker. The default
  // styling renders year buttons in MUI's primary color (a bright
  // royal blue against the neon-on-navy popper), which reads as
  // foreign chrome. The recipe below recolors them to match the
  // calendar day cells: green text, teal hover, green-tinted
  // selected state, blue+opacity for disabled (out-of-range) years.
  //
  // Class names are MUI X v8-specific. The earlier v6/v7 selectors
  // (`.MuiPickersYear-yearButton`, `.MuiPickersMonth-monthButton`)
  // don't exist in v8 — verified against
  // node_modules/@mui/x-date-pickers/YearCalendar/yearCalendarClasses.js
  // which generates classes under `MuiYearCalendar-*`. The matching
  // month classes live under `MuiMonthCalendar-*`. State suffixes
  // are wired both as the local class (`MuiYearCalendar-selected`,
  // `MuiYearCalendar-disabled`) AND the global `Mui-selected` /
  // `Mui-disabled` — target both so the rule wins regardless of
  // which one MUI applies on a given render.
  '& .MuiYearCalendar-root': {
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(0, 68, 143, 0.6) transparent',
    '&::-webkit-scrollbar': { width: '6px' },
    '&::-webkit-scrollbar-track': { background: 'transparent' },
    '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0, 68, 143, 0.6)', borderRadius: '3px' }
  },
  '& .MuiYearCalendar-button': {
    color: 'var(--green)',
    fontWeight: 500,
    borderRadius: 1,
    transition: 'color 0.18s ease, background-color 0.18s ease',
    '&:hover, &:focus': {
      backgroundColor: 'rgba(72, 247, 245, 0.12)',
      color: 'var(--green)'
    }
  },
  '& .MuiYearCalendar-button.Mui-selected, & .MuiYearCalendar-button.MuiYearCalendar-selected': {
    backgroundColor: 'rgba(72, 247, 245, 0.2)',
    color: 'var(--green)',
    textShadow: '0 0 6px rgba(72, 247, 245, 0.45)',
    fontWeight: 700,
    '&:hover, &:focus': {
      backgroundColor: 'rgba(72, 247, 245, 0.28)'
    }
  },
  '& .MuiYearCalendar-button.Mui-disabled, & .MuiYearCalendar-button.MuiYearCalendar-disabled': {
    color: 'var(--blue)',
    opacity: 0.35
  },
  // Month picker view — parallel recipe with v8's MuiMonthCalendar-*
  // class set. Same vocabulary as the year buttons above so the two
  // views read as one cohesive surface when the user clicks through
  // year → month → day.
  '& .MuiMonthCalendar-button': {
    color: 'var(--green)',
    fontWeight: 500,
    borderRadius: 1,
    transition: 'color 0.18s ease, background-color 0.18s ease',
    '&:hover, &:focus': {
      backgroundColor: 'rgba(72, 247, 245, 0.12)',
      color: 'var(--green)'
    }
  },
  '& .MuiMonthCalendar-button.Mui-selected, & .MuiMonthCalendar-button.MuiMonthCalendar-selected': {
    backgroundColor: 'rgba(72, 247, 245, 0.2)',
    color: 'var(--green)',
    textShadow: '0 0 6px rgba(72, 247, 245, 0.45)',
    fontWeight: 700,
    '&:hover, &:focus': {
      backgroundColor: 'rgba(72, 247, 245, 0.28)'
    }
  },
  '& .MuiMonthCalendar-button.Mui-disabled, & .MuiMonthCalendar-button.MuiMonthCalendar-disabled': {
    color: 'var(--blue)',
    opacity: 0.35
  }
};

const datePickerSlotProps = (placeholder, error = false) => ({
  textField: {
    size: 'small',
    placeholder,
    // `error` paints the field's themed error state when the From/To range is
    // reversed, alongside the inline message below the pickers.
    error,
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

const WIRELESS_DATA_TYPE = 'Wireless Sensor Data';
// "All Data" bundles every feed for one device into a single ZIP.
// It lives at the bottom of the dropdown.
const ALL_DATA_TYPE = 'All Data';
const DATA_TYPES = ['Environmental Data', 'PheNode Images', 'System Diagnostics Data', WIRELESS_DATA_TYPE, ALL_DATA_TYPE];

// "Select All" sentinel for the wireless multi-select. It's an object so
// it lives in the same option vocabulary as the real {id, label} sensor
// options (Autocomplete compares options by reference / isOptionEqualToValue).
const SELECT_ALL_OPTION = { id: '__select_all__', label: 'Select All' };

// ---------------------------------------------------------------------------
// Filename helpers — mirror the ones in sections/wireless-sensors so the
// Save As name the user sees is consistent across both download surfaces.
// ---------------------------------------------------------------------------
const dateToFilenameSlug = (d) => {
  const parsed = dayjs(d);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : 'unknown';
};

const labelToFilenameSlug = (label) => {
  const trimmed = (label ?? '').trim();
  if (!trimmed) return 'phenode';
  return trimmed.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'phenode';
};

// Extension from the backend's Content-Disposition filename (CSV for the
// device feeds, ZIP for the image/wireless archives). Read from the header
// rather than hardcoded so the code survives a backend format change.
const extensionFromBackendFilename = (filename, fallback = 'csv') => {
  const m = filename ? /\.([a-z0-9]+)$/i.exec(filename) : null;
  return m ? m[1].toLowerCase() : fallback;
};

// Human-readable note for the X-Download-Bucket header. The backend
// auto-downsamples long-range exports for reliability and reports the
// interval it used ('raw', '5m', '1h', '6h', '1d', …). Returns an empty
// string for raw/missing buckets (nothing to tell the user) and a short
// "aggregated to …" sentence otherwise.
const describeDownloadBucket = (bucket) => {
  if (!bucket || bucket === 'raw') return '';
  const m = /^(\d+)([mhd])$/.exec(bucket);
  if (!m) return 'Data was aggregated for this long range.';
  const n = Number(m[1]);
  const unit = { m: 'minute', h: 'hour', d: 'day' }[m[2]];
  const interval = `${n} ${unit}${n === 1 ? '' : 's'}`;
  return `Long range — data was aggregated to ${interval} intervals.`;
};

// Shared input styling for both the single- and multi-select Autocompletes
// below — keeps the neon control look in one place.
const autocompleteInputSx = (disabled) => ({
  '& .MuiOutlinedInput-root': {
    ...neonControlSx,
    border: '1px solid var(--reflected-light)',
    '&.Mui-disabled': {
      opacity: 1
    },
    '&:hover:not(.Mui-disabled)': {
      borderColor: 'var(--green)'
    },
    '&.Mui-focused:not(.Mui-disabled)': {
      borderColor: 'var(--green)'
    },
    '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
  },
  '& .MuiInputBase-input': {
    color: disabled ? 'var(--med-grey)' : 'var(--green)',
    WebkitTextFillColor: disabled ? 'var(--med-grey)' : 'var(--green)',
    '&::placeholder': {
      color: disabled ? 'var(--med-grey)' : 'var(--green)',
      opacity: 1
    }
  },
  '& .MuiInputBase-input.Mui-disabled': {
    color: 'var(--med-grey)',
    WebkitTextFillColor: 'var(--med-grey)'
  },
  '& .MuiChip-root': {
    color: disabled ? 'var(--med-grey)' : 'var(--green)',
    borderColor: 'var(--box-outline-blue)',
    backgroundColor: 'rgba(0, 20, 61, 0.72)'
  },
  '& .MuiSvgIcon-root': { color: disabled ? 'var(--med-grey)' : 'var(--blue)' },
  '& .MuiOutlinedInput-root:hover:not(.Mui-disabled) .MuiSvgIcon-root': {
    color: 'var(--green)'
  },
  '& .MuiOutlinedInput-root.Mui-focused:not(.Mui-disabled) .MuiSvgIcon-root': {
    color: 'var(--green)'
  }
});

const optionLabel = (option) => option?.label ?? '';
const optionsEqual = (a, b) => a?.id === b?.id;

// Single-select Autocomplete (PheNode picker). Device downloads are
// per-device on the backend, so the product decision is to allow exactly
// one PheNode at a time for the PheNode-based data types.
function SearchableSelect({ placeholder, options, value, onChange, disabled = false }) {
  return (
    <Autocomplete
      options={options}
      value={value}
      disabled={disabled}
      getOptionLabel={optionLabel}
      isOptionEqualToValue={optionsEqual}
      onChange={(_, newValue) => onChange(newValue)}
      renderInput={(params) => <TextField {...params} placeholder={placeholder} size="small" sx={autocompleteInputSx(disabled)} />}
      slotProps={{
        paper: { sx: neonMenuPaperSx },
        listbox: {
          sx: {
            p: 0.5,
            '& .MuiAutocomplete-option': { ...neonMenuItemSx }
          }
        }
      }}
    />
  );
}

// Multi-select Autocomplete (wireless sensor picker) with a "Select All"
// row. Options/value are {id, label} objects.
function SearchableMultiSelect({ placeholder, options, value, onChange, disabled = false, limitTags = -1 }) {
  const allOptions = useMemo(() => [SELECT_ALL_OPTION, ...options], [options]);
  const allSelected = options.length > 0 && value.length === options.length;

  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      limitTags={limitTags}
      options={allOptions}
      value={value}
      disabled={disabled}
      getOptionLabel={optionLabel}
      isOptionEqualToValue={optionsEqual}
      onChange={(_, newValue) => {
        if (newValue.some((opt) => opt.id === SELECT_ALL_OPTION.id)) {
          onChange(allSelected ? [] : options);
          return;
        }
        onChange(newValue);
      }}
      renderOption={(props, option, { selected }) => (
        <li {...props}>
          <Checkbox
            checked={option.id === SELECT_ALL_OPTION.id ? allSelected : selected}
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
          {option.label}
        </li>
      )}
      renderInput={(params) => <TextField {...params} placeholder={placeholder} size="small" sx={autocompleteInputSx(disabled)} />}
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
            color: 'var(--green)',
            borderColor: 'var(--box-outline-blue)',
            backgroundColor: disabled ? '#01113d' : 'rgba(0, 20, 61, 0.72)'
          },
          variant: 'outlined'
        }
      }}
    />
  );
}

// Filename fragment per data type so the three device exports (which all
// come back as "phenode_*.csv" from the backend) don't collide in the
// user's downloads folder.
const TYPE_FILENAME_SLUG = {
  'Environmental Data': 'environmental',
  'System Diagnostics Data': 'diagnostics',
  'PheNode Images': 'images',
  [WIRELESS_DATA_TYPE]: 'wireless',
  [ALL_DATA_TYPE]: 'all-data'
};

export default function DataDownloads() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const { devices, isLoading: devicesLoading } = useMyDevices();
  const { sensors, isLoading: sensorsLoading } = useMyWirelessSensors();

  const [selectedDataType, setSelectedDataType] = useState('');
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [selectedPheNode, setSelectedPheNode] = useState(null);
  const [selectedWirelessSensors, setSelectedWirelessSensors] = useState([]);
  const [downloading, setDownloading] = useState(false);

  const isWirelessDataType = selectedDataType === WIRELESS_DATA_TYPE;
  const isAllDataType = selectedDataType === ALL_DATA_TYPE;
  // Every download type now targets a single PheNode. The PheNode-based
  // types export that device directly; Wireless Sensor Data uses the chosen
  // PheNode to scope which sensors are selectable — the same concept as the
  // fleet overview, where picking a device filters its connected sensors.
  const pheNodeEnabled = Boolean(selectedDataType);
  // The wireless picker only applies to the wireless type, and only once a
  // PheNode is chosen (its connected sensors are what populate the list).
  const wirelessEnabled = isWirelessDataType && selectedPheNode != null;

  // Live device/sensor lists → {id, label} option objects. id is the
  // immutable external identifier the backend download endpoints key on;
  // label is what the user sees (falls back to the id when unlabeled).
  const pheNodeOptions = useMemo(
    () =>
      (devices ?? []).map((device) => ({
        id: device.external_device_id,
        label: device.label || device.external_device_id
      })),
    [devices]
  );

  // Sensor cohort = the wireless sensors paired to the selected PheNode.
  // DeviceRead carries a `wireless_sensors[]` field of
  // { id, external_sensor_id, label } (see services/schemas/device.js); we
  // collect the external ids into a Set for O(1) membership checks below.
  // null = "no PheNode selected yet" so the options resolve to an empty list.
  const connectedSensorIds = useMemo(() => {
    if (!selectedPheNode || !devices) return null;
    const device = devices.find((d) => d.external_device_id === selectedPheNode.id);
    if (!device?.wireless_sensors?.length) return new Set();
    return new Set(device.wireless_sensors.map((s) => s.external_sensor_id));
  }, [devices, selectedPheNode]);

  // The wireless options shown to the user — the full account sensor list
  // filtered down to the selected PheNode's cohort. Empty until a PheNode is
  // picked (or when the chosen PheNode has no connected sensors).
  const wirelessOptions = useMemo(() => {
    if (!sensors || !connectedSensorIds) return [];
    return sensors
      .filter((sensor) => connectedSensorIds.has(sensor.externalSensorId))
      .map((sensor) => ({
        id: sensor.externalSensorId,
        label: sensor.label || sensor.externalSensorId
      }));
  }, [sensors, connectedSensorIds]);

  useEffect(() => {
    if (!isWirelessDataType) {
      setSelectedWirelessSensors([]);
    }
  }, [isWirelessDataType]);

  useEffect(() => {
    if (!pheNodeEnabled) {
      setSelectedPheNode(null);
    }
  }, [pheNodeEnabled]);

  // Drop any selections that no longer exist in the live lists (e.g. a
  // device was removed, or its label changed) so we never POST a stale id.
  useEffect(() => {
    setSelectedPheNode((prev) => (prev && pheNodeOptions.some((opt) => opt.id === prev.id) ? prev : null));
  }, [pheNodeOptions]);

  useEffect(() => {
    setSelectedWirelessSensors((prev) => prev.filter((sel) => wirelessOptions.some((opt) => opt.id === sel.id)));
  }, [wirelessOptions]);

  const fromValid = fromDate != null && dayjs(fromDate).isValid();
  const toValid = toDate != null && dayjs(toDate).isValid();
  // "From" must not be after "To". (Equal is allowed — a single-day window.)
  const datesValid = fromValid && toValid && !dayjs(fromDate).isAfter(dayjs(toDate));
  // Both dates picked but reversed (From later than To) — surfaced as an inline
  // error so the user understands why the download is blocked, rather than a
  // silently-disabled button.
  const datesReversed = fromValid && toValid && dayjs(fromDate).isAfter(dayjs(toDate));

  const fromDateLabel = fromValid ? dayjs(fromDate).format('MM/DD/YYYY') : 'Not selected';
  const toDateLabel = toValid ? dayjs(toDate).format('MM/DD/YYYY') : 'Not selected';

  const canDownload =
    !downloading &&
    Boolean(selectedDataType) &&
    datesValid &&
    selectedPheNode != null &&
    (!isWirelessDataType || selectedWirelessSensors.length > 0);

  const handleDownload = useCallback(async () => {
    if (!canDownload) return;

    const fromIso = dayjs(fromDate).toISOString();
    const toIso = dayjs(toDate).toISOString();
    const dateSlug = `${dateToFilenameSlug(fromDate)}_${dateToFilenameSlug(toDate)}`;
    const typeSlug = TYPE_FILENAME_SLUG[selectedDataType] || 'data';

    setDownloading(true);
    // Set by the blob endpoints from the X-Download-Bucket response header.
    // Stays null for image downloads (not a time-series export). When the
    // backend auto-downsamples a long range, this is the interval used (e.g.
    // '1h', '6h', '1d') so we can tell the user the file is aggregated.
    let downloadBucket = null;
    try {
      if (isWirelessDataType) {
        // One call, comma-separated ids → a single ZIP (one CSV per sensor).
        const sensorList = selectedWirelessSensors.map((sensor) => sensor.id).join(',');
        const { blob, filename, downloadBucket: bucket } = await downloadWirelessSensorData(sensorList, fromIso, toIso, accessToken);
        downloadBucket = bucket;
        const ext = extensionFromBackendFilename(filename, 'zip');
        triggerBlobDownload(blob, `wireless_sensors_${dateSlug}.${ext}`);
      } else if (isAllDataType) {
        // Everything for one PheNode in a single ZIP. 'none' tells the backend
        // to auto-include the wireless sensors already linked to the device.
        const deviceId = selectedPheNode.id;
        const slug = labelToFilenameSlug(selectedPheNode.label || deviceId);
        const { blob, filename, downloadBucket: bucket } = await downloadAllDeviceData(deviceId, 'none', fromIso, toIso, accessToken);
        downloadBucket = bucket;
        const ext = extensionFromBackendFilename(filename, 'zip');
        triggerBlobDownload(blob, `${slug}_${typeSlug}_${dateSlug}.${ext}`);
      } else {
        // Per-device export. The product decision is one PheNode at a time
        // (the backend device endpoints are per-device).
        const deviceId = selectedPheNode.id;
        const slug = labelToFilenameSlug(selectedPheNode.label || deviceId);

        let result;
        let fallbackExt = 'csv';
        if (selectedDataType === 'Environmental Data') {
          // Environmental Data = the PheNode's own sensors only. Pass
          // includeWirelessSensors=false so the backend doesn't bundle linked
          // wireless sensors (those have their own "Wireless Sensor Data" type).
          result = await downloadDeviceSensorData(deviceId, fromIso, toIso, accessToken, false);
        } else if (selectedDataType === 'System Diagnostics Data') {
          result = await downloadDeviceHealthData(deviceId, fromIso, toIso, accessToken);
        } else {
          // PheNode Images → ZIP archive.
          result = await downloadDeviceImages(deviceId, fromIso, toIso, accessToken);
          fallbackExt = 'zip';
        }

        downloadBucket = result.downloadBucket;
        const ext = extensionFromBackendFilename(result.filename, fallbackExt);
        triggerBlobDownload(result.blob, `${slug}_${typeSlug}_${dateSlug}.${ext}`);
      }
      // Long ranges are auto-aggregated server-side for reliability. Tell the
      // user when the file came back downsampled rather than raw so a 6-month
      // export reading "every hour" isn't mistaken for missing data.
      const aggregationNote = describeDownloadBucket(downloadBucket);
      toast.success(aggregationNote ? `Download started. ${aggregationNote}` : 'Download started.');
    } catch (err) {
      // 404 = no rows/images in the requested window — friendlier copy than
      // the generic failure so the user knows to widen the date range.
      if (err?.status === 404) {
        toast.error('No data found in this date range.');
      } else {
        const detail = err?.detail;
        toast.error(detail ? `Couldn't download: ${detail}` : "Couldn't generate the download. Please try again.");
      }
    } finally {
      setDownloading(false);
    }
  }, [
    canDownload,
    fromDate,
    toDate,
    selectedDataType,
    isWirelessDataType,
    isAllDataType,
    selectedPheNode,
    selectedWirelessSensors,
    accessToken,
    toast
  ]);

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
            Data Downloads
          </Typography>
          <Tooltip title="Download Preferences" slotProps={tooltipSlotProps}>
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
                '&:hover': {
                  borderColor: 'var(--green)'
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
                        From
                      </Typography>
                      <DatePicker
                        value={fromDate}
                        onChange={(newValue) => setFromDate(newValue)}
                        format="MM/DD/YY"
                        slotProps={datePickerSlotProps('MM/DD/YY', datesReversed)}
                      />
                    </Stack>
                    <Stack spacing={0.5} sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                        To
                      </Typography>
                      <DatePicker
                        value={toDate}
                        onChange={(newValue) => setToDate(newValue)}
                        format="MM/DD/YY"
                        slotProps={datePickerSlotProps('MM/DD/YY', datesReversed)}
                      />
                    </Stack>
                  </Stack>

                  {datesReversed && (
                    <Typography
                      variant="caption"
                      role="alert"
                      sx={{ color: 'var(--orange)', fontWeight: 600 }}
                    >
                      The “From” date is after the “To” date. Pick a “From” date that’s on or before the “To” date.
                    </Typography>
                  )}

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
                        '&:hover:not(.Mui-disabled)': {
                          borderColor: 'var(--green)',
                          '& .MuiSelect-icon': { color: 'var(--green)' }
                        },
                        '&.Mui-focused:not(.Mui-disabled)': {
                          borderColor: 'var(--green)',
                          '& .MuiSelect-icon': { color: 'var(--green)' }
                        },
                        '& .MuiSelect-select': {
                          color: 'var(--green)'
                        },
                        '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                        '& .MuiSelect-icon': { color: 'var(--blue)' },
                        '&.Mui-disabled': {
                          color: 'var(--med-grey)',
                          border: '1px solid var(--med-grey)',
                          backgroundColor: '#01113d',
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
                  <SearchableSelect
                    placeholder={devicesLoading ? 'Loading PheNodes..' : 'Select a PheNode..'}
                    options={pheNodeOptions}
                    value={selectedPheNode}
                    onChange={setSelectedPheNode}
                    disabled={!pheNodeEnabled || devicesLoading}
                  />
                  {!pheNodeEnabled && (
                    <Typography variant="caption" sx={{ color: 'var(--blue)' }}>
                      Select a Download Type to choose a PheNode.
                    </Typography>
                  )}
                  {pheNodeEnabled && isWirelessDataType && (
                    <Typography variant="caption" sx={{ color: 'var(--blue)' }}>
                      Choose a PheNode to load its connected wireless sensors.
                    </Typography>
                  )}

                  <Typography variant="subtitle1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    Wireless Sensor
                  </Typography>
                  <SearchableMultiSelect
                    placeholder={sensorsLoading ? 'Loading sensors..' : 'Select Wireless Sensor(s)..'}
                    options={wirelessOptions}
                    value={selectedWirelessSensors}
                    onChange={setSelectedWirelessSensors}
                    disabled={!wirelessEnabled || sensorsLoading}
                    limitTags={4}
                  />
                  {!isWirelessDataType && (
                    <Typography variant="caption" sx={{ color: 'var(--blue)' }}>
                      Wireless Sensor selection is enabled only when &apos;Download Type&apos; is Wireless Sensor Data.
                    </Typography>
                  )}
                  {isWirelessDataType && !selectedPheNode && (
                    <Typography variant="caption" sx={{ color: 'var(--blue)' }}>
                      Select a PheNode first to list its connected wireless sensors.
                    </Typography>
                  )}
                  {isWirelessDataType && selectedPheNode && !sensorsLoading && wirelessOptions.length === 0 && (
                    <Typography variant="caption" sx={{ color: 'var(--blue)' }}>
                      This PheNode has no connected wireless sensors.
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
                    PheNode:
                  </Typography>
                  <Typography className="summary-green-text" variant="h6" sx={{ textAlign: 'right', fontWeight: 600 }}>
                    {selectedPheNode ? selectedPheNode.label : 'Not selected'}
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
                    onClick={handleDownload}
                    startIcon={
                      downloading ? <CircularProgress size={16} sx={{ color: 'var(--green)' }} /> : <AntIcon icon={DownloadOutlined} />
                    }
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
                    {downloading ? 'Downloading…' : 'Download'}
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
