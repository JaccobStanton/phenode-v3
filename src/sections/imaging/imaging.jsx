import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

import MainCard from 'components/MainCard';
import mockImage1 from 'assets/mock-images/D3_1F_20_E1_49_B7-1764522192573.jpg';
import mockImage2 from 'assets/mock-images/D3_1F_20_E1_49_B7-1769714749408.jpg';
import mockImage3 from 'assets/mock-images/D3_1F_20_E1_49_B7-1770138236808.jpg';
import mockImage4 from 'assets/mock-images/D3_1F_20_E1_49_B7-1771270350213.jpg';
import mockImage5 from 'assets/mock-images/D3_1F_20_E1_49_B7-1772221035999.jpg';
import mockImage6 from 'assets/mock-images/D3_1F_20_E1_49_B7-1772989423177.jpg';

import DownloadOutlined from '@ant-design/icons/DownloadOutlined';
import InfoCircleOutlined from '@ant-design/icons/InfoCircleOutlined';
import LeftOutlined from '@ant-design/icons/LeftOutlined';
import RightOutlined from '@ant-design/icons/RightOutlined';

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

const carouselImages = [
  { id: 'capture-001', name: 'D3_1F_20_E1_49_B7-1764522192573.jpg', src: mockImage1 },
  { id: 'capture-002', name: 'D3_1F_20_E1_49_B7-1769714749408.jpg', src: mockImage2 },
  { id: 'capture-003', name: 'D3_1F_20_E1_49_B7-1770138236808.jpg', src: mockImage3 },
  { id: 'capture-004', name: 'D3_1F_20_E1_49_B7-1771270350213.jpg', src: mockImage4 },
  { id: 'capture-005', name: 'D3_1F_20_E1_49_B7-1772221035999.jpg', src: mockImage5 },
  { id: 'capture-006', name: 'D3_1F_20_E1_49_B7-1772989423177.jpg', src: mockImage6 }
];

const imagingTableBorder = '1px solid var(--reflected-light)';
const imagingTableHeaderBg = 'rgb(8, 36, 82)';

const parseTimestampFromImageName = (name) => {
  const match = name.match(/-(\d+)\.jpg$/i);
  return match ? Number(match[1]) : Date.now();
};

const carouselImageEntries = carouselImages
  .map((image) => {
    const timestamp = parseTimestampFromImageName(image.name);
    return {
      ...image,
      timestamp,
      date: dayjs(timestamp).format('MM/DD/YYYY'),
      time: dayjs(timestamp).format('hh:mm A')
    };
  })
  .sort((a, b) => a.timestamp - b.timestamp);

const imageTableRows = carouselImageEntries.map((image, index) => ({
  id: `row-${String(index + 1).padStart(3, '0')}`,
  imageName: image.name,
  date: image.date,
  time: image.time,
  timestamp: image.timestamp
}));

