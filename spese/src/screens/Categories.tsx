import { useState } from 'react'
import { sortCategories } from '../db.ts'
import type { Category } from '../model.ts'
import { useStore } from '../store.tsx'
import { Errors, useTitle } from '../ui.tsx'

export function Categories() {
  const { categories, expenses, addCategory, renameCategory, setCategoryArchived } = useStore()
  const sorted = sortCategories(categories)
  const used = new Set(expenses.map((expense) => expense.categoryId))
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  useTitle('Categorie')

  async function onAdd(event: React.FormEvent) {
    event.preventDefault()
    const problem = validateCategoryName(name, categories)
    if (problem) {
      setError(problem)
      return
    }
    setPending(true)
    setError(null)
    try {
      await addCategory(name.trim())
      setName('')
    } finally {
      setPending(false)
    }
  }

  const active = sorted.filter((category) => !category.archived)
  const archived = sorted.filter((category) => category.archived)

  return (
    <div className="stack">
      <div>
        <h1>Categorie</h1>
        <p className="lede">Ogni spesa ne ha una. Una categoria già usata si rinomina o si archivia, non si cancella.</p>
      </div>
      <form className="sheet stack" onSubmit={(event) => void onAdd(event)}>
        <label>
          <span>Nuova categoria</span>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} />
        </label>
        {error ? <Errors messages={[error]} /> : null}
        <button className="primary" type="submit" disabled={pending}>
          Aggiungi categoria
        </button>
      </form>
      <section className="sheet">
        {active.length === 0 ? <p>Nessuna categoria attiva.</p> : null}
        {active.map((category) => (
          <CategoryRow
            key={category.id}
            category={category}
            used={used.has(category.id)}
            categories={categories}
            onRename={renameCategory}
            onArchive={setCategoryArchived}
          />
        ))}
      </section>
      {archived.length > 0 ? (
        <section className="sheet">
          <h2>Archiviate</h2>
          <p className="meta">Non compaiono nelle spese nuove. Le spese vecchie le conservano.</p>
          {archived.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              used={used.has(category.id)}
              categories={categories}
              onRename={renameCategory}
              onArchive={setCategoryArchived}
            />
          ))}
        </section>
      ) : null}
    </div>
  )
}

function CategoryRow({
  category,
  used,
  categories,
  onRename,
  onArchive,
}: {
  category: Category
  used: boolean
  categories: Category[]
  onRename: (id: string, name: string) => Promise<void>
  onArchive: (id: string, archived: boolean) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="category">
      {editing ? (
        <input
          value={name}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
          aria-label={`Nome di ${category.name}`}
        />
      ) : (
        <strong>{category.name}</strong>
      )}
      <span className="badge">{used ? 'Usata' : 'Non usata'}</span>
      {error ? <Errors messages={[error]} /> : null}
      <div className="tools">
        {editing ? (
          <button
            className="secondary"
            type="button"
            onClick={() => {
              const problem = validateCategoryName(name, categories, category.id)
              if (problem) {
                setError(problem)
                return
              }
              setError(null)
              void onRename(category.id, name.trim()).then(() => setEditing(false))
            }}
          >
            Salva nome
          </button>
        ) : (
          <button
            className="secondary"
            type="button"
            onClick={() => {
              setName(category.name)
              setEditing(true)
            }}
          >
            Rinomina
          </button>
        )}
        <button
          className="ghost"
          type="button"
          onClick={() => void onArchive(category.id, !category.archived)}
        >
          {category.archived ? 'Riattiva' : 'Archivia'}
        </button>
      </div>
    </div>
  )
}

function validateCategoryName(name: string, categories: Category[], ignoreId?: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Scrivi il nome della categoria.'
  if (trimmed.length > 40) return 'Il nome può avere al massimo 40 caratteri.'
  const key = trimmed.toLocaleLowerCase('it')
  const duplicate = categories.some(
    (category) => category.id !== ignoreId && category.name.trim().toLocaleLowerCase('it') === key,
  )
  if (duplicate) return 'Questa categoria c’è già.'
  return null
}
