import sgfmill.sgf
import sgfmill.boards
from collections import deque

class GameAnalyzer:
    def __init__(self, board_size=19):
        self.board_size = board_size
        self.analysis_log = []

    def _coords_to_sgf_string(self, r, c):
        """Converts 0-indexed (row, col) to SGF string coordinates (e.g., (0,0) -> 'aa')."""
        # SGF coordinates use 'a' for 0, 'b' for 1, etc.
        # So, row 0 is 'a', col 0 is 'a'.
        # Example: (0,0) is 'aa', (0,1) is 'ab', (1,0) is 'ba'
        return chr(ord('a') + c) + chr(ord('a') + r)
    
    def analyze_sgf_game(self, sgf_string):
        self.analysis_log = [] # Reset for new game
        
        try:
            game = sgfmill.sgf.Sgf_game.from_string(sgf_string)
            board = sgfmill.boards.Board(self.board_size)
            
            for i, node in enumerate(game.get_main_sequence()):
                analysis_report = {}
                analysis_report['move_number'] = i + 1
                
                color_char, coords = node.get_move() 
                analysis_report['player'] = color_char
                
                # Board state before the move (as a list of lists for JSON serialization)
                analysis_report['board_before_move_state'] = self._board_to_list(board)

                if coords is None: # It's a pass
                    analysis_report['type'] = 'Pass'
                    analysis_report['coords'] = None
                    analysis_report['sgf_coords'] = ''
                else:
                    r, c = coords
                    analysis_report['coords'] = (r, c)
                    analysis_report['sgf_coords'] = self._coords_to_sgf_string(r, c) 

                    try:
                        # board.play() returns a potential ko point, not a capture count.
                        ko_point = board.play(r, c, color_char) 
                        
                        # To get captures, you would need to compare board state before and after,
                        # or find a different sgfmill feature. For now, let's just fix the crash.
                        # The 'captured_count' logic needs to be re-evaluated.
                        # For now, let's set it to something neutral, like 0.
                        analysis_report['captured_count'] = 0 # Placeholder! This needs a better solution.
                        analysis_report['type'] = 'Normal Move'

                        # You can still check for a ko
                        if ko_point is not None:
                            analysis_report['ko_detected'] = True

                        # --- Nuance Analysis ---
                        self._analyze_nuances_after_move(r, c, color_char, board, analysis_report)

                    except Exception as e:
                        analysis_report['type'] = 'Illegal Move'
                        analysis_report['reason'] = str(e)

                # Board state after the move (for UI rendering if needed)
                analysis_report['board_after_move_state'] = self._board_to_list(board)
                
                self.analysis_log.append(analysis_report)
            
        except Exception as e:
            print(f"Error analyzing SGF: {e}")
            return None # Indicate failure
            
        return self.analysis_log

    def _analyze_nuances_after_move(self, r, c, player_color_char, current_board_obj, report):
        """
        Placeholder for Go nuance analysis using sgfmill.
        This is where you'll expand on the detailed detections from our previous discussions.
        """
        opponent_color_char = 'W' if player_color_char == 'B' else 'B'
        
        # --- 1. Atari Detection ---
        report['self_atari'] = False
        new_stone_group = current_board_obj.get_group((r, c))
        if current_board_obj.get_liberties_of_group(new_stone_group) == 1:
            report['self_atari'] = True
        
        report['atari_threats'] = []
        for nr, nc in current_board_obj.neighbors((r, c)):
            if current_board_obj.get(nr, nc) == opponent_color_char:
                opp_group = current_board_obj.get_group((nr, nc))
                if current_board_obj.get_liberties_of_group(opp_group) == 1:
                    # Storing just a flag for simplicity now, could store coords
                    report['atari_threats'].append(True) # Simplified for now
                    break # Just need to know if any threat exists for this basic example

        # --- 2. Contact Play ---
        report['is_contact_play'] = False
        for nr, nc in current_board_obj.neighbors((r, c)):
            if current_board_obj.get(nr, nc) == opponent_color_char:
                report['is_contact_play'] = True
                break

        # --- Placeholders for other nuances ---
        report['is_hane'] = False # Implement detailed logic here
        report['connections_made'] = False # Implement detailed logic here
        report['cuts_made'] = False # Implement detailed logic here
        report['shape_assessment'] = {} # Implement detailed logic here
        report['eyes_created'] = False # Implement detailed logic here

        # Example of adding a generic "nuance" for music component
        if report.get('self_atari') or report.get('atari_threats'):
            report['musical_intensity'] = 'high_tension'
        elif report['type'] == 'Capture':
            report['musical_intensity'] = 'percussive_hit'
        else:
            report['musical_intensity'] = 'background_pulse'


    def _board_to_list(self, board_obj):
        """Converts an sgfmill board object to a list of lists for JSON serialization."""
        board_list = []
        for r in range(board_obj.side):
            row = []
            for c in range(board_obj.side):
                stone = board_obj.get(r, c)
                # Map sgfmill's 'b'/'w'/None to 'B'/'W'/'E' for simpler JS handling
                if stone == 'b': row.append('B')
                elif stone == 'w': row.append('W')
                else: row.append('E') # Empty
            board_list.append(row)
        return board_list