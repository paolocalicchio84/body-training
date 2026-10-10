import { useEffect } from 'react'
import { GuideSection } from './settings/GuideSection'
import { ProfileSection } from './settings/ProfileSection'
import { GoalSection } from './settings/GoalSection'
import { TargetsSection } from './settings/TargetsSection'
import { MeasurementsSection } from './settings/MeasurementsSection'
import { DietaryRulesSection } from './settings/DietaryRulesSection'
import { MealPlanSection } from './settings/MealPlanSection'
import { AiSection } from './settings/AiSection'
import { SystemPromptSection } from './settings/SystemPromptSection'
import { CorrectionsSection } from './settings/CorrectionsSection'
import { KnowledgeSection } from './settings/KnowledgeSection'
import { ExportSection } from './settings/ExportSection'
import { DangerZoneSection } from './settings/DangerZoneSection'
import { SectionHelp } from '@/components/tutorial/SectionHelp'

export function Settings() {
  useEffect(() => {
    if (window.location.hash !== '#ai-settings') return
    const el = document.getElementById('ai-settings')
    if (el) {
      // Wait a tick so lazy layout has painted
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <p className="flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground">
          Impostazioni
          <SectionHelp id="settings" />
        </p>
        <h2 className="mt-1 font-mono text-3xl font-semibold tracking-tight">
          Profilo, AI & dati
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Dati personali, obiettivo, misure, configurazione AI e backup.
        </p>
      </div>
      <GuideSection />
      <ProfileSection />
      <GoalSection />
      <TargetsSection />
      <MeasurementsSection />
      <DietaryRulesSection />
      <MealPlanSection />
      <AiSection />
      <SystemPromptSection />
      <CorrectionsSection />
      <KnowledgeSection />
      <ExportSection />
      <DangerZoneSection />
    </div>
  )
}
