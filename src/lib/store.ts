import { useSyncExternalStore } from 'react'

/** Mini-store sans dépendance : la progression du scroll 3D et la sélection du configurateur. */
export function createStore<T>(initial: T) {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set(next: T | ((prev: T) => T)) {
      const value = typeof next === 'function' ? (next as (p: T) => T)(state) : next
      if (Object.is(value, state)) return
      state = value
      listeners.forEach((l) => l())
    },
    subscribe(l: () => void) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
}

export type Store<T> = ReturnType<typeof createStore<T>>

export function useStoreSelector<T, S>(store: Store<T>, selector: (s: T) => S): S {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(store.get()),
  )
}

// ——— Progression du récit 3D (0 → 1 sur toute la section) ———
export const SCENES = 4
export const storyProgress = createStore(0)

/** Position dans une scène donnée : 0 avant, 1 après, entre les deux pendant. */
export const sceneLocal = (p: number, scene: number) => Math.min(1, Math.max(0, p * SCENES - scene))

export const activeSceneOf = (p: number) => Math.min(SCENES - 1, Math.floor(p * SCENES))

export function useActiveScene() {
  return useStoreSelector(storyProgress, activeSceneOf)
}

/**
 * Nombre d'étapes atteintes dans une scène (0 → steps).
 * L'animation commence à 12 % de la scène et se termine à 78 % : le temps de lire le titre.
 */
export function useSceneStep(scene: number, steps: number) {
  return useStoreSelector(storyProgress, (p) => {
    const local = sceneLocal(p, scene)
    const t = Math.min(1, Math.max(0, (local - 0.12) / 0.66))
    return Math.round(t * steps)
  })
}

// ——— Sélection du configurateur (pré-remplie depuis le bandeau, le comparateur…) ———
export interface Selection {
  level: 'n1' | 'n2' | null
  atelierId: string | null
  sessionId: string | null
}
export const selection = createStore<Selection>({ level: null, atelierId: null, sessionId: null })

/** Entrée de la section dans l'écran (0 → 1), pour l'arrivée du téléphone. */
export const storyEnter = createStore(0)
