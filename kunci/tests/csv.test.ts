import { describe, expect, it } from 'vitest'
import { entriesFromCsv, entriesToCsv, parseCsv } from '../src/lib/csv'

describe('csv', () => {
  it('drops an android:// row instead of importing it', () => {
    // Chrome's Android password export writes app logins as
    //   android://<base64 credential>@<package>/
    // These are not websites: no autofill, no open, and the base64 blob buried
    // the account when it landed in the name column. They are dropped.
    const csv = [
      'name,url,username,password,note',
      'android.quora.com,android://pbTt1KmSWiizwy2adE-D3WearPMqqj2Z19iepKP6e9_ZymMYYZHfdV1FqUaYo4SbuSLK7Z36vGc3eCMUVVfckw==@com.quora.android/,tiftazani.khara@gmail.com,sandi-1,',
    ].join('\n')
    expect(entriesFromCsv(csv, 1)).toHaveLength(0)
  })

  it('keeps the website rows around an android row', () => {
    // The row above and below a dropped one must still come through, and the
    // import must not be thrown off by the android url being skipped.
    const csv = [
      'name,url,username,password,note',
      'Amazon,https://www.amazon.com,t@x.com,sandi-1,',
      ',android://abc123@com.traveloka.android/,t@x.com,sandi-2,',
      'Google,https://accounts.google.com,t@x.com,sandi-3,',
    ].join('\n')
    const entries = entriesFromCsv(csv, 1)
    expect(entries.map((e) => e.name)).toEqual(['Amazon', 'Google'])
    expect(entries.map((e) => e.password)).toEqual(['sandi-1', 'sandi-3'])
  })

  it('drops an android row written in a different case', () => {
    const csv = ['name,url,username,password', 'App,ANDROID://abc@com.x.android/,t@x.com,sandi-1'].join('\n')
    expect(entriesFromCsv(csv, 1)).toHaveLength(0)
  })

  it('never uses a raw URL as the display name', () => {
    // 52 of 375 rows in a real Chrome export have the url in the name column.
    const csv = [
      'name,url,username,password,note',
      'http://www.jobstreet.co.id,http://www.jobstreet.co.id,t@x.com,sandi-1,',
    ].join('\n')
    const [entry] = entriesFromCsv(csv, 1)
    expect(entry?.name).toBe('jobstreet.co.id')
  })

  it('keeps a good name exactly as written', () => {
    // Most rows already have a usable name. Rewriting those was a bug I caught
    // by breaking the round-trip test: "Mail" came back as "mail".
    const csv = ['name,url,username,password,note', 'Mail,https://mail.example.com,t@x.com,sandi-1,'].join('\n')
    const [entry] = entriesFromCsv(csv, 1)
    expect(entry?.name).toBe('Mail')
  })

  it('parses quoted commas', () => {
    expect(parseCsv('a,"b,c",d\n1,"2,3",4')).toEqual([
      ['a', 'b,c', 'd'],
      ['1', '2,3', '4'],
    ])
  })

  it('imports Chrome-style logins and password-only rows', () => {
    const text = `name,url,username,password
Netflix,https://netflix.com,tif@x.com,secret
WiFi,,,rumah-wifi
Catatan,,,
`
    const entries = entriesFromCsv(text, 10)
    expect(entries[0]?.type).toBe('login')
    expect(entries[0]?.username).toBe('tif@x.com')
    expect(entries[1]?.type).toBe('password')
    expect(entries[1]?.password).toBe('rumah-wifi')
  })

  it('round-trips export headers', () => {
    const entries = entriesFromCsv('name,url,username,password\nMail,https://mail.test,a,b', 1)
    const csv = entriesToCsv(entries)
    expect(csv).toContain('name,type,url,username,password')
    expect(csv).toContain('Mail')
  })

  it('lets a declared type win over the heuristics', () => {
    // Kunci's own sheet export writes a `type` column, in SHEET_HEADERS order. The
    // heuristics used to sit ahead of the declared value in the same else-if chain,
    // so a `login` row with no URL or username came back as `password`, and a `login`
    // with an app name came back as `app`: a round trip through .csv or .xlsx
    // silently changed the entry type.
    const text = [
      'name,type,url,username,password,app,notes,totp,tags',
      'Tanpa URL,login,,,Pw12345678!,,,,',
      'App Login,login,,,Pw12345678!,Safari,,,',
      'App Mac,app,https://app.test,,Pw12345678!,,,,',
      'PIN wifi,password,,,rumah-wifi,,,,',
      'Catatan,note,,,,,isi catatan,,',
      'OTP kerja,totp,,,,,,JBSWY3DPEHPK3PXP,',
    ].join('\n')
    const entries = entriesFromCsv(text, 10)
    const byName = new Map(entries.map((e) => [e.name, e.type]))
    expect(byName.get('Tanpa URL')).toBe('login')
    expect(byName.get('App Login')).toBe('login')
    expect(byName.get('App Mac')).toBe('app')
    expect(byName.get('PIN wifi')).toBe('password')
    expect(byName.get('Catatan')).toBe('note')
    expect(byName.get('OTP kerja')).toBe('totp')
  })

  it('still infers a type when the column is absent or blank', () => {
    // The heuristics are not gone, only demoted: a file with no `type` column keeps
    // importing the way it always did.
    const noColumn = entriesFromCsv('name,url,username,password\nWiFi,,,rumah-wifi', 1)
    expect(noColumn[0]?.type).toBe('password')
    const blank = entriesFromCsv('name,type,url,username,password\nWiFi,,,,rumah-wifi', 1)
    expect(blank[0]?.type).toBe('password')
  })

  it('skips empty rows', () => {
    expect(entriesFromCsv('name,url,username,password\n,,,', 1)).toHaveLength(0)
  })
})
