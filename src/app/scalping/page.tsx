import { permanentRedirect } from 'next/navigation';

// Fusionné dans /crypto (2026-08-19): exécution M15 BTC vit en haut de /crypto.
export const dynamic = 'force-dynamic';

export default function ScalpingPage() {
  permanentRedirect('/crypto');
}
