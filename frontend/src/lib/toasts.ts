import { toast } from "sonner"

/** A failure, with the error's message as the details. */
export function toastError(message: string, error: unknown): void {
  toast.error(message, { description: error instanceof Error ? error.message : undefined })
}

/** A change that went through, with a button to take it back. */
export function toastWithUndo(
  message: string,
  { description, onUndo }: { description?: string; onUndo: () => void }
): void {
  toast.success(message, { description, action: { label: "Undo", onClick: onUndo } })
}
