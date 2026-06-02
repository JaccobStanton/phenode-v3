import AdminPanel from 'sections/admin/admin';

// Thin page wrapper — mirrors pages/account-settings/account-settings.jsx.
// The route entry (RequireSuperAdmin) already gates access; this just
// mounts the section shell.
export default function AdminPage() {
  return <AdminPanel />;
}
