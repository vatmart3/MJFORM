// Pré-rendu statique de la page d'accueil (SEO local + affichage immédiat).
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { render } = await import(pathToFileURL(resolve(root, 'dist-ssr/entry-server.js')).href)
const file = resolve(root, 'dist/index.html')
const html = readFileSync(file, 'utf8')
if (!html.includes('<!--app-->')) throw new Error('Marqueur <!--app--> introuvable')
writeFileSync(file, html.replace('<!--app-->', render()))
rmSync(resolve(root, 'dist-ssr'), { recursive: true, force: true })
console.log('✓ index.html pré-rendu')
