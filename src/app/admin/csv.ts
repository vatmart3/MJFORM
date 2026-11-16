// Lecture d'un fichier CSV de participants (export tableur, Google Forms, billetterie…).
import type { CsvParticipant } from '../data/types'

/** Découpe un texte CSV en lignes de cellules ; gère les guillemets et les retours à la ligne cités. */
export function parseCsv(text: string, sep: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += c
      continue
    }
    if (c === '"' && cell.trim() === '') {
      quoted = true
      cell = ''
    } else if (c === sep) {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.map((r) => r.map((x) => x.trim())).filter((r) => r.some((x) => x !== ''))
}

/** Séparateur le plus fréquent hors guillemets sur la première ligne : , ; ou tabulation */
export function detectSeparator(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? ''
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 }
  let quoted = false
  for (const c of first) {
    if (c === '"') quoted = !quoted
    else if (!quoted && c in counts) counts[c]++
  }
  const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return n > 0 ? best : ','
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

const HEADERS: Record<keyof CsvParticipant, string[]> = {
  firstName: ['prenom', 'firstname', 'first', 'givenname'],
  lastName: ['nom', 'lastname', 'last', 'surname', 'nomdefamille', 'familyname'],
  email: ['email', 'mail', 'courriel', 'adresseemail', 'adressemail', 'emailaddress'],
  phone: ['telephone', 'phone', 'tel', 'portable', 'mobile', 'numerodetelephone', 'phonenumber'],
}

export interface ParsedRow extends CsvParticipant {
  /** Numéro de ligne dans le fichier (en-tête = 1) */
  line: number
  errors: string[]
  warnings: string[]
}

export interface ParseResult {
  rows: ParsedRow[]
  /** Colonnes reconnues */
  columns: (keyof CsvParticipant)[]
  /** Erreur bloquante (aucun en-tête reconnu, etc.) */
  fatal: string | null
  separator: string
}

export function parseParticipants(raw: string): ParseResult {
  const text = raw.replace(/^﻿/, '')
  const separator = detectSeparator(text)
  const table = parseCsv(text, separator)
  if (!table.length) return { rows: [], columns: [], fatal: null, separator }

  const header = table[0].map(norm)
  const index: Partial<Record<keyof CsvParticipant, number>> = {}
  for (const key of Object.keys(HEADERS) as (keyof CsvParticipant)[]) {
    const i = header.findIndex((h) => HEADERS[key].includes(h))
    if (i >= 0) index[key] = i
  }
  const columns = Object.keys(index) as (keyof CsvParticipant)[]
  if (index.email === undefined) {
    return {
      rows: [],
      columns,
      separator,
      fatal: 'Colonne e-mail introuvable. La première ligne doit contenir les en-têtes, par exemple : prénom ; nom ; email ; téléphone.',
    }
  }

  const seen = new Map<string, number>()
  const rows = table.slice(1).map((cells, k) => {
    const get = (key: keyof CsvParticipant) => (index[key] !== undefined ? (cells[index[key]!] ?? '').trim() : '')
    const r: ParsedRow = { line: k + 2, firstName: get('firstName'), lastName: get('lastName'), email: get('email').toLowerCase(), phone: get('phone'), errors: [], warnings: [] }
    if (!r.email) r.errors.push('E-mail manquant')
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)) r.errors.push('E-mail invalide')
    else if (seen.has(r.email)) r.errors.push(`Doublon de la ligne ${seen.get(r.email)}`)
    else seen.set(r.email, r.line)
    if (!r.firstName) r.warnings.push('Prénom manquant')
    return r
  })
  return { rows, columns, fatal: null, separator }
}
