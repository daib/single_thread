"use client";

import { createPortal } from "react-dom";
import {
  type ButtonHTMLAttributes,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type Props = {
  tooltip: string;
  ariaLabel: string;
  className?: string;
  /** When true, hover/focus tooltip is hidden (e.g. while a menu is open). */
  hideTooltip?: boolean;
  children: ReactNode;
  onClick: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  disabled?: boolean;
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, "aria-expanded" | "aria-haspopup">;

export function PortalTooltipButton({
  tooltip,
  ariaLabel,
  className,
  hideTooltip = false,
  children,
  onClick,
  disabled = false,
  "aria-expanded": ariaExpanded,
  "aria-haspopup": ariaHaspopup,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [tipPos, setTipPos] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  const tipVisible = (hover || focus) && !hideTooltip && !disabled;

  const updateTipPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 8;
    setTipPos({
      left: r.left + r.width / 2,
      top: r.bottom + gap,
    });
  }, []);

  const primeTipPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 8;
    setTipPos({
      left: r.left + r.width / 2,
      top: r.bottom + gap,
    });
  }, []);

  useEffect(() => {
    if (!mounted || !tipVisible) return;
    updateTipPosition();
    window.addEventListener("scroll", updateTipPosition, true);
    window.addEventListener("resize", updateTipPosition);
    return () => {
      window.removeEventListener("scroll", updateTipPosition, true);
      window.removeEventListener("resize", updateTipPosition);
    };
  }, [mounted, tipVisible, updateTipPosition]);

  const canPortal = typeof document !== "undefined" && document.body != null;
  const tooltipPortal =
    mounted &&
    canPortal &&
    tipVisible &&
    tipPos &&
    createPortal(
      <div
        className="chat-tooltip-floater"
        style={{
          position: "fixed",
          left: tipPos.left,
          top: tipPos.top,
          transform: "translateX(-50%)",
          zIndex: 10100,
        }}
        role="tooltip"
      >
        {tooltip}
      </div>,
      document.body,
    );

  return (
    <>
      {tooltipPortal}
      <button
        ref={triggerRef}
        type="button"
        className={className}
        aria-label={ariaLabel}
        aria-expanded={ariaExpanded}
        aria-haspopup={ariaHaspopup}
        disabled={disabled}
        onMouseEnter={() => {
          primeTipPosition();
          setHover(true);
        }}
        onMouseLeave={() => {
          setHover(false);
          setTipPos(null);
        }}
        onFocus={() => {
          primeTipPosition();
          setFocus(true);
        }}
        onBlur={() => {
          setFocus(false);
          setTipPos(null);
        }}
        onClick={onClick}
      >
        {children}
      </button>
    </>
  );
}
