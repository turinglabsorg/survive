// Get actual viewport dimensions (accounting for mobile browser UI)
const getViewportSize = () => {
  return {
    width: Math.min(window.innerWidth, document.documentElement.clientWidth),
    height: Math.min(window.innerHeight, document.documentElement.clientHeight)
  };
};

const IsometricGame = () => {
  const canvasRef = React.useRef(null);
  const canvasContainerRef = React.useRef(null);
  const [ballPos, setBallPos] = React.useState({ x: 0, y: 0 });
  const [endPoint, setEndPoint] = React.useState({ x: 0, y: 0 });
  const [gameState, setGameState] = React.useState('playing');
  const [gameMap, setGameMap] = React.useState([]);
  const [score, setScore] = React.useState(0);
  const [maxSteps, setMaxSteps] = React.useState(0);
  const [enemies, setEnemies] = React.useState([]);
  const [bullets, setBullets] = React.useState([]);
  
// Calculate optimal grid size based on window dimensions
  const TILE_WIDTH = 20;
  const TILE_HEIGHT = 10;
  
  const viewport = getViewportSize();
  
  // Calculate maximum grid size that fits in viewport (much more conservative for mobile)
  // Add padding to ensure grid stays within bounds (20px on each side, 200px for UI at top/bottom)
  const padding = 40; // 20px on each side
  const uiSpace = 200; // Space for title and controls
  const availableWidth = viewport.width - padding;
  const availableHeight = viewport.height - uiSpace - padding;
  
  const maxGridX = Math.floor(availableWidth / (TILE_WIDTH * 0.7));
  const maxGridY = Math.floor(availableHeight / (TILE_HEIGHT * 1.8));
  const GRID_SIZE = Math.min(maxGridX, maxGridY, 20); // Even smaller cap for mobile safety
  
  const BALL_RADIUS = 6;
  
  // Generate random map with start and end points
  const generateRandomMap = () => {
    const map = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      const row = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        const rand = Math.random();
        if (rand < 0.05) {
          row.push(1); // Wall (5%)
        } else if (rand < 0.10) {
          row.push(2); // Hole (5%)
        } else {
          row.push(0); // Empty (85%)
        }
      }
      map.push(row);
    }
    
    // Generate random start and end points
    const startX = Math.floor(Math.random() * GRID_SIZE);
    const startY = Math.floor(Math.random() * GRID_SIZE);
    let endX, endY;
    
    // Ensure end point is far from start
    do {
      endX = Math.floor(Math.random() * GRID_SIZE);
      endY = Math.floor(Math.random() * GRID_SIZE);
    } while (Math.abs(endX - startX) < Math.floor(GRID_SIZE / 3) || 
             Math.abs(endY - startY) < Math.floor(GRID_SIZE / 3));
    
    // Calculate Manhattan distance for dynamic scoring
    const manhattanDistance = Math.abs(endX - startX) + Math.abs(endY - startY);
    const calculatedMaxSteps = Math.ceil(manhattanDistance * 1.5) + 10; // Buffer for detours
    
    // Clear start and end areas
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        // Clear start area
        const sx = startX + dx;
        const sy = startY + dy;
        if (sx >= 0 && sx < GRID_SIZE && sy >= 0 && sy < GRID_SIZE) {
          map[sy][sx] = 0;
        }
        
        // Clear end area
        const ex = endX + dx;
        const ey = endY + dy;
        if (ex >= 0 && ex < GRID_SIZE && ey >= 0 && ey < GRID_SIZE) {
          map[ey][ex] = 0;
        }
      }
    }
    
    // Generate enemies
    const enemyCount = Math.min(4, Math.floor(GRID_SIZE / 8)); // Fewer enemies for mobile
    const newEnemies = [];
    for (let i = 0; i < enemyCount; i++) {
      let ex, ey;
      do {
        ex = Math.floor(Math.random() * GRID_SIZE);
        ey = Math.floor(Math.random() * GRID_SIZE);
      } while (map[ey][ex] !== 0 || (Math.abs(ex - startX) < 3 && Math.abs(ey - startY) < 3));
      
      newEnemies.push({
        x: ex,
        y: ey,
        moveTimer: 0,
        shootTimer: Math.floor(Math.random() * 60) + 30
      });
    }
    
    // Set ball position, end point, score, and enemies
    setBallPos({ x: startX, y: startY });
    setEndPoint({ x: endX, y: endY });
    setScore(calculatedMaxSteps);
    setMaxSteps(calculatedMaxSteps);
    setEnemies(newEnemies);
    setBullets([]);
    
    return map;
  };
  
  React.useEffect(() => {
    setGameMap(generateRandomMap());
  }, []);
  
  const toIsometric = (x, y) => {
    const isoX = (x - y) * (TILE_WIDTH / 2);
    const isoY = (x + y) * (TILE_HEIGHT / 2);
    return { x: isoX, y: isoY };
  };
  
  const drawGrid = (ctx) => {
    // Set up clipping to ensure nothing draws outside canvas bounds
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.clip();
    
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 0.5;
    
// Center the grid perfectly in the viewport with padding
    const corners = [
      toIsometric(0, 0),
      toIsometric(GRID_SIZE - 1, 0),
      toIsometric(0, GRID_SIZE - 1),
      toIsometric(GRID_SIZE - 1, GRID_SIZE - 1)
    ];
    
    const minX = Math.min(...corners.map(c => c.x));
    const maxX = Math.max(...corners.map(c => c.x));
    const minY = Math.min(...corners.map(c => c.y));
    const maxY = Math.max(...corners.map(c => c.y));
    
    const gridWidth = maxX - minX;
    const gridHeight = maxY - minY;
    
    const viewport = getViewportSize();
    const padding = 20; // Padding on all sides
    const topSpace = 100; // Space for title
    
    // Calculate offset with padding, ensuring grid stays within bounds
    const maxOffsetX = viewport.width - gridWidth - padding;
    const maxOffsetY = viewport.height - gridHeight - padding;
    const offsetX = Math.max(padding, Math.min(maxOffsetX, (viewport.width - gridWidth) / 2)) - minX;
    const offsetY = Math.max(topSpace, Math.min(maxOffsetY, (viewport.height - gridHeight) / 2)) - minY;
    
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const iso = toIsometric(x, y);
        const centerX = offsetX + iso.x;
        const centerY = offsetY + iso.y;
        
        // Skip drawing if outside canvas bounds (with some margin for tile rendering)
        if (centerX < -TILE_WIDTH || centerX > ctx.canvas.width + TILE_WIDTH ||
            centerY < -TILE_HEIGHT || centerY > ctx.canvas.height + TILE_HEIGHT) {
          continue;
        }
        
        // Draw tile outline
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + TILE_WIDTH/2, centerY + TILE_HEIGHT/2);
        ctx.lineTo(centerX, centerY + TILE_HEIGHT);
        ctx.lineTo(centerX - TILE_WIDTH/2, centerY + TILE_HEIGHT/2);
        ctx.closePath();
        ctx.stroke();
        
        // Draw special tiles
        const tileType = gameMap[y]?.[x];
        if (tileType === 1) { // Wall
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(centerX - 2, centerY - 12, 4, 20);
        } else if (tileType === 2) { // Yellow tile (trap)
          // Draw isometric yellow tile with softer color
          ctx.fillStyle = '#ffffcc'; // Lighter, softer yellow
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(centerX + TILE_WIDTH/2, centerY + TILE_HEIGHT/2);
          ctx.lineTo(centerX, centerY + TILE_HEIGHT);
          ctx.lineTo(centerX - TILE_WIDTH/2, centerY + TILE_HEIGHT/2);
          ctx.closePath();
          ctx.fill();
          
          // Add subtle orange border
          ctx.strokeStyle = '#ffcc66'; // Lighter orange
          ctx.lineWidth = 0.5;
          ctx.stroke();
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 0.5;
        }
        
        // Draw enemies
        enemies.forEach(enemy => {
          if (enemy.x === x && enemy.y === y) {
            const enemyIso = toIsometric(enemy.x, enemy.y);
            const enemyCenterX = offsetX + enemyIso.x;
            const enemyCenterY = offsetY + enemyIso.y;
            
            // Skip if outside bounds
            if (enemyCenterX < -10 || enemyCenterX > ctx.canvas.width + 10 ||
                enemyCenterY < -10 || enemyCenterY > ctx.canvas.height + 10) {
              return;
            }
            
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(enemyCenterX - 4, enemyCenterY - 4, 8, 8);
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 1;
            ctx.strokeRect(enemyCenterX - 4, enemyCenterY - 4, 8, 8);
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 0.5;
          }
        });
        
        // Draw bullets
        bullets.forEach(bullet => {
          if (Math.floor(bullet.x) === x && Math.floor(bullet.y) === y) {
            const bulletIso = toIsometric(bullet.x, bullet.y);
            const bulletCenterX = offsetX + bulletIso.x;
            const bulletCenterY = offsetY + bulletIso.y;
            
            // Skip if outside bounds
            if (bulletCenterX < -10 || bulletCenterX > ctx.canvas.width + 10 ||
                bulletCenterY < -10 || bulletCenterY > ctx.canvas.height + 10) {
              return;
            }
            
            ctx.fillStyle = '#ff8800';
            ctx.beginPath();
            ctx.arc(bulletCenterX, bulletCenterY, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        });
        
        // Draw end point
        if (endPoint.x === x && endPoint.y === y) {
          const endIso = toIsometric(endPoint.x, endPoint.y);
          const endCenterX = offsetX + endIso.x;
          const endCenterY = offsetY + endIso.y;
          
          // Skip if outside bounds
          if (endCenterX < -20 || endCenterX > ctx.canvas.width + 20 ||
              endCenterY < -20 || endCenterY > ctx.canvas.height + 20) {
            // Don't skip end point, but ensure it's visible
          }
          
          ctx.fillStyle = '#ffff00';
          ctx.strokeStyle = '#ffff00';
          ctx.lineWidth = 2;
          // Draw star shape for end point
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
            const outerRadius = 12;
            const innerRadius = 6;
            const outerX = endCenterX + Math.cos(angle) * outerRadius;
            const outerY = endCenterY + Math.sin(angle) * outerRadius;
            const innerAngle = ((i + 0.5) * 2 * Math.PI) / 5 - Math.PI / 2;
            const innerX = endCenterX + Math.cos(innerAngle) * innerRadius;
            const innerY = endCenterY + Math.sin(innerAngle) * innerRadius;
            
            if (i === 0) {
              ctx.moveTo(outerX, outerY);
            } else {
              ctx.lineTo(outerX, outerY);
            }
            ctx.lineTo(innerX, innerY);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 0.5;
        }
      }
    }
    
    ctx.restore(); // Restore clipping
  };
  
