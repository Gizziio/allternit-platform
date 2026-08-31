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

  it('detects Apple Passwords CSV', () => {
    const csv = 'Title,URL,Username,Password,Notes,OTPAuth\nExample,https://example.com,user@example.com,secret123,,';
    expect(detectImportFormat(csv)).toBe('apple');
  });

  it('detects Dashlane CSV', () => {
    const csv = 'username,username2,username3,title,password,note,url,category,otpUrl\nuser@example.com,,,Example,secret123,,https://example.com,Social,';
    expect(detectImportFormat(csv)).toBe('dashlane');
  });

  it('detects LastPass CSV', () => {
    const csv = 'url,username,password,extra,name,grouping,fav\nhttps://example.com,user@example.com,secret123,,Example,Social,0';
    expect(detectImportFormat(csv)).toBe('lastpass');
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

  it('parses Apple Passwords export', () => {
    const csv = `Title,URL,Username,Password,Notes,OTPAuth
Example,https://example.com,user@example.com,secret123,,
GitHub,https://github.com,octocat,gh_secret,Authenticator,`;
    const result = parsePasswordExport(csv);
    expect(result.format).toBe('apple');
    expect(result.credentials).toHaveLength(2);
    expect(result.credentials[0]).toEqual({
      provider: 'Example',
      username: 'user@example.com',
      password: 'secret123',
      originPattern: 'example.com',
    });
    expect(result.credentials[1]).toEqual({
      provider: 'GitHub',
      username: 'octocat',
      password: 'gh_secret',
      originPattern: 'github.com',
    });
  });

  it('parses Dashlane export', () => {
    const csv = `username,username2,username3,title,password,note,url,category,otpUrl
user@example.com,,,Example,secret123,,https://example.com,Social,
alice,,,GitHub,gh_secret,,https://github.com,Dev,`;
    const result = parsePasswordExport(csv);
    expect(result.format).toBe('dashlane');
    expect(result.credentials).toHaveLength(2);
    expect(result.credentials[1]).toEqual({
      provider: 'GitHub',
      username: 'alice',
      password: 'gh_secret',
      originPattern: 'github.com',
    });
  });

  it('parses LastPass export', () => {
    const csv = `url,username,password,extra,name,grouping,fav
https://example.com,user@example.com,secret123,,Example,Social,0
https://github.com,octocat,gh_secret,,GitHub,Dev,1`;
    const result = parsePasswordExport(csv);
    expect(result.format).toBe('lastpass');
    expect(result.credentials).toHaveLength(2);
    expect(result.credentials[1]).toEqual({
      provider: 'GitHub',
      username: 'octocat',
      password: 'gh_secret',
      originPattern: 'github.com',
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
    expect(formatLabel('apple')).toBe('Apple Passwords');
    expect(formatLabel('bitwarden')).toBe('Bitwarden');
    expect(formatLabel('chrome')).toBe('Chrome');
    expect(formatLabel('dashlane')).toBe('Dashlane');
    expect(formatLabel('generic')).toBe('Generic CSV');
    expect(formatLabel('lastpass')).toBe('LastPass');
    expect(formatLabel('unknown')).toBe('Unknown format');
  });
});
