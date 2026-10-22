import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from './log.js';

describe('createLogger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('every level writes a valid JSON line to stderr, never stdout', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const log = createLogger('debug');
    log.error('e');
    log.warn('w');
    log.info('i', { foo: 'bar' });
    log.debug('d');

    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledTimes(4);
    for (const [line] of stderrSpy.mock.calls) {
      expect(() => JSON.parse(String(line))).not.toThrow();
    }
    const parsed = JSON.parse(String(stderrSpy.mock.calls[2]![0]));
    expect(parsed).toMatchObject({ level: 'info', msg: 'i', foo: 'bar' });
  });

  it('silent writes nothing', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const log = createLogger('silent');
    log.error('e');
    log.warn('w');
    log.info('i');
    log.debug('d');
    expect(stderrSpy).not.toHaveBeenCalled();
  });
});
