import { notFound } from 'next/navigation';
import StyleguideClient from './StyleguideClient';

// Dev-only living styleguide (plan §20.2 — "our Figma"). The authoritative
// prod gate is in middleware.ts (runtime, reliable). This build-time guard is
// belt-and-suspenders in case the route is ever reached bypassing middleware.
export default function StyleguidePage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  return <StyleguideClient />;
}
