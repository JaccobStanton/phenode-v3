import { useMemo, useState } from 'react';

// material-ui
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

// project imports
import useAuth from 'hooks/useAuth';
import { useToast } from 'providers/ToastProvider';
import { useAdminPendingUsers, useAdminUsers } from 'hooks/data/useAdminData';
import { adminApproveUser, adminCreateUser } from 'services/mutations';
import { glassSurfaceSx, reflectedCardChromeSx } from 'themes/sx-tokens';
import {
  themedTextFieldSx,
  themedSelectSx,
  themedDropdownMenuProps,
  fieldLabelSx,
  primaryActionButtonSx,
  formPanelSx,
  sectionTitleSx,
  subSectionTitleSx,
  tableContainerSx,
  tableHeaderCellSx,
  tableCellSx
} from '../shared';

// assets
import AntIcon from 'components/AntIcon';
import CheckOutlined from '@ant-design/icons-svg/lib/asn/CheckOutlined';
import CloseOutlined from '@ant-design/icons-svg/lib/asn/CloseOutlined';
import InfoCircleOutlined from '@ant-design/icons-svg/lib/asn/InfoCircleOutlined';
import SearchOutlined from '@ant-design/icons-svg/lib/asn/SearchOutlined';

// =============================================================================
// UserManagementTab — create users, approve pending signups, browse all users.
// =============================================================================
//
// Ports the v2 AdminPage user-management logic into the V3 theme:
//   - Add User form           → POST /admin/users/        (adminCreateUser)
//   - Pending Approval table  → GET  /admin/users/pending (useAdminPendingUsers)
//                               + POST /admin/users/approve (adminApproveUser)
//   - All Users table         → GET  /admin/users/         (useAdminUsers)
//
// Conventions matched to the rest of the app:
//   - Controls use a caption label ABOVE the field (LabeledField + fieldLabelSx)
//     with a static in-box placeholder — NOT an MUI floating `label` — so the
//     placeholder never animates up into the border. Same as the
//     account-settings display / device tabs.
//   - Tables use the imaging-table chrome (tableContainerSx / header / cell).
//   - The Add User button uses the canonical primaryActionButtonSx (identical
//     rest/hover/disabled to the data-downloads Download + account-settings
//     Save buttons).
//   - Feedback is surfaced through the global ToastProvider (green success /
//     orange error, bottom-right) — the same toast the rest of the app uses.

const ROLE_CHIP_COLOR = {
  SUPER_ADMIN: 'var(--purple)',
  ADMIN: 'var(--orange)',
  USER: 'var(--blue)'
};

const containsQuery = (value, query) =>
  String(value || '')
    .toLowerCase()
    .includes(query);

// ---------------------------------------------------------------------------
// Imaging-table style tokens — scoped to the All Users table only.
//
// Replicated 1:1 from the imaging component's table
// (sections/imaging/imaging.jsx, lines ~1257-1430) so the All Users table
// reads as the same component: transparent body, reflected-light border,
// project shadow, the always-visible themed scrollbar (overflowY: 'scroll'),
// the rgb(8,36,82) sticky header band, blue header text with non-first
// columns centered, and the teal hover / selected row washes with a faint
// purple cell underline. Kept local (not in shared.js) because only this
// table opts into the full imaging replica.
// ---------------------------------------------------------------------------
const IMAGING_TABLE_HEADER_BG = 'rgb(8, 36, 82)';

const imagingTableContainerSx = {
  maxHeight: 600,
  overflowY: 'scroll',
  backgroundColor: 'transparent',
  border: '1px solid var(--reflected-light)',
  borderRadius: 1,
  boxShadow: '0 11px 19px 1px #0000002e',
  scrollbarWidth: 'thin',
  scrollbarColor: 'rgba(0, 68, 143, 0.6) transparent',
  '&::-webkit-scrollbar': { width: '8px' },
  '&::-webkit-scrollbar-track': { background: 'transparent' },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'rgba(0, 68, 143, 0.6)',
    borderRadius: '4px',
    '&:hover': { backgroundColor: 'rgba(0, 68, 143, 0.85)' }
  },
  '& .MuiTable-root': { backgroundColor: 'transparent' },
  '& .MuiTableHead-root': { backgroundColor: IMAGING_TABLE_HEADER_BG, borderTop: 'none', borderBottom: 'none' },
  '& .MuiTableCell-stickyHeader': {
    backgroundColor: `${IMAGING_TABLE_HEADER_BG} !important`,
    borderBottom: '1px solid var(--reflected-light) !important'
  },
  '& .MuiTableBody-root': { backgroundColor: 'transparent' }
};

