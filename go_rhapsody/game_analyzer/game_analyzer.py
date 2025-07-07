import sgfmill.sgf
import sgfmill.boards

class GameAnalyzer:
    def __init__(self, board_size=19):
        self.board_size = board_size
        self.moves_data = []

    def analyze_sgf_game(self, sgf_string):
        try:
            game = sgfmill.sgf.Sgf_game.from_string(sgf_string)
            self.board_size = game.get_size() # Update board size from SGF
            board = sgfmill.boards.Board(self.board_size)
            
            # Initialize moves_data with the initial empty board state
            self.moves_data = [{
                'move_number': 0,
                'player': None,
                'coordinates': None,
                'board_state': self._get_board_state_array(board)
            }]

            for node in game.main_sequence_iter():
                # Apply move if it exists
                if node.has_property('B'):
                    player = 'B'
                    coords = node.get('B')
                    row, col = coords
                    board.play(row, col, 'b')
                elif node.has_property('W'):
                    player = 'W'
                    coords = node.get('W')
                    row, col = coords
                    board.play(row, col, 'w')
                else:
                    # No move in this node, just record the current board state
                    player = None
                    coords = None

                self.moves_data.append({
                    'move_number': len(self.moves_data), # Current move index
                    'player': player,
                    'coordinates': coords, # (row, col) tuple
                    'board_state': self._get_board_state_array(board)
                })
            
            return {
                "board_size": self.board_size,
                "moves": self.moves_data
            }

        except sgfmill.sgf.Sgf_ParseError as e:
            print(f"SGF Parse Error: {e}")
            return None
        except Exception as e:
            print(f"An error occurred during SGF analysis: {e}")
            return None

    def _get_board_state_array(self, board):
        """
        Converts the sgfmill board state to a 2D list (array) representation.
        'empty': 0, 'black': 1, 'white': 2
        """
        board_array = []
        for r in range(self.board_size):
            row_array = []
            for c in range(self.board_size):
                stone = board.get(r, c)
                if stone == 'b':
                    row_array.append(1)  # Black stone
                elif stone == 'w':
                    row_array.append(2)  # White stone
                else:
                    row_array.append(0)  # Empty intersection
            board_array.append(row_array)
        return board_array

# Example Usage (for testing GameAnalyzer independently)
if __name__ == '__main__':
    sample_sgf = """
    (;GM[1]FF[4]CA[UTF-8]AP[sgfmill:1.0.0]SZ[19]KM[6.5]
    PB[BlackPlayer]PW[WhitePlayer]
    ;B[pd]
    ;W[cp]
    ;B[dq]
    )
    """
    analyzer = GameAnalyzer()
    analysis_log = analyzer.analyze_sgf_game(sample_sgf)
    if analysis_log:
        print("Analysis Log:")
        # print(json.dumps(analysis_log, indent=2))
        print(f"Board Size: {analysis_log['board_size']}")
        print(f"Number of moves: {len(analysis_log['moves'])}")
        # You can inspect specific board states:
        # print("Board state after 2nd move:")
        # for row in analysis_log['moves'][2]['board_state']:
        #     print(row)
    else:
        print("SGF analysis failed.")