import { permanentRedirect } from 'next/navigation';

// Consolidation 2 pages (2026-08-19): le catalogue est replié en accordéon
// en bas de /crypto et /markets — plus de page dédiée.
export const dynamic = 'force-dynamic';

export default function ResearchPage() {
  permanentRedirect('/crypto');
}
