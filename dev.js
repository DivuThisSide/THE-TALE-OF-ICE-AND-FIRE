// Game Constants
const AI_STATES = {
    WANDERING: 'wandering',
    RESCUING: 'rescuing'
};

const groundWidth = 3600;
const groundHeight = 2160;
const numFirePlayers = 10;
const INITIAL_LIVES = 3;
const icePlayerSpeed = 8;  // Increased speed
const firePlayerSpeed = 3.5;
const scoreCooldown = 1000;
const COLLISION_RADIUS = 40;

// Add near the top with other constants
const COLORS = {
    GROUND: 0x2d5a27,      // Darker green
    GRASS_PATCH: 0x156315, // Even darker green for contrast
    BORDER: 0x8B4513,      // Saddle brown
    GRID: 0x000000        // Black for grid lines
};

// Add timer constants at the top with other constants
const GAME_TIME = 240; // 4 minutes in seconds

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8B4513);  // Brown background

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(0, 2800, 0);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(0, 2000, 0);
directionalLight.castShadow = true;
directionalLight.shadow.camera.left = -groundWidth/2;
directionalLight.shadow.camera.right = groundWidth/2;
directionalLight.shadow.camera.top = groundHeight/2;
directionalLight.shadow.camera.bottom = -groundHeight/2;
directionalLight.shadow.camera.far = 3500;
directionalLight.shadow.mapSize.width = 4096;
directionalLight.shadow.mapSize.height = 4096;
scene.add(directionalLight);

const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
scene.add(hemisphereLight);

// Ground
const groundGeometry = new THREE.PlaneGeometry(groundWidth, groundHeight);
const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x228B22,
    roughness: 0.8,
    metalness: 0.2
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Add boundary with original golden color
const boundaryGeometry = new THREE.EdgesGeometry(
    new THREE.PlaneGeometry(groundWidth + 20, groundHeight + 20)
);
const boundaryMaterial = new THREE.LineBasicMaterial({ 
    color: 0xffd700,
    linewidth: 2 
});
const boundary = new THREE.LineSegments(boundaryGeometry, boundaryMaterial);
boundary.rotation.x = -Math.PI / 2;
boundary.position.y = 1;
scene.add(boundary);

// Ice Player
const icePlayerGeometry = new THREE.SphereGeometry(30, 32, 32);
const icePlayerMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x00ffff,  // Cyan/Ice blue color
    metalness: 0.3,
    roughness: 0.4
});
const icePlayer = new THREE.Mesh(icePlayerGeometry, icePlayerMaterial);
icePlayer.position.set(0, 30, 0);
icePlayer.castShadow = true;
scene.add(icePlayer);

// Add name to ice player (after ice player creation)
const icePlayerName = createNameSprite('ICE');
icePlayerName.position.y = 150;  // Increased height
icePlayer.add(icePlayerName);

// Game State Variables
let score = 0;
const playerLives = new Array(numFirePlayers).fill(INITIAL_LIVES);
const frozenPlayers = new Array(numFirePlayers).fill(false);
const lastScoreTime = new Map();
const firePlayers = [];
const firePlayerBoxes = [];
const firePlayerNames = Array.from({ length: numFirePlayers }, (_, i) => `${i + 1}`);

