'use client';

/**
 * A call, drawn as wires: dozens of thin lines carrying two voices. The agent
 * speaks on the left (blue), the patient answers on the right (teal), and the
 * lines swell and settle as each one talks. Move the mouse and the wires lift
 * under it. Lines hide the ones behind them, like a signal plot.
 *
 * Decoration with a purpose: it is the product's story (a conversation between
 * an agent and a patient) and carries no data, so it shows no numbers.
 * Honours prefers-reduced-motion with one still frame.
 */
import { useEffect, useRef } from 'react';

const BG = '#050a14';
const AGENT = [96, 165, 250];
const PATIENT = [45, 212, 191];
const WIRES = 54;
const STEP = 5;
const TURN_SECONDS = 6.5; // how long each side talks before the other answers

const bump = (x: number, centre: number, width: number) => Math.exp(-(((x - centre) / width) ** 2));

export default function CallWaves() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !host || !ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pointer = { x: 0, active: 0, target: 0 };
    let width = 0;
    let height = 0;
    let frame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (seconds: number) => {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, width, height);

      const turn = Math.sin((seconds / TURN_SECONDS) * Math.PI);
      const agentTalks = 0.14 + 0.86 * Math.max(0, turn) ** 0.7;
      const patientTalks = 0.14 + 0.86 * Math.max(0, -turn) ** 0.7;
      pointer.active += (pointer.target - pointer.active) * 0.08;

      const top = height * 0.17;
      const bottom = height * 0.5;
      const gap = (bottom - top) / (WIRES - 1);
      const reach = gap * 9;

      for (let i = 0; i < WIRES; i++) {
        const base = top + i * gap;
        const fade = 1 - Math.abs(i - WIRES / 2) / (WIRES / 2);
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        const alpha = 0.22 + 0.62 * fade;
        gradient.addColorStop(0, `rgba(${AGENT.join(',')},${alpha})`);
        gradient.addColorStop(0.42, `rgba(${AGENT.join(',')},${alpha})`);
        gradient.addColorStop(0.58, `rgba(${PATIENT.join(',')},${alpha})`);
        gradient.addColorStop(1, `rgba(${PATIENT.join(',')},${alpha})`);

        ctx.beginPath();
        for (let x = 0; x <= width + STEP; x += STEP) {
          const shimmer =
            0.5 +
            0.25 * Math.sin(x * 0.045 + seconds * 2.2 + i * 0.35) +
            0.25 * Math.sin(x * 0.11 - seconds * 3.1 + i * 0.8);
          const energy =
            agentTalks * bump(x, width * 0.3, width * 0.17) +
            patientTalks * bump(x, width * 0.7, width * 0.17) +
            pointer.active * 0.9 * bump(x, pointer.x, 90);
          const y = base - Math.min(1.4, energy) * shimmer * reach * (0.55 + 0.45 * fade);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        // Close under the line so it hides the wires behind it.
        ctx.save();
        ctx.lineTo(width + STEP, base + gap * 40);
        ctx.lineTo(0, base + gap * 40);
        ctx.closePath();
        ctx.fillStyle = BG;
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // Who is talking: the label brightens on the side that has the floor.
      ctx.font = '600 12px -apple-system, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(${AGENT.join(',')},${0.35 + 0.65 * agentTalks})`;
      ctx.fillText('AGENT', width * 0.3, top - 22);
      ctx.fillStyle = `rgba(${PATIENT.join(',')},${0.35 + 0.65 * patientTalks})`;
      ctx.fillText('PATIENT', width * 0.7, top - 22);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.target = 1;
    };
    const onLeave = () => {
      pointer.target = 0;
    };

    resize();
    const observer = new ResizeObserver(() => {
      resize();
      if (reduceMotion) draw(2.2);
    });
    observer.observe(host);

    if (reduceMotion) {
      draw(2.2);
    } else {
      host.addEventListener('pointermove', onMove);
      host.addEventListener('pointerleave', onLeave);
      const start = performance.now();
      const loop = (now: number) => {
        draw((now - start) / 1000);
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}
