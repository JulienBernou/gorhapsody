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
