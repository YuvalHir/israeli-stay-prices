import type { Metadata } from 'next';
import App from '@/components/App';

export const metadata: Metadata = { alternates: { canonical: '/' } };

export default function Page() {
  return <App />;
}
