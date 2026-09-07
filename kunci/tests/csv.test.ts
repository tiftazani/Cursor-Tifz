import { describe, expect, it } from 'vitest'
import { entriesFromCsv, entriesToCsv, parseCsv } from '../src/lib/csv'

describe('csv', () => {
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
