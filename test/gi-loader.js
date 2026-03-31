/**
 * Custom ESM loader that intercepts `gi://` and `resource://` imports
 * used by GNOME Shell extensions, providing lightweight mocks so that
 * pure-logic modules can be tested under plain Node.js.
 */

const GI_MOCKS = {
  GLib: {
    getenv: () => null,
    find_program_in_path: () => null,
  },
  Gio: {
    Subprocess: class Subprocess {},
    SubprocessFlags: { STDOUT_PIPE: 1, STDERR_PIPE: 2 },
    Cancellable: class Cancellable {},
    DBusProxy: { new_for_bus: () => {} },
  },
  GObject: {
    registerClass: (meta, cls) => cls,
    Object: class GObject {},
  },
  Gtk: {},
  Adw: {},
  Gdk: {},
};

/**
 * Resolve hook — tells Node how to find `gi://` and `resource://` specifiers.
 */
export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('gi://')) {
    return { shortCircuit: true, url: specifier };
  }
  if (specifier.startsWith('resource:///')) {
    return { shortCircuit: true, url: specifier };
  }
  return nextResolve(specifier, context);
}

/**
 * Load hook — returns mock source for intercepted specifiers.
 */
export function load(url, context, nextLoad) {
  if (url.startsWith('gi://')) {
    const moduleName = url.replace('gi://', '').split('?')[0];
    const mock = GI_MOCKS[moduleName] || {};
    const keys = Object.keys(mock);
    const named = keys.map((k) => `export const ${k} = _mock.${k};`).join('\n');
    const source = `
      const _mock = ${JSON.stringify(mock, (_k, v) =>
        typeof v === 'function' ? '__FUNC__' : v,
      ).replace(/"__FUNC__"/g, '() => null')};
      ${named}
      export default _mock;
    `;
    return { shortCircuit: true, format: 'module', source };
  }

  if (url.startsWith('resource:///')) {
    // resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js
    const source = `
      export function gettext(s) { return s; }
      export default { gettext };
    `;
    return { shortCircuit: true, format: 'module', source };
  }

  return nextLoad(url, context);
}
