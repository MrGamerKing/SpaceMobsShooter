const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let score = 0;
let lives = 10;
const bullets = [];
const enemies = [];
const powerUps = [];
const enemyBullets = [];
let lastFireTime = 0;
let fireCooldown = 100; // Fire rate in milliseconds

// Ancient Zone Text Animation
let textOpacity = 0; // Initial opacity
let fadeDirection = 1; // 1 for fading in, -1 for fading out
const fadeSpeed = 0.02; // Speed of fade effect
const minOpacity = 0; // Minimum opacity
const maxOpacity = 1; // Maximum opacity

// Background variables
let backgroundY = 0;
const backgroundSpeed = 2; // Scrolling speed for background

// New power-up variables
let boosterActive = false;
let boosterEndTime = 0;
let scoreMultiplierActive = false;
let scoreMultiplierEndTime = 0;
let upgradeBullet1Spawned = false; // Track if upgrade bullet 1 is already spawned
let upgradeBullet2Spawned = false; // Track if upgrade bullet 2 is already spawned
let upgradeBullet3Spawned = false; // Track if upgrade bullet 3 is already spawned

// Movement patterns
const movementPatterns = ['straight', 'sinusoidal', 'zigzag'];

// Load images once
const backgroundImage = new Image();
backgroundImage.src = 'void.png';
const playerImage = new Image();
playerImage.src = 'player.png';

class Player {
    constructor() {
        this.width = 100;
        this.height = 80;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - this.height - 115;
        this.speed = 8;
        this.dx = 0;
        this.bulletImage = new Image();
        this.bulletImage.src = 'bullet.png'; // Default bullet image
    }

    draw() {
        ctx.drawImage(playerImage, this.x, this.y, this.width, this.height);
    }

    move() {
        this.x += this.dx;
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;
    }

    fire() {
        const currentTime = Date.now();
        if (currentTime - lastFireTime >= fireCooldown) {
            const bullet = new Bullet(this.x + this.width / 2 - 15, this.y, this.bulletImage);
            bullets.push(bullet);
            lastFireTime = currentTime;
        }
    }

    update() {
        this.draw();
        this.move();
    }
}

class Bullet {
    constructor(x, y, image) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.speed = 7;
        this.image = image;
    }

    draw() {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    }

    move() {
        this.y -= this.speed;
    }

    update() {
        this.draw();
        this.move();
    }
}

class Enemy {
    constructor(x, y, pattern = 'straight') {
        this.width = 50;
        this.height = 50;
        this.x = x;
        this.y = y;
        this.speed = 3;
        this.pattern = pattern;
        this.patternOffset = 0;
        const enemyImages = ['zombie.png', 'skeleton.png', 'creeper.png', 'evoker.png', 'vex.png'];
        const enemyImage = new Image();
        enemyImage.src = enemyImages[Math.floor(Math.random() * enemyImages.length)];
        this.image = enemyImage;
        if (this.image.src.endsWith('creeper.png')) {
            this.fireRate = 2000; // Firing rate for creeper bullets
            this.lastFireTime = Date.now();
        }
    }

    draw() {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    }

    move() {
        switch (this.pattern) {
            case 'straight':
                this.y += this.speed;
                break;
            case 'sinusoidal':
                this.y += this.speed;
                this.x += Math.sin(this.patternOffset) * 2;
                this.patternOffset += 0.1;
                break;
            case 'zigzag':
                this.y += this.speed;
                this.x += (this.patternOffset % 2 === 0 ? 2 : -2);
                if (this.y % 50 === 0) this.patternOffset++;
                break;
        }

        // Creeper specific bullet firing
        if (this.image.src.endsWith('creeper.png')) {
            const currentTime = Date.now();
            if (currentTime - this.lastFireTime >= this.fireRate) {
                const enemyBullet = new EnemyBullet(this.x + this.width / 2 - 15, this.y + this.height, 'tnt.png');
                enemyBullets.push(enemyBullet);
                this.lastFireTime = currentTime;
            }
        }
    }

    update() {
        this.draw();
        this.move();
    }
}

class Warden extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.image.src = 'warden.png'; // Set warden image
        this.fireRate = 2500; // Firing rate for warden bullets
        this.width = 165;
        this.height = 80;
        this.lastFireTime = Date.now();
    }

    move() {
        // Warden movement, similar to regular enemies
        this.y += this.speed;

        // Warden-specific bullet firing
        const currentTime = Date.now();
        if (currentTime - this.lastFireTime >= this.fireRate) {
            const wardenBullet = new EnemyBullet(this.x + this.width / 2 - 15, this.y + this.height, 'wardenbullet.png');
            enemyBullets.push(wardenBullet);
            this.lastFireTime = currentTime;
        }
    }
}

