import { useEffect, useRef } from 'react'
import { Banner } from './components/Banner'
import { Calculator } from './components/Calculator'
import { Compare } from './components/Compare'
import { Configurator } from './components/Configurator'
import { Faq } from './components/Faq'
import { Film } from './components/Film'
import { FinalCta } from './components/Final'
import { Footer } from './components/Footer'
import { Groups } from './components/Groups'
import { Hero } from './components/Hero'
import { Nav } from './components/Nav'
import { Reviews } from './components/Reviews'
import { Steps } from './components/Steps'
import { StickyBook } from './components/StickyBook'
import { Story } from './components/story/Story'
import { initReveals } from './lib/motion'
import { SHOW_REVIEWS } from './config'

export default function App() {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el) return
    return initReveals(el)
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
        <Film />
        <Story />
        <Compare />
        <Calculator />
        <Steps />
        <Groups />
        {SHOW_REVIEWS ? <Reviews /> : null}
        <Configurator />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <StickyBook />
    </div>
  )
}