export default function Imaging() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [page, setPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadedCount, setDownloadedCount] = useState(0);
  const rowsPerPage = 10;

  const currentImage = carouselImageEntries[currentImageIndex] || carouselImageEntries[0];
  const lastCapturedImage = carouselImageEntries[carouselImageEntries.length - 1];
  const filteredRows = useMemo(() => {
    return imageTableRows.filter((row) => {
      const capturedAt = dayjs(row.timestamp);
      if (toDate && capturedAt.isAfter(dayjs(toDate).endOf('day'))) return false;
      if (fromDate && capturedAt.isBefore(dayjs(fromDate).startOf('day'))) return false;
      return true;
    });
  }, [fromDate, toDate]);
  const filteredRowIds = useMemo(() => filteredRows.map((row) => row.id), [filteredRows]);
  const selectedFilteredCount = useMemo(
    () => filteredRows.filter((row) => selectedRows.includes(row.id)).length,
    [filteredRows, selectedRows]
  );
  const allSelected = filteredRows.length > 0 && selectedFilteredCount === filteredRows.length;
  const someSelected = selectedFilteredCount > 0 && !allSelected;
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, page]);
  const pageStartIndex = filteredRows.length === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const pageEndIndex = Math.min(page * rowsPerPage, filteredRows.length);
  const totalImagesToDownload = selectedRows.length;
  const estimatedDownloadSizeMb = (totalImagesToDownload * 4.2).toFixed(1);
  const downloadProgress = totalImagesToDownload > 0 ? (downloadedCount / totalImagesToDownload) * 100 : 0;

  const handlePreviousImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? carouselImageEntries.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev === carouselImageEntries.length - 1 ? 0 : prev + 1));
  };

  const handleToggleRow = (rowId) => {
    setSelectedRows((prev) => (prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]));
  };

  const handleToggleAllRows = () => {
    setSelectedRows((prev) => {
      if (allSelected) {
        return prev.filter((id) => !filteredRowIds.includes(id));
      }
      return [...new Set([...prev, ...filteredRowIds])];
    });
  };

  const handleDownload = () => {
    if (!totalImagesToDownload) return;
    setDownloadedCount(0);
    setIsDownloading(true);
  };

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  useEffect(() => {
    if (!isDownloading) return;
    if (totalImagesToDownload === 0 || downloadedCount >= totalImagesToDownload) {
      setIsDownloading(false);
      return;
    }

    const timer = setTimeout(() => {
      setDownloadedCount((prev) => Math.min(prev + 1, totalImagesToDownload));
    }, 320);

    return () => clearTimeout(timer);
  }, [isDownloading, downloadedCount, totalImagesToDownload]);

  return (
    <MainCard content={false} sx={{ overflow: 'hidden', ...glassSurfaceSx, ...reflectedCardChromeSx }}>
      <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 2.5 } }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
          sx={{
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            width: '100%',
            borderBottom: '1px solid',
            borderBottomColor: 'var(--orange)',
            pb: 1.25
          }}
        >
          <Typography variant="h4" sx={{ color: 'var(--blue)' }}>
            Imaging
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{
              textAlign: { xs: 'left', md: 'right' },
              width: { xs: '100%', md: 'auto' },
              display: { xs: 'flex', md: 'block' },
              alignItems: { xs: 'center', md: 'unset' }
            }}
          >
            <Box component="span" sx={{ color: 'var(--blue)' }}>
              Last Image Captured:
            </Box>
            <Box component="span" sx={{ color: 'var(--green)', ml: { xs: 'auto', md: 1.5 }, display: 'inline-block', textAlign: 'right' }}>
              {lastCapturedImage ? `${lastCapturedImage.date}, ${lastCapturedImage.time}` : 'N/A'}
            </Box>
          </Typography>
        </Stack>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, lg: 12 }}>
            <Card
              sx={{
                position: 'relative',
                minHeight: { xs: 380, sm: 480, lg: 560 },
                overflow: 'hidden',
                backgroundColor: 'var(--drf)',
                backgroundImage: 'none',
                ...reflectedCardChromeSx
              }}
            >
              <IconButton
                aria-label="previous image"
                onClick={handlePreviousImage}
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: 16,
                  transform: 'translateY(-50%)',
                  zIndex: 2,
                  color: 'var(--green)',
                  backgroundColor: 'rgba(0, 20, 61, 0.72)',
                  border: '1px solid var(--reflected-light)',
                  boxShadow: '0 11px 19px 1px #0000002e',
                  '&:hover': {
                    backgroundColor: 'rgba(72, 247, 245, 0.08)'
                  }
                }}
              >
                <LeftOutlined />
              </IconButton>

              <IconButton
                aria-label="next image"
                onClick={handleNextImage}
                sx={{
                  position: 'absolute',
                  top: '50%',
                  right: 16,
                  transform: 'translateY(-50%)',
                  zIndex: 2,
                  color: 'var(--green)',
                  backgroundColor: 'rgba(0, 20, 61, 0.72)',
                  border: '1px solid var(--reflected-light)',
                  boxShadow: '0 11px 19px 1px #0000002e',
                  '&:hover': {
                    backgroundColor: 'rgba(72, 247, 245, 0.08)'
                  }
                }}
              >
                <RightOutlined />
              </IconButton>

              <Box
                sx={{
                  position: 'relative',
                  zIndex: 1,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  px: { xs: 6, sm: 7 },
                  pt: { xs: 3, sm: 3.5 },
                  pb: { xs: 11, sm: 12 }
                }}
              >
                <Box
                  component="img"
                  src={currentImage.src}
                  alt={currentImage.name}
                  sx={{
                    width: 'auto',
                    height: 'auto',
                    maxWidth: '100%',
                    maxHeight: { xs: 320, sm: 430, lg: 820 },
                    objectFit: 'contain',
                    border: '1px solid var(--reflected-light)',
                    borderRadius: 1,
                    filter: 'drop-shadow(0 12px 24px rgba(0, 0, 0, 0.35))'
                  }}
                />
              </Box>

              <Box
                sx={{
                  position: 'absolute',
                  left: { xs: 16, sm: 20 },
                  bottom: { xs: 16, sm: 18 },
                  zIndex: 2
                }}
              >
                <Typography variant="subtitle1" sx={{ color: 'var(--green)', fontWeight: 600 }}>
                  {currentImage.name}
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--blue)' }}>
                  {currentImage.date} | {currentImage.time}
                </Typography>
              </Box>

              <Stack
                direction="row"
                spacing={0.75}
                sx={{
                  position: 'absolute',
                  left: '50%',
                  bottom: 16,
                  transform: 'translateX(-50%)',
                  zIndex: 2
                }}
              >
                {carouselImageEntries.map((image, index) => (
                  <Tooltip
                    key={image.id}
                    title={image.name}
                    arrow={false}
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
                      component="button"
                      type="button"
                      onClick={() => setCurrentImageIndex(index)}
                      sx={{
                        width: index === currentImageIndex ? 28 : 10,
                        height: 10,
                        borderRadius: 999,
                        border: '1px solid var(--reflected-light)',
                        backgroundColor: index === currentImageIndex ? 'var(--green)' : 'rgba(72, 247, 245, 0.18)',
                        boxShadow: index === currentImageIndex ? '0 0 8px var(--green)' : 'none',
                        p: 0,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    />
                  </Tooltip>
                ))}
              </Stack>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 12 }} sx={{ order: { xs: 3, lg: 3 } }}>
            <Card sx={{ p: { xs: 1.5, sm: 2 }, height: 'fit-content', ...glassSurfaceSx, ...reflectedCardChromeSx }}>
              <Stack spacing={1}>
                <Typography variant="subtitle1" sx={{ color: '#646cff', fontWeight: 600 }}>
                  Description:
                </Typography>

                <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 1.25 }}>
                  <Typography variant="h6" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    Total Images:
                  </Typography>
                  <Typography variant="h6" sx={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>
                    {carouselImageEntries.length}
                  </Typography>

                  <Typography variant="h6" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    PheNode Taken From:
                  </Typography>
                  <Typography variant="h6" sx={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>
                    12:34:56:78
                  </Typography>

                  <Typography variant="h6" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    Date:
                  </Typography>
                  <Typography variant="h6" sx={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>
                    {currentImage.date}
                  </Typography>

                  <Typography variant="h6" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    Images To Download:
                  </Typography>
                  <Typography variant="h6" sx={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>
                    {totalImagesToDownload}
                  </Typography>
                </Box>

                {/* <Box
                  sx={{
                    mt: 2,
                    mx: 0.5,
                    borderTop: '1px solid var(--box-outline-blue)'
                  }}
                /> */}
                 <Box sx={{ pt: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={downloadProgress}
                    sx={{
                      height: 8,
                      borderRadius: 999,
                      backgroundColor: 'rgba(0, 20, 61, 0.45)',
                      border: '1px solid var(--reflected-light)',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: 'var(--green)',
                        boxShadow: '0 0 8px rgba(72, 247, 245, 0.65)'
                      }
                    }}
                  />
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mt: 0.75 }}>
                    <Typography variant="caption" sx={{ color: 'var(--blue)' }}>
                      {totalImagesToDownload === 0
                        ? 'Select image rows to enable download.'
                        : `Downloaded ${downloadedCount}/${totalImagesToDownload} image${totalImagesToDownload === 1 ? '' : 's'}`}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--green)', fontWeight: 600 }}>
                      {totalImagesToDownload === 0 ? '-- MB' : `${estimatedDownloadSizeMb} MB`}
                    </Typography>
                  </Stack>
                </Box>

                <Box sx={{ pt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadOutlined />}
                    onClick={handleDownload}
                    disabled={isDownloading || totalImagesToDownload === 0}
                    sx={{
                      borderColor: 'var(--orange)',
                      color: 'var(--green)',
                      backgroundColor: 'rgba(0, 20, 61, 0.72)',
                      boxShadow: '0 11px 19px 1px #0000002e',
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
                    {isDownloading ? 'Downloading...' : 'Download'}
                  </Button>
                </Box>

                {/* <Box sx={{ pt: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={downloadProgress}
                    sx={{
                      height: 8,
                      borderRadius: 999,
                      backgroundColor: 'rgba(0, 20, 61, 0.45)',
                      border: '1px solid var(--reflected-light)',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: 'var(--green)',
                        boxShadow: '0 0 8px rgba(72, 247, 245, 0.65)'
                      }
                    }}
                  />
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mt: 0.75 }}>
                    <Typography variant="caption" sx={{ color: 'var(--blue)' }}>
                      {totalImagesToDownload === 0
                        ? 'Select image rows to enable download.'
                        : `Downloaded ${downloadedCount}/${totalImagesToDownload} image${totalImagesToDownload === 1 ? '' : 's'}`}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--green)', fontWeight: 600 }}>
                      {totalImagesToDownload === 0 ? '-- MB' : `${estimatedDownloadSizeMb} MB`}
                    </Typography>
                  </Stack>
                </Box> */}
              </Stack>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 12 }} sx={{ order: { xs: 2, lg: 2 } }}>
            <Card sx={{ p: { xs: 1.5, sm: 2 }, overflow: 'hidden', ...glassSurfaceSx, ...reflectedCardChromeSx }}>
              <Stack spacing={2}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  <Typography variant="h5" sx={{ color: 'var(--blue)' }}>
                    PheNode Images
                  </Typography>
                  <Tooltip
                    title="Images are defaulted to load the last 5 taken by your PheNode."
                    arrow={false}
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
                      component="span"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--blue)',
                        cursor: 'help'
                      }}
                    >
                      <InfoCircleOutlined />
                    </Box>
                  </Tooltip>
                </Stack>

                <LocalizationProvider dateAdapter={AdapterDayjs}>
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
                </LocalizationProvider>

                <TableContainer
                  sx={{
                    maxHeight: 360,
                    backgroundColor: 'transparent',
                    border: imagingTableBorder,
                    borderRadius: 1,
                    boxShadow: '0 11px 19px 1px #0000002e',
                    '& .MuiTable-root': { backgroundColor: 'transparent' },
                    '& .MuiTableHead-root': {
                      backgroundColor: imagingTableHeaderBg,
                      borderTop: 'none',
                      borderBottom: 'none'
                    },
                    '& .MuiTableCell-stickyHeader': {
                      backgroundColor: `${imagingTableHeaderBg} !important`,
                      borderBottom: '1px solid var(--reflected-light) !important'
                      // boxShadow: 'inset 0 -1px 0 red'
                    },
                    '& .MuiTableBody-root': { backgroundColor: 'transparent' }
                  }}
                >
                  <Table stickyHeader aria-label="imaging table">
                    <TableHead>
                      <TableRow
                        sx={{
                          '& th': {
                            position: 'sticky',
                            top: 0,
                            zIndex: 1,
                            backgroundColor: imagingTableHeaderBg,
                            color: 'var(--blue)'
                          },
                          '& th:not(:first-of-type)': {
                            textAlign: 'center'
                          }
                        }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={allSelected}
                            indeterminate={someSelected}
                            onChange={handleToggleAllRows}
                            disableRipple
                            sx={{
                              color: 'var(--blue)',
                              '&.Mui-checked': { color: 'var(--green)' },
                              '&.MuiCheckbox-indeterminate': { color: 'var(--green)' },
                              '&:hover': {
                                backgroundColor: 'rgba(72, 247, 245, 0.08)'
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell align="center">Image Name</TableCell>
                        <TableCell align="center">Date</TableCell>
                        <TableCell align="center">Time</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ color: 'var(--blue)' }}>
                            No images found for the selected range.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedRows.map((row) => {
                          const isSelected = selectedRows.includes(row.id);

                          return (
                            <TableRow
                              key={row.id}
                              hover
                              selected={isSelected}
                              sx={{
                                '& .MuiTableCell-root': {
                                  borderBottom: '1px solid rgba(118, 76, 235, 0.12)'
                                },
                                '&:hover': {
                                  backgroundColor: 'rgba(72, 247, 245, 0.04)'
                                },
                                '&.Mui-selected': {
                                  backgroundColor: 'rgba(72, 247, 245, 0.08)'
                                },
                                '&.Mui-selected:hover': {
                                  backgroundColor: 'rgba(72, 247, 245, 0.1)'
                                }
                              }}
                            >
                              <TableCell padding="checkbox">
                                <Checkbox
                                  checked={isSelected}
                                  onChange={() => handleToggleRow(row.id)}
                                  disableRipple
                                  sx={{
                                    color: 'var(--blue)',
                                    '&.Mui-checked': { color: 'var(--green)' },
                                    '&:hover': {
                                      backgroundColor: 'rgba(72, 247, 245, 0.08)'
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell align="center" sx={{ color: 'var(--green)' }}>
                                {row.imageName}
                              </TableCell>
                              <TableCell align="center" sx={{ color: 'var(--green)' }}>
                                {row.date}
                              </TableCell>
                              <TableCell align="center" sx={{ color: 'var(--green)' }}>
                                {row.time}
                              </TableCell>
                              <TableCell align="center">
                                <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', alignItems: 'center' }}>
                                  <Button
                                    variant="text"
                                    disableRipple
                                    sx={{
                                      minWidth: 0,
                                      px: 0.75,
                                      py: 0.25,
                                      color: 'var(--blue)',
                                      textTransform: 'none',
                                      borderRadius: 0.75,
                                      '&:hover': {
                                        backgroundColor: 'transparent',
                                        color: 'var(--green)'
                                      }
                                    }}
                                  >
                                    View
                                  </Button>
                                  <Typography component="span" sx={{ color: 'var(--medium-grey)' }}>
                                    |
                                  </Typography>
                                  <Button
                                    variant="text"
                                    disableRipple
                                    sx={{
                                      minWidth: 0,
                                      px: 0.75,
                                      py: 0.25,
                                      color: 'var(--blue)',
                                      textTransform: 'none',
                                      borderRadius: 0.75,
                                      '&:hover': {
                                        backgroundColor: 'transparent',
                                        color: 'var(--critical)'
                                      }
                                    }}
                                  >
                                    Delete
                                  </Button>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Divider sx={{ borderColor: 'rgba(118, 76, 235, 0.16)' }} />
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.25}
                  sx={{ justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Typography variant="caption" sx={{ color: 'var(--blue)' }}>
                    {filteredRows.length === 0
                      ? 'Showing 0 images'
                      : `Showing ${pageStartIndex}-${pageEndIndex} of ${filteredRows.length} images`}
                  </Typography>
                  <Pagination
                    page={page}
                    count={pageCount}
                    onChange={(_, value) => setPage(value)}
                    shape="rounded"
                    size="small"
                    sx={{
                      '& .MuiPaginationItem-root': {
                        color: 'var(--blue)',
                        borderColor: 'var(--reflected-light)'
                      },
                      '& .MuiPaginationItem-root.Mui-selected': {
                        color: 'var(--green)',
                        backgroundColor: 'rgba(72, 247, 245, 0.14)'
                      }
                    }}
                  />
                </Stack>
              </Stack>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </MainCard>
  );
}
