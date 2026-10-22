import variant from '@jitl/quickjs-singlefile-browser-release-sync';
import { newQuickJSWASMModuleFromVariant, newVariant } from 'quickjs-emscripten-core';

const memoryLimit = 32 * 1024 * 1024;
const wasmPageSize = 65536;

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
    runtime.setMemoryLimit(memoryLimit);
    runtime.setMaxStackSize(512 * 1024);
    const deadline = Date.now() + 5000;
    runtime.setInterruptHandler(() => Date.now() > deadline);
    const context = runtime.newContext();
    try {
      const logger = context.newFunction('print', (...args) => {
        emit(args.map((arg) => {
          const value = context.dump(arg);
          return typeof value === 'string' ? value : JSON.stringify(value) ?? String(value);
        }).join(' '));
      });
      context.setProp(context.global, 'print', logger);
      const consoleObject = context.newObject();
      for (const name of ['log', 'info', 'warn', 'error']) context.setProp(consoleObject, name, logger);
      context.setProp(context.global, 'console', consoleObject);
      logger.dispose();
      consoleObject.dispose();
      const result = context.evalCode(source, 'project-script.js');
      if (result.error) {
        const error = context.dump(result.error);
        result.error.dispose();
        throw new Error(error?.message ?? String(error));
      }
      result.value.dispose();
      while (runtime.hasPendingJob()) {
        const jobs = runtime.executePendingJobs(1);
        if (jobs.error) {
          const error = context.dump(jobs.error);
          jobs.error.dispose();
          throw new Error(error?.message ?? String(error));
        }
      }
    } finally {
      context.dispose();
      runtime.dispose();
    }
  };
}
