import { describe, expect, it } from 'vitest';
import { detectImportFormat, formatLabel, parsePasswordExport } from './import';

describe('password import parsers', () => {
  it('detects 1Password CSV', () => {
    const csv = 'title,website,username,password,notes\nExample,https://example.com,user@example.com,secret123,';
    expect(detectImportFormat(csv)).toBe('1password');
  });

  it('detects Bitwarden CSV', () => {
    const csv = 'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp\nsocial,0,login,Twitter,,,0,https://twitter.com,user@x.com,passw0rd,';
    expect(detectImportFormat(csv)).toBe('bitwarden');
  });

  it('detects Chrome CSV', () => {
    const csv = 'name,url,username,password\nExample,https://example.com,user@example.com,secret123';
    expect(detectImportFormat(csv)).toBe('chrome');
  });

  it('parses 1Password export', () => {
    const csv = `title,website,username,password,notes
Example,https://example.com,user@example.com,secret123,
"Quoted, Site",https://quoted.com,"user,name",p@ss,"has, comma"`;
    const result = parsePasswordExport(csv);
    expect(result.format).toBe('1password');
    expect(result.credentials).toHaveLength(2);
    expect(result.credentials[0]).toEqual({
      provider: 'Example',
      username: 'user@example.com',
      password: 'secret123',
      originPattern: 'example.com',
    });
    expect(result.credentials[1]).toEqual({
      provider: 'Quoted, Site',
      username: 'user,name',
      password: 'p@ss',
      originPattern: 'quoted.com',
    });
  });

  it('parses Bitwarden export', () => {
    const csv = `folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp
social,0,login,Twitter,,,0,https://twitter.com,user@x.com,passw0rd,
,0,login,GitHub,,,0,https://github.com,octocat,gh_secret,`;
    const result = parsePasswordExport(csv);
    expect(result.format).toBe('bitwarden');
    expect(result.credentials).toHaveLength(2);
    expect(result.credentials[0]).toEqual({
      provider: 'Twitter',
      username: 'user@x.com',
      password: 'passw0rd',
      originPattern: 'twitter.com',
    });
  });

  it('parses Chrome export', () => {
    const csv = `name,url,username,password
Example,https://example.com,user@example.com,secret123
Another,http://another.org,alice,a1!`;
    const result = parsePasswordExport(csv);
    expect(result.format).toBe('chrome');
    expect(result.credentials).toHaveLength(2);
    expect(result.credentials[1]).toEqual({
      provider: 'Another',
      username: 'alice',
      password: 'a1!',
      originPattern: 'another.org',
    });
  });

  it('returns unknown for unsupported CSV', () => {
    const csv = 'a,b,c\n1,2,3';
    const result = parsePasswordExport(csv);
    expect(result.format).toBe('unknown');
    expect(result.credentials).toHaveLength(0);
  });

  it('skips rows without passwords', () => {
    const csv = 'name,url,username,password\nExample,https://example.com,user@example.com,';
    const result = parsePasswordExport(csv);
    expect(result.credentials).toHaveLength(0);
  });

  it('labels formats', () => {
    expect(formatLabel('1password')).toBe('1Password');
    expect(formatLabel('bitwarden')).toBe('Bitwarden');
    expect(formatLabel('chrome')).toBe('Chrome');
    expect(formatLabel('generic')).toBe('Generic CSV');
    expect(formatLabel('unknown')).toBe('Unknown format');
  });
});
