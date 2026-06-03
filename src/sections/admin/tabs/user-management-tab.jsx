import { useMemo, useState } from 'react';

// material-ui
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
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
import {
  themedTextFieldSx,
  themedSelectSx,
  themedDropdownMenuProps,
  primaryActionButtonSx,
  formPanelSx,
  sectionTitleSx,
  imagingCardSx,
  imagingTableContainerSx,
  imagingTableHeadRowSx,
  imagingTableBodyRowSx,
  imagingTableCellSx
} from '../shared';
import { LabeledField, TableSearch, PaginationFooter, usePaginatedRows } from '../components';

// assets
import AntIcon from 'components/AntIcon';
import CheckOutlined from '@ant-design/icons-svg/lib/asn/CheckOutlined';
import CloseOutlined from '@ant-design/icons-svg/lib/asn/CloseOutlined';
import InfoCircleOutlined from '@ant-design/icons-svg/lib/asn/InfoCircleOutlined';

// =============================================================================
// UserManagementTab — create users, approve pending signups, browse all users.
// =============================================================================
//
//   - Add User form           → POST /admin/users/        (adminCreateUser)
//   - Pending Approval table  → GET  /admin/users/pending (useAdminPendingUsers)
//                               + POST /admin/users/approve (adminApproveUser)
//   - All Users table         → GET  /admin/users/         (useAdminUsers)
//
// Both tables sit inside a solid imaging-style Card (imagingCardSx), use the
// EXACT imaging table chrome (imagingTable* tokens), and paginate at 10 rows
// per page (usePaginatedRows + PaginationFooter) — same as the imaging table.

const ROLE_CHIP_COLOR = {
  SUPER_ADMIN: 'var(--purple)',
  ADMIN: 'var(--orange)',
  USER: 'var(--blue)'
};

const containsQuery = (value, query) =>
  String(value || '')
    .toLowerCase()
    .includes(query);

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

  const pendingPage = usePaginatedRows(filteredPending);
  const allPage = usePaginatedRows(filteredAll);

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
      <Card sx={imagingCardSx}>
        <Stack spacing={2}>
          <Typography variant="h5" sx={{ color: 'var(--blue)' }}>
            Pending Approval
          </Typography>
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
                <>
                  <TableContainer sx={imagingTableContainerSx}>
                    <Table stickyHeader aria-label="pending users">
                      <TableHead>
                        <TableRow sx={imagingTableHeadRowSx}>
                          {['Email', 'Name', 'Role', 'Created', 'Actions'].map((h, i) => (
                            <TableCell key={h} align={i === 0 ? 'left' : 'center'}>
                              {h}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {pendingPage.pageRows.map((user) => (
                          <TableRow key={user.id} hover sx={imagingTableBodyRowSx}>
                            <TableCell sx={imagingTableCellSx}>{user.email}</TableCell>
                            <TableCell align="center" sx={imagingTableCellSx}>
                              {user.full_name || '—'}
                            </TableCell>
                            <TableCell align="center" sx={imagingTableCellSx}>
                              <RoleChip role={user.role} />
                            </TableCell>
                            <TableCell align="center" sx={imagingTableCellSx}>
                              {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                            </TableCell>
                            <TableCell align="center" sx={imagingTableCellSx}>
                              <Stack direction="row" spacing={1} sx={{ justifyContent: 'center' }}>
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
                  <PaginationFooter
                    page={pendingPage.page}
                    pageCount={pendingPage.pageCount}
                    onChange={(_e, v) => pendingPage.setPage(v)}
                    shown={pendingPage.pageRows.length}
                    total={pendingPage.total}
                    noun="pending users"
                  />
                </>
              )}
            </Stack>
          )}
        </Stack>
      </Card>

      {/* ----- All Users ----- */}
      <Card sx={imagingCardSx}>
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
                <>
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
                        {allPage.pageRows.map((user) => (
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
                  <PaginationFooter
                    page={allPage.page}
                    pageCount={allPage.pageCount}
                    onChange={(_e, v) => allPage.setPage(v)}
                    shown={allPage.pageRows.length}
                    total={allPage.total}
                    noun="users"
                  />
                </>
              )}
            </Stack>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
