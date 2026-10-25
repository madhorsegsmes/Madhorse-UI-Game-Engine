export type ModelLodReport = {
  assetId: string;
  phase: 'preparing' | 'ready' | 'full-detail';
  fullTriangles: number; mediumTriangles: number; lowTriangles: number;
  activeLevel: number;
  message: string;
};
const reports = new Map<string, ModelLodReport>();
const listeners = new Set<() => void>();
export function getModelLodReport(id: string) { return reports.get(id) ?? null; }
export function subscribeModelLodReports(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function setModelLodReport(id: string, report: ModelLodReport) {
  reports.delete(id); reports.set(id, report);
  if (reports.size > 128) reports.delete(reports.keys().next().value!);
  listeners.forEach(listener => listener());
}
