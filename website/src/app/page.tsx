import { CallToAction } from "@/components/sections/call-to-action"
import { Desktop } from "@/components/sections/desktop"
import { Download } from "@/components/sections/download"
import { Faq } from "@/components/sections/faq"
import { Features } from "@/components/sections/features"
import { Hero } from "@/components/sections/hero"
import { HowItWorks } from "@/components/sections/how-it-works"
import { SelfHost } from "@/components/sections/self-host"
import { getLatestRelease } from "@/lib/releases"

export default async function HomePage() {
  const release = await getLatestRelease()
  return (
    <>
      <Hero release={release} />
      <HowItWorks />
      <Features />
      <Desktop />
      <Download release={release} />
      <SelfHost />
      <Faq />
      <CallToAction release={release} />
    </>
  )
}
