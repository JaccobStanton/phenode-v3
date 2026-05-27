import Profile from 'sections/profile/profile';

// Thin page wrapper — matches the convention used by every other
// dashboard route (pages/<route>/<route>.jsx imports the matching
// sections/<route>/<route>.jsx and forwards). MainRoutes.jsx lazy-loads
// this module so the Profile chunk isn't pulled into the default
// dashboard bundle.
export default function ProfilePage() {
  return <Profile />;
}
