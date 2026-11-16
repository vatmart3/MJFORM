import { FAQ } from '../data/faq'
import { Eyebrow, SectionCta, SplitTitle } from './ui'

export function Faq() {
  return (
    <section className="section" id="faq" aria-labelledby="faq-title">
      <div className="wrap">
        <div className="head">
          <Eyebrow>Questions</Eyebrow>
          <SplitTitle first="Vos questions." second="Nos réponses." id="faq-title" />
        </div>
        <div className="faq" data-reveal="">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>
                {f.q}
                <span className="pm" aria-hidden="true" />
              </summary>
              <div className="answer">
                {f.a.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </details>
          ))}
        </div>
        <SectionCta />
      </div>
    </section>
  )
}
