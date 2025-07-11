// Game variables
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameOverElement = document.getElementById('gameOverInfo');
const coinCountElement = document.getElementById('coinCount');
const cashValueElement = document.getElementById('cashValue');
const couponsElement = document.getElementById('coupons');

const reviveBtn = document.getElementById('reviveBtn');
const connectionStatusElement = document.getElementById('connectionStatus');
const statusTextElement = document.getElementById('statusText');

// Load SVG assets
const coinImage = new Image();
const couponImage = new Image();
const naviImage = new Image();
coinImage.src = 'assets/coin.svg';
couponImage.src = 'assets/coupon.svg';
naviImage.src = 'assets/navi.svg';

// Game state
let gameStarted = false;
let gameRunning = false;
let score = 0;
let coins = 0;
let coupons = 0;
let reviveCount = 5;
let reviveUsedInSession = false; // Track if revive was used in current session

// Coupon system configuration - win condition (will be set from API only)
let couponsToWin = null; // Will be set from API only

// Bird object
const bird = {
    x: 50,
    y: canvas.height / 2,
    width: 30,
    height: 25,
    velocity: 0,
    gravity: 0.15, // Reduced from 0.2 for better control
    jumpPower: -4.5, // Slightly reduced to match new gravity
    color: '#3EA45D' // Green accent from purple theme
};

// Game objects arrays
let pipes = [];
let coinObjects = [];
let couponObjects = [];
let particles = [];

// Game constants (will be set from API only)
const pipeWidth = 60;
let pipeGap = null; // vertical_pipe_gap from API
let basePipeSpeed = null; // bird_speed from API (converted)
const maxPipeSpeed = 2.0; // Maximum speed cap
const speedIncreaseRate = 0.02; // Speed increase per point
let pipeSpacing = null; // horizontal_pipe_gap from API
let coinSpacing = null; // coin_distance from API
let couponSpacing = null; // coupon_distance from API

// Game parameters from API (will be set when API loads)
let gameParameters = null;
let apiInitialized = false;

// Update game parameters from API
function updateGameParameters() {
    if (window.gameAPI && window.gameAPI.isAPIInitialized()) {
        const apiParams = window.gameAPI.getGameParameters();
        const winningCriteria = window.gameAPI.getWinningCriteria();
        gameParameters = apiParams;
        
        // Update game constants based on API parameters
        pipeGap = apiParams.vertical_pipe_gap;
        basePipeSpeed = apiParams.bird_speed / 20; // Convert bird_speed to game speed
        pipeSpacing = apiParams.horizontal_pipe_gap;
        coinSpacing = apiParams.coin_distance;
        couponSpacing = apiParams.coupon_distance;
        
        // Update winning criteria from API
        if (winningCriteria) {
            couponsToWin = winningCriteria.coupons;
        }
        
        apiInitialized = true;
        
        // Check if game can be resumed
        if (window.gameAPI.canResumeGame()) {
            showResumeOption();
        } else {
            showNewGameOption();
        }
        
        // Update UI to show game is ready and correct values
        updateConnectionStatus();
        enableStartButton();
        updateUI(); // Update UI with loaded values
    }
}

// Called when sync completes after session update
function onSyncComplete() {
    // Update game parameters and UI after sync
    updateGameParameters();
    
    // Update UI to reflect new revival options
    updateUI();
    
    // Update connection status
    updateConnectionStatus();
}

// Dynamic speed calculation
function getCurrentSpeed() {
    return Math.min(basePipeSpeed + (score * speedIncreaseRate), maxPipeSpeed);
}

// Resize canvas to viewport
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Reset bird position to center of new canvas size
    bird.y = canvas.height / 2;
}

