/** The leaf-green glow in the far corner of the gradient (header, heroes). */
export default function BrandGlow() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <span className="absolute -top-[90px] -end-[70px] h-60 w-60 rounded-full bg-[radial-gradient(circle,rgba(46,158,91,.55),rgba(46,158,91,0)_66%)]" />
    </span>
  );
}
