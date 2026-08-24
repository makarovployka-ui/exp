(function () {
  if (window.location && window.location.protocol === 'file:') {
    document.documentElement.classList.add('is-file-protocol');
  }
  var LINGUISTIC_REFERENCE_GLOBE_IMAGE = './images_source/inline-2d68aa9a60e4.png?v=20260521a';
  function drawLand(ctx, scaleX, scaleY, offsetX, offsetY, points) {
    ctx.beginPath();
    points.forEach(function (p, i) {
      var x = offsetX + p[0] * scaleX;
      var y = offsetY + p[1] * scaleY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  }

  function createReferenceLandTexture(onLoad, onError) {
    var texture = new THREE.TextureLoader().load(
      LINGUISTIC_REFERENCE_GLOBE_IMAGE,
      function () {
        if (typeof onLoad === 'function') onLoad();
      },
      undefined,
      function () {
        if (typeof onError === 'function') onError();
      }
    );
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 12;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    if ('encoding' in texture && THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  function addLatLongGrid(group, radius) {
    var material = new THREE.LineBasicMaterial({ color: 0x203245, transparent: true, opacity: 0.34 });
    var accent = new THREE.LineBasicMaterial({ color: 0x203245, transparent: true, opacity: 0.50 });
    var segments = 160;

    function lineFromPoints(points, mat) {
      var geometry = new THREE.BufferGeometry().setFromPoints(points);
      var line = new THREE.LineLoop(geometry, mat);
      group.add(line);
      return line;
    }

    [-60, -40, -20, 0, 20, 40, 60].forEach(function (lat) {
      var y = radius * Math.sin(THREE.MathUtils.degToRad(lat));
      var r = radius * Math.cos(THREE.MathUtils.degToRad(lat));
      var pts = [];
      for (var i = 0; i < segments; i++) {
        var t = (i / segments) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(t) * r, y, Math.sin(t) * r));
      }
      lineFromPoints(pts, lat === 0 ? accent : material);
    });

    for (var lon = 0; lon < 180; lon += 15) {
      var pts2 = [];
      var l = THREE.MathUtils.degToRad(lon);
      for (var j = 0; j < segments; j++) {
        var p = -Math.PI / 2 + (j / segments) * Math.PI;
        var x = radius * Math.cos(p) * Math.cos(l);
        var y2 = radius * Math.sin(p);
        var z = radius * Math.cos(p) * Math.sin(l);
        pts2.push(new THREE.Vector3(x, y2, z));
      }
      lineFromPoints(pts2, lon % 45 === 0 ? accent : material);
    }
  }

  function initGlobe(host) {
    if (!host || host.dataset.globeReady === 'true' || !window.THREE) return;
    host.dataset.globeReady = 'true';

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
    camera.position.set(0, 0, 6.15);

    var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    host.appendChild(renderer.domElement);

    var root = new THREE.Group();
    root.rotation.x = 0;
    root.rotation.z = 0;
    scene.add(root);

    var globe = new THREE.Group();
    root.add(globe);

    var globeElement = host.closest ? host.closest('.linguistic-globe') : null;
    var referenceTexture = createReferenceLandTexture(
      function () {
        if (globeElement) globeElement.classList.add('webgl-planet-ready');
      },
      function () {
        if (globeElement) globeElement.classList.add('webgl-planet-fallback');
      }
    );
    var globeRadius = 1.30;
    var base = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius, 160, 120),
      new THREE.ShaderMaterial({
        uniforms: {
          map: { value: referenceTexture },
          radius: { value: globeRadius }
        },
        vertexShader: [
          'varying vec3 vObjPos;',
          'varying vec3 vViewNormal;',
          'void main() {',
          '  vObjPos = position;',
          '  vViewNormal = normalize(normalMatrix * normal);',
          '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
          '}'
        ].join('\n'),
        fragmentShader: [
          'uniform sampler2D map;',
          'uniform float radius;',
          'varying vec3 vObjPos;',
          'varying vec3 vViewNormal;',
          'void main() {',
          '  vec2 center = vec2(0.5000, 0.5000);',
          '  vec2 texRadius = vec2(0.5000, 0.5000);',
          '  vec2 uv = center + vec2((vObjPos.x / radius) * texRadius.x, -(vObjPos.y / radius) * texRadius.y);',
          '  vec4 tex = texture2D(map, clamp(uv, 0.0, 1.0));',
          '  float front = clamp(vViewNormal.z, 0.0, 1.0);',
          '  float edgeShade = 1.0 - smoothstep(0.18, 0.98, front);',
          '  vec3 color = tex.rgb;',
          '  color = mix(color, vec3(1.0), smoothstep(0.78, 1.0, front) * 0.045);',
          '  color = mix(color, color * 0.58, edgeShade * 0.38);',
          '  gl_FragColor = vec4(color, 1.0);',
          '}'
        ].join('\n')
      })
    );
    globe.add(base);

    var rim = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius * 1.012, 128, 96),
      new THREE.MeshBasicMaterial({ color: 0x111111, wireframe: true, transparent: true, opacity: 0.0 })
    );
    globe.add(rim);

    var glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.46, 96, 64),
      new THREE.MeshBasicMaterial({ color: 0xD0DCE8, transparent: true, opacity: 0.10, side: THREE.BackSide })
    );
    root.add(glow);

    var light1 = new THREE.DirectionalLight(0xffffff, 1.25);
    light1.position.set(-3, 4, 5);
    scene.add(light1);
    var light2 = new THREE.DirectionalLight(0xA8D8D0, 0.42);
    light2.position.set(4, -2, 3);
    scene.add(light2);
    scene.add(new THREE.AmbientLight(0xffffff, 0.78));

    function resize() {
      var rect = host.getBoundingClientRect();
      var width = Math.max(10, Math.round(rect.width || host.parentElement.getBoundingClientRect().width || 460));
      var height = Math.max(10, Math.round(rect.height || host.parentElement.getBoundingClientRect().height || 460));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(host);
    window.addEventListener('resize', resize);

    var clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      var elapsed = clock.getElapsedTime();
      globe.rotation.y = 0;
      root.rotation.x = 0;
      root.rotation.z = 0;
      renderer.render(scene, camera);
    }
    animate();
  }

  function initAllLinguisticGlobes() {
    document.querySelectorAll('[data-linguistic-globe]').forEach(initGlobe);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllLinguisticGlobes);
  } else {
    initAllLinguisticGlobes();
  }
  window.addEventListener('load', initAllLinguisticGlobes);
})();

/* Mobile editorial story: reuse the page's own photographs between content sections.
   The generated blocks are hidden above the mobile breakpoint, so desktop stays intact. */
