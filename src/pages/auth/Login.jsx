// project imports
import AuthWrapper from 'sections/auth/AuthWrapper';
import AuthLogin from 'sections/auth/AuthLogin';

// ================================|| LOGIN PAGE ||================================ //
//
// All visual styling lives in AuthWrapper (layout) and AuthLogin (card body).
// This page just composes the two so we can swap pieces independently later.

export default function Login() {
  return (
    <AuthWrapper>
      <AuthLogin />
    </AuthWrapper>
  );
}