class PowerUp {
    constructor(type, x, y) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 40;
        this.speed = 3;
        this.image = new Image();
        this.image.src = type === 'BOOSTER' ? 'booster.gif' :
                         type === 'SCORE_MULTIPLIER' ? 'scoreinc.png' :
                         type === 'UPGRADE_BULLET1' ? 'newbullet.png' :
                         type === 'UPGRADE_BULLET2' ? 'newbullet.png' :
                         type === 'UPGRADE_BULLET3' ? 'newbullet.png' : 
                         type === 'UPGRADE_BULLET4' ? 'newbullet.png' : 
                         type === 'SCORE_MULTIPLIER2' ? 'scoreinc2.png' :
                         type === 'HEART' ? 'heart.png' :'';
    }

    draw() {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    }

    move() {
        this.y += this.speed;
    }

    update() {
        this.draw();
        this.move();
    }
}

class EnemyBullet {
    constructor(x, y, imageSrc) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
        this.speed = 5;
        this.image = new Image();
        this.image.src = imageSrc; // 'tnt.png' for creeper bullets
    }

    draw() {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    }

    move() {
        this.y += this.speed;
    }

    update() {
        this.draw();
        this.move();
    }
}

const player = new Player();

// Function to spawn enemies at random positions, including wardens
function spawnEnemy() {
    const x = Math.random() * (canvas.width - 50);
    const y = 0;

    if (score >= 5000 && score < 10000 && Math.random() < 0.3) {
        // Spawn a warden if the score is between 100 and 1000 (30% chance)
        enemies.push(new Warden(x, y, 'straight'));
    } else {
        // Otherwise, spawn a regular enemy
        const pattern = score >= 50 ? movementPatterns[Math.floor(Math.random() * movementPatterns.length)] : 'straight';
        enemies.push(new Enemy(x, y, pattern));
    }
}


// Function to spawn power-ups
function spawnPowerUp(type) {
    const x = Math.random() * (canvas.width - 30);
    const y = 0;
    powerUps.push(new PowerUp(type, x, y));
}

// Update the score in the DOM
function updateScore() {
    document.getElementById('score').textContent = `Score: ${score}`;
}

// Update the lives in the DOM
function updateLives() {
    document.getElementById('lives').textContent = `Lives: ${lives}`;
}

// Check if two objects collide
function checkCollision(obj1, obj2) {
    return (
        obj1.x < obj2.x + obj2.width &&
        obj1.x + obj1.width > obj2.x &&
        obj1.y < obj2.y + obj2.height &&
        obj1.y + obj2.height > obj2.y
    );
}