// Helper Functions
function createNameSprite(name, lives = null) {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;  // Increased to 2048
    canvas.height = 512;  // Increased to 512
    
    const context = canvas.getContext('2d');
    context.fillStyle = 'rgba(0, 0, 0, 0)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Increased font sizes
    context.font = 'bold 240px Arial';  // Increased to 240px
    context.fillStyle = '#000000';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Draw name in black
    context.fillText(name, canvas.width / 2, canvas.height / 2);
    
    // Increased heart size
    if (lives !== null) {
        context.font = 'bold 160px Arial';  // Increased to 160px
        context.fillStyle = '#ff0000';
        context.fillText(`❤️`.repeat(lives), canvas.width / 2, canvas.height * 0.8);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true,
        sizeAttenuation: true
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(480, 120, 1);  // Increased to (480, 120, 1)
    return sprite;
}

// Event Listeners
const keysPressed = {};

document.addEventListener('keydown', (event) => {
    if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
    }
    
    keysPressed[event.key] = true;
    
    const moveSpeed = icePlayerSpeed;
    const diagonalSpeed = moveSpeed * 0.707; // Approximately moveSpeed / √2 for diagonal movement
    let dx = 0;
    let dz = 0;

    // Check for vertical movement (Up/Down or W/S)
    if (keysPressed['ArrowUp'] || keysPressed['w'] || keysPressed['W']) {
        dz -= 1;
    }
    if (keysPressed['ArrowDown'] || keysPressed['s'] || keysPressed['S']) {
        dz += 1;
    }

    // Check for horizontal movement (Left/Right or A/D)
    if (keysPressed['ArrowLeft'] || keysPressed['a'] || keysPressed['A']) {
        dx -= 1;
    }
    if (keysPressed['ArrowRight'] || keysPressed['d'] || keysPressed['D']) {
        dx += 1;
    }

    // Apply movement with proper speed
    if (dx !== 0 && dz !== 0) {
        // Diagonal movement
        icePlayer.position.x += dx * diagonalSpeed;
        icePlayer.position.z += dz * diagonalSpeed;
    } else {
        // Straight movement
        icePlayer.position.x += dx * moveSpeed;
        icePlayer.position.z += dz * moveSpeed;
    }

    // Boundary checks
    icePlayer.position.x = Math.max(-groundWidth / 2, Math.min(groundWidth / 2, icePlayer.position.x));
    icePlayer.position.z = Math.max(-groundHeight / 2, Math.min(groundHeight / 2, icePlayer.position.z));
});

