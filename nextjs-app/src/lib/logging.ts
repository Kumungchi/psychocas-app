const DEBUG_ENABLED = process.env.NEXT_PUBLIC_DEBUG_LOGGING === 'true';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PREFIX: Record<LogLevel, string> = {
  debug: '🔍',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
};

function shouldLog(level: LogLevel): boolean {
  if (level === 'debug') {
    return DEBUG_ENABLED;
  }
  return true;
}

function buildPrefix(scope: string, level: LogLevel): string {
  return `${LEVEL_PREFIX[level]} [${scope}]`;
}

export function logDebug(scope: string, message: string, metadata?: unknown): void {
  if (!shouldLog('debug')) {
    return;
  }

  if (metadata !== undefined) {
    console.debug(buildPrefix(scope, 'debug'), message, metadata);
  } else {
    console.debug(buildPrefix(scope, 'debug'), message);
  }
}

export function logInfo(scope: string, message: string, metadata?: unknown): void {
  if (!shouldLog('info')) {
    return;
  }

  if (metadata !== undefined) {
    console.info(buildPrefix(scope, 'info'), message, metadata);
  } else {
    console.info(buildPrefix(scope, 'info'), message);
  }
}

export function logWarn(scope: string, message: string, metadata?: unknown): void {
  if (!shouldLog('warn')) {
    return;
  }

  if (metadata !== undefined) {
    console.warn(buildPrefix(scope, 'warn'), message, metadata);
  } else {
    console.warn(buildPrefix(scope, 'warn'), message);
  }
}

export function logError(scope: string, message: string, metadata?: unknown): void {
  if (!shouldLog('error')) {
    return;
  }

  if (metadata !== undefined) {
    console.error(buildPrefix(scope, 'error'), message, metadata);
  } else {
    console.error(buildPrefix(scope, 'error'), message);
  }
}
