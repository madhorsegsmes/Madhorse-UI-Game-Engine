import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import "./modeling-shell.css";

export interface ModelingShellProps {
  children: ReactNode;
  toolbar: ReactNode;
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  status: string;
  onClose: () => void;
}

export function ModelingShell({ children, toolbar, leftPanel, rightPanel, status, onClose }: ModelingShellProps) {
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="modeling-overlay" />
        <Dialog.Content className="modeling-shell" data-testid="dialog-modeling-workspace">
          <header className="modeling-header">
            <div className="modeling-brand">
              <span className="modeling-mark" aria-hidden="true" />
              <Dialog.Title className="modeling-title">Madhorse Modeling Workspace</Dialog.Title>
              <span className="modeling-brief">Blender-compatible · not full Blender</span>
            </div>
            <Dialog.Description className="modeling-sr">
              Model meshes, edit rigs, and exchange GLB or glTF files with Blender.
            </Dialog.Description>
            <Dialog.Close className="modeling-close" aria-label="Close modeling workspace" data-testid="button-close-modeling">
              <X size={16} />
            </Dialog.Close>
          </header>
          <div className="modeling-toolbar" role="toolbar" aria-label="Modeling tools">{toolbar}</div>
          <div className="modeling-body">
            <aside className="modeling-panel modeling-panel-left" aria-label="Tools">{leftPanel}</aside>
            <main className="modeling-viewport" data-testid="region-modeling-viewport">{children}</main>
            <aside className="modeling-panel modeling-panel-right" aria-label="Inspector">{rightPanel}</aside>
          </div>
          <footer className="modeling-status" role="status" aria-live="polite" data-testid="status-modeling">
            <span className="modeling-status-dot" aria-hidden="true" />
            {status}
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default ModelingShell;
