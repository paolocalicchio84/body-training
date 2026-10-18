// Dati finti per la preview UI. Rispecchiano le shape reali degli hook.

import type {
  Exercise,
  Routine,
  RoutineFolder,
  WorkoutSession,
} from '@/features/workout/types'

const U = 'preview-user'

function ex(
  id: string,
  name: string,
  primary: string,
  equipment: string,
  opts: Partial<Exercise> = {},
): Exercise {
  return {
    id,
    user_id: null,
    name,
    aliases: [],
    primary_muscle: primary,
    secondary_muscles: [],
    equipment,
    movement_pattern: null,
    plane: null,
    joint_type: 'multi',
    is_unilateral: false,
    tracking_type: 'weight_reps',
    biomech_notes:
      'Analisi del movimento: articolazioni coinvolte, momento della gravità e famiglia muscolare che vi si oppone. Nota tecnica di riferimento per l esecuzione.',
    cues: [
      'Scapole addotte e depresse',
      'Piedi ben piantati a terra',
      'Espirazione in concentrica',
    ],
    common_errors: [
      {
        error: 'Schiena che si stacca eccessivamente',
        cause: 'Instabilità del cingolo scapolare',
        fix: 'Riduci il carico e stabilizza le scapole',
      },
    ],
    contraindications: null,
    tier: 2,
    discouraged: false,
    discouraged_reason: null,
    default_rest_sec: 120,
    video_url: null,
    archived: false,
    ...opts,
  }
}

export const EXERCISES: Exercise[] = [
  ex('e1', 'Panca piana con bilanciere', 'petto', 'bilanciere', {
    tier: 1,
    secondary_muscles: ['tricipiti', 'deltoide_anteriore'],
    movement_pattern: 'push_h',
    default_rest_sec: 180,
  }),
  ex('e2', 'Squat con bilanciere alto', 'quadricipiti', 'bilanciere', {
    tier: 1,
    secondary_muscles: ['glutei', 'ischiocrurali'],
    movement_pattern: 'squat',
    default_rest_sec: 210,
  }),
  ex('e3', 'Stacco da terra classico', 'ischiocrurali', 'bilanciere', {
    tier: 1,
    secondary_muscles: ['glutei', 'erettori_spinali', 'dorso'],
    movement_pattern: 'hinge',
    default_rest_sec: 210,
  }),
  ex('e4', 'Trazioni alla sbarra prone', 'dorso', 'corpo_libero', {
    tier: 1,
    secondary_muscles: ['bicipiti'],
    movement_pattern: 'pull_v',
    tracking_type: 'reps_only',
  }),
  ex('e5', 'Military press in piedi', 'deltoide_anteriore', 'bilanciere', {
    tier: 1,
    movement_pattern: 'push_v',
  }),
  ex('e6', 'Rematore con bilanciere', 'dorso', 'bilanciere', {
    tier: 1,
    movement_pattern: 'pull_h',
  }),
  ex('e7', 'Hip thrust con bilanciere', 'glutei', 'bilanciere', { tier: 1 }),
  ex('e8', 'Croci ai cavi alti', 'petto', 'cavi', { tier: 3 }),
  ex('e9', 'Leg extension', 'quadricipiti', 'macchina', { tier: 3 }),
  ex('e10', 'Leg curl sdraiato', 'ischiocrurali', 'macchina', { tier: 3 }),
  ex('e11', 'Curl con manubri', 'bicipiti', 'manubri', { tier: 3 }),
  ex('e12', 'Push down ai cavi', 'tricipiti', 'cavi', { tier: 3 }),
  ex('e13', 'Alzate laterali', 'deltoide_laterale', 'manubri', { tier: 3 }),
  ex('e14', 'Calf raise in piedi', 'polpacci', 'macchina', { tier: 3 }),
  ex('e15', 'Crunch a terra', 'addome', 'corpo_libero', {
    tier: 3,
    tracking_type: 'reps_only',
  }),
  ex('e16', 'Plank', 'addome', 'corpo_libero', {
    tier: 2,
    tracking_type: 'duration',
  }),
  ex('e17', 'Sit-up con piedi bloccati', 'addome', 'corpo_libero', {
    tier: 3,
    discouraged: true,
    discouraged_reason:
      'Con i piedi bloccati il movimento è generato soprattutto dall ileopsoas, non dal retto dell addome. Preferire Crunch o Reverse Crunch.',
  }),
  ex('e18', 'Affondi in camminata', 'quadricipiti', 'manubri', {
    tier: 2,
    is_unilateral: true,
    movement_pattern: 'lunge',
  }),
  ex('e19', 'Stacco rumeno', 'ischiocrurali', 'bilanciere', {
    tier: 2,
    movement_pattern: 'hinge',
  }),
  ex('e20', 'Lat machine avanti', 'dorso', 'macchina', {
    tier: 2,
    movement_pattern: 'pull_v',
  }),
]

