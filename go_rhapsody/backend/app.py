from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from go_rhapsody.game_analyzer.game_analyzer import GameAnalyzer # Correct import path for package structure
import uuid # For generating unique game IDs
import sgfmill.sgf # To infer board size

app = Flask(__name__, static_folder='../static', template_folder='../templates')
CORS(app) # Enable CORS for development

# Store analysis logs in memory for simplicity.
game_analyses = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload_sgf', methods=['POST'])
def upload_sgf():
    if 'sgf_file' not in request.files:
        return jsonify({"error": "No SGF file part"}), 400
    
    sgf_file = request.files['sgf_file']
    if sgf_file.filename == '':
        return jsonify({"error": "No selected SGF file"}), 400
    
    if sgf_file:
        sgf_string = sgf_file.read().decode('utf-8')
        
        try:
            # Infer board size from SGF
            game = sgfmill.sgf.Sgf_game.from_string(sgf_string)
            board_size = game.get_size()
            
            game_id = str(uuid.uuid4())
            analyzer = GameAnalyzer(board_size=board_size)
            analysis_log = analyzer.analyze_sgf_game(sgf_string)
            
            if analysis_log is None:
                 return jsonify({"error": "Invalid SGF file or analysis failed"}), 400

            game_analyses[game_id] = analysis_log
            
            return jsonify({"message": "SGF uploaded and analyzed successfully", "game_id": game_id}), 200
        except sgfmill.sgf.Sgf_ParseError as e:
            return jsonify({"error": f"Failed to parse SGF: {str(e)}"}), 400
        except Exception as e:
            return jsonify({"error": f"An unexpected error occurred during analysis: {str(e)}"}), 500
            
@app.route('/analysis/<game_id>', methods=['GET'])
def get_analysis(game_id):
    analysis_log = game_analyses.get(game_id)
    if analysis_log:
        return jsonify(analysis_log), 200
    else:
        return jsonify({"error": "Game analysis not found"}), 404

if __name__ == '__main__':
    app.run(debug=True)