// Clear keys when they're released
document.addEventListener('keyup', (event) => {
    keysPressed[event.key] = false;
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Game Logic Functions
function moveFirePlayers() {
    const frozenCount = frozenPlayers.filter(frozen => frozen).length;
    const maxRescuers = Math.min(2, frozenCount); // Changed to maximum 2 rescuers
    let currentRescuers = 0;

    // First count current rescuers
    firePlayers.forEach(player => {
        if (player.state === AI_STATES.RESCUING) {
            currentRescuers++;
        }
    });

    firePlayers.forEach((firePlayerObj, index) => {
        if (playerLives[index] <= 0) return; // Skip dead players

        const firePlayer = firePlayerObj.mesh;
        const velocity = firePlayerObj.velocity;

        if (frozenPlayers[index]) {
            // Check if another fire player is close enough to unfreeze
            firePlayers.forEach((rescuer, rescuerIndex) => {
                if (index !== rescuerIndex && !frozenPlayers[rescuerIndex] && playerLives[rescuerIndex] > 0) {
                    const distance = firePlayer.position.distanceTo(rescuer.mesh.position);
                    if (distance < 100) { // Unfreezing distance
                        frozenPlayers[index] = false;
                        firePlayer.material = new THREE.MeshStandardMaterial({
                            color: 0xff4500, // Return to original color
                            roughness: 0.8,
                            metalness: 0.2
                        });
                    }
                }
            });
            return;
        }

        if (firePlayerObj.state === AI_STATES.WANDERING) {
            // Only consider becoming a rescuer if we haven't reached the maximum
            if (currentRescuers < maxRescuers && frozenCount > 0) {
                const nearestFrozen = findNearestFrozenPlayer(firePlayer.position);
                if (nearestFrozen) {
                    const distanceToIce = icePlayer.position.distanceTo(nearestFrozen.position);
                    if (distanceToIce > 300) {
                        firePlayerObj.state = AI_STATES.RESCUING;
                        firePlayerObj.targetPlayer = nearestFrozen;
                        currentRescuers++;
                    }
                }
            }
        }

        if (firePlayerObj.state === AI_STATES.RESCUING && firePlayerObj.targetPlayer) {
            // Check if target is still frozen
            const targetIndex = firePlayers.findIndex(p => p.mesh === firePlayerObj.targetPlayer);
            if (targetIndex === -1 || !frozenPlayers[targetIndex]) {
                firePlayerObj.state = AI_STATES.WANDERING;
                firePlayerObj.targetPlayer = null;
                currentRescuers--;
                return;
            }

            const distanceToIce = icePlayer.position.distanceTo(firePlayerObj.targetPlayer.position);
            if (distanceToIce <= 300) {
                firePlayerObj.state = AI_STATES.WANDERING;
                firePlayerObj.targetPlayer = null;
                currentRescuers--;
                const retreatDirection = new THREE.Vector3()
                    .subVectors(firePlayer.position, icePlayer.position)
                    .normalize();
                firePlayer.position.x += retreatDirection.x * firePlayerSpeed * 1.5;
                firePlayer.position.z += retreatDirection.z * firePlayerSpeed * 1.5;
            } else {
                const direction = new THREE.Vector3()
                    .subVectors(firePlayerObj.targetPlayer.position, firePlayer.position)
                    .normalize();
                firePlayer.position.x += direction.x * firePlayerSpeed;
                firePlayer.position.z += direction.z * firePlayerSpeed;
            }
        } else {
            // Normal wandering behavior
            firePlayer.position.x += velocity.x * firePlayerSpeed;
            firePlayer.position.z += velocity.z * firePlayerSpeed;

            if (firePlayer.position.x > groundWidth / 2 || firePlayer.position.x < -groundWidth / 2) {
                velocity.x *= -1;
            }
            if (firePlayer.position.z > groundHeight / 2 || firePlayer.position.z < -groundHeight / 2) {
                velocity.z *= -1;
            }
        }

        // Boundary checks
        firePlayer.position.x = Math.max(-groundWidth / 2, Math.min(groundWidth / 2, firePlayer.position.x));
        firePlayer.position.z = Math.max(-groundHeight / 2, Math.min(groundHeight / 2, firePlayer.position.z));
    });
}

function findNearestFrozenPlayer(position) {
    let nearestDistance = Infinity;
    let nearestPlayer = null;

    firePlayers.forEach((playerObj, index) => {
        if (frozenPlayers[index]) {
            const distance = position.distanceTo(playerObj.mesh.position);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestPlayer = playerObj.mesh;
            }
        }
    });

    return nearestPlayer;
}

// Update detectCollisions function to show win message immediately
function detectCollisions() {
    // Ice player collision box
    const icePlayerCenter = new THREE.Vector3();
    icePlayer.getWorldPosition(icePlayerCenter);
    
    const icePlayerBox = new THREE.Box3();
    icePlayerBox.min.set(
        icePlayerCenter.x - COLLISION_RADIUS,
        icePlayerCenter.y - COLLISION_RADIUS,
        icePlayerCenter.z - COLLISION_RADIUS
    );
    icePlayerBox.max.set(
        icePlayerCenter.x + COLLISION_RADIUS,
        icePlayerCenter.y + COLLISION_RADIUS,
        icePlayerCenter.z + COLLISION_RADIUS
    );

    // Check collisions with fire players
    firePlayers.forEach((firePlayerObj, index) => {
        if (!frozenPlayers[index] && playerLives[index] > 0) {
            const firePlayerCenter = new THREE.Vector3();
            firePlayerObj.mesh.getWorldPosition(firePlayerCenter);
            
            const firePlayerBox = new THREE.Box3();
            firePlayerBox.min.set(
                firePlayerCenter.x - COLLISION_RADIUS,
                firePlayerCenter.y - COLLISION_RADIUS,
                firePlayerCenter.z - COLLISION_RADIUS
            );
            firePlayerBox.max.set(
                firePlayerCenter.x + COLLISION_RADIUS,
                firePlayerCenter.y + COLLISION_RADIUS,
                firePlayerCenter.z + COLLISION_RADIUS
            );

            if (icePlayerBox.intersectsBox(firePlayerBox)) {
                // Update score
                const scoreBoard = document.getElementById('scoreBoard');
                if (scoreBoard && window.gameActive) {
                    const currentScoreText = scoreBoard.textContent.split(': ')[1];
                    const currentScore = parseInt(currentScoreText.split('/')[0]) || 0;
                    const newScore = currentScore + 1;
                    
                    // Update score display
                    scoreBoard.textContent = `Score: ${newScore}/${window.targetScore}`;
                }
                
                // Freeze player
                frozenPlayers[index] = true;
                playerLives[index]--;
                
                const firePlayer = firePlayerObj.mesh;
                
                // Update name sprite
                if (firePlayer.children.length > 0) {
                    firePlayer.remove(firePlayer.children[0]);
                    const newSprite = createNameSprite(firePlayerNames[index], playerLives[index]);
                    newSprite.position.y = 150;
                    firePlayer.add(newSprite);
                }

                // Update hearts display
                const heartsBoard = document.getElementById('heartsBoard');
                if (heartsBoard) {
                    let heartsHTML = '<div style="font-weight: bold; margin-bottom: 5px;">Lives Remaining:</div>';
                    firePlayerNames.forEach((name, idx) => {
                        const hearts = playerLives[idx];
                        heartsHTML += `<div>Player ${name}: ${'❤️'.repeat(hearts)}</div>`;
                    });
                    heartsBoard.innerHTML = heartsHTML;
                }

                // Change player color based on lives
                if (playerLives[index] <= 0) {
                    firePlayer.material = new THREE.MeshStandardMaterial({
                        color: 0x808080, // Grey for no lives
                        roughness: 0.8,
                        metalness: 0.2
                    });
                } else {
                    firePlayer.material = new THREE.MeshStandardMaterial({
                        color: 0xadd8e6, // Light blue for frozen
                        roughness: 0.8,
                        metalness: 0.2
                    });
                }

                // Check win condition after updating visuals
                const newScore = parseInt(scoreBoard.textContent.split(': ')[1].split('/')[0]) || 0;
                if (newScore >= window.targetScore) {
                    // Render one last frame
                    renderer.render(scene, camera);
                    // End game immediately
                    endGame('Congratulations! You Win! 🎉', true);
                }
            }
        }
    });
}

// Add this function to format time
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Update endGame function to ensure it always shows
function endGame(message, isWin = false) {
    if (!window.gameActive) return;
    
    window.gameActive = false;
    clearInterval(window.timerInterval);
    
    const gameOverDiv = document.createElement('div');
    gameOverDiv.id = 'gameOverDiv';
    gameOverDiv.style.position = 'absolute';
    gameOverDiv.style.top = '50%';
    gameOverDiv.style.left = '50%';
    gameOverDiv.style.transform = 'translate(-50%, -50%)';
    gameOverDiv.style.color = isWin ? '#006400' : '#8B0000';
    gameOverDiv.style.fontSize = '48px';
    gameOverDiv.style.fontWeight = 'bold';
    gameOverDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    gameOverDiv.style.padding = '20px';
    gameOverDiv.style.borderRadius = '10px';
    gameOverDiv.style.textAlign = 'center';
    gameOverDiv.style.zIndex = '1000';
    
    const scoreBoard = document.getElementById('scoreBoard');
    const currentScoreText = scoreBoard.textContent.split(': ')[1];
    const currentScore = parseInt(currentScoreText.split('/')[0]) || 0;
    
    let finalMessage = isWin ? 
        `${message}<br>Final Score: ${currentScore}/${window.targetScore}` :
        `Game Over! You Lose!<br>Score: ${currentScore}/${window.targetScore}`;
    
    gameOverDiv.innerHTML = `${finalMessage}<br>
        <button onclick="location.reload()" style="padding: 10px 20px; margin-top: 20px; 
        background-color: ${isWin ? '#4CAF50' : '#CD5C5C'}; color: white; border: none; 
        border-radius: 5px; cursor: pointer;">Play Again</button>`;
    
    document.body.appendChild(gameOverDiv);
    
    function finalRender() {
        renderer.render(scene, camera);
        if (!window.gameActive) {
            requestAnimationFrame(finalRender);
        }
    }
    finalRender();
}

// Update animate function
function animate() {
    if (window.gameActive) {
        requestAnimationFrame(animate);
        moveFirePlayers();
        detectCollisions();
        renderer.render(scene, camera);
    }
}

// Update createBush function to add more flowers
function createBush(x, y, z, scale = 1, forceFlowers = false) {
    const bushGeometry = new THREE.SphereGeometry(20, 8, 8);
    const bushMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2d5a27,  // Dark green
        roughness: 1
    });
    
    const bush = new THREE.Group();
    
    // Create denser main part of bush (4-5 overlapping spheres)
    const numSpheres = Math.floor(Math.random() * 2) + 4;
    for(let i = 0; i < numSpheres; i++) {
        const sphere = new THREE.Mesh(bushGeometry, bushMaterial);
        sphere.position.x = (Math.random() - 0.5) * 20;
        sphere.position.y = (Math.random() - 0.5) * 15;
        sphere.position.z = (Math.random() - 0.5) * 20;
        sphere.scale.set(
            Math.random() * 0.4 + 0.8,
            Math.random() * 0.4 + 0.8,
            Math.random() * 0.4 + 0.8
        );
        bush.add(sphere);
    }
    
    // Add more flowers with vibrant colors
    if(forceFlowers || Math.random() > 0.3) {  // 70% chance of flowers, or forced
        const flowerColors = [
            0xff69b4,
            0xffd700,
            0xff4500,
            0xffffff,
            0x9932cc,
            0xff0000,
            0xffff00,
            0x87ceeb
        ];
        const numFlowers = Math.floor(Math.random() * 4) + 2; // 2-5 flowers
        
        for(let i = 0; i < numFlowers; i++) {
            const flowerGeometry = new THREE.SphereGeometry(5, 8, 8);
            const flowerMaterial = new THREE.MeshStandardMaterial({
                color: flowerColors[Math.floor(Math.random() * flowerColors.length)],
                roughness: 0.5,
                metalness: 0.1
            });
            const flower = new THREE.Mesh(flowerGeometry, flowerMaterial);
            flower.position.x = (Math.random() - 0.5) * 35;
            flower.position.y = (Math.random() * 25) + 10;
            flower.position.z = (Math.random() - 0.5) * 35;
            flower.scale.set(0.4, 0.4, 0.4);
            bush.add(flower);
        }
    }
    
    bush.position.set(x, y, z);
    bush.scale.set(scale, scale, scale);
    return bush;
}

