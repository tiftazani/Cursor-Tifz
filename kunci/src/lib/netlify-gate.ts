export const NETLIFY_PRIVATE_SITE_HELP =
  'Situs Netlify Kunci masih Private / Team login. Helper di Mac tidak punya cookie login Netlify, jadi OTP gagal. Di Netlify: Project configuration → General → Visitor access → Project visibility → Public (production). Kunci tetap dikunci kode Gmail + kata sandi induk.'

export function isNetlifyAccessGate(status: number, body: string): boolean {
  if (status !== 401 && status !== 403) return false
  const text = body.toLowerCase()
  return (
    text.includes('edge-access') ||
    text.includes('login redirect') ||
    text.includes('app.netlify.com') ||
    (text.includes('<!doctype html') && text.includes('netlify'))
  )
}
