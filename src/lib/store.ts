import type { LevelId } from '../data/ateliers'
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
 * L'animation commence à 10 % de la scène et se termine à 70 % : le visiteur lit d'abord
 * le titre, voit l'écran se transformer, puis garde le résultat sous les yeux avant la suite.
 */
export function useSceneStep(scene: number, steps: number) {
  return useStoreSelector(storyProgress, (p) => {
    const local = sceneLocal(p, scene)
    const t = Math.min(1, Math.max(0, (local - 0.1) / 0.6))
    return Math.round(t * steps)
  })
}

// ——— Sélection du configurateur (pré-remplie depuis le bandeau, le comparateur…) ———
export interface Selection {
  level: LevelId | null
  atelierId: string | null
  sessionId: string | null
}
export const selection = createStore<Selection>({ level: null, atelierId: null, sessionId: null })
