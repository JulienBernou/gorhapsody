# Go Rhapsody / Tango

It's a Python Flask web application designed to illustrate Go games from SGF files with dynamic sound and music.

## Core Concept:
The application transforms a Go game into an auditory experience, akin to a song, where each move triggers specific sounds and musical notes.

## Backend (Python):
### Flask Application (app.py): 
Serves as the web server, handling requests and presenting the game in a browser.


### Game Analyzer (game_analyzer.py): 
This script processes SGF game files, extracting move data and relevant Go-specific situations (e.g., atari, capture, hane, extension, life) to inform the sound and rhythm generation.

### Frontend (Web Browser - HTML, CSS, JavaScript):
#### HTML (index.html): 
Provides the main structure of the web page where the Go board and controls are displayed.
#### CSS (style.css, wgo.player.css): 
Styles the application, including the Go board display which seems to leverage wgo.player.css, suggesting the use of WGo.js for board rendering.
#### JavaScript (app.js, music_engine.js, wgo.min.js, wgo.player.min.js):
wgo.min.js and wgo.player.min.js: These are WGo.js library scripts, used for displaying and possibly navigating the Go game on the board.
##### app.js:
Orchestrates the frontend logic, interacting with the backend, controlling the WGo.js player, and triggering the music engine.
##### music_engine.js: 
This is the core of the auditory experience. It uses Tone.js to render sounds and music. It's responsible for:
- Triggering specific sounds/notes for each Go move.
- Varying these sounds based on the game situation (e.g., atari, capture).
- Adjusting the rhythm (playback speed) dynamically from slow to fast, also depending on the game situation.

##### User Interaction: 
The user initiates the "song-like" playback of the Go game by clicking a button.
In essence, Go Rhapsody / Tango generates music from Go games, with Python handling the game data and a sophisticated JavaScript frontend managing the visual and auditory presentation.




## Files and Links
#### App backend
https://github.com/JulienBernou/gorhapsody/blob/main/go_rhapsody/backend/app.py


#### Game analyzer
https://github.com/JulienBernou/gorhapsody/blob/main/go_rhapsody/game_analyzer/game_analyzer.py

#### CSS
https://github.com/JulienBernou/gorhapsody/blob/main/go_rhapsody/static/css/style.css
https://github.com/JulienBernou/gorhapsody/blob/main/go_rhapsody/static/css/wgo.player.css


#### JS app script
https://github.com/JulienBernou/gorhapsody/blob/main/go_rhapsody/static/js/app.js

#### JS music engine
https://github.com/JulienBernou/gorhapsody/blob/main/go_rhapsody/static/js/music_engine.js

#### WGO scripts
https://github.com/JulienBernou/gorhapsody/blob/main/go_rhapsody/static/js/wgo.min.js
https://github.com/JulienBernou/gorhapsody/blob/main/go_rhapsody/static/js/wgo.player.min.js

#### HTML
https://github.com/JulienBernou/gorhapsody/blob/main/go_rhapsody/templates/index.html





## Useful Go knowledge
- **Atari**: A situation where a stone or group of stones is one move away from being captured. The player must respond to avoid losing the stone(s).
- **Capture**: The act of removing an opponent's stone or group of stones from the board by surrounding them completely.
- **Hane**: A move where a stone is placed diagonally adjacent to an opponent's stone, often used to create a strong position or to attack.
- **Extension**: A move that extends a stone or group of stones further along a line, often to strengthen the position or to create a connection.
- **Life**: A situation where a group of stones has two or more "eyes" (empty points surrounded by the group), ensuring that it cannot be captured. A group with life is considered "alive" and cannot be removed from the board.
- **Ko**: A situation where a player can capture a single stone, but doing so would allow the opponent to immediately recapture the same stone, leading to an infinite loop. The rules of Go prevent this by requiring a player to make a different move before returning to the ko position.
- **Sente**: A move that gives the player the initiative, forcing the opponent to respond. It often leads to a favorable position.
- **Gote**: A move that does not give the player the initiative, allowing the opponent to take the initiative instead. It is often a defensive move.
- **Moyo**: A framework or potential territory that a player is building on the board, which can be expanded or contested by the opponent.
- **Tesuji**: A clever or skillful move that takes advantage of the current board position, often leading to a favorable outcome.
- **Joseki**: A sequence of moves that is considered standard or optimal in a specific situation, often leading to a balanced outcome for both players.
- **Fuseki**: The opening phase of the game, where players establish their positions and build frameworks on the board.
- **Endgame**: The final phase of the game, where players focus on maximizing their territory and minimizing their opponent's territory.
- **Seki**: A situation where two groups of stones are alive but cannot capture each other, resulting in a mutual life situation. Both groups have two or more eyes, but they cannot be captured without losing their own life.
- **Aji**: The potential or latent value of a position or move, which may not be immediately apparent but can influence the game later. Aji can refer to the potential for future moves, threats, or opportunities that arise from a particular position on the board.
- **Tsumego**: A problem or puzzle in Go that focuses on finding the best move or sequence of moves to achieve a specific goal, such as capturing stones, creating life, or maximizing territory. Tsumego problems are often used for training and improving one's skills in the game.  


### About hane
https://forums.online-go.com/t/what-is-exactly-a-hane/54037
Some common themes for a hane from the forum include:
- Involving a "diagonal motion across an opponent's stone."
- Often applies to moves around a single opponent's stone or a "stick" (a line of opponent stones).
- Distinction from a "turn" (a solid connection bending around an opponent's stone) or a "wedge" (placing a stone between two opponent stones separated by a one-point jump).


