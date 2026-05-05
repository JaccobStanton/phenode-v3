// project imports
import AuthWrapper from 'sections/auth/AuthWrapper';
import AuthRegister from 'sections/auth/AuthRegister';

// ================================|| REGISTER PAGE ||================================ //
//
// Backend signup is Google-only with admin approval, so this page just
// composes AuthWrapper + AuthRegister (the Google-only CTA).

export default function Register() {
  return (
    <AuthWrapper>
      <AuthRegister />
    </AuthWrapper>
  );
}