// Game initialization
function init() {
    resizeCanvas();
    updateUI();
    updateConnectionStatus();
    enableStartButton(); // Initially disabled
    
    // Initialize API and set callbacks
    if (window.gameAPI) {
        window.gameAPI.onInitialized(updateGameParameters);
        window.gameAPI.onSyncComplete(onSyncComplete);
    } else {
        // Wait for API service to be available
        setTimeout(() => {
            if (window.gameAPI) {
                window.gameAPI.onInitialized(updateGameParameters);
                window.gameAPI.onSyncComplete(onSyncComplete);
            }
        }, 1000);
    }
    
    // Start the game loop for background rendering, but game logic waits for start button
    gameLoop();
}

// Start the game when button is clicked
function startGame() {
    // Check if API is initialized before starting
    if (!apiInitialized || !gameParameters) {
        alert('Please wait for game parameters to load from server...');
        return;
    }
    
    gameStarted = true;
    gameRunning = true;
    
    // Hide start screen and show game
    document.getElementById('startGameInfo').style.display = 'none';
    
    // Reset bird to safe starting position
    bird.y = canvas.height / 2;
    bird.velocity = 0;
    
    // Reset game state
    score = 0;
    coins = 0;
    coupons = 0;
    reviveUsedInSession = false; // Reset revive tracking for new session
    
    // Create first pipe safely positioned using API parameters
    const safeDistance = Math.max(bird.x + 200, canvas.width - pipeSpacing);
    createPipe(safeDistance);
    
    updateUI();
}

// Resume game from saved session
function resumeGame() {
    // Check if API is initialized and can resume
    if (!apiInitialized || !gameParameters || !window.gameAPI.canResumeGame()) {
        alert('Cannot resume game - session data not available');
        return;
    }
    
    const sessionData = window.gameAPI.getActiveGameSession();
    if (!sessionData) {
        alert('No session data available to resume');
        return;
    }
    
    // Restore game state from session data
    if (sessionData.coins !== undefined) coins = sessionData.coins;
    if (sessionData.coupons !== undefined) coupons = sessionData.coupons;
    if (sessionData.score !== undefined) score = sessionData.score;
    if (sessionData.reviveCount !== undefined) reviveCount = sessionData.reviveCount;
    
    // Start the game
    gameStarted = true;
    gameRunning = true;
    
    // Hide start screen and show game
    document.getElementById('startGameInfo').style.display = 'none';
    
    // Reset bird to safe starting position
    bird.y = canvas.height / 2;
    bird.velocity = 0;
    
    // Create first pipe safely positioned using API parameters
    const safeDistance = Math.max(bird.x + 200, canvas.width - pipeSpacing);
    createPipe(safeDistance);
    
    updateUI();
}

// Show resume game option
function showResumeOption() {
    const startBtn = document.getElementById('startGameBtn');
    startBtn.textContent = '🔄 Resume Game';
    startBtn.onclick = resumeGame;
}

// Show new game option
function showNewGameOption() {
    const startBtn = document.getElementById('startGameBtn');
    startBtn.textContent = '🚀 Start Game';
    startBtn.onclick = startGame;
}

// Enable/disable start button based on API status
function enableStartButton() {
    const startBtn = document.getElementById('startGameBtn');
    if (apiInitialized) {
        startBtn.disabled = false;
        startBtn.style.opacity = '1';
    } else {
        startBtn.disabled = true;
        startBtn.textContent = '⏳ Loading...';
        startBtn.style.opacity = '0.6';
    }
}

// Update connection status indicator (optional UI element)
function updateConnectionStatus() {
    try {
        if (!statusTextElement || !connectionStatusElement) {
            return;
        }
        
        if (!window.gameAPI) {
            statusTextElement.textContent = '⚠️ API Loading...';
            connectionStatusElement.style.backgroundColor = 'rgba(255, 193, 7, 0.2)';
            return;
        }

        if (apiInitialized) {
            statusTextElement.textContent = '🟢 Ready';
            connectionStatusElement.style.backgroundColor = 'rgba(40, 167, 69, 0.2)';
        } else if (window.gameAPI.isServiceOnline()) {
            statusTextElement.textContent = '🔄 Loading...';
            connectionStatusElement.style.backgroundColor = 'rgba(255, 193, 7, 0.2)';
        } else {
            statusTextElement.textContent = '🔴 Failed';
            connectionStatusElement.style.backgroundColor = 'rgba(220, 53, 69, 0.2)';
        }
    } catch (error) {
        // Silently ignore connection status UI errors
    }
}