// Update initScene function with denser boundary decoration
function initScene() {
    // Scene Setup
    scene.background = new THREE.Color(0x8B4513);

    // Ground
    const groundGeometry = new THREE.PlaneGeometry(groundWidth, groundHeight);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: COLORS.GROUND,
        roughness: 0.8,
        metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Add boundary
    const boundaryGeometry = new THREE.EdgesGeometry(
        new THREE.PlaneGeometry(groundWidth + 20, groundHeight + 20)
    );
    const boundaryMaterial = new THREE.LineBasicMaterial({ 
        color: 0xffd700,
        linewidth: 2 
    });
    const boundary = new THREE.LineSegments(boundaryGeometry, boundaryMaterial);
    boundary.rotation.x = -Math.PI / 2;
    boundary.position.y = 1;
    scene.add(boundary);

    // Use existing ice player instead of creating a new one
    icePlayer.position.set(0, 30, 0);
    
    // Update ice player name
    if (icePlayer.children.length > 0) {
        icePlayer.remove(icePlayer.children[0]);
    }
    const icePlayerName = createNameSprite(window.icePlayerName || 'ICE');
    icePlayerName.position.y = 150;
    icePlayer.add(icePlayerName);

    // Create fire players
    createFirePlayers();

    // Add boundary bushes with smaller spacing
    const boundarySpacing = 100; // Reduced spacing between bushes
    const boundaryOffset = 40;   // Distance from the actual boundary
    
    // Add bushes along the boundary (double row)
    for(let x = -groundWidth/2; x <= groundWidth/2; x += boundarySpacing) {
        // Top boundary (double row)
        scene.add(createBush(x, 15, -groundHeight/2 - boundaryOffset, 1.2, true));
        scene.add(createBush(x + boundarySpacing/2, 15, -groundHeight/2 - boundaryOffset - 40, 1.1, true));
        
        // Bottom boundary (double row)
        scene.add(createBush(x, 15, groundHeight/2 + boundaryOffset, 1.2, true));
        scene.add(createBush(x + boundarySpacing/2, 15, groundHeight/2 + boundaryOffset + 40, 1.1, true));
    }
    
    for(let z = -groundHeight/2; z <= groundHeight/2; z += boundarySpacing) {
        // Left boundary (double row)
        scene.add(createBush(-groundWidth/2 - boundaryOffset, 15, z, 1.2, true));
        scene.add(createBush(-groundWidth/2 - boundaryOffset - 40, 15, z + boundarySpacing/2, 1.1, true));
        
        // Right boundary (double row)
        scene.add(createBush(groundWidth/2 + boundaryOffset, 15, z, 1.2, true));
        scene.add(createBush(groundWidth/2 + boundaryOffset + 40, 15, z + boundarySpacing/2, 1.1, true));
    }
    
    // Add corner decorations
    const corners = [
        [-groundWidth/2 - boundaryOffset, -groundHeight/2 - boundaryOffset],
        [-groundWidth/2 - boundaryOffset, groundHeight/2 + boundaryOffset],
        [groundWidth/2 + boundaryOffset, -groundHeight/2 - boundaryOffset],
        [groundWidth/2 + boundaryOffset, groundHeight/2 + boundaryOffset]
    ];
    
    corners.forEach(([x, z]) => {
        scene.add(createBush(x, 15, z, 1.4, true));  // Larger corner bushes with forced flowers
    });
    
    // Add random bushes in the playing field (keep this part)
    const numRandomBushes = 30;
    for(let i = 0; i < numRandomBushes; i++) {
        const x = (Math.random() - 0.5) * (groundWidth - 200);
        const z = (Math.random() - 0.5) * (groundHeight - 200);
        
        const distanceFromCenter = Math.sqrt(x * x + z * z);
        if(distanceFromCenter > 300) {
            scene.add(createBush(x, 15, z, 0.8 + Math.random() * 0.4));
        }
    }
}