(function initMobileServicePhotoStory() {
  var servicePages = document.querySelectorAll('.single-service-page');

  function distributePhotos(hero, targets, storyKey) {
    if (!hero || !targets.length) return;
    var sourceCards = Array.prototype.slice.call(
      hero.querySelectorAll('.auto-collage-board > figure')
    );
    if (!sourceCards.length) return;

    targets.forEach(function(target, index) {
      if (target.querySelector('.mobile-service-photo-break[data-mobile-story="' + storyKey + '"]')) return;

      var photoBreak = document.createElement('aside');
      var photoCard = sourceCards[index % sourceCards.length].cloneNode(true);
      var firstArticle = target.querySelector(':scope > article');

      photoBreak.className = 'mobile-service-photo-break';
      photoBreak.setAttribute('aria-label', 'Визуальный пример по разделу');
      photoBreak.dataset.mobileStory = storyKey;

      var eyebrow = document.createElement('span');
      eyebrow.className = 'mobile-service-photo-eyebrow';
      eyebrow.textContent = 'Пример исследования';

      photoCard.classList.add('mobile-service-photo-card');
      photoCard.querySelectorAll('img').forEach(function(image) {
        image.loading = 'lazy';
      });

      photoBreak.appendChild(eyebrow);
      photoBreak.appendChild(photoCard);

      if (firstArticle) firstArticle.insertAdjacentElement('afterend', photoBreak);
      else target.insertBefore(photoBreak, target.firstChild);
    });
  }

  servicePages.forEach(function(page) {
    var panelHero = page.querySelector('.service-section-panel[data-service-panel="hero"] .auto-page-hero');
    var panelTargets = Array.prototype.slice.call(
      page.querySelectorAll('.service-section-panel:not([data-service-panel="hero"])')
    );
    distributePhotos(panelHero, panelTargets, 'section-flow');

    var standaloneHero = Array.prototype.slice.call(page.querySelectorAll('.auto-page-hero')).find(function(hero) {
      return !hero.closest('.service-section-panel');
    });
    var tabTargets = Array.prototype.slice.call(page.querySelectorAll('.linguistic-tab-panel'));
    distributePhotos(standaloneHero, tabTargets, 'tab-flow');
  });
})();

  function prepareAutoEngineImage(img) {
    if (!img || img.dataset.engineTransparentReady === 'true') return;

    function process() {
      if (img.dataset.engineTransparentReady === 'true') return;

      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (!width || !height) return;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const sampleSize = Math.max(8, Math.round(Math.min(width, height) * .035));
      const cornerSamples = [
        [0, 0],
        [width - sampleSize, 0],
        [0, height - sampleSize],
        [width - sampleSize, height - sampleSize]
      ];
      let bgR = 0;
      let bgG = 0;
      let bgB = 0;
      let bgCount = 0;

      cornerSamples.forEach(([startX, startY]) => {
        for (let y = startY; y < startY + sampleSize; y++) {
          for (let x = startX; x < startX + sampleSize; x++) {
            const i = (y * width + x) * 4;
            const a = data[i + 3];
            if (!a) continue;
            bgR += data[i];
            bgG += data[i + 1];
            bgB += data[i + 2];
            bgCount++;
          }
        }
      });

      const background = bgCount ? {
        r: bgR / bgCount,
        g: bgG / bgCount,
        b: bgB / bgCount
      } : null;

      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (!a) continue;

          const avg = (r + g + b) / 3;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const isNearWhite = min > 246;
          const isSoftWhite = min > 226 && max > 236;
          const bgDistance = background ? Math.hypot(r - background.r, g - background.g, b - background.b) : 255;
          const isLightFlatBackground = avg > 176 && max - min < 34;

          if (isNearWhite || (isLightFlatBackground && bgDistance < 38)) {
            data[i + 3] = 0;
            continue;
          }

          if (isSoftWhite || (isLightFlatBackground && bgDistance < 82)) {
            const whiteStrength = Math.max(0, Math.min(1, (242 - avg) / 20));
            const backgroundStrength = Math.max(0, Math.min(1, (bgDistance - 38) / 44));
            const strength = Math.min(whiteStrength, backgroundStrength);
            data[i + 3] = Math.round(a * strength);
          }

          if (data[i + 3] > 10) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);

      if (maxX <= minX || maxY <= minY) {
        img.dataset.engineTransparentReady = 'true';
        img.classList.add('engine-transparent-ready');
        return;
      }

      const padding = 12;
      const cropX = Math.max(0, minX - padding);
      const cropY = Math.max(0, minY - padding);
      const cropW = Math.min(width - cropX, maxX - minX + 1 + padding * 2);
      const cropH = Math.min(height - cropY, maxY - minY + 1 + padding * 2);

      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = cropW;
      croppedCanvas.height = cropH;
      const croppedCtx = croppedCanvas.getContext('2d');
      if (!croppedCtx) return;

      croppedCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      img.dataset.engineTransparentReady = 'true';
      img.classList.add('engine-transparent-ready');
      img.src = croppedCanvas.toDataURL('image/png');
    }

    if (img.complete) {
      process();
    } else {
      img.addEventListener('load', process, { once: true });
    }
  }

  function initAutoEngineTransparency() {
    document.querySelectorAll('.auto-engine-core img').forEach(prepareAutoEngineImage);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoEngineTransparency);
  } else {
    initAutoEngineTransparency();
  }

  // ── Single HTML service pages ──
  const autoTechPage = document.getElementById('autoTechPage');
  const constructionPage = document.getElementById('constructionPage');
  const handwritingPage = document.getElementById('handwritingPage');
  const economicPage = document.getElementById('economicPage');
  const computerPage = document.getElementById('computerPage');
  const phonovideoPage = document.getElementById('phonovideoPage');
  const linguisticPage = document.getElementById('linguisticPage');
  const otherPage = document.getElementById('otherPage');
  const reviewPage = document.getElementById('reviewPage');
  const commodityPage = document.getElementById('commodityPage');
  const privacyPage = document.getElementById('privacyPage');
  const autoOpenTransition = document.getElementById('autoOpenTransition');
  const handwritingOpenPaperStack = document.getElementById('handwritingOpenPaperStack');
  const handwritingOpenSignatureSvg = document.getElementById('handwritingOpenSignatureSvg');
  const handwritingOpenInkPath = document.getElementById('handwritingOpenInkPath');
  const handwritingOpenWetPath = document.getElementById('handwritingOpenWetPath');
  const handwritingOpenPen = document.getElementById('handwritingOpenPen');
  let handwritingOpenFrame = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function handwritingEase(value) {
    const t = clamp(value, 0, 1);
    return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function setHandwritingInkProgress(progress) {
    if (!handwritingOpenInkPath || !handwritingOpenSignatureSvg || !handwritingOpenPaperStack || !handwritingOpenPen) return;

    const totalLength = handwritingOpenInkPath.getTotalLength();
    const drawn = totalLength * clamp(progress, 0, 1);
    const dashOffset = Math.max(0, totalLength - drawn);
    [handwritingOpenInkPath, handwritingOpenWetPath].forEach(path => {
      if (!path) return;
      path.style.strokeDasharray = totalLength;
      path.style.strokeDashoffset = dashOffset;
    });

    const svgRect = handwritingOpenSignatureSvg.getBoundingClientRect();
    const stackRect = handwritingOpenPaperStack.getBoundingClientRect();
    const viewBox = handwritingOpenSignatureSvg.viewBox.baseVal;
    if (!svgRect.width || !svgRect.height || !viewBox.width || !viewBox.height) return;

    const currentPoint = handwritingOpenInkPath.getPointAtLength(drawn);
    const previousPoint = handwritingOpenInkPath.getPointAtLength(Math.max(0, drawn - 8));
    const nextPoint = handwritingOpenInkPath.getPointAtLength(Math.min(totalLength, drawn + 8));
    const pathAngle = Math.atan2(nextPoint.y - previousPoint.y, nextPoint.x - previousPoint.x) * 180 / Math.PI;
    const x = svgRect.left - stackRect.left + (currentPoint.x - viewBox.x) * (svgRect.width / viewBox.width);
    const y = svgRect.top - stackRect.top + (currentPoint.y - viewBox.y) * (svgRect.height / viewBox.height);
    const penAngle = 28 + clamp(pathAngle * .10, -8, 9) + Math.sin(progress * Math.PI * 8) * 1.4;
    const pressureLift = (1.4 - Math.sin(progress * Math.PI) * 2).toFixed(2);

    handwritingOpenPen.style.left = x + 'px';
    handwritingOpenPen.style.top = y + 'px';
    handwritingOpenPen.style.transform = 'translate(-50%, -98%) rotate(' + penAngle.toFixed(2) + 'deg) translateY(' + pressureLift + 'px)';
  }

  function restartHandwritingOpenAnimation() {
    if (!handwritingOpenInkPath || !handwritingOpenPen) return;
    if (handwritingOpenFrame) cancelAnimationFrame(handwritingOpenFrame);

    setHandwritingInkProgress(0);
    const start = performance.now();
    const duration = 2620;

    function draw(now) {
      const rawProgress = (now - start) / duration;
      const easedProgress = handwritingEase(rawProgress);
      setHandwritingInkProgress(easedProgress);

      if (rawProgress < 1) {
        handwritingOpenFrame = requestAnimationFrame(draw);
      } else {
        setHandwritingInkProgress(1);
        handwritingOpenFrame = null;
      }
    }

    handwritingOpenFrame = requestAnimationFrame(draw);
  }

  const servicePages = {
    'auto-tech': { page: autoTechPage, hash: '#auto-tech-page' },
    construction: { page: constructionPage, hash: '#construction-page' },
    handwriting: { page: handwritingPage, hash: '#handwriting-page' },
    economic: { page: economicPage, hash: '#economic-page' },
    computer: { page: computerPage, hash: '#computer-page' },
    phonovideo: { page: phonovideoPage, hash: '#phonovideo-page' },
    linguistic: { page: linguisticPage, hash: '#linguistic-page' },
    other: { page: otherPage, hash: '#other-page' },
    review: { page: reviewPage, hash: '#review-page' },
    commodity: { page: commodityPage, hash: '#commodity-page' },
    privacy: { page: privacyPage, hash: '#privacy-page' }
  };

  function hideAllServicePages() {
    Object.values(servicePages).forEach(({ page }) => {
      if (!page) return;
      page.classList.remove('active');
      page.setAttribute('aria-hidden', 'true');
    });
  }

  function showServicePageAfterTransition(serviceKey, updateHistory = true) {
    const config = servicePages[serviceKey];
    if (!config || !config.page) return;

    document.body.classList.add('service-page-open');
    hideAllServicePages();
    config.page.classList.remove('active');
    void config.page.offsetWidth;
    config.page.classList.add('active');
    config.page.setAttribute('aria-hidden', 'false');

    window.scrollTo({ top: 0, behavior: 'auto' });
    config.page.scrollTo?.({ top: 0, behavior: 'auto' });
    window.resetServiceInnerSections?.(serviceKey);
    if (updateHistory && location.hash !== config.hash) {
      history.pushState({ servicePage: serviceKey }, '', config.hash);
    }
  }

  function openServicePage(serviceKey, updateHistory = true) {
    closeChatWidget();
    closeServicesMenu?.();
    closeDrawer?.();

    const transitionMode = serviceKey === 'auto-tech'
      ? 'mode-auto'
      : serviceKey === 'construction'
        ? 'mode-construction'
        : serviceKey === 'handwriting'
        ? 'mode-handwriting'
        : serviceKey === 'economic'
            ? 'mode-economic'
            : serviceKey === 'linguistic'
              ? 'mode-linguistic'
              : null;

    if (autoOpenTransition && transitionMode) {
      autoOpenTransition.classList.remove('active', 'mode-auto', 'mode-construction', 'mode-handwriting', 'mode-economic', 'mode-linguistic');
      autoOpenTransition.classList.add(transitionMode);
      void autoOpenTransition.offsetWidth;
      autoOpenTransition.classList.add('active');
      autoOpenTransition.setAttribute('aria-hidden', 'false');

      if (serviceKey === 'handwriting') {
        requestAnimationFrame(restartHandwritingOpenAnimation);
      }

      setTimeout(() => {
        showServicePageAfterTransition(serviceKey, updateHistory);
      }, 2790);

      setTimeout(() => {
        autoOpenTransition.classList.remove('active');
        autoOpenTransition.setAttribute('aria-hidden', 'true');
      }, 3150);
    } else {
      showServicePageAfterTransition(serviceKey, updateHistory);
    }
  }

  function closeServicePage() {
    document.body.classList.remove('service-page-open');
    hideAllServicePages();
    if (location.hash === '#auto-tech-page' || location.hash === '#construction-page' || location.hash === '#handwriting-page' || location.hash === '#economic-page' || location.hash === '#computer-page' || location.hash === '#phonovideo-page' || location.hash === '#linguistic-page' || location.hash === '#other-page' || location.hash === '#review-page' || location.hash === '#commodity-page' || location.hash === '#privacy-page') {
      history.pushState({}, '', location.pathname + location.search);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
    Object.values(servicePages).forEach(({ page }) => page?.scrollTo?.({ top: 0, behavior: 'auto' }));
  }

  function openAutoTechPage() { openServicePage('auto-tech', true); }
  function closeAutoTechPage() { closeServicePage(); }
  function openConstructionPage() { openServicePage('construction', true); }
  function closeConstructionPage() { closeServicePage(); }
  function openHandwritingPage() { openServicePage('handwriting', true); }
  function closeHandwritingPage() { closeServicePage(); }
  function openEconomicPage() { openServicePage('economic', true); }
  function closeEconomicPage() { closeServicePage(); }
  function openComputerPage() { openServicePage('computer', true); }
  function closeComputerPage() { closeServicePage(); }
  function openPhonovideoPage() { openServicePage('phonovideo', true); }
  function closePhonovideoPage() { closeServicePage(); }
  function openLinguisticPage() { openServicePage('linguistic', true); }
  function closeLinguisticPage() { closeServicePage(); }
  function openOtherPage() { openServicePage('other', true); }
  function closeOtherPage() { closeServicePage(); }
  function openReviewPage() { openServicePage('review', true); }
  function closeReviewPage() { closeServicePage(); }
  function openCommodityPage() { openServicePage('commodity', true); }
  function closeCommodityPage() { closeServicePage(); }
  function openPrivacyPage() { openServicePage('privacy', true); }

  document.querySelectorAll('[data-open-auto-page="true"]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      openAutoTechPage();
    });
  });

  document.querySelectorAll('[data-open-construction-page="true"]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      openConstructionPage();
    });
  });


  document.querySelectorAll('[data-open-handwriting-page="true"]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      openHandwritingPage();
    });
  });

  document.querySelectorAll('[data-open-economic-page="true"]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      openEconomicPage();
    });
  });

  document.querySelectorAll('[data-open-computer-page="true"]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      openComputerPage();
    });
  });

  document.querySelectorAll('[data-open-phonovideo-page="true"]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      openPhonovideoPage();
    });
  });

  document.querySelectorAll('[data-open-linguistic-page="true"]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      openLinguisticPage();
    });
  });

  document.querySelectorAll('[data-open-other-page="true"]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      openOtherPage();
    });
  });

  document.querySelectorAll('[data-open-review-page="true"]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      openReviewPage();
    });
  });

  document.querySelectorAll('[data-open-commodity-page="true"]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      openCommodityPage();
    });
  });

  document.querySelectorAll('[data-open-privacy-page="true"]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      openPrivacyPage();
    });
  });

  document.querySelectorAll('[data-close-service-page="true"]').forEach(button => {
    button.addEventListener('click', closeOtherPage);
  });

  document.querySelectorAll('[data-service-contact="true"]').forEach(button => {
    button.addEventListener('click', () => {
      closeServicePage();
      setTimeout(() => {
        navigateTo(2);
        setTimeout(() => {
          document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 720);
      }, 40);
    });
  });

  window.addEventListener('popstate', () => {
    if (location.hash === '#auto-tech-page') {
      showServicePageAfterTransition('auto-tech', false);
    } else if (location.hash === '#construction-page') {
      showServicePageAfterTransition('construction', false);
    } else if (location.hash === '#handwriting-page') {
      showServicePageAfterTransition('handwriting', false);
    } else if (location.hash === '#economic-page') {
      showServicePageAfterTransition('economic', false);
    } else if (location.hash === '#computer-page') {
      showServicePageAfterTransition('computer', false);
    } else if (location.hash === '#phonovideo-page') {
      showServicePageAfterTransition('phonovideo', false);
    } else if (location.hash === '#linguistic-page') {
      showServicePageAfterTransition('linguistic', false);
    } else if (location.hash === '#other-page') {
      showServicePageAfterTransition('other', false);
    } else if (location.hash === '#review-page') {
      showServicePageAfterTransition('review', false);
    } else if (location.hash === '#commodity-page') {
      showServicePageAfterTransition('commodity', false);
    } else if (location.hash === '#privacy-page') {
      showServicePageAfterTransition('privacy', false);
    } else if (document.body.classList.contains('service-page-open')) {
      closeServicePage();
    }
  });

  if (location.hash === '#auto-tech-page') {
    showServicePageAfterTransition('auto-tech', false);
  } else if (location.hash === '#construction-page') {
    showServicePageAfterTransition('construction', false);
  } else if (location.hash === '#handwriting-page') {
    showServicePageAfterTransition('handwriting', false);
  } else if (location.hash === '#economic-page') {
    showServicePageAfterTransition('economic', false);
  } else if (location.hash === '#computer-page') {
    showServicePageAfterTransition('computer', false);
  } else if (location.hash === '#phonovideo-page') {
    showServicePageAfterTransition('phonovideo', false);
  } else if (location.hash === '#linguistic-page') {
    showServicePageAfterTransition('linguistic', false);
  } else if (location.hash === '#other-page') {
    showServicePageAfterTransition('other', false);
  } else if (location.hash === '#review-page') {
    showServicePageAfterTransition('review', false);
  } else if (location.hash === '#commodity-page') {
    showServicePageAfterTransition('commodity', false);
  } else if (location.hash === '#privacy-page') {
    showServicePageAfterTransition('privacy', false);
  }


  // Custom cursor
  const cursor = document.getElementById('cursor');
  const ring = document.getElementById('cursorRing');
  let mx = 0, my = 0, rx = 0, ry = 0;
  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  (function animCursor() {
    rx += (mx - rx) * .15; ry += (my - ry) * .15;
    cursor.style.left = mx + 'px'; cursor.style.top = my + 'px';
    ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
    requestAnimationFrame(animCursor);
  })();

  // Navbar shadow on scroll of current page
  document.querySelectorAll('.page').forEach(page => {
    page.addEventListener('scroll', () => {
      document.getElementById('navbar').classList.toggle('scrolled', page.scrollTop > 40);
    });
  });

  // Drawer
  function toggleDrawer() {
    const open = document.getElementById('drawer').classList.contains('open');
    open ? closeDrawer() : openDrawer();
  }
  function openDrawer() {
    closeChatWidget();
    closeServicesMenu();
    document.getElementById('drawer').classList.add('open');
    document.getElementById('drawerOverlay').classList.add('open');
    document.getElementById('hamburger').classList.add('active');
  }
  function closeDrawer() {
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('drawerOverlay').classList.remove('open');
    document.getElementById('hamburger').classList.remove('active');
  }

  const chatWidget = document.getElementById('chatWidget');
  const chatMessages = document.getElementById('chatMessages');
  const chatOptions = document.getElementById('chatOptions');
  const fabWidget = document.querySelector('.fab-widget');
  const chatFlow = {
    start: {
      bot: 'Здравствуйте! Я помогу быстро сориентироваться по услугам. Выберите, что вас интересует.',
      options: [
        { label: 'Виды экспертиз', next: 'service-help' },
        { label: 'Сколько стоит', next: 'price' },
        { label: 'Какие сроки', next: 'timing' },
        { label: 'Можно ли для суда', next: 'court' }
      ]
    },
    'service-help': {
      bot: 'Если кратко: по подписям и рукописному тексту подойдёт почерковедческая экспертиза, по угрозам, переписке и публикациям — лингвистическая, по ДТП и автомобилям — автотехническая, по дефектам зданий и ремонту — строительная, по убыткам и расчётам — экономическая. Если ваш вопрос не попадает в эти направления, можно обратиться с другим видом экспертизы — подберём формат под вашу проблему.',
      options: [
        { label: 'Почерковедческая', next: 'service-handwriting' },
        { label: 'Лингвистическая', next: 'service-linguistic' },
        { label: 'Автотехническая', next: 'service-auto' },
        { label: 'Строительная', next: 'service-construction' },
        { label: 'Экономическая', next: 'service-economic' },
        { label: 'Другой вид', next: 'service-other' },
        { label: 'Назад', next: 'start' }
      ]
    },
    price: {
      bot: 'Стоимость зависит от вида экспертизы, объёма материалов и срочности. Обычно точную цену мы подтверждаем после короткого уточнения задачи и документов.',
      options: [
        { label: 'Какие сроки', next: 'timing' },
        { label: 'Связаться с менеджером', action: 'manager' },
        { label: 'Назад', next: 'start' }
      ]
    },
    timing: {
      bot: 'Срок зависит от сложности. Простые задачи можно оценить быстро, а более объёмные экспертизы требуют больше времени. Для срочных случаев можно отдельно обсудить приоритетный запуск.',
      options: [
        { label: 'Сколько стоит', next: 'price' },
        { label: 'Виды экспертиз', next: 'service-help' },
        { label: 'Назад', next: 'start' }
      ]
    },
    court: {
      bot: 'Да, сайт и структура услуг ориентированы на экспертные заключения, которые можно использовать в переговорах, претензионной работе и судебных спорах. Но конкретный формат лучше уточнить под вашу задачу.',
      options: [
        { label: 'Связаться с менеджером', action: 'manager' },
        { label: 'Виды экспертиз', next: 'service-help' },
        { label: 'Назад', next: 'start' }
      ]
    },
    'service-handwriting': {
      bot: 'Почерковедческая экспертиза помогает проверить подписи, рукописные записи, расписки, доверенности, договоры и другие документы, где важно установить исполнителя или признаки подделки.',
      options: [
        { label: 'Какие документы нужны', next: 'docs-handwriting' },
        { label: 'Связаться с менеджером', action: 'manager' },
        { label: 'Назад к выбору', next: 'service-help' }
      ]
    },
    'service-linguistic': {
      bot: 'Лингвистическая экспертиза нужна для анализа переписки, публикаций, комментариев, угроз, оскорблений, репутационных споров, вопросов авторства и смысла формулировок.',
      options: [
        { label: 'Какие документы нужны', next: 'docs-linguistic' },
        { label: 'Связаться с менеджером', action: 'manager' },
        { label: 'Назад к выбору', next: 'service-help' }
      ]
    },
    'service-auto': {
      bot: 'Автотехническая экспертиза подходит для ДТП, оценки повреждений, анализа обстоятельств происшествия, технического состояния автомобиля и споров со страховой или участниками ДТП.',
      options: [
        { label: 'Какие документы нужны', next: 'docs-auto' },
        { label: 'Связаться с менеджером', action: 'manager' },
        { label: 'Назад к выбору', next: 'service-help' }
      ]
    },
    'service-construction': {
      bot: 'Строительная экспертиза помогает по трещинам, дефектам ремонта, качеству строительных работ, сметам, объёмам и техническому состоянию объекта.',
      options: [
        { label: 'Какие документы нужны', next: 'docs-construction' },
        { label: 'Связаться с менеджером', action: 'manager' },
        { label: 'Назад к выбору', next: 'service-help' }
      ]
    },
    'service-economic': {
      bot: 'Экономическая экспертиза нужна для расчёта убытков, анализа задолженности, бухгалтерских документов, финансовых споров и экономических обоснований.',
      options: [
        { label: 'Какие документы нужны', next: 'docs-economic' },
        { label: 'Связаться с менеджером', action: 'manager' },
        { label: 'Назад к выбору', next: 'service-help' }
      ]
    },
    'service-other': {
      bot: 'Если нужного направления нет в списке, опишите ситуацию: спор, документы, ущерб, объект исследования и цель обращения. Мы подскажем, какой вид экспертизы подходит и какие материалы лучше подготовить.',
      options: [
        { label: 'Связаться с менеджером', action: 'manager' },
        { label: 'Назад к выбору', next: 'service-help' }
      ]
    },
    'docs-handwriting': {
      bot: 'Для почерковедческой экспертизы обычно нужны оригиналы или качественные копии спорного документа, образцы подписи или почерка для сравнения, а также пояснение, что именно нужно установить.',
      options: [
        { label: 'Связаться с менеджером', action: 'manager' },
        { label: 'Назад к виду экспертизы', next: 'service-handwriting' }
      ]
    },
    'docs-linguistic': {
      bot: 'Для лингвистической экспертизы обычно нужны тексты, переписка, публикации, комментарии, аудиозаписи с расшифровкой или скриншоты материалов, которые нужно проанализировать.',
      options: [
        { label: 'Связаться с менеджером', action: 'manager' },
        { label: 'Назад к виду экспертизы', next: 'service-linguistic' }
      ]
    },
    'docs-auto': {
      bot: 'Для автотехнической экспертизы обычно нужны документы по ДТП, фото и видео повреждений, схема происшествия, страховые материалы, акты осмотра, а при необходимости документы на автомобиль и ремонт.',
      options: [
        { label: 'Связаться с менеджером', action: 'manager' },
        { label: 'Назад к виду экспертизы', next: 'service-auto' }
      ]
    },
    'docs-construction': {
      bot: 'Для строительной экспертизы обычно нужны договор, смета, проектная и техническая документация, акты выполненных работ, фото и видео дефектов, а также доступ к объекту для осмотра, если он нужен.',
      options: [
        { label: 'Связаться с менеджером', action: 'manager' },
        { label: 'Назад к виду экспертизы', next: 'service-construction' }
      ]
    },
    'docs-economic': {
      bot: 'Для экономической экспертизы обычно нужны договоры, счета, акты, бухгалтерские документы, расчёты, переписка по обязательствам и иные финансовые материалы, связанные со спором.',
      options: [
        { label: 'Связаться с менеджером', action: 'manager' },
        { label: 'Назад к виду экспертизы', next: 'service-economic' }
      ]
    }
  };
  let chatWidgetInitialized = false;
  let fabPeekTimeout = null;
  let fabPeekInterval = null;

  function playFabPeek() {
    if (!fabWidget || document.body.classList.contains('chat-widget-open')) return;
    fabWidget.classList.remove('is-peeking');
    void fabWidget.offsetWidth;
    fabWidget.classList.add('is-peeking');
    window.clearTimeout(fabPeekTimeout);
    fabPeekTimeout = window.setTimeout(() => {
      fabWidget.classList.remove('is-peeking');
    }, 6900);
  }

  function scheduleFabPeek() {
    if (!fabWidget || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    window.clearTimeout(fabPeekTimeout);
    window.clearInterval(fabPeekInterval);
    fabWidget.classList.remove('is-peeking');
    fabPeekTimeout = window.setTimeout(playFabPeek, 5000);
    fabPeekInterval = window.setInterval(() => {
      if (!document.body.classList.contains('chat-widget-open')) playFabPeek();
    }, 30000);
  }

  function appendChatMessage(role, text) {
    if (!chatMessages) return;
    const bubble = document.createElement('div');
    bubble.className = `chat-widget__bubble ${role}`;
    bubble.textContent = text;
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function renderChatOptions(options) {
    if (!chatOptions) return;
    chatOptions.innerHTML = '';
    options.forEach(option => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chat-widget__option';
      button.textContent = option.label;
      button.addEventListener('click', () => {
        appendChatMessage('user', option.label);
        if (option.action === 'manager') {
          appendChatMessage('bot', 'Открываю блок связи с менеджером. Там можно выбрать услугу и сразу оставить запрос.');
          openDrawer();
          closeChatWidget();
          return;
        }
        setTimeout(() => runChatStep(option.next), 140);
      });
      chatOptions.appendChild(button);
    });
  }

  function runChatStep(stepKey) {
    const step = chatFlow[stepKey];
    if (!step) return;
    appendChatMessage('bot', step.bot);
    renderChatOptions(step.options || []);
  }

  function resetChatWidget() {
    if (!chatMessages || !chatOptions) return;
    chatMessages.innerHTML = '';
    chatOptions.innerHTML = '';
    chatWidgetInitialized = true;
    runChatStep('start');
  }

  function openChatWidget() {
    if (!chatWidget) return;
    closeDrawer();
    closeServicesMenu();
    document.body.classList.add('chat-widget-open');
    chatWidget.classList.add('open');
    chatWidget.setAttribute('aria-hidden', 'false');
    if (!chatWidgetInitialized) resetChatWidget();
  }

  function closeChatWidget() {
    if (!chatWidget) return;
    document.body.classList.remove('chat-widget-open');
    chatWidget.classList.remove('open');
    chatWidget.setAttribute('aria-hidden', 'true');
  }

  function toggleChatWidget() {
    if (!chatWidget) return;
    chatWidget.classList.contains('open') ? closeChatWidget() : openChatWidget();
  }

  scheduleFabPeek();

  // Services quick menu
  function setServicesMenuPanel(panelName) {
    const layer = document.getElementById('servicesPopoverLayer');
    if (!layer) return;
    const target = panelName || 'choice';
    layer.querySelectorAll('[data-services-panel]').forEach(panel => {
      const isActive = panel.getAttribute('data-services-panel') === target;
      panel.classList.toggle('active', isActive);
      panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });
  }

  function openServicesMenu() {
    closeChatWidget();
    closeDrawer();
    const layer = document.getElementById('servicesPopoverLayer');
    const trigger = document.getElementById('servicesMenuTrigger');
    if (!layer) return;
    setServicesMenuPanel('choice');
    layer.classList.add('open');
    layer.setAttribute('aria-hidden', 'false');
    trigger?.classList.add('active');
    trigger?.setAttribute('aria-expanded', 'true');
  }
  function closeServicesMenu() {
    const layer = document.getElementById('servicesPopoverLayer');
    const trigger = document.getElementById('servicesMenuTrigger');
    if (!layer) return;
    layer.classList.remove('open');
    layer.setAttribute('aria-hidden', 'true');
    trigger?.classList.remove('active');
    trigger?.setAttribute('aria-expanded', 'false');
    setServicesMenuPanel('choice');
  }
  function toggleServicesMenu() {
    const layer = document.getElementById('servicesPopoverLayer');
    layer?.classList.contains('open') ? closeServicesMenu() : openServicesMenu();
  }
  document.getElementById('servicesMenuTrigger')?.addEventListener('click', e => {
    e.preventDefault();
    toggleServicesMenu();
  });
  document.querySelectorAll('[data-show-expertise-menu="true"]').forEach(button => {
    button.addEventListener('click', () => setServicesMenuPanel('expertise'));
  });
  document.querySelectorAll('[data-show-services-choice="true"]').forEach(button => {
    button.addEventListener('click', () => setServicesMenuPanel('choice'));
  });

  // ── PAGE NAVIGATION ──
  const PAGE_IDS = ['hero', 'services', 'why'];
  let currentPage = 0;

  function navigateTo(index) {
    if (index < 0 || index >= PAGE_IDS.length) return;
    currentPage = index;
    document.getElementById('pageTrack').style.transform =
      `translateY(calc(${index} * -100vh))`;

    // Trigger reveal animations in target page
    const pages = document.querySelectorAll('.page');
    if (pages[index]) {
      pages[index].querySelectorAll('.reveal').forEach(el => {
        el.classList.add('visible');
      });
      // Scroll target page back to top
      pages[index].scrollTop = 0;
    }
    closeDrawer();
    closeServicesMenu();
    closeChatWidget();
  }

  // "К услугам" hero button
  const heroNextBtn = document.getElementById('openNextSection');
  if (heroNextBtn) {
    heroNextBtn.addEventListener('click', () => navigateTo(1));
  }

  // Nav bar links
  const navMap = { services: 1, why: 2, process: 2, contact: 2 };
  document.querySelectorAll('.nav-links a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const id = link.getAttribute('href').slice(1);
      if (navMap[id] !== undefined) {
        navigateTo(navMap[id]);
        if (navMap[id] === 2 && id !== 'why') {
          setTimeout(() => {
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 720);
        }
      }
    });
  });

  // Drawer links → go to services
  document.querySelectorAll('.drawer-nav a').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      if (link.dataset.drawerPage !== undefined) {
        const pageIndex = Number(link.dataset.drawerPage);
        const scrollTarget = link.dataset.drawerScroll;
        navigateTo(pageIndex);
        if (scrollTarget) {
          setTimeout(() => {
            document.getElementById(scrollTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 720);
        }
        return;
      }
      navigateTo(1);
    });
  });

  // Immediately show reveals on page 0 (hero) and trigger rest on navigate
  document.querySelectorAll('.page')[0]?.querySelectorAll('.reveal').forEach(el => {
    el.classList.add('visible');
  });

  // Auto-size map bubbles via Canvas (works regardless of element opacity/visibility)
  document.fonts.ready.then(() => {
    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');
    const svgEl  = document.querySelector('.russia-map-overlay');
    if (!svgEl) return;

    // Measure text width accounting for per-character letter-spacing
    function measureSpaced(text, fontStr, lsEm, fsPx) {
      ctx.font = fontStr;
      let w = 0;
      for (let i = 0; i < text.length; i++) {
        w += ctx.measureText(text[i]).width;
        if (i < text.length - 1) w += lsEm * fsPx;
      }
      return w;
    }

    document.querySelectorAll('.message-card').forEach(card => {
      const bubbleRect = card.querySelector('rect.bubble');
      if (!bubbleRect) return;

      const svgBounds = svgEl.getBoundingClientRect();
      const pxPerUnit = svgBounds.width / 1940; // screen px per 1 SVG unit
      const MSG_SCALE = 2;                       // scale(2) on .message-card

      let maxWidthUnits = 0;

      card.querySelectorAll('text').forEach(textEl => {
        const isTag  = textEl.classList.contains('bubble-tag');
        const fsSVG  = isTag ? 14 : 18;
        const lsEm   = isTag ? 0.04 : -0.01;
        const fsPx   = fsSVG * MSG_SCALE * pxPerUnit;
        const font   = `800 ${fsPx}px Raleway, sans-serif`;

        const tspans = textEl.querySelectorAll('tspan');
        const lines  = tspans.length
          ? Array.from(tspans).map(n => n.textContent)
          : [textEl.textContent];

        lines.forEach(line => {
          const txt    = isTag ? line.toUpperCase() : line;
          const wPx    = measureSpaced(txt, font, lsEm, fsPx);
          const wUnits = wPx / pxPerUnit / MSG_SCALE;
          if (wUnits > maxWidthUnits) maxWidthUnits = wUnits;
        });
      });

      if (maxWidthUnits > 0) {
        const rectX  = parseFloat(bubbleRect.getAttribute('x')); // 20
        const textX  = 36; // text always starts at x=36
        bubbleRect.setAttribute('width', Math.ceil((textX - rectX) + maxWidthUnits + 20));
      }
    });
  });

  // ── OVERSCROLL → NAVIGATE ──
  (function () {
    const THRESHOLD = 560;   // longer overscroll before trigger
    const pages = Array.from(document.querySelectorAll('.page'));

    // Set transform-origin so buttons grow away from content, not into it
    function prepareOverscrollButton(btn, origin) {
      btn.style.transformOrigin = origin;
      // Do not override absolute-positioned hero buttons: changing them to
      // relative makes the “К услугам” button drift during overscroll.
      if (getComputedStyle(btn).position === 'static') {
        btn.style.position = 'relative';
      }

      const fill = document.createElement('span');
      fill.className = 'nav-overscroll-fill';
      btn.prepend(fill);

      const ring = document.createElement('span');
      ring.className = 'nav-overscroll-ring';
      btn.appendChild(ring);
    }

    document.querySelectorAll('.section-nav-btn').forEach(btn => {
      prepareOverscrollButton(btn, 'bottom center'); // top buttons grow upward, away from content
    });
    document.querySelectorAll('.hero-next').forEach(btn => {
      prepareOverscrollButton(btn, 'top center');    // bottom buttons grow downward, away from content
    });

    function findBtn(page, pageIdx, dir) {
      if (dir < 0) return page.querySelector('.section-nav-btn');
      if (pageIdx === 0) return page.querySelector('#openNextSection');
      return page.querySelector('.hero-next') ||
             page.querySelector('[onclick*="navigateTo(' + (pageIdx + 1) + ')"]') || null;
    }

    function applyProgress(btn, progress) {
      if (!btn) return;
      const p = Math.min(progress, 1);
      const isHeroMain = btn.id === 'openNextSection';

      // The main “К услугам” button sits between hero objects, so it should not
      // physically grow or move during overscroll. Only the ring shows progress.
      if (isHeroMain) {
        // Keep “К услугам” completely fixed: no left/transform writes here,
        // because repeated inline transform updates caused the visible left jerk.
        btn.style.transition = 'box-shadow .15s ease, border-color .15s ease';
      } else {
        const s = 1 + p * 0.10;
        const offset = p * 8;
        const shift = btn.classList.contains('hero-next')
          ? `translateY(${offset.toFixed(1)}px) `
          : `translateY(-${offset.toFixed(1)}px) `;
        btn.style.transform  = shift + `scale(${s.toFixed(3)})`;
        btn.style.transition = 'transform .15s ease, box-shadow .15s ease';
      }

      btn.classList.toggle('overscroll-active', p > 0.02);

      const fill = btn.querySelector('.nav-overscroll-fill');
      if (fill) {
        // Smoother visual fill: CSS transform is GPU-friendly and the eased value
        // removes the stepped/jittery feel from wheel and touch events.
        const eased = 1 - Math.pow(1 - p, 1.45);
        fill.style.setProperty('--overscroll-progress', eased.toFixed(4));
        fill.style.opacity = Math.min(0.92, 0.14 + eased * 0.78).toFixed(2);
      }

      const ring = btn.querySelector('.nav-overscroll-ring');
      if (ring) {
        ring.style.opacity = (p * 0.85).toFixed(2);
        const inset = Math.round((1 - p) * 8) - 4;
        ring.style.inset = inset + 'px';
      }
    }

    function resetBtn(btn) {
      if (!btn) return;
      if (btn.id === 'openNextSection') {
        // Position is controlled only by CSS to prevent horizontal jitter.
        btn.style.removeProperty('left');
        btn.style.removeProperty('transform');
      } else {
        btn.style.transform = '';
      }
      btn.style.transition = 'transform .3s ease';
      btn.classList.remove('overscroll-active');
      const fill = btn.querySelector('.nav-overscroll-fill');
      if (fill) {
        fill.style.setProperty('--overscroll-progress', '0');
        fill.style.opacity = '0';
      }
      const ring = btn.querySelector('.nav-overscroll-ring');
      if (ring) { ring.style.opacity = '0'; ring.style.inset = '-4px'; }
    }

    pages.forEach((page, idx) => {
      let accum     = 0;
      let lastDir   = 0;
      let triggered = false;
      let timer     = null;

      function reset() {
        resetBtn(findBtn(page, idx, -1));
        resetBtn(findBtn(page, idx,  1));
        accum = 0; lastDir = 0; triggered = false;
      }

      page.addEventListener('wheel', e => {
        const atTop    = page.scrollTop <= 1;
        const atBottom = page.scrollTop >= page.scrollHeight - page.clientHeight - 2;
        const dir      = e.deltaY < 0 ? -1 : 1;
        const blocked  = (dir < 0 && atTop) || (dir > 0 && atBottom);

        if (!blocked) { if (accum) reset(); return; }

        e.preventDefault();

        if (dir !== lastDir) { accum = 0; lastDir = dir; triggered = false; }
        accum += Math.abs(e.deltaY);

        const target = idx + dir;
        const canNav = target >= 0 && target < pages.length;

        if (canNav) applyProgress(findBtn(page, idx, dir), accum / THRESHOLD);

        clearTimeout(timer);
        timer = setTimeout(reset, 600);

        if (!triggered && accum >= THRESHOLD && canNav) {
          triggered = true;
          setTimeout(() => { navigateTo(target); reset(); }, 130);
        }
      }, { passive: false });

      // Touch support
      let ty0 = 0, touchActive = false;
      page.addEventListener('touchstart', e => {
        ty0 = e.touches[0].clientY; touchActive = true; accum = 0; triggered = false;
      }, { passive: true });

      page.addEventListener('touchmove', e => {
        if (!touchActive) return;
        const dy   = ty0 - e.touches[0].clientY;
        const dir  = dy > 0 ? 1 : -1;
        const atTop    = page.scrollTop <= 1;
        const atBottom = page.scrollTop >= page.scrollHeight - page.clientHeight - 2;
        const blocked  = (dir < 0 && atTop) || (dir > 0 && atBottom);
        if (!blocked) return;
        e.preventDefault();
        if (dir !== lastDir) { accum = 0; lastDir = dir; triggered = false; }
        accum = Math.abs(dy);
        const target = idx + dir;
        const canNav = target >= 0 && target < pages.length;
        if (canNav) applyProgress(findBtn(page, idx, dir), accum / THRESHOLD);
        if (!triggered && accum >= THRESHOLD && canNav) {
          triggered = true;
          navigateTo(target); reset();
        }
      }, { passive: false });

      page.addEventListener('touchend', () => { touchActive = false; setTimeout(reset, 400); }, { passive: true });
    });
  })();

  // Close drawer on Escape
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDrawer(); closeServicesMenu(); closeChatWidget(); } });


  // Auto and construction pages: separated section panels + matching prev/next overscroll buttons
  (function(){
    const CONFIGS = {
      'auto-tech': {
        pageId: 'autoTechPage',
        order: ['hero', 'scope', 'analysis', 'process']
      },
      economic: {
        pageId: 'economicPage',
        order: ['hero', 'scope', 'types', 'process', 'materials', 'benefits']
      },
      computer: {
        pageId: 'computerPage',
        order: ['hero', 'scope', 'types', 'process', 'materials', 'benefits']
      },
      phonovideo: {
        pageId: 'phonovideoPage',
        order: ['hero', 'scope', 'types', 'process', 'materials', 'benefits']
      },
      handwriting: {
        pageId: 'handwritingPage',
        order: ['hero', 'scope', 'types', 'process', 'materials', 'benefits']
      },
      commodity: {
        pageId: 'commodityPage',
        order: ['hero', 'scope', 'types', 'process', 'materials', 'benefits']
      },
      construction: {
        pageId: 'constructionPage',
        order: ['hero', 'scope', 'types', 'workflow']
      }
    };
    const THRESHOLD = 560;

    function getPage(serviceKey){
      const cfg = CONFIGS[serviceKey];
      return cfg ? document.getElementById(cfg.pageId) : null;
    }

    function getFlow(serviceKey){
      const page = getPage(serviceKey);
      return page ? page.querySelector('[data-service-sections]') : null;
    }

    function currentPanel(serviceKey){
      const flow = getFlow(serviceKey);
      const active = flow ? flow.querySelector('[data-service-panel].active') : null;
      return active ? active.getAttribute('data-service-panel') : CONFIGS[serviceKey].order[0];
    }

    function nextPanel(serviceKey){
      const order = CONFIGS[serviceKey].order;
      const idx = order.indexOf(currentPanel(serviceKey));
      return order[idx + 1] || null;
    }

    function prevPanel(serviceKey){
      const order = CONFIGS[serviceKey].order;
      const idx = order.indexOf(currentPanel(serviceKey));
      return idx > 0 ? order[idx - 1] : null;
    }

    function activeButton(serviceKey, direction){
      const flow = getFlow(serviceKey);
      const current = currentPanel(serviceKey);
      const target = direction === 'prev' ? prevPanel(serviceKey) : nextPanel(serviceKey);
      if (!flow || !target) return null;
      return flow.querySelector('[data-service-panel="' + current + '"] .service-section-btn[data-service-dir="' + direction + '"][data-service-goto="' + target + '"]');
    }

    function prepareButton(btn){
      if (!btn) return;
      if (!btn.querySelector('.nav-overscroll-fill')) {
        const fill = document.createElement('span');
        fill.className = 'nav-overscroll-fill';
        btn.prepend(fill);
      }
      if (!btn.querySelector('.nav-overscroll-ring')) {
        const ring = document.createElement('span');
        ring.className = 'nav-overscroll-ring';
        btn.appendChild(ring);
      }
    }

    function applyProgress(btn, progress, direction){
      if (!btn) return;
      const p = Math.min(progress, 1);
      const s = 1 + p * 0.10;
      const offset = p * 8 * (direction === 'prev' ? -1 : 1);
      btn.style.transform = `translateY(${offset.toFixed(1)}px) scale(${s.toFixed(3)})`;
      btn.style.transition = 'transform .15s ease, box-shadow .15s ease, border-color .15s ease';
      btn.classList.toggle('overscroll-active', p > 0.02);
      const fill = btn.querySelector('.nav-overscroll-fill');
      if (fill) {
        const eased = 1 - Math.pow(1 - p, 1.45);
        fill.style.setProperty('--overscroll-progress', eased.toFixed(4));
        fill.style.opacity = Math.min(0.92, 0.14 + eased * 0.78).toFixed(2);
      }
      const ring = btn.querySelector('.nav-overscroll-ring');
      if (ring) {
        ring.style.opacity = (p * 0.85).toFixed(2);
        const inset = Math.round((1 - p) * 8) - 4;
        ring.style.inset = inset + 'px';
      }
    }

    function resetButton(btn){
      if (!btn) return;
      btn.style.transform = '';
      btn.style.transition = 'transform .3s ease';
      btn.classList.remove('overscroll-active');
      const fill = btn.querySelector('.nav-overscroll-fill');
      if (fill) {
        fill.style.setProperty('--overscroll-progress', '0');
        fill.style.opacity = '0';
      }
      const ring = btn.querySelector('.nav-overscroll-ring');
      if (ring) {
        ring.style.opacity = '0';
        ring.style.inset = '-4px';
      }
    }

    function activePanelElement(serviceKey){
      const flow = getFlow(serviceKey);
      return flow ? flow.querySelector('[data-service-panel].active') : null;
    }

    function applyPanelNudge(serviceKey, direction, progress){
      const panel = activePanelElement(serviceKey);
      if (!panel) return;
      const p = Math.min(progress, 1);
      const isConstructionHero = serviceKey === 'construction' && panel.getAttribute('data-service-panel') === 'hero';
      const maxOffset = isConstructionHero ? 32 : 10;
      const easedPanel = 1 - Math.pow(1 - p, 1.65);
      const offset = Math.min(maxOffset, easedPanel * maxOffset) * (direction === 'prev' ? 1 : -1);
      panel.style.setProperty('transition', isConstructionHero ? 'transform .36s cubic-bezier(.16,1,.3,1)' : 'transform .22s cubic-bezier(.22,1,.36,1)', 'important');
      panel.style.setProperty('transform', `translate3d(0, ${offset.toFixed(1)}px, 0)`, 'important');
    }

    function resetPanelNudge(serviceKey){
      const panel = activePanelElement(serviceKey);
      if (!panel) return;
      const isConstructionHero = serviceKey === 'construction' && panel.getAttribute('data-service-panel') === 'hero';
      panel.style.setProperty('transition', isConstructionHero ? 'transform .72s cubic-bezier(.16,1,.3,1)' : 'transform .42s cubic-bezier(.22,1,.36,1)', 'important');
      panel.style.removeProperty('transform');
    }

    function resetAllButtons(serviceKey){
      const flow = getFlow(serviceKey);
      if (!flow) return;
      flow.querySelectorAll('.service-section-btn').forEach(btn => {
        prepareButton(btn);
        resetButton(btn);
      });
    }

    function openPanel(serviceKey, target){
      const page = getPage(serviceKey);
      const flow = getFlow(serviceKey);
      if (!page || !flow || !target) return;
      page.scrollTo({ top: 0, behavior: 'auto' });
      flow.querySelectorAll('[data-service-panel]').forEach(panel => {
        const isActive = panel.getAttribute('data-service-panel') === target;
        panel.classList.toggle('active', isActive);
        panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      });
      page.classList.toggle('service-inner-section-active', target !== CONFIGS[serviceKey].order[0]);
      resetAllButtons(serviceKey);
      requestAnimationFrame(() => {
        page.scrollTo({ top: 0, behavior: 'auto' });
        resetPanelNudge(serviceKey);
      });
    }

    window.resetServiceInnerSections = function(serviceKey){
      if (!CONFIGS[serviceKey]) return;
      openPanel(serviceKey, CONFIGS[serviceKey].order[0]);
    };

    function initService(serviceKey){
      const page = getPage(serviceKey);
      const flow = getFlow(serviceKey);
      if (!page || !flow || page.dataset.serviceSectionNavReady === 'true') return;
      page.dataset.serviceSectionNavReady = 'true';

      flow.querySelectorAll('.service-section-btn').forEach(btn => {
        prepareButton(btn);
        btn.addEventListener('click', () => openPanel(serviceKey, btn.getAttribute('data-service-goto')));
      });

      let accum = 0;
      let triggered = false;
      let timer = null;
      let touchStartY = 0;
      let touchActive = false;

      function reset(){
        resetButton(activeButton(serviceKey, 'next'));
        resetButton(activeButton(serviceKey, 'prev'));
        resetPanelNudge(serviceKey);
        accum = 0;
        triggered = false;
      }

      page.addEventListener('wheel', event => {
        const scrollRange = Math.max(0, page.scrollHeight - page.clientHeight);
        const compactRange = scrollRange <= 42;
        const isConstructionHero = serviceKey === 'construction' && currentPanel(serviceKey) === 'hero';
        const constructionMobile = isConstructionHero && window.matchMedia('(max-width: 900px)').matches;
        if (constructionMobile) return;
        const treatHeroAsBoundary = isConstructionHero && !constructionMobile;
        const atBottom = page.scrollTop >= scrollRange - 2;
        const atTop = page.scrollTop <= 2;
        const scrollingDown = event.deltaY > 0;
        const scrollingUp = event.deltaY < 0;
        const direction = scrollingDown && (atBottom || compactRange || treatHeroAsBoundary) ? 'next' : (scrollingUp && (atTop || treatHeroAsBoundary) ? 'prev' : null);
        const btn = direction ? activeButton(serviceKey, direction) : null;

        /* The first construction section has no previous panel, but it still needs
           the same tactile movement up and down. In that case we nudge only the
           panel itself, without looking for a non-existent prev button. */
        if (!btn && !(treatHeroAsBoundary && direction === 'prev')) {
          if (accum) reset();
          return;
        }

        event.preventDefault();
        accum += Math.abs(event.deltaY);
        const progress = accum / THRESHOLD;
        if (btn) applyProgress(btn, progress, direction);
        applyPanelNudge(serviceKey, direction, progress);
        clearTimeout(timer);
        timer = setTimeout(reset, 420);

        if (btn && !triggered && accum >= THRESHOLD) {
          triggered = true;
          setTimeout(() => {
            openPanel(serviceKey, btn.getAttribute('data-service-goto'));
            reset();
          }, 130);
        }
      }, { passive: false });

      page.addEventListener('touchstart', event => {
        touchStartY = event.touches[0].clientY;
        touchActive = true;
        accum = 0;
        triggered = false;
      }, { passive: true });

      page.addEventListener('touchmove', event => {
        if (!touchActive) return;
        const dy = touchStartY - event.touches[0].clientY;
        const scrollRange = Math.max(0, page.scrollHeight - page.clientHeight);
        const compactRange = scrollRange <= 42;
        const isConstructionHero = serviceKey === 'construction' && currentPanel(serviceKey) === 'hero';
        const constructionMobile = isConstructionHero && window.matchMedia('(max-width: 900px)').matches;
        if (constructionMobile) return;
        const treatHeroAsBoundary = isConstructionHero && !constructionMobile;
        const atBottom = page.scrollTop >= scrollRange - 2;
        const atTop = page.scrollTop <= 2;
        const direction = dy > 0 && (atBottom || compactRange || treatHeroAsBoundary) ? 'next' : (dy < 0 && (atTop || treatHeroAsBoundary) ? 'prev' : null);
        const btn = direction ? activeButton(serviceKey, direction) : null;

        if (!btn && !(treatHeroAsBoundary && direction === 'prev')) {
          if (accum) reset();
          return;
        }

        event.preventDefault();
        accum = Math.abs(dy);
        const progress = accum / THRESHOLD;
        if (btn) applyProgress(btn, progress, direction);
        applyPanelNudge(serviceKey, direction, progress);
        if (btn && !triggered && accum >= THRESHOLD) {
          triggered = true;
          openPanel(serviceKey, btn.getAttribute('data-service-goto'));
          reset();
        }
      }, { passive: false });

      page.addEventListener('touchend', () => {
        touchActive = false;
        setTimeout(reset, 400);
      }, { passive: true });
    }

    function init(){
      Object.keys(CONFIGS).forEach(initService);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();


  // Tabbed service pages: same bottom-button and overscroll logic as the main page
  (function(){
    const ORDER = ['overview', 'types', 'process', 'materials', 'benefits'];
    const THRESHOLD = 560;

    function pageFor(r){ return r ? r.closest('.single-service-page') : null; }

    function currentPanelName(r){
      const active = r.querySelector('[data-linguistic-panel].active');
      return active ? active.getAttribute('data-linguistic-panel') : ORDER[0];
    }

    function nextPanelName(r){
      const idx = ORDER.indexOf(currentPanelName(r));
      return ORDER[idx + 1] || null;
    }

    function prevPanelName(r){
      const idx = ORDER.indexOf(currentPanelName(r));
      return idx > 0 ? ORDER[idx - 1] : null;
    }

    function activeNextButton(r){
      const current = currentPanelName(r);
      const next = nextPanelName(r);
      if (!next) return null;
      return r.querySelector('[data-linguistic-panel="' + current + '"] .linguistic-next-btn[data-linguistic-goto="' + next + '"]');
    }

    function activePrevButton(r){
      const current = currentPanelName(r);
      const prev = prevPanelName(r);
      if (!prev) return null;
      return r.querySelector('[data-linguistic-panel="' + current + '"] :is(.linguistic-scroll-btn, .linguistic-prev-btn)[data-linguistic-dir="prev"][data-linguistic-goto="' + prev + '"]');
    }

    function prepareButton(btn){
      if (!btn) return;
      btn.style.transformOrigin = 'top center';
      if (!btn.querySelector('.nav-overscroll-fill')) {
        const fill = document.createElement('span');
        fill.className = 'nav-overscroll-fill';
        btn.prepend(fill);
      }
      if (!btn.querySelector('.nav-overscroll-ring')) {
        const ring = document.createElement('span');
        ring.className = 'nav-overscroll-ring';
        btn.appendChild(ring);
      }
    }

    function applyProgress(btn, progress, direction = 'next'){
      if (!btn) return;
      const p = Math.max(0, Math.min(progress, 1));
      const s = 1 + p * 0.10;
      const offset = p * 8 * (direction === 'prev' ? -1 : 1);
      btn.style.transform = `translateY(${offset.toFixed(1)}px) scale(${s.toFixed(3)})`;
      btn.style.transition = 'transform .15s ease, box-shadow .15s ease, border-color .15s ease';
      btn.classList.toggle('overscroll-active', p > 0.02);
      btn.classList.toggle('overscroll-complete', p >= 0.999);

      const fill = btn.querySelector('.nav-overscroll-fill');
      if (fill) {
        const eased = 1 - Math.pow(1 - p, 1.45);
        fill.style.setProperty('--overscroll-progress', eased.toFixed(4));
        fill.style.opacity = (p >= 0.999 ? 1 : Math.min(0.96, 0.14 + eased * 0.82)).toFixed(2);
      }
      const ring = btn.querySelector('.nav-overscroll-ring');
      if (ring) {
        ring.style.opacity = (p * 0.85).toFixed(2);
        const inset = Math.round((1 - p) * 8) - 4;
        ring.style.inset = inset + 'px';
      }
    }

    function resetButton(btn){
      if (!btn) return;
      btn.style.transform = '';
      btn.style.transition = 'transform .3s ease';
      btn.classList.remove('overscroll-active', 'overscroll-complete');
      const fill = btn.querySelector('.nav-overscroll-fill');
      if (fill) {
        fill.style.setProperty('--overscroll-progress', '0');
        fill.style.opacity = '0';
      }
      const ring = btn.querySelector('.nav-overscroll-ring');
      if (ring) {
        ring.style.opacity = '0';
        ring.style.inset = '-4px';
      }
    }

    function openPanel(r, target){
      const p = pageFor(r);
      if (!r || !p || !target) return;

      // First reset the internal scroll position, then swap panels.
      // This prevents the previous upper block/hero from remaining above the newly opened section.
      p.scrollTop = 0;
      p.classList.toggle('linguistic-inner-section-active', target !== 'overview');

      r.querySelectorAll('[data-linguistic-tab]').forEach(btn => {
        const isActive = btn.getAttribute('data-linguistic-tab') === target;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      r.querySelectorAll('[data-linguistic-panel]').forEach(panel => {
        const isActive = panel.getAttribute('data-linguistic-panel') === target;
        panel.classList.toggle('active', isActive);
        panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      });

      r.querySelectorAll('.linguistic-next-btn, :is(.linguistic-scroll-btn, .linguistic-prev-btn)[data-linguistic-dir="prev"]').forEach(btn => {
        prepareButton(btn);
        resetButton(btn);
      });

      p.scrollTop = 0;
    }

    function init(r){
      const p = pageFor(r);
      if (!p || !r || p.dataset.linguisticMainLikeReady === 'true') return;
      p.dataset.linguisticMainLikeReady = 'true';

      p.classList.toggle('linguistic-inner-section-active', currentPanelName(r) !== 'overview');
      r.querySelectorAll('[data-linguistic-panel]').forEach(panel => {
        const isActive = panel.classList.contains('active');
        panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      });

      r.querySelectorAll('.linguistic-next-btn, :is(.linguistic-scroll-btn, .linguistic-prev-btn)[data-linguistic-dir="prev"]').forEach(btn => {
        prepareButton(btn);
        btn.addEventListener('click', () => openPanel(r, btn.getAttribute('data-linguistic-goto')));
      });

      // Hidden tab buttons are kept only as state mirrors; no visible pill navigation.
      r.querySelectorAll('[data-linguistic-tab]').forEach(btn => {
        btn.addEventListener('click', () => openPanel(r, btn.getAttribute('data-linguistic-tab')));
      });

      let accum = 0;
      let triggered = false;
      let timer = null;
      let ty0 = 0;
      let touchActive = false;

      function reset(){
        resetButton(activeNextButton(r));
        resetButton(activePrevButton(r));
        accum = 0;
        triggered = false;
      }

      p.addEventListener('wheel', e => {
        const nextBtn = activeNextButton(r);
        const prevBtn = activePrevButton(r);
        const atBottom = p.scrollTop >= p.scrollHeight - p.clientHeight - 2;
        const atTop = p.scrollTop <= 2;
        const scrollingDown = e.deltaY > 0;
        const scrollingUp = e.deltaY < 0;
        const btn = scrollingDown && atBottom ? nextBtn : (scrollingUp && atTop ? prevBtn : null);
        const direction = btn && scrollingUp ? 'prev' : 'next';

        if (!btn) {
          if (accum) reset();
          return;
        }

        e.preventDefault();
        accum += Math.abs(e.deltaY);
        applyProgress(btn, accum / THRESHOLD, direction);

        clearTimeout(timer);
        timer = setTimeout(reset, 600);

        if (!triggered && accum >= THRESHOLD) {
          triggered = true;
          applyProgress(btn, 1, direction);
          setTimeout(() => {
            openPanel(r, btn.getAttribute('data-linguistic-goto'));
            reset();
          }, 180);
        }
      }, { passive: false });

      p.addEventListener('touchstart', e => {
        ty0 = e.touches[0].clientY;
        touchActive = true;
        accum = 0;
        triggered = false;
      }, { passive: true });

      p.addEventListener('touchmove', e => {
        if (!touchActive) return;

        const dy = ty0 - e.touches[0].clientY;
        const atBottom = p.scrollTop >= p.scrollHeight - p.clientHeight - 2;
        const atTop = p.scrollTop <= 2;
        const btn = dy > 0 && atBottom ? activeNextButton(r) : (dy < 0 && atTop ? activePrevButton(r) : null);
        const direction = dy < 0 ? 'prev' : 'next';
        if (!btn) {
          if (accum) reset();
          return;
        }

        e.preventDefault();
        accum = Math.abs(dy);
        applyProgress(btn, accum / THRESHOLD, direction);

        if (!triggered && accum >= THRESHOLD) {
          triggered = true;
          applyProgress(btn, 1, direction);
          setTimeout(() => {
            openPanel(r, btn.getAttribute('data-linguistic-goto'));
            reset();
          }, 180);
        }
      }, { passive: false });

      p.addEventListener('touchend', () => {
        touchActive = false;
        setTimeout(reset, 400);
      }, { passive: true });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function(){
        document.querySelectorAll('[data-linguistic-tabs]').forEach(init);
      });
    } else {
      document.querySelectorAll('[data-linguistic-tabs]').forEach(init);
    }
  })();


  // Linguistic return buttons fallback
  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('.linguistic-return-btn');
    if (!btn) return;

    var root = btn.closest('[data-linguistic-tabs]') || document.querySelector('[data-linguistic-tabs]');
    if (!root) return;

    var target = btn.getAttribute('data-linguistic-goto');
    if (!target) return;

    var panels = Array.from(root.querySelectorAll('[data-linguistic-panel]'));
    panels.forEach(function(panel){
      panel.classList.toggle('active', panel.getAttribute('data-linguistic-panel') === target);
    });

    root.querySelectorAll('[data-linguistic-tab]').forEach(function(item){
      var active = item.getAttribute('data-linguistic-tab') === target;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    var page = root.closest('.single-service-page');
    if (page) page.scrollTo({ top: 0, behavior: 'smooth' });
  });

  (function(){
    const TARGETS = [
      { selector: '#autoTechPage .auto-task-item', kind: 'auto-task' },
      { selector: '#autoTechPage .auto-approach-item', kind: 'auto-approach' },
      { selector: '#autoTechPage .auto-situation-item', kind: 'auto-situation' },
      { selector: '.single-service-page:not(.other-service-page) .construction-content-card .construction-task-list li', kind: 'scope-task' },
      { selector: '.single-service-page:not(.other-service-page) .construction-content-card .construction-benefit-grid li', kind: 'benefit' }
    ];

    function cleanText(text) {
      return (text || '').replace(/\s+/g, ' ').trim();
    }

    function normalizeTitle(text) {
      return cleanText(text).replace(/[.;]+$/, '').trim();
    }

    function hasKeyword(text, list) {
      return list.some(item => text.includes(item));
    }

    function resolveKind(node, fallbackKind) {
      if (!node) return fallbackKind;

      const panel = node.closest('[data-service-panel], [data-linguistic-panel]');
      const panelName = panel ? (panel.getAttribute('data-service-panel') || panel.getAttribute('data-linguistic-panel') || '') : '';

      if (panelName === 'materials') return 'material-task';
      if (panelName === 'benefits' || node.closest('.construction-benefit-grid')) return 'benefit';
      if (panelName === 'scope' || panelName === 'overview' || panelName === 'types' || panelName === 'workflow') return 'scope-task';

      return fallbackKind;
    }

    function descriptionFor(title, kind) {
      const text = title.toLowerCase();

      if (kind === 'auto-task') {
        if (hasKeyword(text, ['механизм дтп', 'последовательность столкновения'])) return 'Позволяет восстановить ход происшествия и сопоставить версии участников с фактическими следами.';
        if (hasKeyword(text, ['скорость', 'траектори', 'тормозн', 'предотвращения аварии'])) return 'Используется для технического расчета условий движения и возможности избежать столкновения.';
        if (hasKeyword(text, ['повреждени'])) return 'Помогает проверить, связаны ли зафиксированные дефекты именно с заявленным событием.';
        if (hasKeyword(text, ['техническое состояние'])) return 'Дает представление о состоянии узлов и агрегатов до спора и после него.';
        if (hasKeyword(text, ['скрытые дефекты', 'неисправности', 'производственный брак'])) return 'Важно для споров с продавцом, сервисом, производителем или страховщиком.';
        if (hasKeyword(text, ['стоимость восстановительного ремонта'])) return 'Нужно для обоснования суммы требования и проверки расчетов другой стороны.';
        if (hasKeyword(text, ['утрату товарной стоимости'])) return 'Показывает, как происшествие повлияло на рыночную привлекательность автомобиля.';
        if (hasKeyword(text, ['качество ремонта', 'технического обслуживания'])) return 'Помогает оценить, выполнены ли работы надлежащим образом и без скрытых нарушений.';
        if (hasKeyword(text, ['дорожные условия', 'разметку', 'организацию движения'])) return 'Учитывает внешние факторы, которые могли повлиять на возникновение ДТП.';
        return 'Формирует один из ключевых технических выводов, который затем подробно раскрывается в заключении.';
      }

      if (kind === 'auto-approach') {
        if (hasKeyword(text, ['анализ всех доступных материалов'])) return 'Чем полнее исходные документы и фиксация, тем устойчивее итоговый вывод по делу.';
        if (hasKeyword(text, ['осмотр транспортного средства'])) return 'Фактическое состояние автомобиля сопоставляется с документами, фото и заявленными обстоятельствами.';
        if (hasKeyword(text, ['причинно-следственной связи'])) return 'Это помогает отделить реальные последствия события от сторонних или более поздних повреждений.';
        if (hasKeyword(text, ['расчет стоимости ремонта'])) return 'Сумма определяется с учетом характера повреждений, технологии ремонта и состава необходимых работ.';
        if (hasKeyword(text, ['технической возможности предотвратить'])) return 'Такой анализ особенно важен в спорах о виновности и поведении участников.';
        if (hasKeyword(text, ['понятное изложение выводов'])) return 'Заключение должно быть полезным не только эксперту, но и юристу, страховщику и суду.';
        return 'Этот этап включается в исследование для того, чтобы выводы были проверяемыми и связанными с материалами дела.';
      }

      if (kind === 'auto-situation') {
        if (hasKeyword(text, ['страховая компания занизила выплату'])) return 'Экспертиза помогает проверить расчет страховой и показать реальный объем ущерба.';
        if (hasKeyword(text, ['оспаривает обстоятельства дтп'])) return 'Независимый анализ нужен, когда стороны по-разному описывают одно и то же событие.';
        if (hasKeyword(text, ['виновность', 'избежать столкновения'])) return 'Технический вывод позволяет оценить действия участников не по предположениям, а по расчетам.';
        if (hasKeyword(text, ['не совпадают с описанием'])) return 'Такое расхождение часто становится основанием для отдельной проверки механизма повреждений.';
        if (hasKeyword(text, ['после ремонта выявлены дефекты'])) return 'Экспертиза фиксирует недостатки и помогает оценить качество выполненных работ.';
        if (hasKeyword(text, ['скрытую неисправность', 'производственный недостаток'])) return 'Это важно в спорах с продавцом, дилером, производителем или сервисной организацией.';
        if (hasKeyword(text, ['реальную стоимость ремонта'])) return 'Независимый расчет позволяет сравнить заявленную сумму с фактической потребностью в ремонте.';
        if (hasKeyword(text, ['заключение страхового эксперта', 'оценщика'])) return 'Повторная проверка помогает выявить методические ошибки, пропуски и занижения.';
        if (hasKeyword(text, ['спор с автосервисом', 'дилером', 'продавцом'])) return 'Заключение помогает перейти от общих претензий к конкретным техническим аргументам.';
        return 'Это типичная ситуация, при которой независимая экспертиза помогает зафиксировать факты и сформировать позицию.';
      }

      if (kind === 'material-task') {
        if (hasKeyword(text, ['договор', 'спецификац', 'счет', 'наклад', 'акт', 'документ'])) return 'Документы задают исходные условия спора и позволяют сопоставить факты с обязательствами сторон.';
        if (hasKeyword(text, ['фотограф', 'скриншот', 'видео', 'запис'])) return 'Визуальная и цифровая фиксация помогает подтвердить состояние объекта и контекст его использования.';
        if (hasKeyword(text, ['переписк', 'пояснен'])) return 'Такие материалы помогают восстановить обстоятельства спора и позицию участников.';
        if (hasKeyword(text, ['парол', 'учетн', 'доступ'])) return 'Доступ к цифровой среде влияет на полноту анализа и возможность проверить технические следы.';
        if (hasKeyword(text, ['описание ситуации', 'цель обращения', 'вопросы'])) return 'Четкая постановка задачи помогает эксперту выбрать корректный объем исследования.';
        if (hasKeyword(text, ['носитель', 'файл', 'архив', 'копи'])) return 'От исходного формата и полноты передачи зависит сохранность признаков, важных для анализа.';
        if (hasKeyword(text, ['времени', 'месте', 'способе фиксации'])) return 'Контекст происхождения материала помогает правильно интерпретировать результаты исследования.';
        return 'Этот материал помогает уточнить обстоятельства дела и сделать итоговые выводы более устойчивыми.';
      }

      if (kind === 'benefit') {
        if (hasKeyword(text, ['независим'])) return 'Выводы формируются без интереса к исходу спора и опираются на исследованные материалы.';
        if (hasKeyword(text, ['фиксац', 'сохранени'])) return 'Это особенно важно, когда нужно сохранить доказательственное значение объекта или данных.';
        if (hasKeyword(text, ['понятн'])) return 'Результат удобно использовать не только специалисту, но и клиенту, юристу, страховой или суду.';
        if (hasKeyword(text, ['заключени', 'документ'])) return 'Итоговый документ можно приложить к претензии, переговорам, внутренней проверке или судебным материалам.';
        if (hasKeyword(text, ['вопрос'])) return 'Корректная формулировка задач помогает получить от эксперта действительно полезный ответ.';
        if (hasKeyword(text, ['работа с', 'материалами', 'устройствами', 'носителями'])) return 'Это позволяет исследовать спорную ситуацию комплексно, а не по отдельным фрагментам.';
        if (hasKeyword(text, ['рисков'])) return 'Чем раньше выявлены слабые места, тем проще избежать лишних расходов и ошибочных решений.';
        if (hasKeyword(text, ['подход'])) return 'Ситуация оценивается в совокупности: по фактам, документам, признакам и последствиям.';
        return 'Такой результат делает экспертное исследование более практичным для спора, проверки или переговоров.';
      }

      if (kind === 'scope-task') {
        if (hasKeyword(text, ['подлинност', 'подписи'])) return 'Помогает определить, выполнена ли подпись конкретным лицом и есть ли признаки имитации.';
        if (hasKeyword(text, ['исполнителя рукописного текста'])) return 'Нужно, когда важно установить автора записи, расписки, заявления или другого рукописного документа.';
        if (hasKeyword(text, ['подделк', 'обводк', 'подражани'])) return 'Эксперт сопоставляет признаки письма и проверяет, есть ли следы неестественного исполнения.';
        if (hasKeyword(text, ['подписей и записей'])) return 'Это особенно важно для договоров, расписок, доверенностей, актов и иных спорных документов.';
        if (hasKeyword(text, ['одним или разными лицами'])) return 'Позволяет оценить, есть ли в документе участие нескольких исполнителей.';
        if (hasKeyword(text, ['задолженности', 'убытков', 'ущерба', 'неустоек', 'процентов'])) return 'Расчет помогает перейти от спорной суммы к проверяемому экономическому выводу.';
        if (hasKeyword(text, ['финансовых и бухгалтерских расчетов'])) return 'Проверяются формулы, документы-основания и соответствие расчетов условиям спора.';
        if (hasKeyword(text, ['движения денежных средств'])) return 'Анализ помогает увидеть, какие операции действительно подтверждаются платежными документами.';
        if (hasKeyword(text, ['по договорам'])) return 'Это позволяет сопоставить условия договора, акты, платежи и итоговую сумму требований.';
        if (hasKeyword(text, ['обоснованности расходов', 'начислений'])) return 'Эксперт отделяет подтвержденные затраты от спорных или завышенных позиций.';
        if (hasKeyword(text, ['ошибок', 'завышений', 'расхождений'])) return 'Такие признаки нередко становятся ключевым аргументом в претензионной и судебной работе.';
        if (hasKeyword(text, ['финансового состояния'])) return 'Исследование помогает оценить устойчивость компании и структуру ее обязательств.';
        if (hasKeyword(text, ['цифровых доказательств', 'файлов', 'переписки', 'программ', 'записей'])) return 'Задача исследования — не просто найти данные, а связать их с обстоятельствами спора.';
        if (hasKeyword(text, ['работоспособность компьютера', 'цифрового устройства'])) return 'Это важно, когда спор связан с доступом к информации, сбоем или состоянием техники.';
        if (hasKeyword(text, ['учетной записи', 'базе данных', 'электронной почте'])) return 'Такие споры требуют анализа доступа, журналов событий и технических следов действий.';
        if (hasKeyword(text, ['содержание разговора', 'отдельных фраз'])) return 'Эксперт помогает описать значимые фрагменты записи и их восприятие в контексте спора.';
        if (hasKeyword(text, ['монтажа', 'редактирования'])) return 'Проверяется целостность материала и наличие признаков вмешательства в файл или запись.';
        if (hasKeyword(text, ['пригодна ли запись'])) return 'Качество и состояние записи напрямую влияют на допустимость дальнейшего анализа.';
        if (hasKeyword(text, ['события', 'объекты', 'зафиксированные на видео'])) return 'Описание видеоряда помогает выделить существенные обстоятельства и временные ориентиры.';
        if (hasKeyword(text, ['качества строительных', 'ремонтных', 'отделочных работ'])) return 'Проверяется, соответствует ли фактический результат требованиям договора и строительным нормам.';
        if (hasKeyword(text, ['дефектов', 'повреждений', 'строительных норм'])) return 'Исследование помогает зафиксировать нарушения и связать их с конкретными работами или условиями.';
        if (hasKeyword(text, ['трещин', 'протечек', 'деформаций', 'просадок', 'промерзаний'])) return 'Причинный анализ особенно важен, когда стороны по-разному объясняют происхождение повреждений.';
        if (hasKeyword(text, ['соответствия работ проекту', 'смете', 'техническому заданию'])) return 'Это позволяет отделить фактически выполненное от того, что было предусмотрено документами.';
        if (hasKeyword(text, ['стоимости устранения недостатков'])) return 'Расчет нужен для претензии, переговоров, снижения цены или взыскания расходов.';
        if (hasKeyword(text, ['объемов фактически выполненных работ'])) return 'Сопоставление актов и фактического состояния объекта помогает выявить завышения и пропуски.';
        if (hasKeyword(text, ['сметной стоимости'])) return 'Эксперт проверяет, насколько цена работ соответствует составу и объему реально необходимых действий.';
        if (hasKeyword(text, ['ущерба после залива', 'пожара', 'аварии'])) return 'Исследование связывает повреждения с событием и помогает определить стоимость восстановления.';
        if (hasKeyword(text, ['видимые или скрытые дефекты'])) return 'Это одно из самых частых оснований для независимой проверки качества и состояния объекта.';
        if (hasKeyword(text, ['не соответствует договору', 'спецификации', 'характеристикам'])) return 'Эксперт сопоставляет фактические признаки объекта с тем, что обещано в документах.';
        if (hasKeyword(text, ['причине поломки', 'потери качества'])) return 'Причинный вывод помогает понять, связано ли нарушение с браком, эксплуатацией или внешним воздействием.';
        if (hasKeyword(text, ['стоимость товара'])) return 'Оценка нужна, когда спор связан с уценкой, повреждением или размером имущественного требования.';
        if (hasKeyword(text, ['доказательная база'])) return 'Экспертное заключение помогает превратить общую претензию в аргументированную позицию.';
        return 'Это один из типовых вопросов, который эксперт подробно раскрывает в итоговом заключении.';
      }

      return '';
    }

    function enhance(node, kind) {
      if (!node || node.dataset.richReady === 'true') return;

      const existingStrong = Array.from(node.children || []).find(function(child) {
        return child.tagName === 'STRONG';
      });
      const existingSpan = Array.from(node.children || []).find(function(child) {
        return child.tagName === 'SPAN';
      });

      if (existingStrong) {
        if (!existingSpan) {
          const description = Array.from(node.childNodes)
            .filter(function(child) { return child !== existingStrong; })
            .map(function(child) { return cleanText(child.textContent); })
            .filter(Boolean)
            .join(' ');

          Array.from(node.childNodes).forEach(function(child) {
            if (child !== existingStrong) child.remove();
          });

          if (description) {
            const span = document.createElement('span');
            span.textContent = description;
            node.append(span);
          }
        }

        node.classList.add('service-rich-item');
        node.dataset.richReady = 'true';
        return;
      }

      if (node.children.length) return;
      const title = normalizeTitle(node.textContent);
      const desc = descriptionFor(title, kind);
      if (!title || !desc) return;

      const strong = document.createElement('strong');
      const span = document.createElement('span');
      strong.textContent = title;
      span.textContent = desc;

      node.textContent = '';
      node.append(strong, span);
      node.classList.add('service-rich-item');
      node.dataset.richReady = 'true';
    }

    function initRichItems() {
      TARGETS.forEach(function(target) {
        document.querySelectorAll(target.selector).forEach(function(node) {
          enhance(node, resolveKind(node, target.kind));
        });
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initRichItems);
    } else {
      initRichItems();
    }
  })();

  var PERSONAL_DATA_POLICY_VERSION = '2026-08-18';
  var privacyConsentLayer = document.getElementById('privacyConsentLayer');
  var privacyConsentCheckbox = privacyConsentLayer?.querySelector('[data-consent-checkbox="true"]');
  var privacyConsentConfirm = privacyConsentLayer?.querySelector('[data-consent-confirm="true"]');
  var privacyConsentError = privacyConsentLayer?.querySelector('[data-consent-error="true"]');
  var pendingConsentRequest = null;
  var consentReturnFocus = null;

  function setConsentField(form, name, value) {
    if (!form) return;
    var input = form.querySelector('input[name="' + name + '"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      form.appendChild(input);
    }
    input.value = value;
  }

  function closePrivacyConsent(restoreFocus) {
    if (!privacyConsentLayer) return;
    privacyConsentLayer.classList.remove('active');
    privacyConsentLayer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('privacy-consent-open');
    pendingConsentRequest = null;
    if (privacyConsentCheckbox) privacyConsentCheckbox.checked = false;
    if (privacyConsentConfirm) privacyConsentConfirm.disabled = true;
    if (privacyConsentError) privacyConsentError.textContent = '';
    if (restoreFocus !== false && consentReturnFocus && typeof consentReturnFocus.focus === 'function') {
      consentReturnFocus.focus();
    }
    consentReturnFocus = null;
  }

  function requestPrivacyConsent(options) {
    if (!privacyConsentLayer || !privacyConsentCheckbox || !privacyConsentConfirm) return;
    pendingConsentRequest = options || {};
    consentReturnFocus = pendingConsentRequest.trigger || document.activeElement;
    privacyConsentCheckbox.checked = false;
    privacyConsentConfirm.disabled = true;
    if (privacyConsentError) privacyConsentError.textContent = '';
    privacyConsentLayer.classList.add('active');
    privacyConsentLayer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('privacy-consent-open');
    setTimeout(function() { privacyConsentCheckbox.focus(); }, 40);
  }

  if (privacyConsentLayer && privacyConsentCheckbox && privacyConsentConfirm) {
    privacyConsentCheckbox.addEventListener('change', function() {
      privacyConsentConfirm.disabled = !privacyConsentCheckbox.checked;
      if (privacyConsentError) privacyConsentError.textContent = '';
    });

    privacyConsentConfirm.addEventListener('click', function() {
      if (!privacyConsentCheckbox.checked || !pendingConsentRequest) {
        if (privacyConsentError) privacyConsentError.textContent = 'Чтобы продолжить, подтвердите согласие на обработку персональных данных.';
        return;
      }

      var request = pendingConsentRequest;
      var consentDetails = {
        accepted: true,
        acceptedAt: new Date().toISOString(),
        policyVersion: PERSONAL_DATA_POLICY_VERSION
      };

      if (request.form) {
        setConsentField(request.form, 'privacy_consent', 'yes');
        setConsentField(request.form, 'privacy_consent_at', consentDetails.acceptedAt);
        setConsentField(request.form, 'privacy_policy_version', consentDetails.policyVersion);
        request.form.dispatchEvent(new CustomEvent('personal-data-consent-confirmed', {
          bubbles: true,
          detail: consentDetails
        }));
      }

      closePrivacyConsent(false);
      if (typeof request.onConfirm === 'function') request.onConfirm(consentDetails);
    });

    privacyConsentLayer.querySelectorAll('[data-consent-close="true"]').forEach(function(button) {
      button.addEventListener('click', function() { closePrivacyConsent(true); });
    });

    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape' && privacyConsentLayer.classList.contains('active')) {
        closePrivacyConsent(true);
      }
    });
  }

  function getRussianPhoneDigits(value) {
    var digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.charAt(0) === '8') digits = '7' + digits.slice(1);
    if (digits.charAt(0) !== '7') digits = '7' + digits;
    return digits.slice(0, 11);
  }

  function formatRussianPhone(value) {
    var digits = getRussianPhoneDigits(value);
    if (!digits) return '';
    var local = digits.slice(1);
    var formatted = '+7';
    if (local.length) formatted += ' (' + local.slice(0, 3);
    if (local.length >= 3) formatted += ')';
    if (local.length > 3) formatted += ' ' + local.slice(3, 6);
    if (local.length > 6) formatted += '-' + local.slice(6, 8);
    if (local.length > 8) formatted += '-' + local.slice(8, 10);
    return formatted;
  }

  function isValidRussianPhone(value) {
    var digits = getRussianPhoneDigits(value);
    return digits.length === 11 && digits.charAt(0) === '7';
  }

  function isEmailValue(value) {
    return String(value || '').includes('@');
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value || '').trim());
  }

  function isRestrictedEmail(value) {
    var domain = String(value || '').trim().toLowerCase().split('@').pop() || '';
    return domain.endsWith('.com') || /(^|\.)(gmail|googlemail|google)(\.|$)/i.test(domain);
  }

  function setupRussianPhoneInput(input, phoneOnly) {
    if (!input) return;

    if (phoneOnly) {
      input.addEventListener('focus', function() {
        if (!input.value.trim()) input.value = '+7 ';
      });
      input.addEventListener('blur', function() {
        if (getRussianPhoneDigits(input.value).length <= 1) input.value = '';
      });
    }

    input.addEventListener('input', function() {
      var value = input.value;
      var looksLikeEmail = isEmailValue(value) || /[a-zа-я]/i.test(value);
      if (!phoneOnly && looksLikeEmail) return;
      input.value = formatRussianPhone(value);
    });
  }

  (function() {
    var callbackForm = document.querySelector('[data-callback-form]');
    if (!callbackForm) return;

    var phoneInput = callbackForm.querySelector('input[name="callback_phone"]');
    var submitButton = callbackForm.querySelector('button[type="submit"]');
    var status = document.querySelector('[data-callback-status]');

    setupRussianPhoneInput(phoneInput, true);

    callbackForm.addEventListener('submit', function(event) {
      event.preventDefault();
      var phoneDigits = getRussianPhoneDigits(phoneInput?.value);
      if (!phoneInput || !phoneInput.value.trim() || phoneDigits.length <= 1) {
        if (status) {
          status.textContent = 'Заполнены не все данные.';
          status.classList.remove('is-success');
        }
        phoneInput?.focus();
        return;
      }

      if (!isValidRussianPhone(phoneInput.value)) {
        if (status) {
          status.textContent = 'Указан неверный номер телефона.';
          status.classList.remove('is-success');
        }
        phoneInput.focus();
        return;
      }

      if (status) status.textContent = '';
      requestPrivacyConsent({
        form: callbackForm,
        trigger: submitButton,
        onConfirm: function() {
          if (status) {
            status.textContent = 'Согласие подтверждено. Заявка готова к отправке.';
            status.classList.add('is-success');
          }
          /* Future server submission should be called here. */
        }
      });
    });

    phoneInput?.addEventListener('input', function() {
      if (!status) return;
      status.textContent = '';
      status.classList.remove('is-success');
    });
  })();

  (function() {
    var reviewPage = document.getElementById('reviewPage');
    if (!reviewPage) return;

    var uploadPanel = reviewPage.querySelector('#reviewUploadPanel');
    var scrollButton = reviewPage.querySelector('[data-review-scroll-upload="true"]');
    var form = reviewPage.querySelector('[data-review-upload-form]');
    var fileInput = reviewPage.querySelector('[data-review-file-input]');
    var fileList = reviewPage.querySelector('[data-review-file-list]');
    var status = reviewPage.querySelector('[data-review-status]');
    var nameInput = reviewPage.querySelector('[data-review-name]');
    var phoneInput = reviewPage.querySelector('[data-review-phone]');
    var emailInput = reviewPage.querySelector('[data-review-email]');
    var submitButton = reviewPage.querySelector('[data-review-submit]');
    var dropzone = reviewPage.querySelector('.review-upload-dropzone');

    setupRussianPhoneInput(phoneInput, true);

    function setStatus(message, isSuccess) {
      if (!status) return;
      status.textContent = message || '';
      status.classList.toggle('is-success', Boolean(isSuccess));
    }

    function renderFiles() {
      if (!fileInput || !fileList) return;

      var files = Array.from(fileInput.files || []);
      if (!files.length) {
        fileList.classList.remove('has-files');
        fileList.textContent = 'Файлы ещё не выбраны.';
        return;
      }

      var list = document.createElement('ul');
      files.forEach(function(file) {
        var item = document.createElement('li');
        var sizeMb = file.size ? ' · ' + (file.size / (1024 * 1024)).toFixed(2).replace(/\.00$/, '') + ' МБ' : '';
        item.textContent = file.name + sizeMb;
        list.appendChild(item);
      });

      fileList.classList.add('has-files');
      fileList.textContent = '';
      fileList.appendChild(list);
    }

    function validateForm() {
      if (!nameInput || !phoneInput || !emailInput || !fileInput) return false;

      var firstMissingField = !nameInput.value.trim()
        ? nameInput
        : getRussianPhoneDigits(phoneInput.value).length <= 1
          ? phoneInput
          : !emailInput.value.trim()
            ? emailInput
            : null;

      if (firstMissingField) {
        setStatus('Заполнены не все данные.', false);
        firstMissingField.focus();
        return false;
      }

      if (!isValidRussianPhone(phoneInput.value)) {
        setStatus('Указан неверный номер телефона.', false);
        phoneInput.focus();
        return false;
      }

      var emailValue = emailInput.value.trim();
      if (!isValidEmail(emailValue)) {
        setStatus('Указан неверный адрес электронной почты.', false);
        emailInput.focus();
        return false;
      }
      if (isRestrictedEmail(emailValue)) {
        setStatus('На данный момент мы не можем обрабатывать информацию с электронных почт с доменом .com.', false);
        emailInput.focus();
        return false;
      }

      if (!fileInput.files || !fileInput.files.length) {
        setStatus('Заполнены не все данные.', false);
        fileInput.focus();
        return false;
      }

      setStatus('', false);
      return true;
    }

    function submitReviewRequest() {
      if (!form || !fileInput) return;

      setStatus('Материалы приняты. Рецензия будет передана эксперту после проверки комплекта документов.', true);
      form.reset();
      renderFiles();
    }

    if (scrollButton && uploadPanel) {
      scrollButton.addEventListener('click', function() {
        uploadPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', function() {
        renderFiles();
        if (status && !status.classList.contains('is-success')) setStatus('', false);
      });
    }

    if (dropzone && fileInput) {
      dropzone.addEventListener('dragover', function(event) {
        event.preventDefault();
        dropzone.classList.add('is-dragover');
      });

      dropzone.addEventListener('dragleave', function() {
        dropzone.classList.remove('is-dragover');
      });

      dropzone.addEventListener('drop', function(event) {
        event.preventDefault();
        dropzone.classList.remove('is-dragover');

        if (!event.dataTransfer || !event.dataTransfer.files || !event.dataTransfer.files.length) return;

        fileInput.files = event.dataTransfer.files;
        renderFiles();
        setStatus('', false);
      });
    }

    if (submitButton) {
      submitButton.addEventListener('click', function() {
        if (!validateForm()) return;
        requestPrivacyConsent({
          form: form,
          trigger: submitButton,
          onConfirm: submitReviewRequest
        });
      });
    }

    renderFiles();
  })();

  (function() {
    var layer = document.getElementById('expertiseOrderLayer');
    if (!layer) return;

    var dialog = layer.querySelector('.expertise-order-dialog');
    var form = layer.querySelector('[data-expertise-order-form]');
    var nameInput = layer.querySelector('[data-expertise-order-name]');
    var phoneInput = layer.querySelector('[data-expertise-order-phone]');
    var emailInput = layer.querySelector('[data-expertise-order-email]');
    var fileInput = layer.querySelector('[data-expertise-order-file-input]');
    var fileList = layer.querySelector('[data-expertise-order-file-list]');
    var status = layer.querySelector('[data-expertise-order-status]');
    var submitButton = layer.querySelector('[data-expertise-order-submit]');
    var dropzone = layer.querySelector('.expertise-order-dropzone');
    var returnFocus = null;

    setupRussianPhoneInput(phoneInput, true);

    function setStatus(message, isSuccess) {
      if (!status) return;
      status.textContent = message || '';
      status.classList.toggle('is-success', Boolean(isSuccess));
    }

    function renderFiles() {
      if (!fileInput || !fileList) return;

      var files = Array.from(fileInput.files || []);
      if (!files.length) {
        fileList.classList.remove('has-files');
        fileList.textContent = 'Файлы ещё не выбраны.';
        return;
      }

      var list = document.createElement('ul');
      files.forEach(function(file) {
        var item = document.createElement('li');
        var sizeMb = file.size ? ' · ' + (file.size / (1024 * 1024)).toFixed(2).replace(/\.00$/, '') + ' МБ' : '';
        item.textContent = file.name + sizeMb;
        list.appendChild(item);
      });

      fileList.classList.add('has-files');
      fileList.textContent = '';
      fileList.appendChild(list);
    }

    function resetFormState() {
      form?.reset();
      setStatus('', false);
      renderFiles();
    }

    function openOrderForm(trigger) {
      closeDrawer();
      closeServicesMenu();
      closeChatWidget();
      resetFormState();
      returnFocus = trigger || document.activeElement;
      layer.classList.add('active');
      layer.setAttribute('aria-hidden', 'false');
      document.body.classList.add('expertise-order-open');
      setTimeout(function() { nameInput?.focus(); }, 40);
    }

    function closeOrderForm(restoreFocus) {
      layer.classList.remove('active');
      layer.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('expertise-order-open');
      resetFormState();
      if (restoreFocus !== false && returnFocus && typeof returnFocus.focus === 'function') {
        returnFocus.focus();
      }
      returnFocus = null;
    }

    function validateForm() {
      if (!nameInput || !phoneInput || !emailInput) return false;

      var firstMissingField = !nameInput.value.trim()
        ? nameInput
        : getRussianPhoneDigits(phoneInput.value).length <= 1
          ? phoneInput
          : !emailInput.value.trim()
            ? emailInput
            : null;

      if (firstMissingField) {
        setStatus('Заполнены не все данные.', false);
        firstMissingField.focus();
        return false;
      }

      if (!isValidRussianPhone(phoneInput.value)) {
        setStatus('Указан неверный номер телефона.', false);
        phoneInput.focus();
        return false;
      }

      var emailValue = emailInput.value.trim();
      if (!isValidEmail(emailValue)) {
        setStatus('Указан неверный адрес электронной почты.', false);
        emailInput.focus();
        return false;
      }

      if (isRestrictedEmail(emailValue)) {
        setStatus('На данный момент мы не можем обрабатывать информацию с электронных почт с доменом .com.', false);
        emailInput.focus();
        return false;
      }

      setStatus('', false);
      return true;
    }

    function completeOrderRequest() {
      setStatus('Согласие подтверждено. Заявка на экспертизу готова к отправке.', true);
      form?.reset();
      renderFiles();
    }

    document.querySelectorAll('[data-open-expertise-order="true"]').forEach(function(trigger) {
      trigger.addEventListener('click', function(event) {
        event.preventDefault();
        openOrderForm(trigger);
      });
    });

    layer.querySelectorAll('[data-expertise-order-close="true"]').forEach(function(button) {
      button.addEventListener('click', function() { closeOrderForm(true); });
    });

    if (fileInput) {
      fileInput.addEventListener('change', function() {
        renderFiles();
        if (status && !status.classList.contains('is-success')) setStatus('', false);
      });
    }

    if (dropzone && fileInput) {
      dropzone.addEventListener('dragover', function(event) {
        event.preventDefault();
        dropzone.classList.add('is-dragover');
      });

      dropzone.addEventListener('dragleave', function() {
        dropzone.classList.remove('is-dragover');
      });

      dropzone.addEventListener('drop', function(event) {
        event.preventDefault();
        dropzone.classList.remove('is-dragover');
        if (!event.dataTransfer || !event.dataTransfer.files || !event.dataTransfer.files.length) return;
        fileInput.files = event.dataTransfer.files;
        renderFiles();
        setStatus('', false);
      });
    }

    [nameInput, phoneInput, emailInput].forEach(function(input) {
      input?.addEventListener('input', function() {
        if (status && !status.classList.contains('is-success')) setStatus('', false);
      });
    });

    submitButton?.addEventListener('click', function() {
      if (!validateForm()) return;
      requestPrivacyConsent({
        form: form,
        trigger: submitButton,
        onConfirm: completeOrderRequest
      });
    });

    document.addEventListener('keydown', function(event) {
      if (event.key !== 'Escape' || !layer.classList.contains('active')) return;
      if (privacyConsentLayer?.classList.contains('active')) return;
      closeOrderForm(true);
    });

    dialog?.addEventListener('click', function(event) {
      event.stopPropagation();
    });

    renderFiles();
  })();
