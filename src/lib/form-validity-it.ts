/**
 * Italian HTML5 constraint messages — browsers ignore lang=it for
 * native tooltips like "Please fill out this field."
 */
export function setItalianValidity(el: HTMLInputElement): void {
  el.setCustomValidity('')
  if (el.validity.valueMissing) {
    if (el.type === 'email' || el.name === 'email' || el.id === 'email') {
      el.setCustomValidity('Inserisci l’email')
    } else if (
      el.type === 'password' ||
      el.name === 'password' ||
      el.id === 'password' ||
      el.id === 'confirm'
    ) {
      el.setCustomValidity(
        el.id === 'confirm' ? 'Conferma la password' : 'Inserisci la password',
      )
    } else {
      el.setCustomValidity('Compila questo campo')
    }
    return
  }
  if (el.validity.typeMismatch && el.type === 'email') {
    el.setCustomValidity('Inserisci un’email valida')
    return
  }
  if (el.validity.tooShort) {
    const min = el.minLength > 0 ? el.minLength : 6
    el.setCustomValidity(`Minimo ${min} caratteri`)
  }
}

export function clearItalianValidity(el: HTMLInputElement): void {
  el.setCustomValidity('')
}

/** Wire input/invalid handlers so native bubbles show Italian copy. */
export function italianValidityHandlers(el: HTMLInputElement | null): {
  onInvalid: () => void
  onInput: () => void
} {
  return {
    onInvalid: () => {
      if (el) setItalianValidity(el)
    },
    onInput: () => {
      if (el) clearItalianValidity(el)
    },
  }
}
