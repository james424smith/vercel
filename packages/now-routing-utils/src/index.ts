export * from './schemas';
export * from './types';
import {
  Route,
  Handler,
  NormalizedRoutes,
  GetRoutesProps,
  NowError,
  NowErrorNested,
} from './types';
import {
  convertCleanUrls,
  convertRewrites,
  convertRedirects,
  convertHeaders,
  convertTrailingSlash,
} from './superstatic';

export { getCleanUrls } from './superstatic';
export { mergeRoutes } from './merge';

const VALID_HANDLE_VALUES = ['filesystem', 'hit', 'miss'] as const;
const validHandleValues = new Set<string>(VALID_HANDLE_VALUES);
export type HandleValue = typeof VALID_HANDLE_VALUES[number];

export function isHandler(route: Route): route is Handler {
  return typeof (route as Handler).handle !== 'undefined';
}

export function isValidHandleValue(handle: string): handle is HandleValue {
  return validHandleValues.has(handle);
}

export function normalizeRoutes(inputRoutes: Route[] | null): NormalizedRoutes {
  if (!inputRoutes || inputRoutes.length === 0) {
    return { routes: inputRoutes, error: null };
  }

  const routes: Route[] = [];
  const handling: HandleValue[] = [];
  const errors: NowErrorNested[] = [];

  // We don't want to treat the input routes as references
  inputRoutes.forEach(r => routes.push(Object.assign({}, r)));

  for (const route of routes) {
    if (isHandler(route)) {
      if (Object.keys(route).length !== 1) {
        errors.push({
          message: `Cannot have any other keys when handle is used (handle: ${route.handle})`,
          handle: route.handle,
        });
      }
      const { handle } = route;
      if (!isValidHandleValue(handle)) {
        errors.push({
          message: `This is not a valid handler (handle: ${handle})`,
          handle: handle,
        });
        continue;
      }
      if (handling.includes(handle)) {
        errors.push({
          message: `You can only handle something once (handle: ${handle})`,
          handle: handle,
        });
      } else {
        handling.push(handle);
      }
    } else if (route.src) {
      // Route src should always start with a '^'
      if (!route.src.startsWith('^')) {
        route.src = `^${route.src}`;
      }

      // Route src should always end with a '$'
      if (!route.src.endsWith('$')) {
        route.src = `${route.src}$`;
      }

      // Route src should strip escaped forward slash, its not special
      route.src = route.src.replace(/\\\//g, '/');

      const regError = checkRegexSyntax(route.src);
      if (regError) {
        errors.push(regError);
      }

      // The last seen handling is the current handler
      const handleValue = handling[handling.length - 1];
      if (handleValue === 'hit') {
        if (route.dest) {
          errors.push({
            message: `You cannot assign "dest" after "handle: hit"`,
            src: route.src,
          });
        }
        if (!route.continue) {
          errors.push({
            message: `You must assign "continue: true" after "handle: hit"`,
            src: route.src,
          });
        }
      } else if (handleValue === 'miss') {
        if (route.dest && !route.check) {
          errors.push({
            message: `You must assign "check: true" after "handle: miss"`,
            src: route.src,
          });
        } else if (!route.dest && !route.continue) {
          errors.push({
            message: `You must assign "continue: true" after "handle: miss"`,
            src: route.src,
          });
        }
      }
    } else {
      errors.push({
        message: 'A route must set either handle or src',
      });
    }
  }

  const error = createNowError(
    'invalid_routes',
    'One or more invalid routes were found',
    errors
  );
  return { routes, error };
}

function checkRegexSyntax(src: string): NowErrorNested | null {
  try {
    // This feels a bit dangerous if there would be a vulnerability in RegExp.
    new RegExp(src);
  } catch (err) {
    return {
      message: `Invalid regular expression: "${src}"`,
      src,
    };
  }
  return null;
}

function createNowError(
  code: string,
  msg: string,
  errors: NowErrorNested[]
): NowError | null {
  const error: NowError | null =
    errors.length > 0
      ? {
          code,
          message: `${msg}:\n${errors
            .map(item => `- ${item.message}`)
            .join('\n')}`,
          errors,
        }
      : null;
  return error;
}

function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function getTransformedRoutes({
  nowConfig,
}: GetRoutesProps): NormalizedRoutes {
  const { cleanUrls, rewrites, redirects, headers, trailingSlash } = nowConfig;
  let { routes = null } = nowConfig;
  const errors: NowErrorNested[] = [];
  if (routes) {
    if (typeof cleanUrls !== 'undefined') {
      errors.push({
        message: 'Cannot define both `routes` and `cleanUrls`',
      });
    }
    if (typeof trailingSlash !== 'undefined') {
      errors.push({
        message: 'Cannot define both `routes` and `trailingSlash`',
      });
    }
    if (typeof redirects !== 'undefined') {
      errors.push({
        message: 'Cannot define both `routes` and `redirects`',
      });
    }
    if (typeof headers !== 'undefined') {
      errors.push({
        message: 'Cannot define both `routes` and `headers`',
      });
    }
    if (typeof rewrites !== 'undefined') {
      errors.push({
        message: 'Cannot define both `routes` and `rewrites`',
      });
    }
    if (errors.length > 0) {
      const error = createNowError(
        'invalid_keys',
        'Cannot mix legacy routes with new keys',
        errors
      );
      return { routes, error };
    }
    return normalizeRoutes(routes);
  }

  if (typeof cleanUrls !== 'undefined') {
    const normalized = normalizeRoutes(
      convertCleanUrls(cleanUrls, trailingSlash)
    );
    if (normalized.error) {
      normalized.error.code = 'invalid_clean_urls';
      return { routes, error: normalized.error };
    }
    routes = routes || [];
    routes.push(...(normalized.routes || []));
  }

  if (typeof trailingSlash !== 'undefined') {
    const normalized = normalizeRoutes(convertTrailingSlash(trailingSlash));
    if (normalized.error) {
      normalized.error.code = 'invalid_trailing_slash';
      return { routes, error: normalized.error };
    }
    routes = routes || [];
    routes.push(...(normalized.routes || []));
  }

  if (typeof redirects !== 'undefined') {
    const code = 'invalid_redirects';
    const errors = redirects
      .map(r => checkRegexSyntax(r.source))
      .filter(notEmpty);
    if (errors.length > 0) {
      return {
        routes,
        error: createNowError(
          code,
          'Redirect `source` contains invalid regex',
          errors
        ),
      };
    }
    const normalized = normalizeRoutes(convertRedirects(redirects));
    if (normalized.error) {
      normalized.error.code = code;
      return { routes, error: normalized.error };
    }
    routes = routes || [];
    routes.push(...(normalized.routes || []));
  }

  if (typeof headers !== 'undefined') {
    const normalized = normalizeRoutes(convertHeaders(headers));
    if (normalized.error) {
      normalized.error.code = 'invalid_headers';
      return { routes, error: normalized.error };
    }
    routes = routes || [];
    routes.push(...(normalized.routes || []));
  }

  if (typeof rewrites !== 'undefined') {
    const code = 'invalid_rewrites';
    const errors = rewrites
      .map(r => checkRegexSyntax(r.source))
      .filter(notEmpty);
    if (errors.length > 0) {
      return {
        routes,
        error: createNowError(
          code,
          'Rewrites `source` contains invalid regex',
          errors
        ),
      };
    }
    const normalized = normalizeRoutes(convertRewrites(rewrites));
    if (normalized.error) {
      normalized.error.code = code;
      return { routes, error: normalized.error };
    }
    routes = routes || [];
    routes.push({ handle: 'filesystem' });
    routes.push(...(normalized.routes || []));
  }

  return { routes, error: null };
}
