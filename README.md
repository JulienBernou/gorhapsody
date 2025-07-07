# GoRhapsody: Go & Music Synchronizer

This project aims to create an immersive experience for viewing Go games, synchronizing game events with generative music.

## Project Structure

-   `backend/`: Flask application for API endpoints, SGF parsing, and Go analysis.
-   `static/`: Frontend static assets (CSS, JavaScript).
-   `templates/`: Flask templates (currently just `index.html`).
-   `venv/`: Python virtual environment.
-   `requirements.txt`: Python dependencies.

## Setup Instructions

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/your-username/GoRhapsody.git](https://github.com/your-username/GoRhapsody.git) # Replace with your repo URL
    cd GoRhapsody
    ```

2.  **Create and activate a Python virtual environment:**
    ```bash
    python3 -m venv venv
    source venv/bin/activate # On Windows: .\venv\Scripts\activate
    ```

3.  **Install Python dependencies:**
    ```bash
    poetry install --no-root 
    ```

4.  **Run the Flask backend:**
    
    ```bash
    export FLASK_APP=backend/app.py # On Windows: set FLASK_APP=backend\app.py
    export FLASK_ENV=development # For debug mode
    flask run
    ```
    The server should start on `http://127.0.0.1:5000/`
    
    
5.  **Set up a MIDI Synthesizer/DAW (for music output):**
    The frontend JavaScript (Tone.js) will produce audio directly in the browser, so no external MIDI setup is strictly required for basic functionality. However, if you want to use external MIDI devices or specific software synths, you'd integrate them via your browser's audio/MIDI capabilities or by routing internal audio.

## Usage

1.  Open your web browser and navigate to `http://127.0.0.1:5000/`.
2.  Use the "Upload SGF" button to select a `.sgf` file from your computer.
3.  Once the SGF is uploaded and analyzed (status message will update), the playback controls will become active.
4.  Click "Load & Start Playback" to begin the synchronized Go game and music experience.
5.  Use "Play/Pause", "Prev", "Next", and "Reset" buttons to control the playback.

## Development Notes

-   **Go Analysis (`backend/game_analyzer.py`):** The current `_analyze_nuances_after_move` function in `game_analyzer.py` is a placeholder. You'll need to expand this significantly to detect all the specific Go nuances (connections, cuts, shapes, advanced eye detection, etc.) as per our discussions.
-   **Musical Mappings (`static/js/music_engine.js`):** The `playMusicalCue` function uses very basic Tone.js examples. This is where you'll get creative, mapping the Go nuances from the backend to sophisticated musical ideas, instrument changes, effects, and harmonies.
-   **WGo.js Integration:** The `app.js` is designed to let `WGo.Player` handle the visual board updates and navigation directly using its SGF parsing. Your task is to ensure that for *each* move `WGo.Player` advances to, the corresponding `analysisReport` from your backend is passed to `playMusicalCue`.

---

Now you have a structured project. Your next steps are to:

1.  **Run the Flask app.**
2.  **Test the SGF upload and analysis retrieval.**
3.  **Start expanding the `_analyze_nuances_after_move` function** in `backend/game_analyzer.py` to detect more specific Go nuances.
4.  **Develop the musical responses in `static/js/music_engine.js`** using Tone.js, translating those nuanced analysis reports into compelling audio.

Good luck! This is an exciting project.