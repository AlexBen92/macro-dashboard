export default function Loading() {
  return (
    <div className="min-h-screen bg-[#08080f] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-[#1a1a30] border-t-[#00e5ff] rounded-full animate-spin mx-auto mb-4" />
        <div className="font-mono text-[0.8rem] text-[#556680] tracking-[3px]">MACRO STACK</div>
        <div className="font-mono text-[0.6rem] text-[#1a1a30] mt-1">Loading decision engine...</div>
      </div>
    </div>
  );
}
