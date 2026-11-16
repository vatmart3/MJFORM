import { useEffect, useRef } from 'react'
import { Banner } from './components/Banner'
import { Calculator } from './components/Calculator'
import { Compare } from './components/Compare'
import { Configurator } from './components/Configurator'
import { Faq } from './components/Faq'
import { FinalCta } from './components/Final'
import { Footer } from './components/Footer'
import { Groups } from './components/Groups'
import { Hero } from './components/Hero'
import { Nav } from './components/Nav'
import { Reviews } from './components/Reviews'
import { Steps } from './components/Steps'
import { StickyBook } from './components/StickyBook'
import { Story } from './components/story/Story'
import { initMagnetic, initReveals, initSmoothScroll, ScrollTrigger } from './lib/motion'

export default function App() {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el) return
    initSmoothScroll()
    const undoReveals = initReveals(el)
    const undoMagnetic = initMagnetic(el)
    // Recalcule les déclencheurs une fois les polices chargées (hauteurs définitives)
    document.fonts?.ready.then(() => ScrollTrigger.refresh())
    return () => {
      undoReveals()
      undoMagnetic()
    }
  }, [])

  return (
    <div ref={root}>
      <a className="skip" href="#main">
        Aller au contenu
      </a>
      <Banner />
      <Nav />
      <main id="main">
        <Hero />
        <Story />
        <Compare />
        <Calculator />
        <Steps />
        <Groups />
        <Reviews />
        <Configurator />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <StickyBook />
    </div>
  )
}