const imagingTableHeadRowSx = {
  '& th': { position: 'sticky', top: 0, zIndex: 1, backgroundColor: IMAGING_TABLE_HEADER_BG, color: 'var(--blue)' },
  '& th:not(:first-of-type)': { textAlign: 'center' }
};

const imagingTableBodyRowSx = {
  '& .MuiTableCell-root': { borderBottom: '1px solid rgba(118, 76, 235, 0.12)' },
  '&:hover': { backgroundColor: 'rgba(72, 247, 245, 0.04)' },
  '&.Mui-selected': { backgroundColor: 'rgba(72, 247, 245, 0.08)' },
  '&.Mui-selected:hover': { backgroundColor: 'rgba(72, 247, 245, 0.1)' }
};

const imagingTableCellSx = { color: 'var(--green)' };

// Caption-above-control field wrapper — the project's standard labeling
// pattern (see sections/account-settings/tabs/display-tab.jsx UnitSelect).
function LabeledField({ label, htmlFor, children, sx }) {
  return (
    <Box sx={sx}>
      <Typography component="label" htmlFor={htmlFor} sx={fieldLabelSx}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

// Themed search box — caption-less, static placeholder (no floating label),
// blue search icon adornment. Matches the project input chrome.
function TableSearch({ value, onChange, placeholder, maxWidth = 460 }) {
  return (
    <TextField
      size="small"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      sx={{ ...themedTextFieldSx, maxWidth, width: '100%' }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start" sx={{ color: 'var(--blue)', mr: 0.5 }}>
            <AntIcon icon={SearchOutlined} />
          </InputAdornment>
        )
      }}
    />
  );
}

function RoleChip({ role }) {
  const color = ROLE_CHIP_COLOR[(role || '').toUpperCase()] || 'var(--blue)';
  return (
    <Chip label={role || '—'} size="small" variant="outlined" sx={{ color, borderColor: color, fontWeight: 600, fontSize: '0.72rem' }} />
  );
}

function StatusChip({ approved }) {
  const color = approved ? 'var(--green)' : 'var(--orange)';
  return (
    <Chip
      label={approved ? 'Approved' : 'Pending'}
      size="small"
      variant="outlined"
      sx={{ color, borderColor: color, fontWeight: 600, fontSize: '0.72rem' }}
    />
  );
}