// Animate the game
function animate() {
    // Scroll background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(backgroundImage, 0, backgroundY, canvas.width, canvas.height);
    ctx.drawImage(backgroundImage, 0, backgroundY - canvas.height, canvas.width, canvas.height);
    backgroundY += backgroundSpeed;
    if (backgroundY >= canvas.height) backgroundY = 0;

    // Update player, bullets, enemies, power-ups, etc.
    player.update();

    bullets.forEach((bullet, bulletIndex) => {
        bullet.update();

        enemies.forEach((enemy, enemyIndex) => {
            if (
                bullet.x < enemy.x + enemy.width &&
                bullet.x + bullet.width > enemy.x &&
                bullet.y < enemy.y + enemy.height &&
                bullet.y + bullet.height > enemy.y
            ) {
                enemies.splice(enemyIndex, 1);
                bullets.splice(bulletIndex, 1);
                score += scoreMultiplierActive ? 20 : 10; // Adjust score increment based on multiplier
                updateScore();
            }
        });

        if (bullet.y + bullet.height < 0) {
            bullets.splice(bulletIndex, 1);
        }
    });

    enemies.forEach((enemy, index) => {
        enemy.update();

        if (checkCollision(player, enemy)) {
            alert('Crashed!!  (CTRL + R) --   Score= ' + score);
            location.reload(); // Restart the game
        }

        if (enemy.y > canvas.height) {
            enemies.splice(index, 1);
            lives--;
            updateLives();
            if (lives === 0) {
                alert('Out of Lives!!  (CTRL + R) ---   Score= ' + score);
                location.reload(); // Restart the game
            }
        }
    });

    // Handle enemy bullets
    enemyBullets.forEach((enemyBullet, index) => {
        enemyBullet.update();

        if (checkCollision(player, enemyBullet)) {
            alert('Kaboom!!   (CTRL + R) --   Score= ' + score);
            location.reload(); // Restart the game
        }

        if (enemyBullet.y > canvas.height) {
            enemyBullets.splice(index, 1);
        }
    });

    // Handle power-ups
    powerUps.forEach((powerUp, index) => {
        powerUp.update();

        if (checkCollision(player, powerUp)) {
            if (powerUp.type === 'BOOSTER') {
                boosterActive = true;
                boosterEndTime = Date.now() + 5000; // Booster active for 5 seconds
                player.speed = 40;
                fireCooldown = 10; // Increase fire rate during boost
            } else if (powerUp.type === 'SCORE_MULTIPLIER') {
                score += 100; // Add 100 to score when collected
                updateScore();
            } else if (powerUp.type === 'UPGRADE_BULLET1') {
                upgradeBullet1Spawned = true;
                player.bulletImage.src = 'upcharge.png'; // Change bullet image to upgrade 1
            } else if (powerUp.type === 'UPGRADE_BULLET2') {
                upgradeBullet2Spawned = true;
                player.bulletImage.src = 'upcharge2.png'; // Change bullet image to upgrade 2
            } else if (powerUp.type === 'UPGRADE_BULLET3') {
                upgradeBullet3Spawned = true;
                player.bulletImage.src = 'upcharge3.png'; // Change bullet image to upgrade 3
            } else if (powerUp.type === 'UPGRADE_BULLET4') {
                upgradeBullet4Spawned = true;
                player.bulletImage.src = 'upcharge4.png'; // Change bullet image to upgrade 4
            } else if (powerUp.type === 'SCORE_MULTIPLIER2') {
                score += 250; // Add 100 to score when collected
                updateScore();
            } else if (powerUp.type === 'HEART') {
                lives += 1; // Add 1 live when collected
                updateLives();
            }
            
            
        
            powerUps.splice(index, 1);
        }

        if (powerUp.y > canvas.height) {
            powerUps.splice(index, 1);
        }
    });

    // Reset player speed and fire rate after booster expires
    if (boosterActive && Date.now() >= boosterEndTime) {
        boosterActive = false;
        player.speed = 8;
        fireCooldown = 100;
    }

    // Text When Warden starts Spawning
    if (score >= 5000 && score < 10000) {
        if (fadeDirection === 1) {
            textOpacity += fadeSpeed;
            if (textOpacity >= maxOpacity) {
                textOpacity = maxOpacity;
                fadeDirection = -1; // Start fading out
            }
        } else {
            textOpacity -= fadeSpeed;
            if (textOpacity <= minOpacity) {
                textOpacity = minOpacity;
                fadeDirection = 1; // Start fading in
            }
        }

        ctx.font = 'bold 28px Arial'; // Decrease font size
        ctx.fillStyle = `rgba(0, 255, 255, ${textOpacity})`; // Text color with opacity
        ctx.textAlign = 'center'; // Center the text
        ctx.textBaseline = 'top'; // Set baseline for text rendering
        ctx.shadowColor = 'black'; // Shadow color
        ctx.shadowBlur = 8; // Shadow blur
        ctx.fillText('Space Ancient Zone Alert!!', canvas.width / 2, 20); // Text position
    }

    // Handle New Stage

    if (score > 50) {        
                // Change enemies' skins
                enemies.forEach(enemy => {
                    if (enemy.image.src.endsWith('creeper.png')) {
                        enemy.image.src = 'creeper.png';
                    }
                    // Add more conditions if needed for other enemies
                });
            }

    requestAnimationFrame(animate);
}

// Event listeners for player movement
window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') player.dx = player.speed;
    if (e.key === 'ArrowLeft') player.dx = -player.speed;
    if (e.key === ' ') player.fire();
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') player.dx = 0;
});

// Spawn enemies at a regular interval
setInterval(spawnEnemy, 1000);

// Spawn a booster every 20 seconds
setInterval(() => spawnPowerUp('BOOSTER'), 20000);

// Spawn a score multiplier every 15 seconds
setInterval(() => spawnPowerUp('SCORE_MULTIPLIER'), 15000);

// Spawn upgrade bullet 1 when score reaches 500, but only once
function checkForUpgradeBullet1() {
    if (score >= 500 && !upgradeBullet1Spawned) {
        spawnPowerUp('UPGRADE_BULLET1');
        upgradeBullet1Spawned = true;
    }
}
setInterval(checkForUpgradeBullet1, 1000);

// Spawn upgrade bullet 2 when score reaches 1000, but only once
function checkForUpgradeBullet2() {
    if (score >= 1000 && !upgradeBullet2Spawned) {
        spawnPowerUp('UPGRADE_BULLET2');
        upgradeBullet2Spawned = true;
    }
}
setInterval(checkForUpgradeBullet2, 1000);

// Spawn upgrade bullet 3 when score reaches 1500, but only once
function checkForUpgradeBullet3() {
    if (score >= 1500 && !upgradeBullet3Spawned) {
        spawnPowerUp('UPGRADE_BULLET3');
        upgradeBullet3Spawned = true;
    }
}
setInterval(checkForUpgradeBullet3, 1000);

// Spawn upgrade bullet 4 when score reaches 2000, but only once
function checkForUpgradeBullet4() {
    if (score >= 2000 && !upgradeBullet4Spawned) {
        spawnPowerUp('UPGRADE_BULLET4');
        upgradeBullet4Spawned = true;
    }
}
setInterval(checkForUpgradeBullet4, 1000);

// Spawn a score multiplier 2 every 25 seconds
setInterval(() => spawnPowerUp('SCORE_MULTIPLIER2'), 25000);

// Spawn Heart when live is less than 6
setInterval(() => {
    if (lives < 5) {
        spawnPowerUp('HEART');
    }
}, 10000);


// Start the game loop
animate();