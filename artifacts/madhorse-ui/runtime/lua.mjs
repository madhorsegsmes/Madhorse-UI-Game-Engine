import fengari from 'fengari';

export function run(source, emit) {
  const { lua, lauxlib, lualib, to_luastring, to_jsstring } = fengari;
  const state = lauxlib.luaL_newstate();
  try {
    // Do not open io, os, package, debug, or JavaScript interoperability.
    for (const [name, open] of [
      ['_G', lualib.luaopen_base],
      ['table', lualib.luaopen_table],
      ['string', lualib.luaopen_string],
      ['math', lualib.luaopen_math],
      ['utf8', lualib.luaopen_utf8],
      ['coroutine', lualib.luaopen_coroutine],
    ]) {
      lauxlib.luaL_requiref(state, to_luastring(name), open, 1);
      lua.lua_pop(state, 1);
    }
    for (const name of ['dofile', 'loadfile']) {
      lua.lua_pushnil(state);
      lua.lua_setglobal(state, to_luastring(name));
    }
    lua.lua_pushjsfunction(state, (L) => {
      const parts = [];
      for (let i = 1; i <= lua.lua_gettop(L); i++) {
        const value = lauxlib.luaL_tolstring(L, i);
        parts.push(to_jsstring(value));
        lua.lua_pop(L, 1);
      }
      emit(parts.join('\t'));
      return 0;
    });
    lua.lua_setglobal(state, to_luastring('print'));
    const deadline = Date.now() + 5000;
    lua.lua_sethook(state, (L) => {
      if (Date.now() > deadline) lauxlib.luaL_error(L, to_luastring('Script exceeded the 5-second time limit'));
    }, lua.LUA_MASKCOUNT, 10000);
    const loaded = lauxlib.luaL_loadstring(state, to_luastring(source));
    if (loaded !== lua.LUA_OK) throw new Error(lua.lua_tojsstring(state, -1));
    if (lua.lua_pcall(state, 0, lua.LUA_MULTRET, 0) !== lua.LUA_OK) {
      throw new Error(lua.lua_tojsstring(state, -1));
    }
  } finally {
    lua.lua_close(state);
  }
}