// Update UI elements
function updateUI() {
    // Display coin count and cash value separately with their respective icons
    coinCountElement.textContent = coins;
    const cashValue = (coins / 10).toFixed(1);
    cashValueElement.textContent = `₹${cashValue}`;
    couponsElement.textContent = `${coupons}/${couponsToWin || '?'}`;
    
    // Show/hide revive button based on game state
    reviveBtn.style.display = gameRunning ? 'none' : 'inline-block';
    
    // Enable/disable revive button based on API revival data
    if (window.gameAPI && window.gameAPI.hasRevivalsAvailable()) {
        reviveBtn.disabled = false;
        reviveBtn.textContent = 'Revive';
        reviveBtn.onclick = useRevive;
    } else {
        reviveBtn.disabled = true;
        reviveBtn.textContent = 'Revive (Locked)';
        reviveBtn.onclick = showLockedRevivalReasons;
    }
}

// Create a new pipe
function createPipe(customX = null) {
    const minHeight = 50;
    const maxHeight = canvas.height - pipeGap - minHeight;
    const topHeight = Math.random() * (maxHeight - minHeight) + minHeight;
    const pipeX = customX !== null ? customX : canvas.width;
    
    pipes.push({
        x: pipeX,
        topHeight: topHeight,
        bottomY: topHeight + pipeGap,
        bottomHeight: canvas.height - (topHeight + pipeGap),
        passed: false
    });
    
    // Randomly spawn coins and coupons
    if (Math.random() < 0.9) { // 90% chance for coin
        // Add randomness to coin position within the pipe gap for better distribution
        const coinY = topHeight + (pipeGap * 0.3) + (Math.random() * pipeGap * 0.4);
        createCoin(pipeX + 100, coinY);
    }
    
    if (Math.random() < 0.15) { // 15% chance for coupon, unlimited spawning
        createCoupon(pipeX + 150, Math.random() * (canvas.height - 100) + 50);
    }
}

// Create coin
function createCoin(x, y) {
    coinObjects.push({
        x: x,
        y: y,
        width: 20,
        height: 20,
        collected: false
    });
}

// Create coupon
function createCoupon(x, y) {
    couponObjects.push({
        x: x,
        y: y,
        width: 30,
        height: 25,
        collected: false,
        pulse: 0
    });
}

// Create particle effect
function createParticles(x, y, color, count = 5) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 30,
            maxLife: 30,
            color: color
        });
    }
}

// Update bird physics
function updateBird() {
    if (!gameRunning) return;
    
    bird.velocity += bird.gravity;
    bird.y += bird.velocity;
    
    // Prevent bird from going off screen
    if (bird.y < 0) {
        bird.y = 0;
        bird.velocity = 0;
    }
    
    if (bird.y + bird.height > canvas.height) {
        gameOver();
    }
}

// Update pipes
function updatePipes() {
    if (!gameRunning) return;
    
    // Move pipes
    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x -= getCurrentSpeed();
        
        // Check if bird passed the pipe
        if (!pipes[i].passed && pipes[i].x + pipeWidth < bird.x) {
            pipes[i].passed = true;
            score++;
            updateUI();
        }
        
        // Remove pipes that are off screen
        if (pipes[i].x + pipeWidth < 0) {
            pipes.splice(i, 1);
        }
    }
    
    // Create new pipe when needed with equal spacing
    if (pipes.length === 0 || pipes[pipes.length - 1].x < canvas.width - pipeSpacing) {
        createPipe();
    }
}

