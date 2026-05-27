import AccountSettings from 'sections/account-settings/account-settings';

// Thin page wrapper — matches the convention used by every other
// dashboard route. MainRoutes.jsx lazy-loads this module so the
// AccountSettings chunk isn't pulled into the default dashboard bundle.
export default function AccountSettingsPage() {
  return <AccountSettings />;
}
