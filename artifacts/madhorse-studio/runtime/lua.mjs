import { LuaWasm } from 'wasmoon';
import { memoryLimits } from './memory-limits.mjs';

export async function initialize(wasmURL) {
  // Use the C API only: no Wasmoon object proxies, JS globals, promises or
  // standard-library filesystem/network bridge is installed in the guest.
  const lua = await LuaWasm.initialize(wasmURL);
  return (source, emit) => {
    let used = 0;
    const module = lua.module;
    const allocator = module.addFunction((_, pointer, oldSize, newSize) => {
      if (!newSize) {
        if (pointer) { used -= oldSize; module._free(pointer); }
        return 0;
      }
      const next = used + newSize - (pointer ? oldSize : 0);
      if (next > memoryLimits.luaHeap) return 0;
      const result = module._realloc(pointer, newSize);
      if (result) used = next;
      return result;
    }, 'iiiii');
    const state = lua.lua_newstate(allocator, null);
    let printer;
    try {
      if (!state) throw new Error('Lua out of memory');
      for (const [name, open] of [
        ['_G', 'base'], ['table', 'table'], ['string', 'string'],
        ['math', 'math'], ['utf8', 'utf8'], ['coroutine', 'coroutine'],
      ]) {
        lua[`luaopen_${open}`](state);
        lua.lua_setglobal(state, name);
      }
      for (const name of ['dofile', 'loadfile']) {
        lua.lua_pushnil(state);
        lua.lua_setglobal(state, name);
      }
      printer = module.addFunction((L) => {
        const parts = [];
        for (let i = 1; i <= lua.lua_gettop(L); i++) {
          parts.push(lua.luaL_tolstring(L, i, null));
          lua.lua_settop(L, -2);
        }
        emit(parts.join('\t'));
        return 0;
      }, 'ii');
      lua.lua_pushcclosure(state, printer, 0);
      lua.lua_setglobal(state, 'print');
      const loaded = lua.luaL_loadstring(state, source);
      if (loaded || lua.lua_pcallk(state, 0, 0, 0, 0, null)) {
        throw new Error(lua.lua_tolstring(state, -1, null) || 'Lua out of memory');
      }
    } finally {
      if (state) lua.lua_close(state);
      if (printer !== undefined) module.removeFunction(printer);
      module.removeFunction(allocator);
    }
  };
}