// Update coins
function updateCoins() {
    if (!gameRunning) return;
    
    for (let i = coinObjects.length - 1; i >= 0; i--) {
        const coin = coinObjects[i];
        coin.x -= getCurrentSpeed();
        
        // Check collision with bird
        if (!coin.collected && 
            bird.x < coin.x + coin.width &&
            bird.x + bird.width > coin.x &&
            bird.y < coin.y + coin.height &&
            bird.y + bird.height > coin.y) {
            
            coin.collected = true;
            coins++;
            createParticles(coin.x + coin.width/2, coin.y + coin.height/2, '#FFD700', 8);
            updateUI();
        }
        
        // Remove coins that are off screen or collected
        if (coin.x + coin.width < 0 || coin.collected) {
            coinObjects.splice(i, 1);
        }
    }
}

// Update coupons
function updateCoupons() {
    if (!gameRunning) return;
    
    for (let i = couponObjects.length - 1; i >= 0; i--) {
        const coupon = couponObjects[i];
        coupon.x -= getCurrentSpeed();
        coupon.pulse += 0.1;
        
        // Check collision with bird
        if (!coupon.collected && 
            bird.x < coupon.x + coupon.width &&
            bird.x + bird.width > coupon.x &&
            bird.y < coupon.y + coupon.height &&
            bird.y + bird.height > coupon.y) {
            
            coupon.collected = true;
            coupons++;
            reviveCount++; // Give revive for collecting coupon
            createParticles(coupon.x + coupon.width/2, coupon.y + coupon.height/2, '#FF69B4', 10);
            updateUI();
            
            // Check win condition - player wins when collecting required coupons
            if (coupons >= couponsToWin) {
                gameWin();
            }
        }
        
        // Remove coupons that are off screen or collected
        if (coupon.x + coupon.width < 0 || coupon.collected) {
            couponObjects.splice(i, 1);
        }
    }
}

// Update particles
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life--;
        
        if (particle.life <= 0) {
            particles.splice(i, 1);
        }
    }
}



// Check collisions
function checkCollisions() {
    if (!gameRunning) return;
    
    for (let pipe of pipes) {
        // Check if bird is within pipe x bounds
        if (bird.x < pipe.x + pipeWidth && bird.x + bird.width > pipe.x) {
            // Check collision with top pipe
            if (bird.y < pipe.topHeight) {
                gameOver();
                return;
            }
            // Check collision with bottom pipe
            if (bird.y + bird.height > pipe.bottomY) {
                gameOver();
                return;
            }
        }
    }
}

// Draw bird
function drawBird() {
    ctx.fillStyle = bird.color;
    ctx.fillRect(bird.x, bird.y, bird.width, bird.height);
    
    // Draw bird details (simple)
    ctx.fillStyle = '#FF6347';
    ctx.fillRect(bird.x + bird.width - 5, bird.y + bird.height / 2 - 2, 8, 4); // beak
    
    ctx.fillStyle = '#000';
    ctx.fillRect(bird.x + 5, bird.y + 5, 3, 3); // eye
}

// Draw coins
function drawCoins() {
    for (let coin of coinObjects) {
        if (coin.collected) continue;
        
        // Draw SVG coin image at higher resolution without rotation
        if (coinImage.complete) {
            // Render at 1.5x size for better resolution
            const renderSize = coin.width * 1.5;
            const offsetX = coin.x - (renderSize - coin.width) / 2;
            const offsetY = coin.y - (renderSize - coin.height) / 2;
            
            ctx.drawImage(coinImage, offsetX, offsetY, renderSize, renderSize);
        } else {
            // Fallback if SVG not loaded
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(coin.x, coin.y, coin.width, coin.height);
        }
    }
}

// Draw coupons
function drawCoupons() {
    for (let coupon of couponObjects) {
        if (coupon.collected) continue;
        
        const pulseSize = Math.sin(coupon.pulse) * 3;
        
        ctx.save();
        ctx.translate(coupon.x + coupon.width/2, coupon.y + coupon.height/2);
        
        // Coupon glow effect
        ctx.shadowColor = '#FF69B4';
        ctx.shadowBlur = 10 + pulseSize;
        
        // Draw SVG coupon image with pulse effect
        if (couponImage.complete) {
            const size = pulseSize / 2;
            ctx.drawImage(couponImage, 
                -coupon.width/2 - size, -coupon.height/2 - size, 
                coupon.width + size * 2, coupon.height + size * 2);
        } else {
            // Fallback if SVG not loaded
            ctx.fillStyle = '#FF69B4';
            ctx.fillRect(-coupon.width/2 - pulseSize/2, -coupon.height/2 - pulseSize/2, 
                        coupon.width + pulseSize, coupon.height + pulseSize);
        }
        
        ctx.restore();
    }
}

