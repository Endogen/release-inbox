// The first page of the desktop app: asks for the server's address, checks that it answers
// and hands it to the app, which then shows the server's own pages.

const { invoke } = window.__TAURI__.core

const REACHABLE_TIMEOUT_MS = 8000

const form = document.querySelector("#connect")
const input = document.querySelector("#url")
const error = document.querySelector("#error")
const submit = document.querySelector("#submit")
const cancel = document.querySelector("#cancel")

function showError(message) {
  error.textContent = message
  error.hidden = !message
  input.setAttribute("aria-invalid", String(Boolean(message)))
}

/** Whether anything answers at the address. The response itself is opaque to this page. */
async function isReachable(server) {
  try {
    await fetch(new URL("api/auth/me", server), {
      mode: "no-cors",
      cache: "no-store",
      signal: AbortSignal.timeout(REACHABLE_TIMEOUT_MS),
    })
    return true
  } catch {
    return false
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault()
  showError("")
  submit.disabled = true
  submit.textContent = "Connecting…"
  try {
    const server = await invoke("check_server_url", { url: input.value })
    if (!(await isReachable(server))) {
      showError(`Couldn't reach ${server}. Check the address and your connection.`)
      return
    }
    await invoke("connect", { url: server })
  } catch (message) {
    showError(String(message))
  } finally {
    submit.disabled = false
    submit.textContent = "Connect"
  }
})

input.addEventListener("input", () => showError(""))

// Coming from "Change server…": offer the current one, and a way back to it.
const current = await invoke("server_url")
if (current) {
  input.value = current
  input.select()
  cancel.hidden = false
  cancel.addEventListener("click", () => invoke("connect", { url: current }))
}
