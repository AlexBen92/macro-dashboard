import { permanentRedirect } from 'next/navigation';

// Consolidation 2 pages (2026-08-19): l'ex-décision engine / est absorbée
// par /crypto (section "Exécution BTC · M15" + contexte macro sur /markets).
export const dynamic = 'force-dynamic';

export default function RootPage() {
  permanentRedirect('/crypto');
}
