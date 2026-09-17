export async function api(path, options = {}) {
  let response
  try {
    response = await fetch(`/api${path}`, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...options.headers } })
  } catch { throw new Error('Cannot reach the workspace. Check your connection and try again.') }
  let result
  try { result = await response.json() } catch { throw new Error('The workspace API is unavailable. Start the backend and try again.') }
  if (!response.ok) throw Object.assign(new Error(result.error || 'Request failed.'), { status: response.status })
  return result
}
