// project imports
import AuthWrapper from 'sections/auth/AuthWrapper';
import AuthApprovalPending from 'sections/auth/AuthApprovalPending';

// ================================|| APPROVAL PENDING PAGE ||================================ //
//
// Users who signed in via Google but aren't yet approved by an admin land
// here. Behavior lives in AuthApprovalPending — this page just composes
// the auth shell.

export default function ApprovalPending() {
  return (
    <AuthWrapper>
      <AuthApprovalPending />
    </AuthWrapper>
  );
}