// Draw particles
function drawParticles() {
    for (let particle of particles) {
        const alpha = particle.life / particle.maxLife;
        ctx.fillStyle = particle.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
    }
}

// Draw pipes
function drawPipes() {
    ctx.fillStyle = '#76529A'; // Medium purple for pipe body
    
    for (let pipe of pipes) {
        // Top pipe
        ctx.fillRect(pipe.x, 0, pipeWidth, pipe.topHeight);
        // Bottom pipe
        ctx.fillRect(pipe.x, pipe.bottomY, pipeWidth, pipe.bottomHeight);
        
        // Pipe caps
        ctx.fillStyle = '#381763'; // Dark purple for pipe caps
        ctx.fillRect(pipe.x - 5, pipe.topHeight - 20, pipeWidth + 10, 20);
        ctx.fillRect(pipe.x - 5, pipe.bottomY, pipeWidth + 10, 20);
        ctx.fillStyle = '#76529A'; // Reset to medium purple
        
        // Add navi.svg branding on pipes
        if (naviImage.complete && naviImage.naturalWidth > 0) {
            const logoSize = 40; // Size of the navi logo
            const logoX = pipe.x + (pipeWidth - logoSize) / 2; // Center horizontally on pipe
            
            // Navi logo on top pipe (if there's enough space)
            if (pipe.topHeight > logoSize + 10) {
                const logoY = pipe.topHeight - logoSize - 30; // Position above pipe cap
                ctx.drawImage(naviImage, logoX, logoY, logoSize, logoSize);
            }
            
            // Navi logo on bottom pipe (if there's enough space)
            if (pipe.bottomHeight > logoSize + 10) {
                const logoY = pipe.bottomY + 30; // Position below pipe cap
                ctx.drawImage(naviImage, logoX, logoY, logoSize, logoSize);
            }
        }
    }
}

// Draw background elements
function drawBackground() {
    // Purple gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1F002A'); // Deepest purple at top
    gradient.addColorStop(0.5, '#290932'); // Very dark purple in middle
    gradient.addColorStop(1, '#381763'); // Dark purple at bottom
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Purple-tinted clouds
    ctx.fillStyle = 'rgba(118, 82, 154, 0.3)'; // Semi-transparent medium purple
    ctx.beginPath();
    ctx.arc(100, 80, 25, 0, Math.PI * 2);
    ctx.arc(120, 80, 30, 0, Math.PI * 2);
    ctx.arc(140, 80, 25, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(300, 120, 20, 0, Math.PI * 2);
    ctx.arc(315, 120, 25, 0, Math.PI * 2);
    ctx.arc(330, 120, 20, 0, Math.PI * 2);
    ctx.fill();
}

// Main game loop
function gameLoop() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background elements
    drawBackground();
    
    // Only update and draw game objects if game has started
    if (gameStarted) {
        // Update game objects
        updateBird();
        updatePipes();
        updateCoins();
        updateCoupons();
        updateParticles();
        checkCollisions();
        
        // Draw game objects
        drawPipes();
        drawCoins();
        drawCoupons();
        drawParticles();
        drawBird();
    }
    
    // Continue game loop
    requestAnimationFrame(gameLoop);
}



// Handle unified SPACE key controls
function handleSpaceKey() {
    if (gameRunning) {
        // During gameplay: jump
        jump();
    } else {
        // Game over state: check if revive is available, otherwise restart
        if (reviveCount > 0) {
            useRevive();
        } else {
            restartGame();
        }
    }
}

