"use client"

import { CheckIcon, CopyIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

/** Shell commands with a copy button; lines starting with "#" are comments. */
export function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    const commands = code
      .split("\n")
      .filter((line) => !line.startsWith("#"))
      .join("\n")
    await navigator.clipboard.writeText(commands)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="group relative max-w-full overflow-hidden rounded-xl border bg-muted/40 dark:bg-black/30">
      <pre className="overflow-x-auto p-4 pr-12 font-mono text-[13px] leading-relaxed">
        <code>
          {code.split("\n").map((line, index) => (
            <span
              key={index}
              className={line.startsWith("#") ? "block text-muted-foreground" : "block"}
            >
              {line.startsWith("#") || line === "" ? line : <><span className="text-brand select-none">$ </span>{line}</>}
            </span>
          ))}
        </code>
      </pre>
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute top-2.5 right-2.5 text-muted-foreground"
        aria-label={copied ? "Copied" : "Copy commands"}
        onClick={() => void copy()}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  )
}
