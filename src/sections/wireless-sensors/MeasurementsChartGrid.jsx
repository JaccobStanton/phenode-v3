import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LineChart } from '@mui/x-charts/LineChart';

import ZoomInOutlined from '@ant-design/icons/ZoomInOutlined';

import { reflectedCardChromeSx, chartSurfaceSx } from 'themes/sx-tokens';

/**
 * Renders the responsive grid of mini line-charts shown on Sensor Network
 * (and any future page that needs the same "small multiples" view).
 *
 * @param {Object} props
 * @param {Array} props.charts  - [{ title, lineColor, data: number[] }]
 * @param {string[]} props.timeLabels
 * @param {'row'|'column'} props.layout
 */
export default function MeasurementsChartGrid({ charts, timeLabels, layout = 'row' }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1.5,
        gridTemplateColumns:
          layout === 'row' ? { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } : '1fr'
      }}
    >
      {charts.map((chart) => {
        const minVal = Math.min(...chart.data);
        const maxVal = Math.max(...chart.data);
        const pad = Math.max(0.1, (maxVal - minVal) * 0.04);

        return (
          <Box
            key={chart.title}
            sx={{
              borderRadius: 1,
              p: { xs: 0.45, sm: 0.65 },
              minHeight: { xs: 260, sm: 286 },
              display: 'flex',
              flexDirection: 'column',
              ...chartSurfaceSx,
              ...reflectedCardChromeSx
            }}
          >
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
              <Typography variant="subtitle1" sx={{ color: 'var(--blue)', ml: 1.25 }}>
                {chart.title}
              </Typography>
              <IconButton aria-label={`zoom ${chart.title}`} size="small" sx={{ color: 'var(--blue)' }}>
                <ZoomInOutlined />
              </IconButton>
            </Stack>

            <LineChart
              xAxis={[
                {
                  id: `${chart.title}-x`,
                  scaleType: 'point',
                  data: timeLabels,
                  tickLabelInterval: (_, index) => index === 0 || index === timeLabels.length - 1 || index % 4 === 0,
                  tickLabelStyle: { fontSize: 11, fill: 'var(--green)' }
                }
              ]}
              yAxis={[
                {
                  id: `${chart.title}-y`,
                  min: minVal - pad,
                  max: maxVal + pad,
                  width: 30,
                  tickLabelStyle: { fill: 'var(--green)' },
                  valueFormatter: (value) => (Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`)
                }
              ]}
              series={[
                {
                  id: `${chart.title}-line`,
                  data: chart.data,
                  color: chart.lineColor,
                  area: true,
                  showMark: false,
                  curve: 'linear'
                }
              ]}
              grid={{ horizontal: true, vertical: true }}
              height={layout === 'row' ? 228 : 258}
              margin={{ top: 2, right: 16, bottom: 10, left: 10 }}
              hideLegend
              sx={{
                width: '100%',
                overflow: 'visible',
                '& .MuiChartsSurface-root': {
                  overflow: 'visible'
                },
                '& .MuiChartsGrid-line': {
                  stroke: 'var(--blue)',
                  strokeOpacity: 0.38,
                  strokeWidth: 0.65
                },
                '& .MuiLineElement-root': {
                  strokeWidth: 0.95,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                  filter: `drop-shadow(0 0 8px ${chart.lineColor})`
                },
                '& .MuiAreaElement-root': {
                  fillOpacity: 0.16
                },
                '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': {
                  stroke: 'rgba(232, 232, 232, 0.45)'
                },
                '& .MuiChartsAxis-tickLabel': {
                  fill: 'var(--green)',
                  fontWeight: 600
                },
                '& .MuiChartsAxis-left .MuiChartsAxis-line, & .MuiChartsAxis-bottom .MuiChartsAxis-line': {
                  stroke: 'rgba(232, 232, 232, 0.55)'
                },
                background: 'transparent',
                borderRadius: 1
              }}
            />
          </Box>
        );
      })}
    </Box>
  );
}
