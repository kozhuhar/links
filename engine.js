var fps = function() {
    var fpstime = 0;
    var framecount = 0;

    return {
        value: 0,
        tick: function(dt) {
            if (fpstime > 0.25) {
                // Calculate fps
                this.value = Math.round(framecount / fpstime);
                // Reset time and framecount
                fpstime = 0;
                framecount = 0;
            }
            
            // Increase time and framecount
            fpstime += dt;
            framecount++;
        }
    };
}();

var looper = function() {
    var _tick = null;

    function _loop(dt) {
        window.requestAnimationFrame(_loop);
        if (_tick != null) {
            _tick(dt);
        }
    }

    return {
        start: function(tick) {
            if (typeof tick === "function") {
                _tick = tick;
            }
            _loop(0);
        }

    };
}()

var newTile = function(column, row) {
    return {column: column, row: row};
}

const loadImg = function(name) {
    const gem1 = new Image();
    gem1.src = name;
    return gem1;
}

// The function gets called when the window is fully loaded
window.onload = function() {
    // Get the canvas and context
    var canvas = document.getElementById("viewport");
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    var context = canvas.getContext("2d");

    
    
    // Timing and frames per second
    var lastframe = 0;
    
    // Mouse dragging
    var drag = false;
    
    // Level object
    var level = {
        header: 66,     // size of the header
        columns: 8,     // Number of tile columns
        rows: 8,        // Number of tile rows
        gap: 4,         // space between tiles
        tiles: [],      // The two-dimensional tile array
        activeTile: null
    };

    const side = Math.floor(Math.min(canvas.width, canvas.height - level.header) * 0.9);
    level.tilewidth = Math.floor(side/level.columns);
    level.x = Math.floor((canvas.width - level.tilewidth * level.columns)/2.0);

    level.tileheight = Math.floor(side/level.rows);
    level.y = Math.floor(level.header + (canvas.height - level.header - level.tileheight * level.rows)/2.0);
    
    // All of the different tile colors in RGB
    var tilecolors = [
        loadImg("01.png"),
        loadImg("02.png"),
        loadImg("03.png"),
        loadImg("04.png"),
        loadImg("05.png"),
        loadImg("06.png"),
        loadImg("07.png")
    ];
    
    // Clusters and moves that were found
    var clusters = [];  // { column, row, length, horizontal }
    var moves = [];     // { column1, row1, column2, row2 }

    // Current move
    var currentmove = { column1: 0, row1: 0, column2: 0, row2: 0 };
    
    // Game states
    var gamestates = { init: 0, ready: 1, resolve: 2, gameover: 3 };
    var gamestate = gamestates.init;
    
    // Score
    var score = 0;
    
    // Animation variables
    var animationstate = 0;
    var animationtime = 0;
    var animationtimetotal = 0.3;
    
    // Show available moves
    var showmoves = false;
        
    // Add mouse events
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseout", onMouseOut);
    
    // Initialize the two-dimensional tile array
    for (var i=0; i<level.columns; i++) {
        level.tiles[i] = [];
        for (var j=0; j<level.rows; j++) {
            // Define a tile type and a shift parameter for animation
            level.tiles[i][j] = { type: 0, shift:0 }
        }
    }
        
    // Update the game state
    function update(tframe) {
        var dt = (tframe - lastframe) / 1000;
        lastframe = tframe;
        
        fps.tick(dt);
        
        if (gamestate == gamestates.ready) {
            // Game is ready for player input. Do nothing.
            
            // Check for game over
            if (moves.length <= 0) {
                gamestate == gamestates.gameover
            }
        } else if (gamestate == gamestates.resolve) {
            // Game is busy resolving and animating clusters
            animationtime += dt;
            
            if (animationstate == 0) {
                // Clusters need to be found and removed
                if (animationtime > animationtimetotal) {
                    // Find clusters
                    findClusters();
                    
                    if (clusters.length > 0) {
                        // Add points to the score
                        for (var i=0; i<clusters.length; i++) {
                            // Add extra points for longer clusters
                            score += 100 * (clusters[i].length - 2);;
                        }
                    
                        // Clusters found, remove them
                        removeClusters();
                        
                        // Tiles need to be shifted
                        animationstate = 1;
                    } else {
                        // No clusters found, animation complete
                        gamestate = gamestates.ready;
                    }
                    animationtime = 0;
                }
            } else if (animationstate == 1) {
                // Tiles need to be shifted
                if (animationtime > animationtimetotal) {
                    // Shift tiles
                    shiftTiles();
                    
                    // New clusters need to be found
                    animationstate = 0;
                    animationtime = 0;
                    
                    // Check if there are new clusters
                    findClusters();
                    if (clusters.length <= 0) {
                        // Animation complete
                        gamestate = gamestates.ready;
                    }
                }
            } else if (animationstate == 2) {
                // Swapping tiles animation
                if (animationtime > animationtimetotal) {
                    // Swap the tiles
                    swap(currentmove.column1, currentmove.row1, currentmove.column2, currentmove.row2);
                    
                    // Check if the swap made a cluster
                    findClusters();
                    if (clusters.length > 0) {
                        // Valid swap, found one or more clusters
                        // Prepare animation states
                        animationstate = 0;
                        animationtime = 0;
                        gamestate = gamestates.resolve;
                    } else {
                        // Invalid swap, Rewind swapping animation
                        animationstate = 3;
                        animationtime = 0;
                    }
                    
                    // Update moves and clusters
                    findMoves();
                    findClusters();
                }
            } else if (animationstate == 3) {
                // Rewind swapping animation
                if (animationtime > animationtimetotal) {
                    // Invalid swap, swap back
                    swap(currentmove.column1, currentmove.row1, currentmove.column2, currentmove.row2);
                    
                    // Animation complete
                    gamestate = gamestates.ready;
                }
            }
            
            // Update moves and clusters
            findMoves();
            findClusters();
        }
    }
    
    // Draw text that is centered
    function drawCenterText(text, x, y, width) {
        var metrics = context.measureText(text);
        let actualHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
        context.fillText(text, x - metrics.width/2, y + actualHeight/2.0);
    }
    
    // Render the game
    function render() {
        // Draw the frame
        // Draw background and a border
        context.fillStyle = "#d0d0d0";
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw header
        context.fillStyle = "#303030";
        context.fillRect(0, 0, canvas.width, level.header);
            
        // Display fps
        context.fillStyle = "#ffffff";
        context.font = "12px Verdana";
        context.fillText("Fps: " + fps.value, 13, 50);
        
        // Draw score
        context.fillStyle = "#FFFFFF";
        context.font = "24px Verdana";
        drawCenterText("Score: "+score, canvas.width/2.0, 33, 150);
        
        // Draw level background
        var levelwidth = level.columns * level.tilewidth;
        var levelheight = level.rows * level.tileheight;
        context.fillStyle = "#000000";
        context.fillRect(level.x - 4, level.y - 4, levelwidth + 8, levelheight + 8);
        
        // Render tiles
        renderTiles();
        
        // Render clusters
        renderClusters();
        
        // Render moves, when there are no clusters
        if (showmoves && clusters.length <= 0 && gamestate == gamestates.ready) {
            renderMoves();
        }
        
        // Game Over overlay
        if (gamestate == gamestates.gameover) {
            context.fillStyle = "rgba(0, 0, 0, 0.8)";
            context.fillRect(level.x, level.y, levelwidth, levelheight);
            
            context.fillStyle = "#ffffff";
            context.font = "24px Verdana";
            drawCenterText("Game Over!", level.x + levelwidth/2.0, level.y + levelheight / 2, levelwidth);
        }
    }
    
    // Render tiles
    function renderTiles() {
        for (var i=0; i<level.columns; i++) {
            for (var j=0; j<level.rows; j++) {
                // Get the shift of the tile for animation
                var shift = level.tiles[i][j].shift;
                if (gamestate == gamestates.resolve && (animationstate == 2 || animationstate == 3) && (currentmove.column1 == i && currentmove.row1 == j || currentmove.column2 == i && currentmove.row2 == j)) {
                    // skip animated tiles
                } else {
                    // Calculate the tile coordinates
                    var coord = getTileCoordinate(i, j, 0, (animationtime / animationtimetotal) * shift);                
                    drawTile(coord.tilex, coord.tiley, level.tiles[i][j].type, level.activeTile != null && level.activeTile.column == i && level.activeTile.row == j ? true : false);
                }
            }
        }
        



        // Render the swap animation
        if (gamestate == gamestates.resolve && (animationstate == 2 || animationstate == 3)) {
            // Calculate the x and y shift
            var shiftx = currentmove.column2 - currentmove.column1;
            var shifty = currentmove.row2 - currentmove.row1;

            // First tile
            var coord1shift = getTileCoordinate(currentmove.column1, currentmove.row1, (animationtime / animationtimetotal) * shiftx, (animationtime / animationtimetotal) * shifty);
            var col1 = level.tiles[currentmove.column1][currentmove.row1].type;
            
            // Second tile
            var coord2shift = getTileCoordinate(currentmove.column2, currentmove.row2, (animationtime / animationtimetotal) * -shiftx, (animationtime / animationtimetotal) * -shifty);
            var col2 = level.tiles[currentmove.column2][currentmove.row2].type;
            
            
            // Change the order, depending on the animation state
            if (animationstate == 2) {
                drawTile(coord1shift.tilex, coord1shift.tiley, col1);
                drawTile(coord2shift.tilex, coord2shift.tiley, col2);
            } else {
                drawTile(coord2shift.tilex, coord2shift.tiley, col2);
                drawTile(coord1shift.tilex, coord1shift.tiley, col1);
            }
        }
    }
    
    // Get the tile coordinate
    function getTileCoordinate(column, row, columnoffset, rowoffset) {
        var tilex = level.x + (column + columnoffset) * level.tilewidth;
        var tiley = level.y + (row + rowoffset) * level.tileheight;
        return { tilex: tilex, tiley: tiley};
    }
    
    // Draw a tile with a color
    function drawTile(x, y, index, active) {
        var gap = level.gap;
        if (active == true) {
            gap = Math.min(level.tilewidth, level.tileheight)/4;
        }

        if (index == -2) {
            context.fillStyle = "rgb(0, 0, 0)";
            context.fillRect(x + gap/2, y + gap/2, level.tilewidth - gap, level.tileheight - gap);
            // context.clearRect(x + gap/2, y + gap/2, level.tilewidth - gap, level.tileheight - gap);
        } else if (index >= 0 && index < tilecolors.length) {
            context.drawImage(tilecolors[index], x + gap/2, y + gap/2, level.tilewidth - gap, level.tileheight - gap);
        }
    }
    
    // Render clusters
    function renderClusters() {
        for (var i=0; i<clusters.length; i++) {
            // Calculate the tile coordinates
            var coord = getTileCoordinate(clusters[i].column, clusters[i].row, 0, 0);
            
            if (clusters[i].horizontal) {
                // Draw a horizontal line
                context.fillStyle = "#00ff00";
                context.fillRect(coord.tilex + level.tilewidth/2, coord.tiley + level.tileheight/2 - 4, (clusters[i].length - 1) * level.tilewidth, 8);
            } else {
                // Draw a vertical line
                context.fillStyle = "#0000ff";
                context.fillRect(coord.tilex + level.tilewidth/2 - 4, coord.tiley + level.tileheight/2, 8, (clusters[i].length - 1) * level.tileheight);
            }
        }
    }
    
    // Render moves
    function renderMoves() {
        for (var i=0; i<moves.length; i++) {
            // Calculate coordinates of tile 1 and 2
            var coord1 = getTileCoordinate(moves[i].column1, moves[i].row1, 0, 0);
            var coord2 = getTileCoordinate(moves[i].column2, moves[i].row2, 0, 0);
            
            // Draw a line from tile 1 to tile 2
            context.strokeStyle = "#ff0000";
            context.beginPath();
            context.moveTo(coord1.tilex + level.tilewidth/2, coord1.tiley + level.tileheight/2);
            context.lineTo(coord2.tilex + level.tilewidth/2, coord2.tiley + level.tileheight/2);
            context.stroke();
        }
    }
    
    // Start a new game
    function newGame() {
        // Reset score
        score = 0;
        
        // Set the gamestate to ready
        gamestate = gamestates.ready;
        
        // Create the level
        createLevel();
        
        // Find initial clusters and moves
        findMoves();
        findClusters(); 
    }
    
    // Create a random level
    function createLevel() {
        var done = false;
        
        // Keep generating levels until it is correct
        while (!done) {
        
            // Create a level with random tiles
            for (var i=0; i<level.columns; i++) {
                for (var j=0; j<level.rows; j++) {
                    level.tiles[i][j].type = getRandomTile();
                }
            }
            
            // Resolve the clusters
            resolveClusters();
            
            // Check if there are valid moves
            findMoves();
            
            // Done when there is a valid move
            if (moves.length > 0) {
                done = true;
            }
        }
    }
    
    // Get a random tile
    function getRandomTile() {
        return Math.floor(Math.random() * tilecolors.length);
    }
    
    // Remove clusters and insert tiles
    function resolveClusters() {
        // Check for clusters
        findClusters();
        
        // While there are clusters left
        while (clusters.length > 0) {
        
            // Remove clusters
            removeClusters();
            
            // Shift tiles
            shiftTiles();
            
            // Check if there are clusters left
            findClusters();
        }
    }
    
    // Find clusters in the level
    function findClusters() {
        // Reset clusters
        clusters = []
        
        // Find horizontal clusters
        for (var j=0; j<level.rows; j++) {
            // Start with a single tile, cluster of 1
            var matchlength = 1;
            for (var i=0; i<level.columns; i++) {
                var checkcluster = false;
                
                if (i == level.columns-1) {
                    // Last tile
                    checkcluster = true;
                } else {
                    // Check the type of the next tile
                    if (level.tiles[i][j].type == level.tiles[i+1][j].type &&
                        level.tiles[i][j].type != -1) {
                        // Same type as the previous tile, increase matchlength
                        matchlength += 1;
                    } else {
                        // Different type
                        checkcluster = true;
                    }
                }
                
                // Check if there was a cluster
                if (checkcluster) {
                    if (matchlength >= 3) {
                        // Found a horizontal cluster
                        clusters.push({ column: i+1-matchlength, row:j,
                                        length: matchlength, horizontal: true });
                    }
                    
                    matchlength = 1;
                }
            }
        }

        // Find vertical clusters
        for (var i=0; i<level.columns; i++) {
            // Start with a single tile, cluster of 1
            var matchlength = 1;
            for (var j=0; j<level.rows; j++) {
                var checkcluster = false;
                
                if (j == level.rows-1) {
                    // Last tile
                    checkcluster = true;
                } else {
                    // Check the type of the next tile
                    if (level.tiles[i][j].type == level.tiles[i][j+1].type &&
                        level.tiles[i][j].type != -1) {
                        // Same type as the previous tile, increase matchlength
                        matchlength += 1;
                    } else {
                        // Different type
                        checkcluster = true;
                    }
                }
                
                // Check if there was a cluster
                if (checkcluster) {
                    if (matchlength >= 3) {
                        // Found a vertical cluster
                        clusters.push({ column: i, row:j+1-matchlength,
                                        length: matchlength, horizontal: false });
                    }
                    
                    matchlength = 1;
                }
            }
        }
    }
    
    // Find available moves
    function findMoves() {
        // Reset moves
        moves = []
        
        // Check horizontal swaps
        for (var j=0; j<level.rows; j++) {
            for (var i=0; i<level.columns-1; i++) {
                // Swap, find clusters and swap back
                swap(i, j, i+1, j);
                findClusters();
                swap(i, j, i+1, j);
                
                // Check if the swap made a cluster
                if (clusters.length > 0) {
                    // Found a move
                    moves.push({column1: i, row1: j, column2: i+1, row2: j});
                }
            }
        }
        
        // Check vertical swaps
        for (var i=0; i<level.columns; i++) {
            for (var j=0; j<level.rows-1; j++) {
                // Swap, find clusters and swap back
                swap(i, j, i, j+1);
                findClusters();
                swap(i, j, i, j+1);
                
                // Check if the swap made a cluster
                if (clusters.length > 0) {
                    // Found a move
                    moves.push({column1: i, row1: j, column2: i, row2: j+1});
                }
            }
        }
        
        // Reset clusters
        clusters = []
    }
    
    // Loop over the cluster tiles and execute a function
    function loopClusters(func) {
        for (var i=0; i<clusters.length; i++) {
            //  { column, row, length, horizontal }
            var cluster = clusters[i];
            var coffset = 0;
            var roffset = 0;
            for (var j=0; j<cluster.length; j++) {
                func(i, cluster.column+coffset, cluster.row+roffset, cluster);
                
                if (cluster.horizontal) {
                    coffset++;
                } else {
                    roffset++;
                }
            }
        }
    }
    
    // Remove the clusters
    function removeClusters() {
        // Change the type of the tiles to -1, indicating a removed tile
        loopClusters(function(index, column, row, cluster) { level.tiles[column][row].type = -1; });

        // Calculate how much a tile should be shifted downwards
        for (var i=0; i<level.columns; i++) {
            var shift = 0;
            for (var j=level.rows-1; j>=0; j--) {
                // Loop from bottom to top
                if (level.tiles[i][j].type == -1) {
                    // Tile is removed, increase shift
                    shift++;
                    level.tiles[i][j].shift = 0;
                } else {
                    // Set the shift
                    level.tiles[i][j].shift = shift;
                }
            }
        }
    }
    
    // Shift tiles and insert new tiles
    function shiftTiles() {
        // Shift tiles
        for (var i=0; i<level.columns; i++) {
            for (var j=level.rows-1; j>=0; j--) {
                // Loop from bottom to top
                if (level.tiles[i][j].type == -1) {
                    // Insert new random tile
                    level.tiles[i][j].type = getRandomTile();
                } else {
                    // Swap tile to shift it
                    var shift = level.tiles[i][j].shift;
                    if (shift > 0) {
                        swap(i, j, i, j+shift)
                    }
                }
                
                // Reset shift
                level.tiles[i][j].shift = 0;
            }
        }
    }
    
    // Get the tile under the mouse
    function getMouseTile(pos) {
        var tx = Math.floor((pos.x - level.x) / level.tilewidth);
        var ty = Math.floor((pos.y - level.y) / level.tileheight);
        if (tx >= 0 && tx < level.columns && ty >= 0 && ty < level.rows) {
            return {
                valid: true,
                x: tx,
                y: ty
            };
        }
        return null;
    }
    
    // Check if two tiles can be swapped
    function canSwap(x1, y1, x2, y2) {
        // Check if the tile is a direct neighbor of the selected tile
        if ((Math.abs(x1 - x2) == 1 && y1 == y2) ||
            (Math.abs(y1 - y2) == 1 && x1 == x2)) {
            return true;
        }
        
        return false;
    }
    
    // Swap two tiles in the level
    function swap(x1, y1, x2, y2) {
        var typeswap = level.tiles[x1][y1].type;
        level.tiles[x1][y1].type = level.tiles[x2][y2].type;
        level.tiles[x2][y2].type = typeswap;
    }
    
    // Swap two tiles as a player action
    function mouseSwap(c1, r1, c2, r2) {
        // Save the current move
        currentmove = {column1: c1, row1: r1, column2: c2, row2: r2};
    
        // Deselect
        level.activeTile = null;
        
        // Start animation
        animationstate = 2;
        animationtime = 0;
        gamestate = gamestates.resolve;
    }
    
    // On mouse movement
    function onMouseMove(e) {
        // Get the mouse position
        var pos = getMousePos(canvas, e);
        
        // Check if we are dragging with a tile selected
        if (drag && level.activeTile != null) {
            // Get the tile under the mouse
            mt = getMouseTile(pos);
            if (mt != null) {
                // Valid tile
                
                // Check if the tiles can be swapped
                if (canSwap(mt.x, mt.y, level.activeTile.column, level.activeTile.row)){
                    // Swap the tiles
                    mouseSwap(mt.x, mt.y, level.activeTile.column, level.activeTile.row);
                }
            }
        }
    }
    
    // On mouse button click
    function onMouseDown(e) {
        // Get the mouse position
        var pos = getMousePos(canvas, e);
        
        // Start dragging
        if (!drag) {
            mt = getMouseTile(pos);
            
            if (mt != null) {
                // Valid tile
                var swapped = false;
                if (level.activeTile != null) {
                    if (mt.x == level.activeTile.column && mt.y == level.activeTile.row) {
                        // Same tile selected, deselect
                        level.activeTile = null;
                        drag = true;
                        return;
                    } else if (canSwap(mt.x, mt.y, level.activeTile.column, level.activeTile.row)){
                        // Tiles can be swapped, swap the tiles
                        mouseSwap(mt.x, mt.y, level.activeTile.column, level.activeTile.row);
                        swapped = true;
                    }
                }
                
                if (!swapped) {
                    // Set the new selected tile
                    level.activeTile = newTile(mt.x, mt.y);
                }
            } else {
                // Invalid tile
                level.activeTile = null;
            }

            // Start dragging
            drag = true;
        }
    }
    
    function onMouseUp(e) {
        // Reset dragging
        drag = false;
    }
    
    function onMouseOut(e) {
        // Reset dragging
        drag = false;
    }
    
    // Get the mouse position
    function getMousePos(canvas, e) {
        var rect = canvas.getBoundingClientRect();
        return {
            x: Math.round((e.clientX - rect.left)/(rect.right - rect.left)*canvas.width),
            y: Math.round((e.clientY - rect.top)/(rect.bottom - rect.top)*canvas.height)
        };
    }
    
    // New game
    newGame();    
    // Enter main loop
    looper.start(function(tframe) {
        update(tframe);
        render();
    });
};