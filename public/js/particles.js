// ===== ADVANCED INTERACTIVE PARTICLES & MOUSE REACTIVE SYSTEM =====
(function initInteractiveBackground() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h;
  let particles = [];
  let shockwaves = [];

  // Mouse tracking state
  const mouse = {
    x: null,
    y: null,
    radius: 170,
    targetX: null,
    targetY: null,
    active: false,
    clickPulse: 0
  };

  const resize = () => {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);

  // Mouse movement listeners
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
    updateCardParallax(e.clientX, e.clientY);
  });

  window.addEventListener('mouseleave', () => {
    mouse.active = false;
    mouse.x = null;
    mouse.y = null;
    resetCardParallax();
  });

  window.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
      mouse.active = true;
      triggerShockwave(mouse.x, mouse.y);
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
      mouse.active = true;
    }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    mouse.active = false;
  });

  window.addEventListener('click', (e) => {
    triggerShockwave(e.clientX, e.clientY);
  });

  function triggerShockwave(x, y) {
    if (!x || !y) return;
    shockwaves.push({
      x,
      y,
      radius: 5,
      maxRadius: 180,
      alpha: 0.65,
      speed: 4.5,
      color: Math.random() > 0.5 ? 'rgba(255, 139, 61,' : 'rgba(45, 212, 191,'
    });
  }

  // Card 3D parallax tilt
  function updateCardParallax(cx, cy) {
    const card = document.querySelector('.term-shell');
    const gate = document.getElementById('auth-gate');
    if (!card || !gate || gate.style.display === 'none') return;

    const rect = card.getBoundingClientRect();
    const cardCenterX = rect.left + rect.width / 2;
    const cardCenterY = rect.top + rect.height / 2;

    const deltaX = (cx - cardCenterX) / (window.innerWidth / 2);
    const deltaY = (cy - cardCenterY) / (window.innerHeight / 2);

    const rotateY = deltaX * 7.5;
    const rotateX = -deltaY * 7.5;

    card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(5px)`;
    card.style.transition = 'transform 0.12s cubic-bezier(0.16, 1, 0.3, 1)';
  }

  function resetCardParallax() {
    const card = document.querySelector('.term-shell');
    if (!card) return;
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0)';
    card.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
  }

  // Tier color palette (Amber, Teal, Violet, Pure White, Electric Blue)
  const colorPalette = [
    { base: 'rgba(255, 139, 61,', r: 255, g: 139, b: 61 },
    { base: 'rgba(45, 212, 191,', r: 45, g: 212, b: 191 },
    { base: 'rgba(167, 139, 250,', r: 167, g: 139, b: 250 },
    { base: 'rgba(255, 255, 255,', r: 255, g: 255, b: 255 },
    { base: 'rgba(94, 177, 255,', r: 94, g: 177, b: 255 }
  ];

  const particleCount = Math.min(110, Math.floor((window.innerWidth * window.innerHeight) / 12000));

  for (let i = 0; i < particleCount; i++) {
    const colorObj = colorPalette[i % colorPalette.length];
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      originalVx: (Math.random() - 0.5) * 0.45,
      originalVy: (Math.random() - 0.5) * 0.45,
      radius: Math.random() * 2.2 + 0.8,
      baseAlpha: Math.random() * 0.45 + 0.25,
      color: colorObj.base,
      rgb: colorObj,
      phase: Math.random() * Math.PI * 2,
      speed: 0.015 + Math.random() * 0.025,
      mass: Math.random() * 1.5 + 1
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // 1. Draw dynamic mouse spotlight halo on canvas
    if (mouse.active && mouse.x !== null && mouse.y !== null) {
      const gradient = ctx.createRadialGradient(
        mouse.x, mouse.y, 0,
        mouse.x, mouse.y, mouse.radius * 1.3
      );
      gradient.addColorStop(0, 'rgba(255, 139, 61, 0.12)');
      gradient.addColorStop(0.4, 'rgba(45, 212, 191, 0.06)');
      gradient.addColorStop(1, 'rgba(10, 11, 13, 0)');

      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, mouse.radius * 1.3, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // 2. Process expanding shockwaves
    for (let s = shockwaves.length - 1; s >= 0; s--) {
      const sw = shockwaves[s];
      sw.radius += sw.speed;
      sw.alpha -= 0.015;

      if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
        shockwaves.splice(s, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `${sw.color} ${sw.alpha})`;
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = sw.color + ' 0.8)';
      ctx.stroke();
      ctx.shadowBlur = 0; // reset

      // Push particles outward from shockwave front
      particles.forEach((p) => {
        const dx = p.x - sw.x;
        const dy = p.y - sw.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (Math.abs(dist - sw.radius) < 30 && dist > 0) {
          const force = (1 - Math.abs(dist - sw.radius) / 30) * 3;
          p.x += (dx / dist) * force;
          p.y += (dy / dist) * force;
        }
      });
    }

    // 3. Process & draw particles
    particles.forEach((p, index) => {
      p.phase += p.speed;
      const currentAlpha = Math.min(1, p.baseAlpha * (0.7 + 0.3 * Math.sin(p.phase)));

      // Mouse interactive physics (Fluid Gravitational Push & Pull)
      if (mouse.active && mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < mouse.radius) {
          const force = (1 - dist / mouse.radius);
          const angle = Math.atan2(dy, dx);
          
          // Gentle repulsion creating fluid wake
          p.x -= Math.cos(angle) * force * 3.5;
          p.y -= Math.sin(angle) * force * 3.5;

          // Connect laser beam to mouse cursor
          ctx.beginPath();
          ctx.strokeStyle = `rgba(255, 160, 80, ${(force * 0.45).toFixed(3)})`;
          ctx.lineWidth = 1 + force * 1.5;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }

      // Draw particle glowing dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color + currentAlpha + ')';
      ctx.shadowBlur = p.radius * 4;
      ctx.shadowColor = p.color + ' 0.8)';
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw constellation mesh lines between neighboring particles
      for (let j = index + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p2.x - p.x;
        const dy = p2.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 125) {
          const lineAlpha = (1 - dist / 125) * 0.18;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(255, 139, 61, ${lineAlpha})`;
          ctx.lineWidth = 0.75;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }

      // Advance particle position
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around edges smoothly
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;
    });

    requestAnimationFrame(draw);
  }

  draw();
})();
