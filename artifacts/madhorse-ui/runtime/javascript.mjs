import variant from '@jitl/quickjs-singlefile-browser-release-sync';
import { newQuickJSWASMModuleFromVariant, newVariant } from 'quickjs-emscripten-core';
import { createFormatting } from './javascript-format.mjs';

const memoryLimit = 32 * 1024 * 1024;
const wasmPageSize = 65536;
// QuickJS counts its linear-memory stack, not the browser's native WASM call
// frames. At 512 KiB Chromium/V8 can trap first, skipping QuickJS's unwinding
// and leaving live GC objects behind. Keep the guest guard below that boundary.
const stackLimit = 64 * 1024;

function throwGuestError(context, formatter, handle) {
  let message = 'Script error could not be formatted safely';
  try {
    const result = context.callFunction(formatter, context.undefined, handle);
    if (result.error) result.error.dispose();
    else {
      try { message = context.getString(result.value); }
      finally { result.value.dispose(); }
    }
  } finally {
    if (handle.alive) handle.dispose();
  }
  throw new Error(message);
}

export async function initialize() {
  // QuickJS 0.32's Emscripten allocator reports usable_size = 0, so
  // setMemoryLimit alone does not account for retained allocations. Bound the
  // actual linear memory instead, including the engine, stack and FFI overhead.
  // The maximum is enforced by WebAssembly on every growth, not by polling.
  const memory = new WebAssembly.Memory({
    initial: 16 * 1024 * 1024 / wasmPageSize,
    maximum: memoryLimit / wasmPageSize,
  });
  const engine = await newQuickJSWASMModuleFromVariant(newVariant(variant, { wasmMemory: memory }));
  // Fail closed if an upstream variant stops honoring the supplied memory.
  if (engine.getWasmMemory() !== memory) throw new Error('JavaScript memory limit could not be installed');
  return (source, emit) => {
    const runtime = engine.newRuntime();
    let context;
    let errorFormatter;
    const errors = [];
    try {
      runtime.setMemoryLimit(memoryLimit);
      runtime.setMaxStackSize(stackLimit);
      const deadline = Date.now() + 5000;
      runtime.setInterruptHandler(() => Date.now() > deadline);
      context = runtime.newContext();
      // The sink is private to the trusted guest closure. It never receives a
      // project object or an unchecked string. Captured intrinsics also prevent
      // source from replacing stringify/String/prototype methods at the boundary.
      const sink = context.newFunction('sink', (text) => {
        emit(context.getString(text));
      });
      let logger;
      try {
        const factory = context.evalCode(`(${createFormatting.toString()})`, 'log-formatter.js');
        if (factory.error) {
          factory.error.dispose();
          throw new Error('JavaScript safe formatter could not be installed');
        }
        let installed;
        try { installed = context.callFunction(factory.value, context.undefined, sink); }
        finally { factory.value.dispose(); }
        if (installed.error) {
          installed.error.dispose();
          throw new Error('JavaScript safe formatter could not be installed');
        }
        try {
          logger = context.getProp(installed.value, 'log');
          errorFormatter = context.getProp(installed.value, 'error');
        } finally { installed.value.dispose(); }
        context.setProp(context.global, 'print', logger);
        const consoleObject = context.newObject();
        try {
          for (const name of ['log', 'info', 'warn', 'error']) context.setProp(consoleObject, name, logger);
          context.setProp(context.global, 'console', consoleObject);
        } finally {
          consoleObject.dispose();
        }
      } finally {
        logger?.dispose();
        sink.dispose();
      }
      const result = context.evalCode(source, 'project-script.js');
      if (result.error) throwGuestError(context, errorFormatter, result.error);
      result.value.dispose();
      while (runtime.hasPendingJob()) {
        const jobs = runtime.executePendingJobs(1);
        if (jobs.error) throwGuestError(jobs.error.context, errorFormatter, jobs.error);
      }
    } catch (error) {
      errors.push(error);
    } finally {
      // Attempt both disposals, but never replace the execution failure with
      // a cleanup failure. Additional failures must remain visible, too.
      try { errorFormatter?.dispose(); } catch (error) { errors.push(error); }
      try { context?.dispose(); } catch (error) { errors.push(error); }
      try { runtime.dispose(); } catch (error) { errors.push(error); }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors,
      errors.map((error) => error instanceof Error ? error.message : String(error)).join('\n'));
  };
}
