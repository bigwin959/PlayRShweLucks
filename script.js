document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("playRandomBtn");

  // Provider Navigation
  const titleItems = document.querySelectorAll(".title-item");
  const providerOrder = ["pg", "jili", "pp"];
  let currentProvider = "jili";

  // Carousel Container
  const mainCarousel = document.getElementById("main-carousel");

  // Lock Button
  const lockBtn = document.getElementById("lock-btn");
  let isLocked = false;

  let isAnimating = false;

  // --- DATA LOADING & INIT ---
  let games = [];

  fetch("data.json")
    .then((response) => response.json())
    .then((data) => {
      // 1. Update Site Config
      const config = data.siteConfig;
      document.title = config.pageTitle;
      const mainTitle = document.getElementById("mainTitle");
      if (mainTitle) mainTitle.textContent = config.headerTitle;

      if (btn) btn.textContent = config.playButtonText;

      // Update CTA Links
      const ctaLinks = document.querySelectorAll(".play-btn");
      ctaLinks.forEach((link) => {
        link.href = config.ctaUrl;
        // Preserve the icon
        const icon = link.querySelector(".play-icon");
        link.innerHTML = "";
        if (icon) link.appendChild(icon);
        link.append(" " + (config.ctaText || "ကစားမယ်"));
      });

      // Update Colors
      if (config.colors) {
        const root = document.documentElement;
        root.style.setProperty("--primary-color", config.colors.primary);
        root.style.setProperty("--secondary-color", config.colors.secondary);
        root.style.setProperty("--accent-color", config.colors.accent);
      }

      // 2. Load Games
      games = data.games;

      // Filter games by provider
      const jiliGames = games.filter((g) => g.provider === "JILI");
      const pgGames = games.filter((g) => g.provider === "PG Soft");
      const ppGames = games.filter((g) => g.provider === "PP Slot");

      // Store lists for spin logic
      window.gameLists = { jili: jiliGames, pg: pgGames, pp: ppGames };

      // Populate random games first so visuals aren't empty
      populateInitialCards(mainCarousel, window.gameLists[currentProvider]);
    })
    .catch((err) => console.error("Failed to load data:", err));

  // --- Sound Manager (Web Audio API) ---
  const soundManager = {
    ctx: null,
    init: function () {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
    },
    playTone: function (freq, type, duration, vol = 0.1) {
      if (!this.ctx) this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.01,
        this.ctx.currentTime + duration,
      );
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    },
    playSpinTick: function () {
      this.playTone(800 + Math.random() * 200, "square", 0.05, 0.05);
    },
    playColumnStop: function () {
      this.playTone(150, "triangle", 0.3, 0.2);
      this.playTone(100, "sine", 0.3, 0.2);
    },
    playLockSound: function () {
      this.playTone(400, "sawtooth", 0.1, 0.1);
    },
    playJackpot: function () {
      if (!this.ctx) this.init();
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = i % 2 === 0 ? "sine" : "triangle";
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        gain.gain.setValueAtTime(0.1, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.5);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.5);
      });
    },
  };

  // Lock Button listener
  if (lockBtn) {
    lockBtn.addEventListener("click", () => {
      if (isAnimating) return;

      isLocked = !isLocked;
      soundManager.playLockSound();

      const col = lockBtn.closest(".provider-column");

      if (isLocked) {
        lockBtn.classList.add("locked");
        lockBtn.innerHTML = '<span class="lock-icon">🔒</span> LOCKED';
        if (col) col.classList.add("locked-state");
      } else {
        lockBtn.classList.remove("locked");
        lockBtn.innerHTML = '<span class="lock-icon">🔓</span> Unlock';
        if (col) col.classList.remove("locked-state");
      }
    });
  }

  // Provider Slider Logic
  titleItems.forEach((item) => {
    item.addEventListener("click", () => {
      if (isAnimating || isLocked) return;
      const clickedProvider = item.dataset.provider;
      if (clickedProvider === currentProvider) return;

      currentProvider = clickedProvider;
      updateProviderSliderUI();

      // Update UI
      mainCarousel.innerHTML = "";
      populateInitialCards(mainCarousel, window.gameLists[currentProvider]);
    });
  });

  function updateProviderSliderUI() {
    titleItems.forEach((item) => {
      item.classList.remove("active", "left", "right");
      const provider = item.dataset.provider;
      const index = providerOrder.indexOf(provider);
      const activeIndex = providerOrder.indexOf(currentProvider);

      if (index === activeIndex) {
        item.classList.add("active");
      } else if (index === (activeIndex + 1) % 3) {
        item.classList.add("right");
      } else {
        item.classList.add("left");
      }
    });
  }

  btn.addEventListener("click", () => {
    if (isAnimating) return;
    isAnimating = true;

    soundManager.init();

    // Start animation process
    startSlotMachineInColumns();
  });

  function startSlotMachineInColumns() {
    if (isLocked) {
      isAnimating = false;
      return;
    }

    const pool = window.gameLists[currentProvider];
    let stack = getStack(mainCarousel, pool);

    spinColumn(stack, pool, pickUniqueGames(pool, 3), 3000);

    setTimeout(() => {
      soundManager.playJackpot();
      triggerConfetti();
      isAnimating = false;
    }, 3000);
  }

  function getStack(container, pool) {
    if (isLocked) {
      return Array.from(container.children);
    } else {
      container.innerHTML = "";
      return createInitialStack(container, pool);
    }
  }

  function triggerConfetti() {
    if (typeof confetti === "function") {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#00f3ff", "#bc13fe", "#ffd700"],
      });
    }
  }

  // Populate helper for initial load
  function populateInitialCards(container, list) {
    createInitialStack(container, list);
  }

  function createInitialStack(container, gameList) {
    const random3 = pickUniqueGames(gameList, 3);
    const cards = random3.map((g) => createCard(g));

    cards.forEach((c) => {
      // Note: don't add 'spinning' here immediately, only during spin
      container.appendChild(c);
    });

    setupCarouselInteraction(container, cards);
    updateCardPositions(cards, [0, 1, 2]);

    return cards;
  }

  function spinColumn(cards, pool, finalGames, duration) {
    if (isLocked) return;

    // Apply spinning effect
    cards.forEach((c) => c.classList.add("spinning"));

    const intervalTime = 100;
    let elapsed = 0;

    const interval = setInterval(() => {
      elapsed += intervalTime;

      if (elapsed < duration) {
        // UPDATE PHASE
        const randomFrame = pickUniqueGames(pool, 3);
        updateStackContent(cards, randomFrame);

        if (elapsed % 200 === 0) soundManager.playSpinTick();
      } else {
        // STOP PHASE
        clearInterval(interval);

        updateStackContent(cards, finalGames);
        soundManager.playColumnStop();

        cards.forEach((c) => c.classList.remove("spinning"));

        const activeCard = cards.find((c) =>
          c.classList.contains("card-active"),
        );
        if (activeCard) {
          activeCard.classList.add("winning", "super-win");
          startFakeNotifications();
        }
      }
    }, intervalTime);
  }

  function updateStackContent(cardElements, gameDataList) {
    cardElements.forEach((card, i) => {
      const game = gameDataList[i];

      const img = card.querySelector(".game-image");
      img.src = game.image;
      img.alt = game.name;

      const title = card.querySelector(".game-title");
      title.textContent = game.name;

      const providerSpan = card.querySelector(".game-provider");
      providerSpan.textContent = game.provider;

      const rtpSpan = card.querySelector(".rtp-badge");

      let rtpValue = game.rtp;
      if (!rtpValue && game.provider === "JILI") {
        rtpValue = generateRandomRTP();
      }

      if (rtpValue) {
        rtpSpan.textContent = `RTP: ${rtpValue}`;
        rtpSpan.classList.remove("hidden");
      } else {
        rtpSpan.classList.add("hidden");
      }
    });
  }

  function startFakeNotifications() {
      const container = document.getElementById("notificationsContainer");
      if (!container) return;
      container.innerHTML = ""; // Clear existing

      const names = ["Josh", "Alex", "Mg Mg", "Ko Ko", "Aung Aung", "Su Su", "Zaw Zaw"];
      const amounts = ["4,000", "15,000", "100,000", "50,000", "20,000", "5,000"];

      // Spawn 3 notifications spaced out
      for (let i = 0; i < 3; i++) {
          setTimeout(() => {
              const notif = document.createElement("div");
              notif.className = "fake-notification";

              const randomName = names[Math.floor(Math.random() * names.length)];
              const randomAmount = amounts[Math.floor(Math.random() * amounts.length)];

              notif.innerHTML = `<span class="name">${randomName} won</span> <span class="amount">+${randomAmount} MMK</span>`;

              // Randomize horizontal position around the edges
              const isLeft = Math.random() > 0.5;
              if (isLeft) {
                  notif.style.left = (10 + Math.random() * 15) + "%";
              } else {
                  notif.style.right = (10 + Math.random() * 15) + "%";
              }
              
              notif.style.top = (40 + Math.random() * 20) + "%";

              container.appendChild(notif);

              setTimeout(() => {
                  if (notif.parentNode) notif.remove();
              }, 3000); 
          }, i * 800 + 400); 
      }
  }

  // --- Reuse existing helper functions ---

  function setupCarouselInteraction(container, cards) {
    let currentOrder = [0, 1, 2];

    function handleCardClick(clickedIndex) {
      const position = currentOrder.indexOf(clickedIndex);
      if (position === 0) rotateRight();
      else if (position === 2) rotateLeft();
    }

    function rotateLeft() {
      const first = currentOrder.shift();
      currentOrder.push(first);
      updateCardPositions(cards, currentOrder);
      cards.forEach((c) => c.classList.remove("winning", "super-win"));
    }

    function rotateRight() {
      const last = currentOrder.pop();
      currentOrder.unshift(last);
      updateCardPositions(cards, currentOrder);
      cards.forEach((c) => c.classList.remove("winning", "super-win"));
    }

    cards.forEach((card, index) => {
      card.addEventListener("click", () => handleCardClick(index));

      // Add Tilt Effect to Active Card only
      if (index === currentOrder[1]) {
        // active
        // We'll attach mousemove to the wrapper to avoid flicker
      }
    });

    // 3D Tilt Effect on Container
    container.addEventListener("mousemove", (e) => {
      // Find active card
      const activeCard = container.querySelector(".card-active");
      if (!activeCard) return;

      const rect = activeCard.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Calculate rotation (max 15 degrees)
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -10; // Invert axis
      const rotateY = ((x - centerX) / centerX) * 10;

      // Apply transform. Note: we must keep the existing transforms!
      // .card-active has: translateX(-50%) translateZ(0) scale(1)
      activeCard.style.transform = `translateX(-50%) translateZ(0) scale(1) perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    container.addEventListener("mouseleave", () => {
      const activeCard = container.querySelector(".card-active");
      if (activeCard) {
        activeCard.style.transform = ""; // Clear inline styles to revert to class style
      }
    });
  }

  function updateCardPositions(cards, order) {
    cards.forEach((c) =>
      c.classList.remove("card-left", "card-active", "card-right"),
    );
    if (cards[order[0]]) cards[order[0]].classList.add("card-left");
    if (cards[order[1]]) cards[order[1]].classList.add("card-active");
    if (cards[order[2]]) cards[order[2]].classList.add("card-right");
  }

  function pickUniqueGames(gameList, count) {
    const shuffled = [...gameList].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  function generateRandomRTP() {
    const min = 96.5;
    const max = 98.0;
    const random = Math.random() * (max - min) + min;
    return random.toFixed(2) + "%";
  }

  function createCard(game) {
    const card = document.createElement("div");
    card.className = "game-card";

    let rtpDisplay = "";
    let rtpValue = game.rtp;
    let hiddenClass = "hidden";

    if (!rtpValue && game.provider === "JILI") {
      rtpValue = generateRandomRTP();
    }

    if (rtpValue) {
      rtpDisplay = `RTP: ${rtpValue}`;
      hiddenClass = "";
    }

    card.innerHTML = `
            <div class="game-image-wrapper">
                <a href="https://www.shwelucks.com" target="_blank">
                    <img src="${game.image}" alt="${game.name}" class="game-image">
                </a>
            </div>
            <h2 class="game-title">${game.name}</h2>
            <div class="card-footer">
                <span class="game-provider">${game.provider}</span>
                <span class="rtp-badge ${hiddenClass}">${rtpDisplay}</span>
            </div>
        `;

    return card;
  }
});
