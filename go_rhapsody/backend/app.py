from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from go_rhapsody.game_analyzer.game_analyzer import GameAnalyzer
import uuid
import sgfmill.sgf
from typing import Any
from go_rhapsody.backend.exceptions import SgfParseError

app = Flask(__name__, static_folder='../static', template_folder='../templates')
CORS(app)

# In-memory store for analysis logs
game_analyses = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload_sgf', methods=['POST'])
def upload_sgf() -> Any:
    sgf_file = request.files.get('sgf_file')
    if not sgf_file or sgf_file.filename == '':
        return jsonify({"error": "No SGF file provided"}), 400

    try:
        sgf_string = sgf_file.read().decode('utf-8')
        game = sgfmill.sgf.Sgf_game.from_string(sgf_string)
        board_size = game.get_size()

        analyzer = GameAnalyzer(board_size=board_size)
        analysis_log = analyzer.analyze_sgf_game(sgf_string)
        if analysis_log is None:
            return jsonify({"error": "Invalid SGF file or analysis failed"}), 400

        game_id = str(uuid.uuid4())
        game_analyses[game_id] = analysis_log

        return jsonify({"message": "SGF uploaded and analyzed successfully", "game_id": game_id}), 200
    except SgfParseError as e:
        return jsonify({"error": f"Failed to parse SGF: {str(e)}"}), 400
    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred during analysis: {str(e)}"}), 500

@app.route('/analysis/<game_id>', methods=['GET'])
def get_analysis(game_id):
    analysis_log = game_analyses.get(game_id)
    if analysis_log is not None:
        return jsonify(analysis_log), 200
    return jsonify({"error": "Game analysis not found"}), 404

if __name__ == '__main__':
    app.run(debug=True)
