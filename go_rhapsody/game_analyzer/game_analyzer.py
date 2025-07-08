import sgfmill.sgf
import sgfmill.boards
from logging import getLogger

class GameAnalyzer:
    def __init__(self, board_size: int = 19):
        self.board_size: int = board_size
        self.analysis_log: list[dict] = []
        self.log = getLogger("Analyzer")

    def _coords_to_sgf_string(self, r: int, c: int) -> str:
        """Converts 0-indexed (row, col) to SGF string coordinates (e.g., (0,0) -> 'aa')."""
        return chr(ord('a') + c) + chr(ord('a') + r)
    
    def analyze_sgf_game(self, sgf_string: str) -> list[dict] | None:
        self.analysis_log = [] # Reset for new game
        
        try:
            game = sgfmill.sgf.Sgf_game.from_string(sgf_string)
            board = sgfmill.boards.Board(self.board_size)
            
            main_sequence = list(game.get_main_sequence())
            for i, node in enumerate(main_sequence[1:], start=1):  # Start from second move
                analysis_report: dict = {}
                analysis_report['move_number'] = i
                
                color_char, coords = node.get_move() 

                analysis_report['player'] = color_char
                
                # IMPORTANT: We need a copy of the board *before* the move to detect captures accurately.
                board_before_move_copy = self._board_to_list(board)
                analysis_report['board_before_move_state'] = board_before_move_copy

                if coords is None: # It's a pass
                    analysis_report['type'] = 'Pass'
                    analysis_report['coords'] = None
                    analysis_report['sgf_coords'] = ''
                else:
                    r, c = coords
                    analysis_report['coords'] = (r, c)
                    analysis_report['sgf_coords'] = self._coords_to_sgf_string(r, c) 

                    try:
                        ko_point = board.play(r, c, color_char) 
                        analysis_report['captured_count'] = 0 # Will be updated by analyze_nuances_after_move
                        analysis_report['type'] = 'Normal Move' # Default, can be overridden

                        if ko_point is not None:
                            analysis_report['ko_detected'] = True

                        if color_char is not None:
                            self.analyze_nuances_after_move(i, r, c, color_char, board, board_before_move_copy, analysis_report)

                    except Exception as e:
                        analysis_report['type'] = 'Illegal Move'
                        analysis_report['reason'] = str(e)

                analysis_report['board_after_move_state'] = self._board_to_list(board)
                
                self.analysis_log.append(analysis_report)
            
        except Exception as e:
            self.log.error(f"Error analyzing SGF: {e}") # Use logger instead of print
            return None # Indicate failure
            
        return self.analysis_log

    def analyze_nuances_after_move(
        self,
        move_number: int,
        r: int,
        c: int,
        player_color_char: str,
        current_board_obj: sgfmill.boards.Board,
        board_before_move_list: list[list[str]], # Added this parameter
        report: dict
    ) -> None:
        """
        Analyze Go move nuances: atari, capture, contact, hane, connection, cut, eyes.
        """
        # sgfmill uses 'b'/'w' for board, 'B'/'W' for SGF, so normalize
        player = player_color_char.lower()
        opponent = 'w' if player == 'b' else 'b'
        board_size = current_board_obj.side

        # --- 1. Self-Atari Detection ---
        report['self_atari'] = False
        group = self.get_group(current_board_obj, (r, c))
        if len(self.get_liberties(current_board_obj, group)) == 1:
            report['self_atari'] = True

        # --- 2. Atari / Atari Threat Detection ---
        report['atari'] = [] # List of opponent groups now in atari (1 liberty)
        report['atari_threats'] = [] # List of opponent groups now with 2 liberties left

        for nr, nc in self._neighbors(r, c, board_size):
            if current_board_obj.get(nr, nc) == opponent:
                opp_group = self.get_group(current_board_obj, (nr, nc))
                liberties = self.get_liberties(current_board_obj, opp_group)
                num_liberties = len(liberties)
                
                if num_liberties == 1:
                    report['atari'].append(tuple(sorted(list(opp_group)))) 
                elif num_liberties == 2:
                    report['atari_threats'].append(tuple(sorted(list(opp_group))))

        # --- 3. Capture Detection ---
        captured_stones = []
        for nr, nc in self._neighbors(r, c, board_size):
            # Check if this neighbor point was an opponent stone *before* the move
            prev_state_stone = None
            if 0 <= nr < board_size and 0 <= nc < board_size:
                char = board_before_move_list[nr][nc]
                if char == 'B': prev_state_stone = 'b'
                elif char == 'W': prev_state_stone = 'w'
                
            # If it was an opponent stone and is now empty, it was captured
            if prev_state_stone == opponent and current_board_obj.get(nr, nc) is None:
                captured_stones.append((nr, nc))
        report['captures'] = captured_stones
        if captured_stones:
            report['type'] = 'Capture'
            report['captured_count'] = len(captured_stones)

        # --- 4. Contact Play Detection ---
        report['is_contact_play'] = any(
            current_board_obj.get(nr, nc) == opponent
            for nr, nc in self._neighbors(r, c, board_size)
        )

        # --- 5. Hane Detection ---
        report['is_hane'] = False
        # A hane must be a contact play.
        if report['is_contact_play']:
            # The played stone (r, c) is a hane if:
            # It's adjacent to an opponent stone (nr_opp, nc_opp)
            # AND the point on the *other side* of (r, c) in the same direction (r - dr_to_opp, c - dc_to_opp)
            # is a friendly stone.
            
            for nr_opp, nc_opp in self._neighbors(r, c, board_size):
                if current_board_obj.get(nr_opp, nc_opp) == opponent:
                    # Found an adjacent opponent stone (nr_opp, nc_opp)
                    
                    # Calculate vector from played stone (r,c) to opponent stone (nr_opp, nc_opp)
                    dr_to_opp = nr_opp - r
                    dc_to_opp = nc_opp - c

                    # Calculate the coordinate on the "other side"
                    nr_other_side = r - dr_to_opp
                    nc_other_side = c - dc_to_opp
                    
                    if (0 <= nr_other_side < board_size and 0 <= nc_other_side < board_size and
                        current_board_obj.get(nr_other_side, nc_other_side) == player):
                        # This confirms the F-P-O straight line pattern, which is a hane.
                        report['is_hane'] = True
                        break # Found a hane, no need to check other opponent neighbors
                if report['is_hane']:
                    break # Found a hane, no need to check other opponent neighbors


        # --- 6. Connection Detection (did this move connect two friendly groups?) ---
        friendly_neighbors = []
        for nr, nc in self._neighbors(r, c, board_size):
            if current_board_obj.get(nr, nc) == player:
                friendly_neighbors.append((nr, nc))
        
        report['connections_made'] = len(friendly_neighbors) > 1

        # --- 7. Cut Detection (did this move cut opponent groups?) ---
        distinct_opp_groups_adjacent = set()
        for nr, nc in self._neighbors(r, c, board_size):
            if current_board_obj.get(nr, nc) == opponent:
                distinct_opp_groups_adjacent.add(frozenset(self.get_group(current_board_obj, (nr, nc))))
        
        report['cuts_made'] = len(distinct_opp_groups_adjacent) > 1

        # --- 8. Eye Creation Detection (did this move create an eye?) ---
        report['eyes_created'] = False
        for nr_empty, nc_empty in self._neighbors(r, c, board_size):
            if current_board_obj.get(nr_empty, nc_empty) is None: # Found an empty neighbor
                is_eye_candidate = True
                for nnr, nnc in self._neighbors(nr_empty, nc_empty, board_size):
                    if (nnr, nnc) == (r, c): # Skip the just played stone itself
                        continue
                    if current_board_obj.get(nnr, nnc) != player:
                        is_eye_candidate = False
                        break
                if is_eye_candidate:
                    report['eyes_created'] = True
                    break 

        # --- 9. Shape Assessment (very basic) ---
        report['shape_assessment'] = {}
        friendly_orthogonal_neighbors_count = 0
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = r + dr, c + dc
            if (0 <= nr < board_size and 0 <= nc < board_size and
                current_board_obj.get(nr, nc) == player):
                friendly_orthogonal_neighbors_count += 1
        
        report['shape_assessment']['forms_corner_like_shape'] = (friendly_orthogonal_neighbors_count >= 2)

        # --- 10. Musical Intensity Mapping ---
        if report.get('self_atari') or report.get('atari'):
            report['musical_intensity'] = 'high_tension'
        elif report.get('type') == 'Capture':
            report['musical_intensity'] = 'percussive_hit'
        elif report.get('is_hane') or report.get('cuts_made'):
            report['musical_intensity'] = 'sharp_accent'
        else:
            report['musical_intensity'] = 'background_pulse'


    def get_group(self, board: sgfmill.boards.Board, pos: tuple[int, int]) -> set[tuple[int, int]]:
        """Finds all stones in the group connected to pos."""
        color = board.get(*pos)
        if color is None:
            return set()
        visited = set()
        stack = [pos]
        board_size = board.side 
        while stack:
            r, c = stack.pop()
            if (r, c) in visited:
                continue
            if board.get(r, c) == color:
                visited.add((r, c))
                for nr, nc in self._neighbors(r, c, board_size):
                    if (nr, nc) not in visited:
                        stack.append((nr, nc))
        return visited

    def _neighbors(self, r: int, c: int, size: int) -> list[tuple[int, int]]:
        """Returns the list of valid neighbor coordinates for a given point."""
        neighbors = []
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = r + dr, c + dc
            if 0 <= nr < size and 0 <= nc < size:
                neighbors.append((nr, nc))
        return neighbors

    def get_liberties(self, board: sgfmill.boards.Board, group: set[tuple[int, int]]) -> set[tuple[int, int]]:
        """Returns the set of liberties (empty adjacent points) for a group."""
        liberties = set()
        board_size = board.side 
        for r, c in group:
            for nr, nc in self._neighbors(r, c, board_size):
                if board.get(nr, nc) is None:
                    liberties.add((nr, nc))
        return liberties

    def _board_to_list(self, board_obj: sgfmill.boards.Board) -> list[list[str]]:
        """Converts an sgfmill board object to a list of lists for JSON serialization."""
        board_list: list[list[str]] = []
        for r in range(board_obj.side):
            row: list[str] = []
            for c in range(board_obj.side):
                stone = board_obj.get(r, c)
                if stone == 'b': row.append('B')
                elif stone == 'w': row.append('W')
                else: row.append('E')
            board_list.append(row)
        return board_list