export const FOLDERS: RoutineFolder[] = [
  {
    id: 'f1',
    user_id: U,
    name: 'Upper/Lower 4 giorni',
    description: 'Mesociclo di ipertrofia',
    goal: 'hypertrophy',
    days_per_week: 4,
    weeks_planned: 8,
    starts_on: null,
    source: 'ai',
    ai_rationale:
      'Quattro sedute permettono di distribuire 12-16 serie per gruppo muscolare mantenendo due stimoli settimanali su ogni distretto, che è il compromesso migliore fra volume e recupero al tuo livello.',
    position: 0,
    archived: false,
    created_at: new Date().toISOString(),
  },
]

export const ROUTINES: Routine[] = [
  {
    id: 'r1',
    user_id: U,
    folder_id: 'f1',
    name: 'Upper A — Spinta',
    description: 'Panca pesante + complementari',
    notes: null,
    weekday: 0,
    position: 0,
    source: 'ai',
    ai_rationale: null,
    archived: false,
    last_performed_at: new Date(Date.now() - 3 * 864e5).toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: 'r2',
    user_id: U,
    folder_id: 'f1',
    name: 'Lower A — Squat',
    description: null,
    notes: null,
    weekday: 1,
    position: 1,
    source: 'ai',
    ai_rationale: null,
    archived: false,
    last_performed_at: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'r3',
    user_id: U,
    folder_id: null,
    name: 'Braccia extra',
    description: null,
    notes: null,
    weekday: null,
    position: 0,
    source: 'user',
    ai_rationale: null,
    archived: false,
    last_performed_at: null,
    created_at: new Date().toISOString(),
  },
]

export const ROUTINE_DEEP = {
  ...ROUTINES[0],
  routine_exercises: [
    {
      id: 're1',
      routine_id: 'r1',
      exercise_id: 'e1',
      position: 0,
      superset_group: null,
      target_sets: 4,
      rep_min: 5,
      rep_max: 8,
      target_rpe: 8,
      rest_sec: 120,
      notes: null,
      exercise: EXERCISES[0],
      routine_sets: [],
    },
    {
      id: 're2',
      routine_id: 'r1',
      exercise_id: 'e6',
      position: 1,
      superset_group: null,
      target_sets: 4,
      rep_min: 8,
      rep_max: 10,
      target_rpe: 8,
      rest_sec: 150,
      notes: null,
      exercise: EXERCISES[5],
      routine_sets: [],
    },
    {
      id: 're3',
      routine_id: 'r1',
      exercise_id: 'e13',
      position: 2,
      superset_group: null,
      target_sets: 3,
      rep_min: 12,
      rep_max: 15,
      target_rpe: 9,
      rest_sec: 75,
      notes: 'Fermo di un secondo in alto',
      exercise: EXERCISES[12],
      routine_sets: [],
    },
  ],
}