// Update initializeGame function to include styles
function initializeGame() {
    // Initialize game state
    window.gameActive = true;
    score = 0;
    
    // Create score board
    const scoreBoard = document.createElement('div');
    scoreBoard.id = 'scoreBoard';
    scoreBoard.style.position = 'absolute';
    scoreBoard.style.top = '20px';
    scoreBoard.style.left = '20px';
    scoreBoard.style.color = 'black';
    scoreBoard.style.fontSize = '24px';
    scoreBoard.style.fontWeight = 'bold';
    scoreBoard.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
    scoreBoard.style.padding = '10px';
    scoreBoard.style.borderRadius = '5px';
    scoreBoard.textContent = `Score: 0/${window.targetScore}`;
    document.body.appendChild(scoreBoard);

    // Create timer board
    const timerBoard = document.createElement('div');
    timerBoard.id = 'timerBoard';
    timerBoard.style.position = 'absolute';
    timerBoard.style.top = '20px';
    timerBoard.style.right = '20px';
    timerBoard.style.color = 'black';
    timerBoard.style.fontSize = '24px';
    timerBoard.style.fontWeight = 'bold';
    timerBoard.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
    timerBoard.style.padding = '10px';
    timerBoard.style.borderRadius = '5px';
    document.body.appendChild(timerBoard);

    // Initialize timer
    let timeLeft = GAME_TIME;
    timerBoard.textContent = `Time: ${formatTime(timeLeft)}`;
    
    window.timerInterval = setInterval(() => {
        timeLeft--;
        timerBoard.textContent = `Time: ${formatTime(timeLeft)}`;
        
        if (timeLeft <= 0) {
            const scoreBoard = document.getElementById('scoreBoard');
            const currentScoreText = scoreBoard.textContent.split(': ')[1];
            const currentScore = parseInt(currentScoreText.split('/')[0]) || 0;
            
            if (currentScore >= window.targetScore) {
                endGame('Congratulations! You Win! 🎉', true);
            } else {
                endGame('Time\'s Up!', false);
            }
        }
    }, 1000);

    // Create hearts board
    const heartsBoard = document.createElement('div');
    heartsBoard.id = 'heartsBoard';
    heartsBoard.style.position = 'absolute';
    heartsBoard.style.top = '80px';
    heartsBoard.style.left = '20px';
    heartsBoard.style.color = 'black';
    heartsBoard.style.fontSize = '20px';
    heartsBoard.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
    heartsBoard.style.padding = '10px';
    heartsBoard.style.borderRadius = '5px';
    
    // Initial hearts display
    let heartsHTML = '<div style="font-weight: bold; margin-bottom: 5px;">Lives Remaining:</div>';
    firePlayerNames.forEach((name, index) => {
        const hearts = playerLives[index];
        heartsHTML += `<div>Player ${name}: ${'❤️'.repeat(hearts)}</div>`;
    });
    heartsBoard.innerHTML = heartsHTML;
    document.body.appendChild(heartsBoard);

    // Start animation
    animate();
}

