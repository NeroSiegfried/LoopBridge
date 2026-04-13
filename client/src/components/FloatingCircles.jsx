import { useEffect, useRef, useCallback } from 'react';

const BASE_COLORS = [
  '#79EC94','#79ECA9','#79ECAB','#7996EC','#799CEC','#79D3EC','#79EC87','#79ECAF',
  '#79ECB2','#79ECB8','#79ECD7','#79A5EC','#79A9EC','#79ABEC','#79B4EC','#79B8EC',
  '#79BAEC','#79BEEC','#79CDEC','#79D7EC','#79DEEC','#79E8EC','#79EC83','#79EC8C',
  '#79EC9C','#79ECA5','#79ECB6','#79ECBC','#79ECBE','#79ECC4','#79ECD5','#79ECDB',
  '#7FEC79',
];

function getRandomColor() {
  const base = BASE_COLORS[Math.floor(Math.random() * BASE_COLORS.length)];
  const r = parseInt(base.slice(1, 3), 16);
  const g = parseInt(base.slice(3, 5), 16);
  const b = parseInt(base.slice(5, 7), 16);
  const rr = Math.min(255, Math.max(0, r + Math.floor(Math.random() * 30 - 15)));
  const gg = Math.min(255, Math.max(0, g + Math.floor(Math.random() * 30 - 15)));
  const bb = Math.min(255, Math.max(0, b + Math.floor(Math.random() * 30 - 15)));
  return `rgb(${rr}, ${gg}, ${bb})`;
}

/**
 * Animated floating circles background effect.
 * Used on the Home page "Join" section and the Login/Signup pages.
 *
 * @param {string} className — CSS class for the wrapper div
 * @param {number} count     — how many circles to spawn (default 30)
 */
export default function FloatingCircles({ className = 'login-circle-effect', count = 30 }) {
  const ref = useRef(null);

  const createCircle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const circle = document.createElement('div');
    circle.classList.add('circle');
    const size = Math.floor(Math.random() * 16) + 10;
    circle.style.width = `${size}px`;
    circle.style.height = `${size}px`;
    circle.style.left = `${Math.random() * 100}%`;
    circle.style.top = `${Math.random() * 100}%`;
    circle.style.backgroundColor = getRandomColor();
    const duration = Math.random() * 5 + 5;
    circle.style.animationDuration = `${duration}s`;
    circle.style.setProperty('--translateX', `${Math.random() * 6.25 - 3.125}rem`);
    circle.style.setProperty('--translateY', `${Math.random() * 6.25 - 3.125}rem`);
    el.appendChild(circle);
    setTimeout(() => { circle.remove(); createCircle(); }, duration * 1000);
  }, []);

  useEffect(() => {
    for (let i = 0; i < count; i++) createCircle();
  }, [createCircle, count]);

  return <div className={className} ref={ref} />;
}