export const SESSIONS: WorkoutSession[] = [
  {
    id: 's-long',
    user_id: U,
    routine_id: 'r1',
    name: 'Upper A — Spinta',
    status: 'completed',
    started_at: new Date(Date.now() - 1 * 864e5).toISOString(),
    ended_at: new Date(Date.now() - 1 * 864e5 + 1000 * 60 * 1000).toISOString(),
    duration_sec: 1000 * 60,
    notes: 'Timer dimenticato',
    session_rpe: 7,
    total_volume_kg: 5000,
    total_sets: 12,
    total_reps: 90,
  },
  {
    id: 's1',
    user_id: U,
    routine_id: 'r1',
    name: 'Upper A — Spinta',
    status: 'completed',
    started_at: new Date(Date.now() - 3 * 864e5).toISOString(),
    ended_at: new Date(Date.now() - 3 * 864e5 + 4200e3).toISOString(),
    duration_sec: 4200,
    notes: null,
    session_rpe: 8,
    total_volume_kg: 8420,
    total_sets: 16,
    total_reps: 132,
  },
  {
    id: 's2',
    user_id: U,
    routine_id: 'r2',
    name: 'Lower A — Squat',
    status: 'completed',
    started_at: new Date(Date.now() - 6 * 864e5).toISOString(),
    ended_at: new Date(Date.now() - 6 * 864e5 + 3900e3).toISOString(),
    duration_sec: 3900,
    notes: 'Ginocchio destro un po fastidioso in buca',
    session_rpe: 9,
    total_volume_kg: 11250,
    total_sets: 18,
    total_reps: 141,
  },
]

export const ACTIVE_SESSION = {
  id: 'active1',
  user_id: U,
  routine_id: 'r1',
  name: 'Upper A — Spinta',
  status: 'in_progress' as const,
  started_at: new Date(Date.now() - 45e3).toISOString(),
  ended_at: null,
  duration_sec: null,
  notes: null,
  session_rpe: null,
  total_volume_kg: 3200,
  total_sets: 6,
  total_reps: 48,
  session_exercises: [
    {
      id: 'se1',
      session_id: 'active1',
      exercise_id: 'e1',
      position: 0,
      superset_group: null,
      notes: null,
      exercise: EXERCISES[0],
      session_sets: [
        {
          id: 'ss0',
          session_exercise_id: 'se1',
          position: 0,
          set_type: 'warmup' as const,
          weight_kg: 40,
          reps: 10,
          rpe: null,
          rir: null,
          duration_sec: null,
          distance_m: null,
          completed: true,
          is_pr: false,
          notes: null,
        },
        {
          id: 'ss1',
          session_exercise_id: 'se1',
          position: 1,
          set_type: 'normal' as const,
          weight_kg: 80,
          reps: 8,
          rpe: 8,
          rir: null,
          duration_sec: null,
          distance_m: null,
          completed: true,
          is_pr: false,
          notes: null,
        },
        {
          id: 'ss2',
          session_exercise_id: 'se1',
          position: 2,
          set_type: 'normal' as const,
          weight_kg: 80,
          reps: 7,
          rpe: null,
          rir: null,
          duration_sec: null,
          distance_m: null,
          completed: true,
          is_pr: false,
          notes: null,
        },
        {
          id: 'ss3',
          session_exercise_id: 'se1',
          position: 3,
          set_type: 'normal' as const,
          weight_kg: null,
          reps: null,
          rpe: null,
          rir: null,
          duration_sec: null,
          distance_m: null,
          completed: false,
          is_pr: false,
          notes: null,
        },
      ],
    },
    {
      id: 'se2',
      session_id: 'active1',
      exercise_id: 'e6',
      position: 1,
      superset_group: null,
      notes: null,
      exercise: EXERCISES[5],
      session_sets: [
        {
          id: 'ss4',
          session_exercise_id: 'se2',
          position: 0,
          set_type: 'normal' as const,
          weight_kg: null,
          reps: null,
          rpe: null,
          rir: null,
          duration_sec: null,
          distance_m: null,
          completed: false,
          is_pr: false,
          notes: null,
        },
        {
          id: 'ss5',
          session_exercise_id: 'se2',
          position: 1,
          set_type: 'normal' as const,
          weight_kg: null,
          reps: null,
          rpe: null,
          rir: null,
          duration_sec: null,
          distance_m: null,
          completed: false,
          is_pr: false,
          notes: null,
        },
      ],
    },
  ],
}