export default function UserManagementTab() {
  const { accessToken } = useAuth();
  const toast = useToast();

  const { pendingUsers, error: pendingError, mutate: mutatePending } = useAdminPendingUsers();
  const { users: allUsers, error: allError, mutate: mutateAll } = useAdminUsers();

  // Add User form state.
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('USER');
  const [approved, setApproved] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Search state.
  const [pendingSearch, setPendingSearch] = useState('');
  const [allSearch, setAllSearch] = useState('');

  const filteredPending = useMemo(() => {
    if (!Array.isArray(pendingUsers)) return [];
    const q = pendingSearch.trim().toLowerCase();
    if (!q) return pendingUsers;
    return pendingUsers.filter((u) => containsQuery(u.email, q) || containsQuery(u.full_name, q) || containsQuery(u.role, q));
  }, [pendingUsers, pendingSearch]);

  const filteredAll = useMemo(() => {
    if (!Array.isArray(allUsers)) return [];
    const q = allSearch.trim().toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter((u) => containsQuery(u.email, q) || containsQuery(u.full_name, q) || containsQuery(u.role, q));
  }, [allUsers, allSearch]);

  const handleCreateUser = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      toast.error('Please provide a valid email address.');
      return;
    }
    if (!password || password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await adminCreateUser({ email: trimmedEmail, password, fullName, role, isApproved: approved }, accessToken);
      toast.success(`User created: ${created.email}`);
      setEmail('');
      setFullName('');
      setPassword('');
      setRole('USER');
      setApproved(true);
      mutatePending();
      mutateAll();
    } catch (err) {
      toast.error(err?.detail || err?.message || 'Failed to create user.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (userId, approve) => {
    try {
      const data = await adminApproveUser(userId, approve, accessToken);
      toast.success(data?.message || (approve ? 'User approved.' : 'User rejected.'));
      mutatePending();
      mutateAll();
    } catch (err) {
      toast.error(err?.detail || err?.message || 'Failed to update approval status.');
    }
  };

  return (
    <Stack spacing={3}>
      {/* ----- Add User ----- */}
      <Box sx={formPanelSx}>
        <Typography sx={{ ...sectionTitleSx, mb: 1.5 }}>Add User</Typography>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} alignItems={{ lg: 'flex-end' }} flexWrap="wrap" useFlexGap>
          <LabeledField label="Email" htmlFor="add-user-email" sx={{ flex: 1, minWidth: 200 }}>
            <TextField
              id="add-user-email"
              type="email"
              size="small"
              fullWidth
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={themedTextFieldSx}
            />
          </LabeledField>
          <LabeledField label="Full name (optional)" htmlFor="add-user-fullname" sx={{ flex: 1, minWidth: 180 }}>
            <TextField
              id="add-user-fullname"
              size="small"
              fullWidth
              placeholder="Jane Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              sx={themedTextFieldSx}
            />
          </LabeledField>
          <LabeledField label="Password" htmlFor="add-user-password" sx={{ flex: 1, minWidth: 180 }}>
            <TextField
              id="add-user-password"
              type="password"
              size="small"
              fullWidth
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={themedTextFieldSx}
            />
          </LabeledField>
          <LabeledField label="Role" htmlFor="add-user-role" sx={{ minWidth: 140 }}>
            <FormControl size="small" fullWidth>
              <Select
                id="add-user-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                sx={themedSelectSx}
                MenuProps={themedDropdownMenuProps}
              >
                <MenuItem value="USER">USER</MenuItem>
                <MenuItem value="ADMIN">ADMIN</MenuItem>
                <MenuItem value="SUPER_ADMIN">SUPER_ADMIN</MenuItem>
              </Select>
            </FormControl>
          </LabeledField>
          <LabeledField label="Status" htmlFor="add-user-status" sx={{ minWidth: 150 }}>
            <FormControl size="small" fullWidth>
              <Select
                id="add-user-status"
                value={approved ? 'approved' : 'pending'}
                onChange={(e) => setApproved(e.target.value === 'approved')}
                sx={themedSelectSx}
                MenuProps={themedDropdownMenuProps}
              >
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
              </Select>
            </FormControl>
          </LabeledField>
          <Button
            variant="outlined"
            onClick={handleCreateUser}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : null}
            sx={{ ...primaryActionButtonSx, minWidth: 120, height: 40, flexShrink: 0 }}
          >
            {submitting ? 'Adding…' : 'Add User'}
          </Button>
        </Stack>
      </Box>

      {/* ----- Pending Approval ----- */}
      <Box>
        <Typography sx={{ ...subSectionTitleSx, mb: 1 }}>Pending Approval</Typography>
        {pendingError ? (
          <Alert severity="error" variant="outlined">
            Failed to load pending users.
          </Alert>
        ) : !pendingUsers ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={28} sx={{ color: 'var(--green)' }} />
          </Box>
        ) : pendingUsers.length === 0 ? (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ color: 'var(--blue)', p: 1.5, border: '1px solid var(--reflected-light)', borderRadius: 1 }}
          >
            <AntIcon icon={InfoCircleOutlined} />
            <Typography sx={{ fontSize: '0.86rem' }}>No users pending approval</Typography>
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            <TableSearch
              value={pendingSearch}
              onChange={(e) => setPendingSearch(e.target.value)}
              placeholder="Search pending users (email, name, role)"
            />
            {filteredPending.length === 0 ? (
              <Typography sx={{ color: 'var(--blue)', fontSize: '0.85rem' }}>No matching pending users.</Typography>
            ) : (
              <TableContainer sx={tableContainerSx}>
                <Table stickyHeader aria-label="pending users">
                  <TableHead>
                    <TableRow>
                      {['Email', 'Name', 'Role', 'Created', 'Actions'].map((h) => (
                        <TableCell key={h} sx={tableHeaderCellSx}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredPending.map((user) => (
                      <TableRow key={user.id} hover>
                        <TableCell sx={tableCellSx}>{user.email}</TableCell>
                        <TableCell sx={tableCellSx}>{user.full_name || '—'}</TableCell>
                        <TableCell sx={tableCellSx}>
                          <RoleChip role={user.role} />
                        </TableCell>
                        <TableCell sx={tableCellSx}>{user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</TableCell>
                        <TableCell sx={tableCellSx}>
                          <Stack direction="row" spacing={1}>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<AntIcon icon={CheckOutlined} />}
                              onClick={() => handleApprove(user.id, true)}
                              sx={primaryActionButtonSx}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<AntIcon icon={CloseOutlined} />}
                              onClick={() => handleApprove(user.id, false)}
                              sx={{
                                color: 'var(--red)',
                                borderColor: 'var(--red)',
                                backgroundColor: 'rgba(0, 20, 61, 0.72)',
                                boxShadow: '0 11px 19px 1px #0000002e',
                                transition: 'none',
                                '&:hover': {
                                  borderColor: 'var(--critical)',
                                  color: 'var(--critical)',
                                  boxShadow: '0 0 7px -5px var(--critical)',
                                  backgroundColor: 'rgba(255, 72, 75, 0.08)'
                                }
                              }}
                            >
                              Reject
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
        )}
      </Box>

      {/* ----- All Users ----- */}
      {/* Wrapped in a Card that mirrors the imaging component's "PheNode
          Images" card — title + controls + table all inside one glass-chrome
          Card (sections/imaging/imaging.jsx:1181). */}
      <Card sx={{ p: { xs: 1.5, sm: 2 }, overflow: 'hidden', ...glassSurfaceSx, ...reflectedCardChromeSx }}>
        <Stack spacing={2}>
          <Typography variant="h5" sx={{ color: 'var(--blue)' }}>
            All Users
          </Typography>
          {allError ? (
            <Alert severity="error" variant="outlined">
              Failed to load users.
            </Alert>
          ) : !allUsers ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={28} sx={{ color: 'var(--green)' }} />
            </Box>
          ) : (
            <Stack spacing={1.5}>
              <TableSearch
                value={allSearch}
                onChange={(e) => setAllSearch(e.target.value)}
                placeholder="Search users (email, name, role)"
              />
              {filteredAll.length === 0 ? (
                <Typography sx={{ color: 'var(--blue)', fontSize: '0.85rem' }}>No matching users.</Typography>
              ) : (
                <TableContainer sx={imagingTableContainerSx}>
                  <Table stickyHeader aria-label="all users">
                    <TableHead>
                      <TableRow sx={imagingTableHeadRowSx}>
                        {['Email', 'Name', 'Role', 'Status', 'Created'].map((h, i) => (
                          <TableCell key={h} align={i === 0 ? 'left' : 'center'}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredAll.map((user) => (
                        <TableRow key={user.id} hover sx={imagingTableBodyRowSx}>
                          <TableCell sx={imagingTableCellSx}>{user.email}</TableCell>
                          <TableCell align="center" sx={imagingTableCellSx}>
                            {user.full_name || '—'}
                          </TableCell>
                          <TableCell align="center" sx={imagingTableCellSx}>
                            <RoleChip role={user.role} />
                          </TableCell>
                          <TableCell align="center" sx={imagingTableCellSx}>
                            <StatusChip approved={user.is_approved} />
                          </TableCell>
                          <TableCell align="center" sx={imagingTableCellSx}>
                            {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Stack>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
