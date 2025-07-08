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



