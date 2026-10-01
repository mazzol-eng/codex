import { AuthFrame } from '@/components/auth/auth-frame';
import './auth.css';
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AuthFrame>{children}</AuthFrame>;
}
