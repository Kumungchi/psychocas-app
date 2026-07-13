import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildOtpEmail,
  generateNumericOtp,
  sendOtpWithResend,
} from '../convex/otp';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Convex email OTP', () => {
  it('generates an eight digit code with unbiased byte rejection', () => {
    const sequence = [250, 251, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const code = generateNumericOtp(8, (bytes) => {
      bytes.forEach((_, index) => {
        bytes[index] = sequence[index % sequence.length];
      });
    });

    expect(code).toBe('01234567');
  });

  it('rejects unsafe code lengths and malformed email tokens', () => {
    expect(() => generateNumericOtp(5)).toThrow('invalid_otp_length');
    expect(() => buildOtpEmail('<script>')).toThrow('invalid_otp_token');
  });

  it('builds a Czech one-time-code email without a magic link', () => {
    const email = buildOtpEmail('12345678');

    expect(email.subject).toContain('Přihlašovací kód');
    expect(email.text).toContain('12345678');
    expect(email.html).toContain('12345678');
    expect(email.html).not.toContain('href=');
  });

  it('calls Resend directly with the Convex-side credential', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: 'email-id' }), { status: 200 }),
    );

    await sendOtpWithResend(
      {
        apiKey: 'server-secret',
        from: 'Psychočas <no-reply@psychocas.cz>',
        to: 'CLEN@EXAMPLE.CZ',
        token: '87654321',
      },
      fetchMock,
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(request?.headers).toMatchObject({
      Authorization: 'Bearer server-secret',
      'Content-Type': 'application/json',
      'User-Agent': 'Psychoapp/1.0',
    });
    expect(JSON.parse(String(request?.body))).toMatchObject({
      from: 'Psychočas <no-reply@psychocas.cz>',
      to: ['clen@example.cz'],
      subject: 'Přihlašovací kód do Psychočasu',
    });
  });

  it('fails closed when the provider key is missing or Resend rejects delivery', async () => {
    await expect(
      sendOtpWithResend({ apiKey: '', from: 'sender@example.cz', to: 'member@example.cz', token: '12345678' }),
    ).rejects.toThrow('email_provider_unavailable');

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 429 }));
    await expect(
      sendOtpWithResend(
        { apiKey: 'key', from: 'sender@example.cz', to: 'member@example.cz', token: '12345678' },
        fetchMock,
      ),
    ).rejects.toThrow('email_delivery_failed:429');
  });
});