// Add this event listener at the bottom of your file
document.addEventListener('DOMContentLoaded', function() {
    // Move the start button click handler here
    document.getElementById('startButton').onclick = function() {
        const username = document.getElementById('username').value.trim();
        const difficulty = document.getElementById('difficulty').value;

        if (username.length === 0 || username.length > 5) {
            alert('Please enter a username between 1-5 letters!');
            return;
        }

        // Store username globally
        window.icePlayerName = username.toUpperCase();

        // Set game configuration based on difficulty (only speed and target score)
        switch(difficulty) {
            case 'easy':
                window.targetScore = 7;
                window.firePlayerSpeed = 2;
                break;
            case 'medium':
                window.targetScore = 12;
                window.firePlayerSpeed = 3;
                break;
            case 'hard':
                window.targetScore = 15;
                window.firePlayerSpeed = 4;
                break;
        }

        // Remove the lines that override numFirePlayers and playerLives
        window.gameActive = true;
        document.getElementById('startMenu').remove();
        
        initScene();
        initializeGame();
        animate();
    };
});

// Add this function before initScene
function createFirePlayers() {
    const firePlayerMaterial = new THREE.MeshStandardMaterial({ color: 0xff4500 });

    for(let i = 0; i < numFirePlayers; i++) {
        const firePlayer = new THREE.Mesh(
            new THREE.SphereGeometry(30, 32, 32),
            firePlayerMaterial.clone()
        );
        
        // Keep trying positions until we find one far enough from ice player
        let validPosition = false;
        while (!validPosition) {
            const x = Math.random() * (groundWidth - 400) - groundWidth / 2;
            const z = Math.random() * (groundHeight - 400) - groundHeight / 2;
            
            // Calculate distance from ice player
            const distanceToIce = Math.sqrt(x * x + z * z);
            if (distanceToIce > 500) {
                firePlayer.position.set(x, 30, z);
                validPosition = true;
            }
        }

        firePlayer.castShadow = true;

        const nameSprite = createNameSprite(firePlayerNames[i], playerLives[i]);
        nameSprite.position.y = 150;
        firePlayer.add(nameSprite);

        firePlayers.push({
            mesh: firePlayer,
            nameSprite: nameSprite,
            velocity: {
                x: Math.random() * 2 - 1,
                z: Math.random() * 2 - 1
            },
            state: AI_STATES.WANDERING,
            targetPlayer: null
        });

        firePlayerBoxes.push(new THREE.Box3());
        scene.add(firePlayer);
    }
}
