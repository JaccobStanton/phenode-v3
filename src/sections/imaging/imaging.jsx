import { useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';
import avatarGroupImage from 'assets/images/users/avatar-group.png';
import avatarOneImage from 'assets/images/users/avatar-1.png';
import avatarTwoImage from 'assets/images/users/avatar-2.png';
import avatarThreeImage from 'assets/images/users/avatar-3.png';

import DownloadOutlined from '@ant-design/icons/DownloadOutlined';
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

const carouselImages = [
  { id: 'capture-001', name: 'PheNode_020_Capture_001.png', src: avatarGroupImage, date: '02/24/2026', time: '09:14 AM' },
  { id: 'capture-002', name: 'PheNode_020_Capture_002.png', src: avatarOneImage, date: '02/24/2026', time: '09:22 AM' },
  { id: 'capture-003', name: 'PheNode_020_Capture_003.png', src: avatarTwoImage, date: '02/24/2026', time: '09:37 AM' },
  { id: 'capture-004', name: 'PheNode_020_Capture_004.png', src: avatarThreeImage, date: '02/24/2026', time: '09:48 AM' }
];

const imageTableRows = [
  { id: 'row-001', imageName: 'PheNode_020_Capture_001.png', date: '02/24/2026', time: '09:14 AM' },
  { id: 'row-002', imageName: 'PheNode_020_Capture_002.png', date: '02/24/2026', time: '09:22 AM' },
  { id: 'row-003', imageName: 'PheNode_020_Capture_003.png', date: '02/24/2026', time: '09:37 AM' },
  { id: 'row-004', imageName: 'PheNode_020_Capture_004.png', date: '02/24/2026', time: '09:48 AM' },
  { id: 'row-005', imageName: 'PheNode_020_Capture_005.png', date: '02/24/2026', time: '10:02 AM' },
  { id: 'row-006', imageName: 'PheNode_020_Capture_006.png', date: '02/24/2026', time: '10:16 AM' },
  { id: 'row-007', imageName: 'PheNode_020_Capture_007.png', date: '02/24/2026', time: '10:31 AM' },
  { id: 'row-008', imageName: 'PheNode_020_Capture_008.png', date: '02/24/2026', time: '10:46 AM' }
];

export default function Imaging() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedRows, setSelectedRows] = useState([]);

  const currentImage = carouselImages[currentImageIndex];
  const allSelected = selectedRows.length === imageTableRows.length && imageTableRows.length > 0;
  const someSelected = selectedRows.length > 0 && !allSelected;

  const handlePreviousImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? carouselImages.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev === carouselImages.length - 1 ? 0 : prev + 1));
  };

  const handleToggleRow = (rowId) => {
    setSelectedRows((prev) => (prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]));
  };

  const handleToggleAllRows = () => {
    setSelectedRows(allSelected ? [] : imageTableRows.map((row) => row.id));
  };

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
              02/24/2026, 09:48 AM
            </Box>
          </Typography>
        </Stack>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <Card
              sx={{
                position: 'relative',
                minHeight: { xs: 280, sm: 340, lg: 380 },
                overflow: 'hidden',
                ...glassSurfaceSx,
                ...reflectedCardChromeSx
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `url(${currentImage.src})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: 'blur(18px)',
                  transform: 'scale(1.08)',
                  opacity: 0.28
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(180deg, rgba(1, 20, 74, 0.26) 0%, rgba(1, 14, 49, 0.62) 100%)'
                }}
              />

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
                  px: { xs: 7.5, sm: 9 },
                  py: { xs: 3, sm: 3.5 }
                }}
              >
                <Box
                  component="img"
                  src={currentImage.src}
                  alt={currentImage.name}
                  sx={{
                    width: '100%',
                    height: '100%',
                    maxHeight: { xs: 220, sm: 280, lg: 320 },
                    objectFit: 'contain',
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
                {carouselImages.map((image, index) => (
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

          <Grid size={{ xs: 12, lg: 4 }}>
            <Card sx={{ p: { xs: 1.5, sm: 2 }, minHeight: '100%', ...glassSurfaceSx, ...reflectedCardChromeSx }}>
              <Stack spacing={1}>
                <Typography variant="subtitle1" sx={{ color: '#646cff', fontWeight: 600 }}>
                  Description:
                </Typography>

                <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 1.25 }}>
                  <Typography variant="h6" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    Total Images:
                  </Typography>
                  <Typography variant="h6" sx={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>
                    12
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
                    02/24/2026
                  </Typography>

                  <Typography variant="h6" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    Images To Download:
                  </Typography>
                  <Typography variant="h6" sx={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>
                    14
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
                    startIcon={<DownloadOutlined />}
                    sx={{
                      borderColor: 'var(--orange)',
                      color: 'var(--green)',
                      backgroundColor: 'rgba(0, 20, 61, 0.72)',
                      boxShadow: '0 11px 19px 1px #0000002e',
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

          <Grid size={{ xs: 12 }}>
            <Card sx={{ p: 0, overflow: 'hidden', ...glassSurfaceSx, ...reflectedCardChromeSx }}>
              <TableContainer sx={{ maxHeight: 360 }}>
                <Table stickyHeader aria-label="imaging table">
                  <TableHead>
                    <TableRow
                      sx={{
                        '& th': {
                          position: 'sticky',
                          top: 0,
                          zIndex: 1,
                          backgroundColor: 'rgba(0, 20, 61, 0.96)',
                          color: 'var(--blue)',
                          borderBottom: '1px solid var(--reflected-light)'
                        }
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={allSelected}
                          indeterminate={someSelected}
                          onChange={handleToggleAllRows}
                          sx={{
                            color: 'var(--blue)',
                            '&.Mui-checked': { color: 'var(--green)' },
                            '&.MuiCheckbox-indeterminate': { color: 'var(--green)' }
                          }}
                        />
                      </TableCell>
                      <TableCell>Image Name</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Time</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {imageTableRows.map((row) => {
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
                              sx={{
                                color: 'var(--blue)',
                                '&.Mui-checked': { color: 'var(--green)' }
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: 'var(--green)' }}>{row.imageName}</TableCell>
                          <TableCell sx={{ color: 'var(--green)' }}>{row.date}</TableCell>
                          <TableCell sx={{ color: 'var(--green)' }}>{row.time}</TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                              <Button variant="text" sx={{ minWidth: 0, px: 0, color: 'var(--blue)', textTransform: 'none' }}>
                                View
                              </Button>
                              <Typography component="span" sx={{ color: 'var(--medium-grey)' }}>
                                |
                              </Typography>
                              <Button variant="text" sx={{ minWidth: 0, px: 0, color: 'var(--orange)', textTransform: 'none' }}>
                                Delete
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <Divider sx={{ borderColor: 'rgba(118, 76, 235, 0.16)' }} />
            </Card>
          </Grid>
        </Grid>
      </Box>
    </MainCard>
  );
}
