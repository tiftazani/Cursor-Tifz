import { describe, expect, it } from 'vitest'
import { entriesFromCsv, entriesToCsv, parseCsv } from '../src/lib/csv'

describe('csv', () => {
  it('names an android:// row by its site, not by the credential in the url', () => {
    // Chrome's Android password export writes app logins as
    //   android://<credential>@<package>/
    // and puts the site in the NAME column ("android.quora.com"). That name is
    // good, so it must be kept exactly as written.
    const csv = [
      'name,url,username,password,note',
      'android.quora.com,android://pbTt1KmSWiizwy2adE-D3WearPMqqj2Z19iepKP6e9_ZymMYYZHfdV1FqUaYo4SbuSLK7Z36vGc3eCMUVVfckw==@com.quora.android/,tiftazani.khara@gmail.com,sandi-1,',
    ].join('\n')
    const [entry] = entriesFromCsv(csv, 1)
    expect(entry?.name).toBe('android.quora.com')
    expect(entry?.url).toBe('android://pbTt1KmSWiizwy2adE-D3WearPMqqj2Z19iepKP6e9_ZymMYYZHfdV1FqUaYo4SbuSLK7Z36vGc3eCMUVVfckw==@com.quora.android/')
    expect(entry?.name).not.toContain('==')
  })

  it('uses the package name when an android row has no name column', () => {
    const csv = [
      'name,url,username,password,note',
      ',android://abc123@com.traveloka.android/,t@x.com,sandi-1,',
    ].join('\n')
    const [entry] = entriesFromCsv(csv, 1)
    expect(entry?.name).toBe('com.traveloka.android')
  })

  it('falls back to the site for an android row with no name, never the url', () => {
    // A url that is one long credential is never a usable display name. The
    // summary showed the whole base64 blob, with the account buried inside it.
    const csv = [
      'name,url,username,password,note',
      ',android://pbTt1KmSWiizwy2adE-D3WearPMqqj2Z19iepKP6e9_ZymMYYZHfdV1FqUaYo4SbuSLK7Z36vGc3eCMUVVfckw==@com.quora.android/,t@x.com,sandi-1,',
    ].join('\n')
    const [entry] = entriesFromCsv(csv, 1)
    expect(entry?.name).toBe('com.quora.android')
    expect(entry?.name).not.toContain('==')
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

  it('skips empty rows', () => {
    expect(entriesFromCsv('name,url,username,password\n,,,', 1)).toHaveLength(0)
  })
})
