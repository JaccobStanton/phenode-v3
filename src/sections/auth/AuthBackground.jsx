// material-ui
import Box from '@mui/material/Box';

// ==============================|| AUTH ATMOSPHERIC BACKGROUND ||============================== //
//
// Soft, layered radial glows used behind the auth screens. Colors mirror
// the project's neon palette: --green (#48f7f5) cyan and --blue (#1a76e0)
// accent, fading into the midnight backdrop.

export default function AuthBackground() {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden'
      }}
    >
      {/* Top-left cyan glow (--green) */}
      <Box
        sx={{
          position: 'absolute',
          top: '-12%',
          left: '-8%',
          width: 520,
          height: 520,
          borderRadius: '50%',
          filter: 'blur(120px)',
          opacity: 0.45,
          background: 'radial-gradient(circle, rgba(72, 247, 245, 0.45) 0%, rgba(72, 247, 245, 0.0) 70%)'
        }}
      />

      {/* Bottom-right blue glow (--blue) */}
      <Box
        sx={{
          position: 'absolute',
          bottom: '-15%',
          right: '-10%',
          width: 620,
          height: 620,
          borderRadius: '50%',
          filter: 'blur(140px)',
          opacity: 0.55,
          background: 'radial-gradient(circle, rgba(26, 118, 224, 0.55) 0%, rgba(0, 18, 68, 0.0) 70%)'
        }}
      />

      {/* Subtle center wash with the dark-blue accent */}
      <Box
        sx={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 800,
          height: 360,
          borderRadius: '50%',
          filter: 'blur(120px)',
          opacity: 0.25,
          background: 'radial-gradient(ellipse, rgba(18, 88, 170, 0.45) 0%, transparent 70%)'
        }}
      />

      {/* Faint top vignette */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 220,
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%)'
        }}
      />
    </Box>
  );
}
