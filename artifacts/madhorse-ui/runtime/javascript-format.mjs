// This trusted factory is evaluated INSIDE QuickJS before project source.
// Never move traversal or conversion of guest values to the host.
export function createFormatting(sink) {
  const stringify = JSON.stringify;
  const string = String;
  const isArray = Array.isArray;
  const own = Function.prototype.call.bind(Object.prototype.hasOwnProperty);
  const add = Function.prototype.call.bind(WeakSet.prototype.add);
  const has = Function.prototype.call.bind(WeakSet.prototype.has);
  const remove = Function.prototype.call.bind(WeakSet.prototype.delete);
  const Seen = WeakSet;
  const GuestError = Error;
  const isError = Function.prototype.call.bind(Function.prototype[Symbol.hasInstance], Error);
  const apply = Reflect.apply;
  const getPrototypeOf = Object.getPrototypeOf;
  const promisePrototype = Promise.prototype;
  let remaining = 16000;

  function format(values, budget) {
    let text = '';
    let nodes = 0;
    const seen = new Seen();
    function append(part) {
      if (part.length > budget - text.length) {
        throw new GuestError('Script output exceeded the 16,000-character limit');
      }
      text += part;
    }
    function quote(value) {
      // Check BEFORE stringify, including object keys and nested strings.
      if (value.length > budget - text.length) {
        throw new GuestError('Script output exceeded the 16,000-character limit');
      }
      append(stringify(value));
    }
    function visit(value, depth, nested, converted = false, key = '') {
      if (++nodes > 1024 || depth > 32) {
        throw new GuestError('Script value exceeded safe formatting limits (32 levels / 1,024 values)');
      }
      if (!converted && value !== null && typeof value === 'object') {
        const toJSON = value.toJSON;
        if (typeof toJSON === 'function') {
          visit(apply(toJSON, value, [key]), depth, nested, true);
          return;
        }
        if (isError(value)) {
          visit({name: value.name, message: value.message, stack: value.stack}, depth, nested, true);
          return;
        }
      }
      if (typeof value === 'string') {
        if (nested) quote(value);
        else append(value);
      } else if (value === null) append('null');
      else if (typeof value !== 'object') {
        if (nested && typeof value === 'bigint') {
          throw new GuestError('Script value contains a BigInt that cannot be serialized');
        }
        // JSON's ordinary object/array conventions; top-level undefined,
        // functions and symbols still have a printable representation.
        append(typeof value === 'number' || typeof value === 'boolean'
          ? stringify(value) : nested ? 'null' : string(value));
      } else {
        if (has(seen, value)) throw new GuestError('Script value contains a circular reference');
        add(seen, value);
        if (isArray(value)) {
          append('[');
          for (let i = 0; i < value.length; i++) {
            if (i) append(',');
            visit(value[i], depth + 1, true, false, string(i));
          }
          append(']');
        } else {
          append('{');
          let count = 0;
          // Do not materialize Object.keys or stringify an entire guest graph.
          // Proxy traps/getters run only in the guest under its runtime limits.
          for (const key in value) {
            if (!own(value, key)) continue;
            if (++nodes > 1024) {
              throw new GuestError('Script value exceeded safe formatting limits (32 levels / 1,024 values)');
            }
            const item = value[key];
            if (item === undefined || typeof item === 'function' || typeof item === 'symbol') continue;
            if (count++) append(',');
            quote(key);
            append(':');
            visit(item, depth + 1, true, false, key);
          }
          append('}');
        }
        remove(seen, value);
      }
    }
    for (let i = 0; i < values.length; i++) {
      if (i) append(' ');
      visit(values[i], 0, false);
    }
    return text;
  }
  return {
    log: (...values) => {
      const text = format(values, remaining - 1);
      remaining -= text.length + 1;
      sink(text);
    },
    error: (value) => {
      try {
        // Do not unwrap Promise state (and its potentially huge payload).
        if (value !== null && typeof value === 'object' && getPrototypeOf(value) === promisePrototype) {
          return '[object Object]';
        }
        const message = value !== null && typeof value === 'object' ? value.message : undefined;
        return format([message === undefined ? value : message], 15999);
      } catch {
        return 'Script error exceeded safe formatting limits or could not be formatted safely';
      }
    },
  };
}