export const LAST_PERFORMANCE = new Map([
  [
    'e1',
    {
      exercise_id: 'e1',
      performed_at: new Date(Date.now() - 7 * 864e5).toISOString(),
      sets: [
        { position: 0, set_type: 'warmup' as const, weight_kg: 40, reps: 12, rpe: null },
        { position: 1, set_type: 'normal' as const, weight_kg: 77.5, reps: 8, rpe: 8 },
        { position: 2, set_type: 'normal' as const, weight_kg: 77.5, reps: 8, rpe: 9 },
        { position: 3, set_type: 'normal' as const, weight_kg: 75, reps: 7, rpe: 9 },
      ],
    },
  ],
  [
    'e6',
    {
      exercise_id: 'e6',
      performed_at: new Date(Date.now() - 7 * 864e5).toISOString(),
      sets: [
        { position: 0, set_type: 'normal' as const, weight_kg: 60, reps: 10, rpe: 8 },
        { position: 1, set_type: 'normal' as const, weight_kg: 60, reps: 9, rpe: 9 },
      ],
    },
  ],
])

export const MUSCLE_VOLUME = (() => {
  const weeks = [0, 1, 2, 3].map((i) => {
    const d = new Date()
    d.setDate(d.getDate() - i * 7)
    const day = (d.getDay() + 6) % 7
    d.setDate(d.getDate() - day)
    return d.toISOString().slice(0, 10)
  })
  const muscles: Array<[string, number]> = [
    ['petto', 14],
    ['dorso', 16],
    ['quadricipiti', 12],
    ['ischiocrurali', 8],
    ['glutei', 10],
    ['deltoide_laterale', 6],
    ['bicipiti', 22],
    ['tricipiti', 11],
  ]
  return weeks.flatMap((week_start, wi) =>
    muscles.map(([muscle, sets]) => ({
      week_start,
      muscle,
      sets: Math.max(2, sets - wi),
      volume_kg: (sets - wi) * 420,
    })),
  )
})()

export const WEEKLY_VOLUME = [3, 2, 1, 0].map((i) => {
  const d = new Date()
  d.setDate(d.getDate() - i * 7)
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return {
    week: d.toISOString().slice(0, 10),
    volumeKg: 18000 + i * 1400,
  }
})

export const PERSONAL_RECORDS = [
  {
    id: 'p1',
    exercise_id: 'e1',
    record_type: 'est_1rm' as const,
    value: 101.3,
    weight_kg: 80,
    reps: 8,
    achieved_at: new Date(Date.now() - 3 * 864e5).toISOString(),
  },
  {
    id: 'p2',
    exercise_id: 'e2',
    record_type: 'est_1rm' as const,
    value: 142.5,
    weight_kg: 120,
    reps: 5,
    achieved_at: new Date(Date.now() - 6 * 864e5).toISOString(),
  },
  {
    id: 'p3',
    exercise_id: 'e3',
    record_type: 'est_1rm' as const,
    value: 168.0,
    weight_kg: 140,
    reps: 6,
    achieved_at: new Date(Date.now() - 13 * 864e5).toISOString(),
  },
]

export const EXERCISE_HISTORY = [5, 4, 3, 2, 1, 0].map((i) => ({
  session_id: `h${i}`,
  performed_at: new Date(Date.now() - i * 7 * 864e5).toISOString(),
  session_name: 'Upper A — Spinta',
  best_weight_kg: 72.5 + (5 - i) * 2.5,
  best_reps: 8,
  est_1rm: Math.round((72.5 + (5 - i) * 2.5) * (1 + 8 / 30) * 10) / 10,
  total_volume_kg: 2400 + (5 - i) * 120,
  work_sets: 4,
}))

export const TRAINING_SUMMARY = {
  sessions: 14,
  sessionsPerWeek: 3.5,
  totalVolumeKg: 84200,
  totalMinutes: 940,
  totalSets: 218,
}
