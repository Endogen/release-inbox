import Link from "next/link"
import type { ReactNode } from "react"

import { Reveal } from "@/components/reveal"
import { Section } from "@/components/section"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { site } from "@/lib/site"

const QUESTIONS: ReadonlyArray<{ question: string; answer: ReactNode }> = [
  {
    question: "Do I need a server?",
    answer:
      "Yes. Releases is self-hosted: the server polls GitHub for you, keeps the inbox and sends the notifications. The desktop app and the web app both show that server. A small VPS, a home server or your own machine is enough.",
  },
  {
    question: "Which releases show up?",
    answer:
      "Exactly the ones you subscribed to on GitHub: Releases reads your GitHub notifications and keeps the ones about releases. Watch a repository with Custom → Releases, and its next release lands in the inbox.",
  },
  {
    question: "Does it change anything on GitHub?",
    answer:
      "Only when you ask it to: marking as read also marks the GitHub notification as read, and unsubscribing stops watching the repository. Everything else stays in the app.",
  },
  {
    question: "What does it cost?",
    answer:
      "Nothing. The app and the desktop apps are free. AI summaries are optional and billed to your own Anthropic API key, only when you ask for one.",
  },
  {
    question: "Why does Windows warn me before the first start?",
    answer: (
      <>
        Windows SmartScreen warns about apps it doesn&apos;t know yet. Code signing through
        SignPath Foundation is being set up; see the{" "}
        <Link href="/code-signing/" className="underline underline-offset-4">
          code signing policy
        </Link>
        . Until then, choose <em>More info → Run anyway</em> if you trust this download.
      </>
    ),
  },
  {
    question: "Can I use it on my phone?",
    answer:
      "Yes. The web app adapts to phones, can be installed to the home screen, and supports swipe gestures and push notifications.",
  },
]

export function Faq() {
  return (
    <Section id="faq" eyebrow="FAQ" title="Questions, answered">
      <Reveal className="mx-auto max-w-3xl">
        <Accordion type="single" collapsible className="rounded-2xl border bg-card px-6">
          {QUESTIONS.map(({ question, answer }) => (
            <AccordionItem key={question} value={question}>
              <AccordionTrigger className="py-5 text-base">{question}</AccordionTrigger>
              <AccordionContent className="pb-5 text-base leading-relaxed text-muted-foreground">
                {answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Something else?{" "}
          <a href={site.issuesUrl} className="underline underline-offset-4 hover:text-foreground">
            Ask on GitHub
          </a>
          .
        </p>
      </Reveal>
    </Section>
  )
}
