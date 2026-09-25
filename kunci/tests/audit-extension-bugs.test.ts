import { describe, expect, it } from 'vitest'
import { entryMatchesPage, nameMatchesHost, siteLabel } from '../src/lib/match'
// @ts-expect-error plain JS module shared with the extension
import { matchesForUrl } from '../extension/crypto.js'
import { detectCsvDelimiter, entriesFromCsv } from '../src/lib/csv'
import { totpCode } from '../src/lib/totp'

// Findings B1, B2, B3, B6, B11 from the extension audit (2026-09-25). Each test below
// fails against the code as it was, with the exact input the audit used.

describe('B2: a name is never a label inside an attacker host', () => {
  it('does not answer for gmail.evil.com with an entry named gmail', () => {
    // host.split('.') gave ["gmail","evil","com"] and includes("gmail") was true, so
    // an attacker subdomain got the real password autofilled with no interaction.
    expect(nameMatchesHost('gmail', 'gmail.evil.com')).toBe(false)
    expect(entryMatchesPage({ name: 'Gmail' }, 'https://gmail.evil.com/login')).toBe(false)
    expect(matchesForUrl([{ id: '1', type: 'login', name: 'Gmail' }], 'https://gmail.evil.com/login')).toHaveLength(0)
  })

  it('still answers for the site the name actually is', () => {
    expect(nameMatchesHost('gmail', 'gmail.com')).toBe(true)
    expect(nameMatchesHost('gmail', 'mail.gmail.com')).toBe(true)
    // app.slack.com is Slack's own host, so the bare name must keep working.
    expect(entryMatchesPage({ name: 'slack', appName: 'Slack' }, 'https://app.slack.com')).toBe(true)
    expect(nameMatchesHost('bank', 'bank.com.au')).toBe(true)
  })

  it('reads the label the host owns', () => {
    expect(siteLabel('app.slack.com')).toBe('slack')
    expect(siteLabel('bank.com.au')).toBe('bank')
    expect(siteLabel('gmail.evil.com')).toBe('evil')
    expect(siteLabel('example.com')).toBe('example')
  })
})

describe('B11: an https login is not filled into plain http', () => {
  it('refuses the downgrade', () => {
    expect(entryMatchesPage({ url: 'https://bank.example.com' }, 'http://bank.example.com/login')).toBe(false)
    expect(matchesForUrl([{ id: '1', type: 'login', url: 'https://bank.example.com' }], 'http://bank.example.com/login')).toHaveLength(0)
  })

  it('still matches the secure page, and a bare host still matches both', () => {
    expect(entryMatchesPage({ url: 'https://bank.example.com' }, 'https://bank.example.com/login')).toBe(true)
    // No scheme means no promise was made about TLS.
    expect(entryMatchesPage({ url: 'bank.example.com' }, 'http://bank.example.com/login')).toBe(true)
  })
})

describe('B1: the delimiter is read across lines, not from a title row', () => {
  const titled = 'Passwords-data\nname;url;username;password\nGmail;https://***@gmail.com;Pw12345678!\nNetflix;https://***@gmail.com;Pw87654321!'

  it('finds the semicolon under a title row', () => {
    expect(detectCsvDelimiter(titled)).toBe(';')
  })

  it('imports the rows instead of returning nothing', () => {
    const entries = entriesFromCsv(titled)
    expect(entries).toHaveLength(2)
    expect(entries.map((e) => e.name)).toEqual(['Gmail', 'Netflix'])
  })

  it('finds a tab under a title row too', () => {
    const tsv = 'Passwords-data\nname\turl\tusername\tpassword\nGmail\thttps://gmail.com\ttif@example.com\tPw12345678!'
    expect(detectCsvDelimiter(tsv)).toBe('\t')
    expect(entriesFromCsv(tsv)).toHaveLength(1)
  })

  it('still reads a plain comma file', () => {
    const plain = 'name,url,username,password\nGmail,https://gmail.com,tif@example.com,Pw12345678!'
    expect(detectCsvDelimiter(plain)).toBe(',')
    expect(entriesFromCsv(plain)).toHaveLength(1)
  })

  it('is not fooled by a semicolon inside one value', () => {
    // Kunci's own export joins tags with ';', so a comma file can carry semicolons.
    const tagged =
      'name,url,username,password,tags\nA,https://a.com,u1,p1,"x;y"\nB,https://b.com,u2,p2,"z;w"\nC,https://c.com,u3,p3,'
    expect(detectCsvDelimiter(tagged)).toBe(',')
    expect(entriesFromCsv(tagged)).toHaveLength(3)
  })
})

describe('B3: the TOTP field accepts the otpauth URI its hint promises', () => {
  it('produces a code from a URI instead of throwing', async () => {
    const uri = 'otpauth://totp/GitHub:tif@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub'
    const fromUri = await totpCode(uri, 0)
    const fromSecret = await totpCode('JBSWY3DPEHPK3PXP', 0)
    expect(fromUri.code).toBe(fromSecret.code)
    expect(fromUri.code).toMatch(/^\d{6}$/)
  })

  it('leaves a bare secret alone', async () => {
    const bare = await totpCode('JBSWY3DPEHPK3PXP', 0)
    expect(bare.code).toBe('282760')
  })
})
