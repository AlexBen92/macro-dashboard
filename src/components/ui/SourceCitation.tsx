'use client';

export interface AcademicSource {
  authors: string;
  year: number;
  title: string;
  venue: string;
  id: string; // e.g. "SSRN 2025" or "arXiv 2024"
}

export default function SourceCitation({ source }: { source: AcademicSource }) {
  return (
    <div className="font-mono text-[0.58rem] text-[#556680] mt-1 leading-snug">
      <span className="text-[#a0a0b8]">{source.authors}</span>{' '}
      <span className="text-[#ffaa00]">({source.year})</span>{' '}
      — {source.venue}
    </div>
  );
}
