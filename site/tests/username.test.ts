import { describe, expect, it } from 'vitest';
import { signUpErrorMessage, usernameProblem } from '@/lib/username';

// Mirrors the database's check: ^[a-z0-9_]{3,30}$
const DB_RULE = /^[a-z0-9_]{3,30}$/;

describe('usernameProblem', () => {
  it.each(['abc', 'john_doe', 'jd_2026', 'a'.repeat(30)])('accepts %s', (u) => {
    expect(usernameProblem(u)).toBeNull();
    expect(DB_RULE.test(u)).toBe(true);
  });

  it.each([
    ['john doe', /space/],
    ['John', /lowercase/],
    ['jöhn', /lowercase/],
    ['john-doe', /lowercase/],
    ['jd', /3/],
    ['a'.repeat(31), /30/],
  ])('rejects %s', (u, msg) => {
    expect(usernameProblem(u)).toMatch(msg);
    expect(DB_RULE.test(u)).toBe(false);
  });

  it('says nothing while empty', () => {
    expect(usernameProblem('')).toBeNull();
  });
});

describe('signUpErrorMessage', () => {
  it('maps the trigger failure to a username message', () => {
    expect(signUpErrorMessage('Database error saving new user')).toMatch(/username/);
  });
  it('maps an existing email', () => {
    expect(signUpErrorMessage('User already registered')).toMatch(/Sign in/);
  });
  it('passes other messages through', () => {
    expect(signUpErrorMessage('Password should be at least 6 characters')).toBe('Password should be at least 6 characters');
  });
});
