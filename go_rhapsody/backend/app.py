import os
import uuid
from flask import Flask, request, jsonify, render_template, url_for
from werkzeug.utils import secure_filename

from .game_analyzer import GameAnalyzer
from .sgf_parser import SGFParser
from .exceptions import SGFParseError

app = Flask(__name__, template_folder='../templates', static_folder='../static')

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'sgf'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Ensure the upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# In-memory storage for game data (game_id -> (moves, board_size))
games = {}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload_sgf', methods=['POST'])
def upload_sgf():
    if 'sgf_file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['sgf_file']

    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        game_id = str(uuid.uuid4())
        
        try:
            sgf_content = file.stream.read().decode("utf-8")
            
            # Parse the SGF content
            parser = SGFParser(sgf_content)
            game_moves = parser.parse()
            board_size = parser.board_size # Get board size from parser
            
            # Store the parsed moves and board size in memory
            games[game_id] = (game_moves, board_size)
            
            return jsonify({"message": "File processed successfully", "game_id": game_id}), 200

        except SGFParseError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

    return jsonify({"error": "File type not allowed"}), 400

@app.route('/analysis/<game_id>', methods=['GET'])
def get_analysis(game_id):
    game_data = games.get(game_id)
    if not game_data:
        return jsonify({"error": "Game not found"}), 404
    
    # Unpack the stored tuple
    game_moves, board_size = game_data
        
    try:
        # Pass the board_size to the analyzer
        analyzer = GameAnalyzer(game_moves, board_size=board_size)
        analysis_report = analyzer.analyze()
        return jsonify(analysis_report), 200
    except Exception as e:
        app.logger.error(f"Analysis failed for game {game_id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to analyze game"}), 500

if __name__ == '__main__':
    app.run(debug=True)