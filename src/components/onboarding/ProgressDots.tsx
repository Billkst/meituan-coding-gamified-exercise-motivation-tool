export default function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-3 py-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={
            'w-2 h-2 rounded-full transition-colors duration-300 ' +
            (i < current ? 'bg-accent-primary' : 'bg-white/20')
          }
        />
      ))}
    </div>
  )
}