const drawBall = (ctx, x, y) => {
    // Set up clipping to ensure nothing draws outside canvas bounds
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.clip();
    
    const iso = toIsometric(x, y);
    
    // Use the same offset calculation as drawGrid to ensure alignment
    const corners = [
      toIsometric(0, 0),
      toIsometric(GRID_SIZE - 1, 0),
      toIsometric(0, GRID_SIZE - 1),
      toIsometric(GRID_SIZE - 1, GRID_SIZE - 1)
    ];
    
    const minX = Math.min(...corners.map(c => c.x));
    const maxX = Math.max(...corners.map(c => c.x));
    const minY = Math.min(...corners.map(c => c.y));
    const maxY = Math.max(...corners.map(c => c.y));
    
    const gridWidth = maxX - minX;
    const gridHeight = maxY - minY;
    
    const viewport = getViewportSize();
    const padding = 20; // Padding on all sides
    const topSpace = 100; // Space for title
    
    // Calculate offset with padding, ensuring grid stays within bounds
    const maxOffsetX = viewport.width - gridWidth - padding;
    const maxOffsetY = viewport.height - gridHeight - padding;
    const offsetX = Math.max(padding, Math.min(maxOffsetX, (viewport.width - gridWidth) / 2)) - minX;
    const offsetY = Math.max(topSpace, Math.min(maxOffsetY, (viewport.height - gridHeight) / 2)) - minY;
    
    const centerX = offsetX + iso.x;
    const centerY = offsetY + iso.y + 8;
    
    // Skip drawing if ball is outside canvas bounds
    if (centerX < -BALL_RADIUS || centerX > ctx.canvas.width + BALL_RADIUS ||
        centerY < -BALL_RADIUS || centerY > ctx.canvas.height + BALL_RADIUS) {
      ctx.restore();
      return;
    }
    
    // Ball shadow
    ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + 10, BALL_RADIUS * 0.8, BALL_RADIUS * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Main ball
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(centerX, centerY, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    
    // Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.ellipse(centerX - 1, centerY - 1, BALL_RADIUS * 0.3, BALL_RADIUS * 0.2, -Math.PI/4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore(); // Restore clipping
  };
  
  const canMoveTo = (x, y) => {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return false;
    return gameMap[y]?.[x] !== 1;
  };
  
  const moveBall = (dx, dy) => {
    if (gameState !== 'playing') return;
    
    const newX = ballPos.x + dx;
    const newY = ballPos.y + dy;
    
    if (canMoveTo(newX, newY)) {
      setBallPos({ x: newX, y: newY });
      
      // Decrease score for each step
      setScore(prev => {
        const newScore = prev - 1;
        if (newScore <= 0) {
          setGameState('lost');
          return 0;
        }
        return newScore;
      });
      
      // Check for yellow trap tile
      if (gameMap[newY][newX] === 2) {
        setGameState('trapped');
      }
      
      // Check for end point (win condition)
      if (newX === endPoint.x && newY === endPoint.y) {
        setGameState('won');
      }
    }
  };
  
  React.useEffect(() => {
    const handleKeyPress = (e) => {
      switch(e.key) {
        case 'ArrowUp':
        case 'w':
          moveBall(0, -1);
          break;
        case 'ArrowDown':
        case 's':
          moveBall(0, 1);
          break;
        case 'ArrowLeft':
        case 'a':
          moveBall(-1, 0);
          break;
        case 'ArrowRight':
        case 'd':
          moveBall(1, 0);
          break;
case ' ':
        resetGame();
        break;
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [ballPos, gameState]);
  
  // Game loop for enemies and bullets
  React.useEffect(() => {
    if (gameState !== 'playing') return;
    
    const gameLoop = setInterval(() => {
      // Move enemies
      setEnemies(prev => {
        const newEnemies = prev.map(enemy => {
          const newEnemy = { ...enemy };
          newEnemy.moveTimer++;
          
          // Move enemy every 15 frames (faster)
          if (newEnemy.moveTimer >= 15) {
            newEnemy.moveTimer = 0;
            const directions = [
              { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
              { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
            ];
            const validMoves = directions.filter(dir => {
              const newX = newEnemy.x + dir.dx;
              const newY = newEnemy.y + dir.dy;
              return newX >= 0 && newX < GRID_SIZE && 
                     newY >= 0 && newY < GRID_SIZE && 
                     gameMap[newY][newX] !== 1;
            });
            
            if (validMoves.length > 0) {
              const move = validMoves[Math.floor(Math.random() * validMoves.length)];
              newEnemy.x += move.dx;
              newEnemy.y += move.dy;
              
              // Check if enemy stepped on yellow trap
              if (gameMap[newEnemy.y][newEnemy.x] === 2) {
                return null; // Enemy dies
              }
            }
          }
          
          // Enemy shoots
          newEnemy.shootTimer--;
          if (newEnemy.shootTimer <= 0) {
            newEnemy.shootTimer = Math.floor(Math.random() * 60) + 60; // Slower shooting
            
            // Calculate direction to ball
            const dx = ballPos.x - newEnemy.x;
            const dy = ballPos.y - newEnemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
if (distance > 0 && distance < 8) { // Reduced shooting range
            const bulletDx = (dx / distance) * 0.15; // Slower bullets
            const bulletDy = (dy / distance) * 0.15;
              
              setBullets(prev => [...prev, {
                x: newEnemy.x,
                y: newEnemy.y,
                dx: bulletDx,
                dy: bulletDy
              }]);
            }
          }
          
          return newEnemy;
        }).filter(enemy => enemy !== null); // Remove dead enemies
        
        // Spawn new enemy if one died
        if (newEnemies.length < prev.length) {
          let ex, ey;
          do {
            ex = Math.floor(Math.random() * GRID_SIZE);
            ey = Math.floor(Math.random() * GRID_SIZE);
          } while (gameMap[ey][ex] !== 0 || (Math.abs(ex - ballPos.x) < 3 && Math.abs(ey - ballPos.y) < 3));
          
          newEnemies.push({
            x: ex,
            y: ey,
            moveTimer: 0,
            shootTimer: Math.floor(Math.random() * 60) + 30
          });
        }
        
        return newEnemies;
      });
      
      // Move bullets
      setBullets(prev => {
        return prev.map(bullet => {
          const newBullet = {
            ...bullet,
            x: bullet.x + bullet.dx,
            y: bullet.y + bullet.dy
          };
          
          // Check if bullet hit ball
          const distance = Math.sqrt(
            Math.pow(newBullet.x - ballPos.x, 2) + 
            Math.pow(newBullet.y - ballPos.y, 2)
          );
          
          if (distance < 0.5) {
            setGameState('shot');
            return null;
          }
          
          // Remove bullet if out of bounds
          if (newBullet.x < 0 || newBullet.x >= GRID_SIZE || 
              newBullet.y < 0 || newBullet.y >= GRID_SIZE) {
            return null;
          }
          
          return newBullet;
        }).filter(bullet => bullet !== null);
      });
    }, 25); // Run game loop every 25ms (faster gameplay)
    
    return () => clearInterval(gameLoop);
  }, [gameState, ballPos, gameMap, GRID_SIZE]);

  React.useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const viewport = getViewportSize();
      // Ensure canvas doesn't exceed viewport
      canvas.width = Math.min(viewport.width, window.innerWidth);
      canvas.height = Math.min(viewport.height, window.innerHeight);
      
      const ctx = canvas.getContext('2d');
      // Clear canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Only draw if we have a valid game map
      if (gameMap.length > 0) {
        drawGrid(ctx);
        drawBall(ctx, ballPos.x, ballPos.y);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    // Handle mobile viewport changes
    const handleViewportChange = () => {
      setTimeout(handleResize, 100); // Delay to account for browser UI animations
    };
    window.addEventListener('resize', handleViewportChange);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [ballPos, gameMap, GRID_SIZE, endPoint, enemies, bullets]);
  
  const resetGame = () => {
    setGameState('playing');
    setGameMap(generateRandomMap());
  };
  
return React.createElement(
    'div',
    { 
      ref: canvasContainerRef,
      style: { 
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%', 
        height: '100%',
        height: '-webkit-fill-available', // iOS Safari
        overflow: 'hidden',
        touchAction: 'none'
      } 
    },
      React.createElement(
      'canvas',
      {
        ref: canvasRef,
        style: {
          backgroundColor: '#000000',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          maxWidth: '100vw',
          maxHeight: '100vh',
          display: 'block',
          touchAction: 'none',
          overflow: 'hidden'
        }
      }
    ),
    // Mobile controls
    React.createElement(
      'div',
      {
        style: {
          position: 'fixed',
          bottom: getViewportSize().width < 768 ? '40px' : '20px', // Leave space for score at bottom on mobile
          left: '50%',
          transform: 'translateX(-50%)',
          display: getViewportSize().width < 768 ? 'grid' : 'none', // Only show on mobile
          gridTemplateColumns: 'repeat(3, 60px)',
          gridTemplateRows: 'repeat(3, 60px)',
          gap: '10px',
          zIndex: 20
        }
      },
      // Up button
      React.createElement(
        'button',
        {
          onClick: () => moveBall(0, -1),
          style: {
            gridArea: '1 / 2',
            backgroundColor: '#000000',
            border: '2px solid #00ff00',
            color: '#00ff00',
            fontSize: '1.5rem',
            fontFamily: '"Courier New", monospace',
            cursor: 'pointer',
            borderRadius: '5px'
          }
        },
        '↑'
      ),
      // Left button
      React.createElement(
        'button',
        {
          onClick: () => moveBall(-1, 0),
          style: {
            gridArea: '2 / 1',
            backgroundColor: '#000000',
            border: '2px solid #00ff00',
            color: '#00ff00',
            fontSize: '1.5rem',
            fontFamily: '"Courier New", monospace',
            cursor: 'pointer',
            borderRadius: '5px'
          }
        },
        '←'
      ),
      // Down button
      React.createElement(
        'button',
        {
          onClick: () => moveBall(0, 1),
          style: {
            gridArea: '2 / 2',
            backgroundColor: '#000000',
            border: '2px solid #00ff00',
            color: '#00ff00',
            fontSize: '1.5rem',
            fontFamily: '"Courier New", monospace',
            cursor: 'pointer',
            borderRadius: '5px'
          }
        },
        '↓'
      ),
      // Right button
      React.createElement(
        'button',
        {
          onClick: () => moveBall(1, 0),
          style: {
            gridArea: '2 / 3',
            backgroundColor: '#000000',
            border: '2px solid #00ff00',
            color: '#00ff00',
            fontSize: '1.5rem',
            fontFamily: '"Courier New", monospace',
            cursor: 'pointer',
            borderRadius: '5px'
          }
        },
        '→'
      )
    ),
    // Score display during gameplay - at the very bottom
    gameState === 'playing' && React.createElement(
      'div',
      {
        style: {
          position: 'fixed',
          bottom: '5px', // Very bottom of screen
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#00ff00',
          fontFamily: '"Courier New", monospace',
          fontSize: getViewportSize().width < 768 ? '0.85rem' : '1rem',
          fontWeight: 'bold',
          textShadow: '0 0 10px #00ff00',
          zIndex: 15,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '6px 12px',
          borderRadius: '5px',
          border: '1px solid #00ff00'
        }
      },
      `Score: ${score}/${maxSteps}`
    ),
    
    // Game modal overlay
    (gameState !== 'playing') && React.createElement(
      'div',
      {
        style: {
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 255, 0, 0.9)',
          zIndex: 100,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }
      },
React.createElement(
        'div',
        {
          style: {
            backgroundColor: getViewportSize().width < 768 ? 'rgba(0, 0, 0, 0.1)' : '#00ff00',
            color: '#000000',
            padding: '0',
            margin: '0',
            textAlign: 'center',
            fontFamily: '"Courier New", monospace',
            fontSize: getViewportSize().width < 768 ? '2rem' : '3rem',
            fontWeight: 'bold',
            height: '100vh',
            width: '100vw',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'absolute',
            top: '0',
            left: '0',
            zIndex: 100
          }
},
        // Game state title only on desktop
        (getViewportSize().width < 768) && React.createElement(
          'div',
          {
            style: {
              fontSize: '3rem',
              marginTop: '60px',
              color: '#000000',
              textShadow: '0 0 10px rgba(0, 255, 0, 0.5)'
            }
          },
          `${gameState === 'trapped' 
            ? 'TRAPPED!' 
            : gameState === 'won'
            ? 'YOU WON!'
            : gameState === 'lost'
            ? 'OUT OF STEPS!'
            : gameState === 'shot'
            ? 'SHOT!'
            : 'GAME OVER'}`
        ),
React.createElement(
          'div',
          {
            style: {
              fontSize: getViewportSize().width < 768 ? '1rem' : '1.2rem',
              marginTop: getViewportSize().width < 768 ? '20vh' : '30px',
              cursor: 'pointer',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: '#00ff00',
              padding: '15px 25px',
              borderRadius: '5px',
              border: '2px solid #00ff00'
            },
            onClick: resetGame
          },
          `Final Score: ${score}/${maxSteps}`
        ),
        React.createElement(
          'div',
          {
            style: {
              fontSize: getViewportSize().width < 768 ? '0.9rem' : '1rem',
              marginTop: getViewportSize().width < 768 ? '10vh' : '20px',
              cursor: 'pointer',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: '#00ff00',
              padding: '10px 20px',
              borderRadius: '5px',
              border: '1px solid #00ff00'
            },
            onClick: resetGame
          },
          'Press SPACE or Click to Play Again'
        )
      )
    ),

    
  );
};

const App = () => {
  return React.createElement(
    'div',
    { 
      style: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        height: '-webkit-fill-available', // iOS Safari
        backgroundColor: '#000000',
        overflow: 'hidden',
        touchAction: 'none'
      }
    },
React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          top: getViewportSize().width < 768 ? '20px' : '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#00ff00',
          fontFamily: '"Courier New", monospace',
          fontSize: getViewportSize().width < 768 ? '1.1rem' : '1.5rem', // Smaller on mobile
          fontWeight: 'bold',
          textShadow: '0 0 10px #00ff00',
          zIndex: 10,
          whiteSpace: 'nowrap'
        }
      },
      'survive:'
    ),
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          top: getViewportSize().width < 768 ? '50px' : '70px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#00ff00',
          fontFamily: '"Courier New", monospace',
          fontSize: getViewportSize().width < 768 ? '0.7rem' : '0.8rem',
          textAlign: 'center',
          zIndex: 10,
          padding: getViewportSize().width < 768 ? '0 10px' : '0',
          maxWidth: '90%',
          lineHeight: '1.2'
        }
      },
      getViewportSize().width < 768 
        ? 'Reach YELLOW star! Avoid RED enemies!' 
        : 'Navigate to the YELLOW star! Avoid RED enemies! Use WASD or Arrow Keys'
    ),

    React.createElement(IsometricGame),
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));