// Make bird jump
function jump() {
    if (gameRunning) {
        bird.velocity = bird.jumpPower;
    }
}

// Show locked revival reasons when revive is disabled
function showLockedRevivalReasons() {
    if (window.gameAPI) {
        const lockedReasons = window.gameAPI.getLockedRevivalReasons();
        const unlockedReasons = window.gameAPI.getUnlockedRevivalReasons();
        
        let message = 'Revival is currently locked.\n\n';
        
        if (unlockedReasons.length > 0) {
            message += 'Available revival methods:\n' + unlockedReasons.join(', ') + '\n\n';
        }
        
        if (lockedReasons.length > 0) {
            message += 'Locked revival methods:\n' + lockedReasons.join(', ') + '\n\n';
            message += 'Complete required actions to unlock these revival methods.';
        } else {
            message += 'No revival methods available at this time.';
        }
        
        alert(message);
    } else {
        alert('Revival system not available - API not connected.');
    }
}

// Use revive power-up
function useRevive() {
    if (window.gameAPI && window.gameAPI.hasRevivalsAvailable() && !gameRunning) {
        const unlockedReasons = window.gameAPI.getUnlockedRevivalReasons();
        
        // For now, use the first available revival reason
        if (unlockedReasons.length > 0) {
            bird.y = canvas.height / 2;
            bird.velocity = 0;
            gameRunning = true;
            document.getElementById('gameOverInfo').style.display = 'none';
            
            // Clear nearby pipes to give player a chance
            for (let i = pipes.length - 1; i >= 0; i--) {
                if (pipes[i].x < bird.x + 100 && pipes[i].x > bird.x - 50) {
                    pipes.splice(i, 1);
                }
            }
            
            // Create revival particles effect
            createParticles(bird.x + bird.width/2, bird.y + bird.height/2, '#FF69B4', 15);
            
            // Mark that revive was used in this session
            reviveUsedInSession = true;
            
            updateUI();
        }
    } else {
        showLockedRevivalReasons();
    }
}



// Game win - player collected required coupons
function gameWin() {
    gameRunning = false;
    
    // Send session data to API
    if (window.gameAPI && window.gameAPI.isServiceOnline()) {
        window.gameAPI.updateGameSession({
            verdict: 'WON',
            coins: coins,
            coupons: coupons,
            reviveUsed: reviveUsedInSession
        });
    }
    
    // Show win message instead of game over
    alert(`🎉 Congratulations! You collected ${couponsToWin} coupons and won the game! 🎉`);
    document.getElementById('gameOverInfo').style.display = 'block';
    updateUI();
}

// Game over
function gameOver() {
    gameRunning = false;
    
    // Send session data to API
    if (window.gameAPI && window.gameAPI.isServiceOnline()) {
        window.gameAPI.updateGameSession({
            verdict: 'LOST',
            coins: coins,
            coupons: coupons,
            reviveUsed: reviveUsedInSession
        });
    }
    
    document.getElementById('gameOverInfo').style.display = 'block';
    updateUI();
}

// Restart game
function restartGame() {
    gameStarted = false;
    gameRunning = false;
    score = 0;
    coins = 0;
    coupons = 0;
    reviveCount = 5;
    reviveUsedInSession = false; // Reset revive tracking for new session
    bird.y = canvas.height / 2;
    bird.velocity = 0;
    pipes = [];
    coinObjects = [];
    couponObjects = [];
    particles = [];
    document.getElementById('gameOverInfo').style.display = 'none';
    document.getElementById('startGameInfo').style.display = 'block';
    updateUI();
}

// Event listeners
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
        e.preventDefault();
        handleSpaceKey();
    }
});

// Canvas click event
canvas.addEventListener('click', (e) => {
    jump();
});

// Make sure canvas can receive focus
canvas.setAttribute('tabindex', '0');

// Add window focus to ensure events work
window.addEventListener('load', () => {
    canvas.focus();
});

// Handle window resize
window.addEventListener('resize', () => {
    resizeCanvas();
});

// Start the game
init();
