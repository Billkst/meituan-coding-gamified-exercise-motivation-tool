import Placeholder from '@/components/Placeholder'

export default function Workout() {
  return (
    <Placeholder
      sectionKey="workout.section"
      titleKey="workout.title"
      bodyKey="placeholder.day"
      bodyVars={{ n: 3 }}
    />
  )
}
