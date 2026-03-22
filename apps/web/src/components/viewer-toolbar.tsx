import { type CameraMode, useViewer } from "@syyclops/ifc-viewer";
import { useEffect, useRef, useState } from "react";

// ============================================================================
// Constants
// ============================================================================

const CAMERA_MODES: { mode: CameraMode; label: string; icon: string }[] = [
  { mode: "Orbit", label: "Orbit", icon: "orbit" },
  { mode: "Plan", label: "Pan", icon: "pan" },
  { mode: "FirstPerson", label: "Walk", icon: "walk" },
];

// ============================================================================
// SVG Icons
// ============================================================================

function OrbitIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 12c-3.87 0-7 1.34-7 3s3.13 3 7 3 7-1.34 7-3" />
      <path d="M5 15v-3c0-1.66 3.13-3 7-3s7 1.34 7 3v3" />
      <circle cx="12" cy="8" r="2" />
    </svg>
  );
}

function PanIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
      <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
      <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  );
}

function WalkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1" />
      <path d="m9 20 3-6 3 6" />
      <path d="m6 8 6 2 6-2" />
      <path d="M12 10v4" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m2 12 8.58 3.91a2 2 0 0 0 1.66 0L21 12" />
      <path d="m2 17 8.58 3.91a2 2 0 0 0 1.66 0L21 17" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

const ICON_MAP: Record<string, () => React.JSX.Element> = {
  orbit: OrbitIcon,
  pan: PanIcon,
  walk: WalkIcon,
};

// ============================================================================
// Popover hook
// ============================================================================

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return { open, setOpen, ref };
}

// ============================================================================
// Camera Mode Selector
// ============================================================================

function CameraModeSelector({
  currentMode,
  onModeChange,
}: {
  currentMode: CameraMode | undefined;
  onModeChange: (mode: CameraMode) => void;
}) {
  const { open, setOpen, ref } = usePopover();

  const currentConfig = CAMERA_MODES.find((m) => m.mode === currentMode);
  const CurrentIcon = ICON_MAP[currentConfig?.icon ?? "orbit"] ?? OrbitIcon;

  return (
    <div className="vt-popover-wrapper" ref={ref}>
      <button
        className="vt-btn"
        onClick={() => setOpen(!open)}
        title={`Camera: ${currentConfig?.label ?? "Orbit"}`}
      >
        <CurrentIcon />
      </button>
      {open && (
        <div className="vt-popover vt-popover-narrow">
          {CAMERA_MODES.map(({ mode, label, icon }) => {
            const Icon = ICON_MAP[icon] ?? OrbitIcon;
            return (
              <button
                key={mode}
                className={`vt-popover-item${currentMode === mode ? " vt-popover-item--active" : ""}`}
                onClick={() => {
                  onModeChange(mode);
                  setOpen(false);
                }}
              >
                <Icon />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Plan View Selector
// ============================================================================

function PlanViewSelector({
  plans,
  activePlanId,
  onPlanSelect,
}: {
  plans: { id: string; name: string }[];
  activePlanId: string | null;
  onPlanSelect: (planId: string) => void;
}) {
  const { open, setOpen, ref } = usePopover();

  if (plans.length === 0) return null;

  return (
    <div className="vt-popover-wrapper" ref={ref}>
      <button
        className={`vt-btn${activePlanId ? " vt-btn--active" : ""}`}
        onClick={() => setOpen(!open)}
        title="Floor Plans"
      >
        <LayersIcon />
      </button>
      {open && (
        <div className="vt-popover vt-popover-plans">
          <div className="vt-popover-header">
            <div className="vt-popover-header-left">
              <LayersIcon />
              <span>Floor Plans</span>
            </div>
            {activePlanId && (
              <button
                className="vt-btn vt-btn--sm"
                onClick={() => onPlanSelect(activePlanId)}
                title="Exit floor plan view"
              >
                <CloseIcon />
              </button>
            )}
          </div>
          <div className="vt-popover-list">
            {plans.map((plan, index) => {
              const isActive = activePlanId === plan.id;
              return (
                <button
                  key={plan.id}
                  className={`vt-plan-item${isActive ? " vt-plan-item--active" : ""}`}
                  onClick={() => onPlanSelect(plan.id)}
                >
                  <span className={`vt-plan-badge${isActive ? " vt-plan-badge--active" : ""}`}>
                    {index + 1}
                  </span>
                  <span className="vt-plan-name">{plan.name}</span>
                  {isActive && <CheckIcon />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main ViewerToolbar
// ============================================================================

export function ViewerToolbar() {
  const { camera, planViews } = useViewer();

  const handleCameraModeChange = (mode: CameraMode) => {
    camera?.setMode(mode);
  };

  const handlePlanSelect = (planId: string) => {
    if (planViews?.activePlanId === planId) {
      planViews.close();
    } else {
      planViews?.open(planId);
    }
  };

  return (
    <div className="vt-container">
      <div className="vt-bar">
        <CameraModeSelector
          currentMode={camera?.mode}
          onModeChange={handleCameraModeChange}
        />

        {planViews && planViews.plans.length > 0 && (
          <>
            <div className="vt-divider" />
            <PlanViewSelector
              plans={planViews.plans}
              activePlanId={planViews.activePlanId}
              onPlanSelect={handlePlanSelect}
            />
          </>
        )}
      </div>
    </div>
  );
}
