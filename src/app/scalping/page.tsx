import { permanentRedirect } from 'next/navigation';

// Fusionné dans / (2026-08-18): décision engine + signaux composites en
// section exploratoire. Une seule page de décision.
export default function ScalpingPage() {
  permanentRedirect('/');
}
